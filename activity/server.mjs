import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {generateTutor} from './tutor-provider.mjs';
const directory=dirname(fileURLToPath(import.meta.url));
const assets=new Map([['/','gradient-descent-lab.html'],...['gradient-descent-lab.html','lesson.js','math.js','study.js','study-core.js','study.css'].map(x=>['/'+x,x])]);
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
const same=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createServer({env=process.env,provider=generateTutor}={}){
  const usage=new Map();let concurrent=0;
  const allowedTokens=(env.STUDY_AI_TOKENS||'').split(',').filter(Boolean);
  const configured=!!(env.ANTHROPIC_API_KEY&&env.TUTOR_MODEL&&env.APP_ORIGIN&&allowedTokens.length);
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
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
        const index=allowedTokens.findIndex(x=>same(data.token,x));if(index<0){send(403,{error:'invalid_study_access_code'});return;}
        if(!data.context||!['explore','theory','missions'].includes(data.context.stage)||!Array.isArray(data.conversation)||data.conversation.length>8){send(400,{error:'invalid_learning_context'});return;}
        const now=Date.now();let u=usage.get(index)||{window:now,count:0,total:0};if(now-u.window>60000){u.window=now;u.count=0;}
        if(u.count>=12||u.total>=250||concurrent>=8){send(429,{error:'request_limit'});return;}
        u.count++;u.total++;usage.set(index,u);concurrent++;
        try{
          const instructions=await readFile(join(directory,'tutor-instructions.txt'),'utf8');
          const text=await provider({context:data.context,conversation:data.conversation,instructions,apiKey:env.ANTHROPIC_API_KEY,model:env.TUTOR_MODEL});
          send(200,{text});
        }catch{send(502,{error:'tutor_unavailable'});}finally{concurrent--;}
        return;
      }
      const asset=assets.get(path);if(!asset||!['GET','HEAD'].includes(req.method)){send(404,{error:'not_found'});return;}
      const content=await readFile(join(directory,asset));res.writeHead(200,{'Content-Type':mime[asset.split('.').pop()]});res.end(req.method==='HEAD'?undefined:content);
    }catch{if(!res.headersSent)send(500,{error:'server_error'});else res.end();}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1';
  createServer().listen(port,host,()=>console.log(`Gradient Descent Lab listening on http://${host}:${port}`));
}
