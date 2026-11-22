import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from '../server.mjs';import {generateTutor} from '../tutor-provider.mjs';import {saveSubmission,submissionConfig,SubmissionStoreError} from '../submission-store.mjs';
test('relay guards, provider contract, static allowlist, errors',async()=>{
  let calls=0;const server=createServer({env:{APP_ORIGIN:'http://study.test',ANTHROPIC_API_KEY:'test-only',TUTOR_MODEL:'test-model',STUDY_AI_TOKENS:'test-code'},provider:async()=>{calls++;return 'Compare two learning rates.';}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  const post=(data,origin='http://study.test')=>fetch(url+'/api/tutor',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
  try{
    assert.equal((await fetch(url+'/server.mjs')).status,404);assert.equal((await fetch(url+'/tutor-instructions.txt')).status,404);assert.equal((await fetch(url+'/')).status,200);
    assert.equal((await post({})).status,403);assert.equal((await post({token:'test-code'},'https://other.test')).status,403);
    for(const stage of ['pre','post','assess'])assert.equal((await post({token:'test-code',context:{stage},conversation:[]})).status,400);
    const response=await post({token:'test-code',context:{stage:'theory'},conversation:[]});assert.equal(response.status,200);assert.equal((await response.json()).text,'Compare two learning rates.');assert.equal(calls,1);
    for(let i=0;i<11;i++)await post({token:'test-code',context:{stage:'explore'},conversation:[]});
    assert.equal((await post({token:'test-code',context:{stage:'explore'},conversation:[]})).status,429);
  }finally{await new Promise(r=>server.close(r));}
});
test('provider adapter sends server-side instructions and extracts text',async()=>{
  const text=await generateTutor({context:{stage:'explore'},conversation:[],instructions:'tutor rules',apiKey:'test-key',model:'test-model',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(options.headers['x-api-key'],'test-key');assert.equal(JSON.parse(options.body).system,'tutor rules');return {ok:true,json:async()=>({content:[{type:'text',text:'A question?'}]})};
  }});assert.equal(text,'A question?');
});
test('unconfigured service and upstream failures are explicit, never fixed hints',async()=>{
  for(const configured of [false,true]){
    const env=configured?{APP_ORIGIN:'http://study.test',ANTHROPIC_API_KEY:'test',TUTOR_MODEL:'test',STUDY_AI_TOKENS:'code'}:{};
    const server=createServer({env,provider:async()=>{throw new Error('provider offline');}});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    try{
      const r=await fetch(`http://127.0.0.1:${server.address().port}/api/tutor`,{method:'POST',headers:{Origin:'http://study.test','Content-Type':'application/json'},body:JSON.stringify({token:'code',context:{stage:'explore'},conversation:[]})});
      assert.equal(r.status,configured?502:503);assert.equal((await r.json()).text,undefined);
    }finally{await new Promise(r=>server.close(r));}
  }
});
test('Groq adapter sends context with server key and returns only the final answer',async()=>{
  const text=await generateTutor({providerName:'groq',context:{stage:'missions',hintLevel:1},conversation:[{role:'user',content:'Help'}],instructions:'tutor rules',apiKey:'private-test-key',model:'qwen/qwen3.8-27b',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer private-test-key');
    const body=JSON.parse(options.body);assert.equal(body.reasoning_format,'hidden');assert.equal(body.messages[0].content,'tutor rules');assert.equal(JSON.parse(body.messages[1].content).context.hintLevel,1);assert.ok(!options.body.includes('private-test-key'));
    return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'What does the plot show?',reasoning:'Not student-facing'}}]})};
  }});assert.equal(text,'What does the plot show?');
});
test('Groq failures are sanitized and incomplete/empty responses rejected',async()=>{
  const base={providerName:'groq',context:{stage:'theory'},conversation:[],instructions:'rules',apiKey:'secret',model:'qwen/qwen3.8-27b'};
  for(const [status,code] of [[429,'provider_rate_limited'],[401,'provider_auth_error'],[404,'provider_configuration_error'],[500,'provider_error']]){
    await assert.rejects(generateTutor({...base,fetchImpl:async()=>({ok:false,status,json:()=>{throw new Error('must not read provider error body');}})}),e=>e.code===code);
  }
  for(const choice of [{message:{content:''}},{finish_reason:'length',message:{content:'Partial answer'}},{message:{content:'<think>reasoning</think>Answer'}}]){
    await assert.rejects(generateTutor({...base,fetchImpl:async()=>({ok:true,json:async()=>({choices:[choice]})})}));
  }
});
test('Groq-only configuration works; credentials are not served; rate limits remain explicit',async()=>{
  const server=createServer({env:{TUTOR_PROVIDER:'groq',GROQ_API_KEY:'private-key',TUTOR_MODEL:'qwen/qwen3.8-27b',APP_ORIGIN:'http://study.test',STUDY_AI_TOKENS:'code'},provider:async args=>{
    assert.equal(args.providerName,'groq');assert.equal(args.apiKey,'private-key');return 'Compare the first step.';
  }});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
  try{
    for(const file of ['.env','.env.example','tutor-provider.mjs','test-tutor.mjs'])assert.equal((await fetch(url+'/'+file)).status,404);
    const r=await fetch(url+'/api/tutor',{method:'POST',headers:{Origin:'http://study.test','Content-Type':'application/json'},body:JSON.stringify({token:'code',context:{stage:'theory'},conversation:[]})});
    assert.equal(r.status,200);const data=await r.json();assert.equal(data.text,'Compare the first step.');assert.equal(data.provider,'groq');assert.equal(data.model,'qwen/qwen3.8-27b');assert.equal(data.available,true);assert.equal(data.reasoningEffort,'none');
  }finally{await new Promise(r=>server.close(r));}
  assert.throws(()=>createServer({env:{TUTOR_PROVIDER:'typo'}}),/TUTOR_PROVIDER/);
});
test('submission store config validation, GitHub Contents PUT, idempotent retry, error sanitization',async()=>{
  assert.throws(()=>submissionConfig({GITHUB_DATA_REPO:'not-a-repo'}),/GITHUB_DATA_REPO/);
  assert.throws(()=>submissionConfig({GITHUB_DATA_REPO:'org/data',GITHUB_DATA_PATH:'../escape'}),/GITHUB_DATA_PATH/);
  const cfg=submissionConfig({GITHUB_DATA_REPO:'org/study-data',GITHUB_DATA_TOKEN:'ghp_secret',GITHUB_DATA_BRANCH:'main',GITHUB_DATA_PATH:'/results/'});
  assert.equal(cfg.configured,true);assert.equal(cfg.pathPrefix,'results');

  const calls=[];
  const sample={schemaVersion:'cs411-m4-v1',sessionId:'12345678-abcd-ef01-2345-67890abcdef0',participantId:'P01',condition:'control',phase:'complete'};
  const saved=await saveSubmission({submission:sample,...cfg,fetchImpl:async(url,options)=>{
    calls.push({url,method:options.method,body:options.body,auth:options.headers.Authorization});
    return {ok:true,status:201,json:async()=>({commit:{sha:'abc123'}})};
  }});
  assert.equal(saved.path,'results/P01-12345678.json');assert.equal(saved.commitSha,'abc123');
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.github.com/repos/org/study-data/contents/results/P01-12345678.json');
  assert.equal(calls[0].auth,'Bearer ghp_secret');assert.ok(!calls[0].body.includes('ghp_secret'));
  const decoded=JSON.parse(Buffer.from(JSON.parse(calls[0].body).content,'base64').toString('utf8'));
  assert.equal(decoded.participantId,'P01');

  // Idempotent retry: 422 on initial PUT -> GET existing sha -> PUT with sha succeeds.
  let step=0;
  const retried=await saveSubmission({submission:sample,...cfg,fetchImpl:async(url,options)=>{
    step++;
    if(step===1){assert.equal(options.method,'PUT');return {ok:false,status:422};}
    if(step===2){assert.equal(options.method,'GET');assert.ok(url.endsWith('?ref=main'));return {ok:true,status:200,json:async()=>({sha:'existing-sha'})};}
    assert.equal(options.method,'PUT');assert.equal(JSON.parse(options.body).sha,'existing-sha');
    return {ok:true,status:200,json:async()=>({commit:{sha:'def456'}})};
  }});
  assert.equal(retried.commitSha,'def456');assert.equal(step,3);

  for(const [status,code] of [[401,'store_auth_error'],[403,'store_auth_error'],[404,'store_repo_error'],[429,'store_rate_limited'],[500,'store_error']]){
    await assert.rejects(saveSubmission({submission:sample,...cfg,fetchImpl:async()=>({ok:false,status})}),e=>e instanceof SubmissionStoreError&&e.code===code);
  }
});
test('/api/submit guards, works without AI tokens, strips token, blocks server files',async()=>{
  const stored=[];
  const server=createServer({
    env:{APP_ORIGIN:'http://study.test',GITHUB_DATA_REPO:'org/study-data',GITHUB_DATA_TOKEN:'ghp_test'},
    store:async({submission,repo})=>{stored.push({submission,repo});return {path:'submissions/P01-12345678.json',commitSha:'sha1'};}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const valid={schemaVersion:'cs411-m4-v1',sessionId:'12345678-abcd-ef01-2345-67890abcdef0',participantId:'P01',condition:'control',phase:'complete',token:'should-be-stripped'};
  const post=(body,origin='http://study.test')=>fetch(url+'/api/submit',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  try{
    for(const file of ['submission-store.mjs','export-csv.mjs'])assert.equal((await fetch(url+'/'+file)).status,404);
    assert.equal((await fetch(url+'/api/submit')).status,405);
    assert.equal((await post(valid,'https://evil.test')).status,403);
    assert.equal((await post({...valid,phase:'learning'})).status,400);
    assert.equal((await post({...valid,participantId:'../bad'})).status,400);
    const res=await post(valid);
    assert.equal(res.status,200);
    const json=await res.json();assert.equal(json.ok,true);assert.equal(json.path,'submissions/P01-12345678.json');assert.ok(json.receivedAt);
    assert.equal(stored.length,1);assert.equal(stored[0].repo,'org/study-data');assert.equal(stored[0].submission.token,undefined);assert.equal(stored[0].submission.receivedAt,json.receivedAt);
  }finally{await new Promise(r=>server.close(r));}

  // Unconfigured submission store returns 503 explicitly.
  const unconf=createServer({env:{APP_ORIGIN:'http://study.test'}});
  await new Promise(r=>unconf.listen(0,'127.0.0.1',r));
  try{
    const r=await fetch(`http://127.0.0.1:${unconf.address().port}/api/submit`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://study.test'},body:JSON.stringify(valid)});
    assert.equal(r.status,503);assert.equal((await r.json()).error,'submission_not_configured');
  }finally{await new Promise(r=>unconf.close(r));}
});
