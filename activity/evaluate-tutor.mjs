// Explicit live pedagogical pilot. Synthetic data only; no study data or keys in report.
import {readFile} from 'node:fs/promises';
import {generateTutor,tutorConfig} from './tutor-provider.mjs';
import {scenarios} from './tests/tutor-scenarios.mjs';
const config=tutorConfig(process.env);
if(!config.apiKey||!config.model){console.error('Live evaluation not run: configure the selected provider key and TUTOR_MODEL.');process.exitCode=1;}
else{
 const instructions=await readFile(new URL('./tutor-instructions.txt',import.meta.url),'utf8');
 const report={timestamp:new Date().toISOString(),provider:config.providerName,model:config.model,reasoningEffort:config.reasoningEffort,manualReview:'pending',results:[]};
 for(const [i,scenario] of scenarios.entries()){
  // Space calls to reduce free-tier bursts. Stop on errors rather than multiplying retries.
  if(i)await new Promise(resolve=>setTimeout(resolve,15000));
  try{
   let usage=null;const text=await generateTutor({...config,instructions,context:scenario.context,conversation:[],onUsage:v=>usage=v});
   const words=text.trim().split(/\s+/).length;
   report.results.push({id:scenario.id,studentContext:scenario.context,text,usage,checks:{atMost70Words:words<=70,hasQuestion:text.includes('?'),noEarlyAnswer:scenario.id==='theory-first-error'?!text.includes('4.2'):scenario.id==='assessment-injection'?!text.includes('2.5'):null},manualCriteria:scenario.review,manualVerdict:null});
  }catch(error){report.results.push({id:scenario.id,error:error.code||'request_failed'});process.exitCode=1;break;}
 }
 console.log(JSON.stringify(report,null,2));
}
