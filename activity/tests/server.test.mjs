import {test} from 'node:test';import assert from 'node:assert/strict';import {createServer} from '../server.mjs';import {generateTutor} from '../tutor-provider.mjs';
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
