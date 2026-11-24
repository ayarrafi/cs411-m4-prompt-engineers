import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {generateTutor,tutorConfig,TutorProviderError} from './tutor-provider.mjs';
import {saveSubmission,submissionConfig,SubmissionStoreError} from './submission-store.mjs';
const directory=dirname(fileURLToPath(import.meta.url));
const assets=new Map([['/','gradient-descent-lab.html'],...['gradient-descent-lab.html','lesson.js','math.js','study.js','study-core.js','process-metrics.js','study.css'].map(x=>['/'+x,x])]);
for(const name of ['katex.min.js','katex.min.css','contrib/auto-render.min.js',...(await readdir(join(directory,'vendor/katex/fonts'))).filter(n=>/\.(woff2?|ttf)$/.test(n)).map(n=>'fonts/'+n)]) assets.set('/vendor/katex/'+name,'vendor/katex/'+name);
assets.set('/tutor-math.js','tutor-math.js');
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf'};
const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const MAX_SUBMIT_BYTES=2*1024*1024;
export function createServer({env=process.env,provider=generateTutor,store=saveSubmission}={}){
  const usage=new Map();let concurrent=0;
  let submitWindow=Date.now(),submitCount=0,submitConcurrent=0;
  const allowedTokens=(env.STUDY_AI_TOKENS||'').split(',').filter(Boolean);
  const config=tutorConfig(env);
  const storeCfg=submissionConfig(env);
  const configured=!!(config.apiKey&&config.model&&env.APP_ORIGIN&&allowedTokens.length);
  const submitConfigured=!!(storeCfg.configured&&env.APP_ORIGIN);
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(req.url?.split('?')[0]==='/api/tutor'?{provider:config.providerName,model:config.model||null,available:status===200,...data}:data));};
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(path==='/api/tutor'){
        if(req.method!=='POST'){send(405,{error:'method_not_allowed'});return;}
        if(!configured){send(503,{error:'tutor_not_configured'});return;}
        if(req.headers.origin!==env.APP_ORIGIN){send(403,{error:'origin_not_allowed'});return;}
        if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'json_required'});return;}
        let body='',size=0;
        for await(const chunk of req){size+=chunk.length;if(size>32000){send(413,{error:'request_too_large'});return;}body+=chunk;}
        let data;try{data=JSON.parse(body);}catch{send(400,{error:'invalid_json'});return;}
        const index=allowedTokens.findIndex(x=>same(data?.token,x));if(index<0){send(403,{error:'invalid_study_access_code'});return;}
        if(!data.context||!['explore','theory','missions'].includes(data.context.stage)||!Array.isArray(data.conversation)||data.conversation.length>8){send(400,{error:'invalid_learning_context'});return;}
        const now=Date.now();let u=usage.get(index)||{window:now,count:0,total:0};if(now-u.window>60000){u.window=now;u.count=0;}
        if(u.count>=12||u.total>=250||concurrent>=8){send(429,{error:'request_limit'});return;}
        u.count++;u.total++;usage.set(index,u);concurrent++;
        try{
          const instructions=await readFile(join(directory,'tutor-instructions.txt'),'utf8');
          let tokenUsage=null;
          const text=await provider({context:data.context,conversation:data.conversation,instructions,...config,onUsage:value=>{tokenUsage=value;} });
          send(200,{text,provider:config.providerName,model:config.model,usage:tokenUsage,reasoningEffort:config.reasoningEffort});
        }catch(error){const code=error instanceof TutorProviderError?error.code:'tutor_unavailable';send(code==='provider_rate_limited'?429:502,{error:code,provider:config.providerName,model:config.model});}finally{concurrent--;}
        return;
      }
      if(path==='/api/submit'){
        if(req.method!=='POST'){send(405,{error:'method_not_allowed'});return;}
        if(!submitConfigured){send(503,{error:'submission_not_configured'});return;}
        if(req.headers.origin!==env.APP_ORIGIN){send(403,{error:'origin_not_allowed'});return;}
        if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'json_required'});return;}
        let body='',size=0;
        for await(const chunk of req){size+=chunk.length;if(size>MAX_SUBMIT_BYTES){send(413,{error:'request_too_large'});return;}body+=chunk;}
        let data;try{data=JSON.parse(body);}catch{send(400,{error:'invalid_json'});return;}
        if(!data||typeof data!=='object'||Array.isArray(data)||data.schemaVersion!=='cs411-m4-v1'||typeof data.sessionId!=='string'||!/^[A-Za-z0-9-]{8,64}$/.test(data.sessionId)||typeof data.participantId!=='string'||!/^[A-Za-z0-9_-]{2,40}$/.test(data.participantId)||!['ai','control'].includes(data.condition)||data.phase!=='complete'){
          send(400,{error:'invalid_submission'});return;
        }
        const now=Date.now();if(now-submitWindow>60000){submitWindow=now;submitCount=0;}
        if(submitCount>=20||submitConcurrent>=4){send(429,{error:'request_limit'});return;}
        submitCount++;submitConcurrent++;
        try{
          const {token:_ignored,...clean}=data;
          const receivedAt=new Date().toISOString();
          const result=await store({submission:{...clean,receivedAt},...storeCfg});
          send(200,{ok:true,path:result.path,receivedAt});
        }catch(error){
          const code=error instanceof SubmissionStoreError?error.code:'submission_unavailable';
          send(code==='store_rate_limited'?429:502,{error:code});
        }finally{submitConcurrent--;}
        return;
      }
      const asset=assets.get(path);if(!asset||!['GET','HEAD'].includes(req.method)){send(404,{error:'not_found'});return;}
      const content=await readFile(join(directory,asset));res.writeHead(200,{'Content-Type':mime[asset.split('.').pop()]});res.end(req.method==='HEAD'?undefined:content);
    }catch{if(!res.headersSent)send(500,{error:'server_error'});else res.end();}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1';
  const config=tutorConfig(process.env);
  const storeCfg=submissionConfig(process.env);
  createServer().listen(port,host,()=>{
    console.log(`Gradient Descent Lab listening on http://${host}:${port}`);
    const missing=[!config.apiKey&&(config.providerName==='groq'?'GROQ_API_KEY':'ANTHROPIC_API_KEY'),!config.model&&'TUTOR_MODEL',!process.env.APP_ORIGIN&&'APP_ORIGIN',!process.env.STUDY_AI_TOKENS&&'STUDY_AI_TOKENS'].filter(Boolean);
    console.log(missing.length?`AI unavailable: configure ${missing.join(', ')}`:`AI configured: ${config.providerName} / ${config.model}. Run the tutor smoke test to verify connectivity.`);
    const missingStore=[!storeCfg.bucket&&'FIREBASE_STORAGE_BUCKET',!storeCfg.clientEmail&&'FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_PATH)',!process.env.APP_ORIGIN&&'APP_ORIGIN'].filter(Boolean);
    console.log(missingStore.length?`Submissions unavailable: configure ${missingStore.join(', ')}`:`Submissions configured: Firebase Storage bucket ${storeCfg.bucket} (<condition>/<participantId>.json).`);
  });
}
