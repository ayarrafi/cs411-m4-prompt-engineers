/* Pure, deterministic analysis. No UI, network, raw-event mutation or subjective coding. */
(function(root){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const time=v=>finite(v)?v:typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const ratio=(a,b)=>finite(a)&&finite(b)&&b>0?a/b:null;
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=a=>{const b=[...a].sort((x,y)=>x-y),n=b.length;return n?(b[(n-1)>>1]+b[n>>1])/2:null;};
const isAttempt=e=>['explore_run','check_answer','mission_run'].includes(e.ev);
const predOK=e=>e.ev==='check_answer'?e.ok:e.predOK;
const outcome=e=>e.observed??(e.ev==='check_answer'?e.correct:null);
const present=v=>v!==undefined&&v!==null;
function derive(session){
 const d=session&&typeof session==='object'?session:{};
 const issues=[],notes=[];
 const outer=Array.isArray(d.events)?d.events:null;
 const fallback=Array.isArray(d.lesson?.state?.log)?d.lesson.state.log:null;
 const primary=outer?.filter(e=>e?.type==='lesson_event');
 // Never merge these sources: current submissions contain two copies of lesson events.
 const source=primary?.length?'events':fallback?.length?'lesson.state.log':outer?'events':fallback?'lesson.state.log':null;
 const raw=source==='events'?primary:source==='lesson.state.log'?fallback:null;
 const known=raw!==null;
 const rows=[];let lastTime=null,lastSequence=null,ordered=true;
 for(const entry of source==='events'?outer||[]:raw||[]){
  if(!entry||typeof entry!=='object'){issues.push('malformed_event');ordered=false;continue;}
  const t=time(entry.t);
  if(t===null){issues.push('missing_event_timestamp');ordered=false;}
  if(t!==null&&lastTime!==null&&t<lastTime){issues.push('nonchronological_events');ordered=false;}
  if(t!==null)lastTime=t;
  if(finite(entry.sequence)){if(lastSequence!==null&&entry.sequence<=lastSequence){issues.push('nonmonotonic_sequence');ordered=false;}lastSequence=entry.sequence;}
  if(source==='events'&&entry.type!=='lesson_event')continue;
  const e=source==='events'?entry.detail:entry;
  if(!e||typeof e.ev!=='string'){issues.push('malformed_lesson_event');ordered=false;continue;}
  rows.push({...e,t:entry.t??e.t,phase:entry.phase??'learning'});
 }
 if(!known||!rows.length)issues.push('missing_lesson_events');
 const count=fn=>known?rows.filter(fn).length:null;
 const ev=name=>count(e=>e.ev===name);
 const attempts=rows.filter(isAttempt),missions=attempts.filter(e=>e.ev==='mission_run');
 if(attempts.some(e=>typeof e.step!=='string'))issues.push('missing_task_identifier');
 if(attempts.some(e=>!rows.some(s=>s.ev==='step_start'&&s.step===e.step)))issues.push('missing_step_start');
 if(d.phase==='complete'&&!attempts.length)issues.push('missing_attempt_events');
 const ids=new Set(missions.filter(e=>typeof e.step==='string').map(e=>e.step));
 const missionIdsKnown=missions.every(e=>typeof e.step==='string');
 const successKnown=missionIdsKnown&&missions.every(e=>typeof e.success==='boolean');
 const successes=new Set(missions.filter(e=>e.success===true&&typeof e.step==='string').map(e=>e.step));
 const score=phase=>{const s=d.tests?.[phase]?.score;return s&&s.manualStatus!=='pending'&&finite(s.total)&&s.total>=0&&s.total<=9?s.total:null;};
 const pre=score('pre'),post=score('post');
 const active=d.timing?.learning?.activeMs;
 const start=time(d.timing?.pre?.startedAt)??time(d.createdAt);
 const end=time(d.timing?.feedback?.endedAt)??time(outer?.find(e=>e?.type==='feedback_finalized')?.t);
 const predictions=attempts.filter(e=>['check_answer','mission_run'].includes(e.ev)&&present(e.prediction));
 const correctnessKnown=predictions.every(e=>typeof predOK(e)==='boolean');
 // Current mission UI does not reset firstPredAt after each run. Only first-run
 // mission latencies are independent measurements; theory retries reset it.
 const latencies=predictions.filter(e=>e.ev==='check_answer'||e.signals?.runs===1).map(e=>e.signals?.secondsBeforePredicting).filter(v=>finite(v)&&v>=0);
 const ai=rows.filter(e=>e.ev==='tutor'&&e.mode==='ai');
 const failed=rows.filter(e=>e.ev==='tutor'&&e.mode==='unavailable');
 const depths=rows.filter(e=>e.ev==='tutor_request').map(e=>e.context?.hintLevel).filter(v=>finite(v)&&v>=0);
 const control=d.condition==='control';
 const m={
  metricsVersion:'1.0.0',eventSource:source,
  preScore:pre,postScore:post,normalizedGain:pre!==null&&post!==null&&pre!==9?(post-pre)/(9-pre):null,
  preObjectiveScore:finite(d.tests?.pre?.score?.objectiveTotal)?d.tests.pre.score.objectiveTotal:null,
  postObjectiveScore:finite(d.tests?.post?.score?.objectiveTotal)?d.tests.post.score.objectiveTotal:null,
  transferScore:finite(d.lesson?.state?.results?.assess?.score)?d.lesson.state.results.assess.score:null,
  activeLearningTimeSeconds:finite(active)&&active>=0?active/1000:null,
  totalStudyTimeSeconds:start!==null&&end!==null&&end>=start?(end-start)/1000:null,
  meanMissionTimeSeconds:null,medianMissionTimeSeconds:null,
  totalSimulationRuns:known?attempts.length:null,explorationRuns:ev('explore_run'),missionRuns:ev('mission_run'),
  totalMissionAttempts:ev('mission_run'),meanAttemptsPerMission:missionIdsKnown?ratio(ev('mission_run'),ids.size):null,
  missionSuccessCount:known&&successKnown?successes.size:null,missionAttemptedCount:known&&missionIdsKnown?ids.size:null,
  missionSuccessRate:known&&successKnown?ratio(successes.size,ids.size):null,
  predictionCount:known?predictions.length:null,correctPredictionCount:known&&correctnessKnown?predictions.filter(e=>predOK(e)).length:null,
  predictionAccuracy:known&&correctnessKnown?ratio(predictions.filter(e=>predOK(e)).length,predictions.length):null,
  meanPredictionLatencySeconds:mean(latencies),predictionLatencySampleCount:known?latencies.length:null,
  predictionRevisionCount:null,predictionRevisionRate:null,predictionRevisionOpportunities:null,
  learningRateChangeCount:null,startingPointChangeCount:null,exactRepeatRunCount:null,exactRepeatRunRate:null,comparableRunPairCount:null,
  divergenceOrOscillationOpportunities:null,appropriateLearningRateAdjustments:null,appropriateLearningRateAdjustmentRate:null,
  localMinimumOpportunities:null,appropriateStartingPointAdjustments:null,appropriateStartingPointAdjustmentRate:null,
  helpRequestCount:ev('help_request'),helpRequestsPerMission:null,
  studentChatMessageCount:count(e=>e.ev==='student_msg'||(e.ev==='help_request'&&typeof e.text==='string'&&!['stuck','hint'].includes(e.text))),
  predefinedHintOpenCount:ev('hint_reveal'),aiResponseCount:known?ai.length:null,aiFailureCount:known?failed.length:null,
  aiFailureRate:known?ratio(failed.length,ai.length+failed.length):null,
  maxHintDepth:control?null:depths.length?Math.max(...depths):null,meanHintDepth:control?null:mean(depths),
  helpEpisodes:null,postHelpImprovementCount:null,postHelpImprovementRate:null,evaluableHelpEpisodes:null,
  browserRefreshCount:outer?outer.filter(e=>e?.type==='browser_refresh').length:null,
  visibilityChangeCount:outer?outer.filter(e=>e?.type==='visibility').length:null,
  // Session expiry only; provider/network timeouts belong in AI failures.
  timeoutCount:d.learningStatus==='time_limit_incomplete'?1:outer?outer.filter(e=>e?.type==='learning_end'&&e.status==='time_limit_incomplete').length:null,
  incompleteStepCount:Array.isArray(d.incompleteSteps)?d.incompleteSteps.length:null,
  aiUnavailableCount:known?failed.length:null,
  hasExternalAssistance:d.feedback?.assistance==='Yes'?true:d.feedback?.assistance==='No'?false:null,
  needsReview:false,dataQualityIssues:[],derivationNotes:notes
 };
 notes.push('Prediction latency uses theory attempts and first mission attempts only; later mission timestamps may be stale.');
 if(m.transferScore===null){const a=rows.findLast(e=>e.ev==='assessment'&&finite(e.score));if(a)m.transferScore=a.score;}
 m.helpRequestsPerMission=known&&missionIdsKnown?ratio(rows.filter(e=>e.ev==='help_request'&&ids.has(e.step)).length,ids.size):null;
 // Separate task variants: a changed question is not a revised prediction on the same task.
 const epochs=new Map(),groups=new Map();
 for(const e of rows){
  if(typeof e.step!=='string')continue;
  if(['variant_change','step_start'].includes(e.ev))epochs.set(e.step,(epochs.get(e.step)||0)+1);
  const key=e.step+':'+(epochs.get(e.step)||0);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);
 }
 const fullCfg=e=>e.cfg&&['x0','lr','steps'].every(k=>finite(e.cfg[k]));
 const adjustment=(a,b)=>{
  if(['diverge','oscillate'].includes(outcome(a)))return finite(a.cfg?.lr)&&finite(b.cfg?.lr)?b.cfg.lr<a.cfg.lr:null;
  // Observable changed-start proxy only; do not claim intent or that the basin changed.
  if(a.ev==='mission_run'&&outcome(a)==='local')return finite(a.cfg?.x0)&&finite(b.cfg?.x0)?b.cfg.x0!==a.cfg.x0:null;
  return false;
 };
 if(known&&ordered&&!attempts.some(e=>typeof e.step!=='string')){
  let revisions=0,revisionPairs=0,lr=0,x0=0,repeats=0,pairs=0,div=0,lower=0,local=0,changed=0,episodes=0,evaluable=0,improved=0;
  let cfgMissing=false,lrMissing=false,xMissing=false;
  for(const list of groups.values()){
   const runs=list.filter(isAttempt);
   for(let i=0;i<runs.length;i++){
    const a=runs[i],b=runs[i+1];
    if(['diverge','oscillate'].includes(outcome(a))){div++;if(b){const v=adjustment(a,b);if(v===null)lrMissing=true;else if(v)lower++;}}
    if(a.ev==='mission_run'&&outcome(a)==='local'){local++;if(b){const v=adjustment(a,b);if(v===null)xMissing=true;else if(v)changed++;}}
    if(!b)continue;
    if(present(a.prediction)&&present(b.prediction)){revisionPairs++;if(a.prediction!==b.prediction)revisions++;}
    // Theory events lack cfg: exclude them rather than assuming slider state.
    if(a.ev==='check_answer'||b.ev==='check_answer')continue;
    if(!fullCfg(a)||!fullCfg(b)){cfgMissing=true;continue;}
    pairs++;if(a.cfg.lr!==b.cfg.lr)lr++;if(a.cfg.x0!==b.cfg.x0)x0++;
    if(['lr','x0','steps'].every(k=>a.cfg[k]===b.cfg[k]))repeats++;
   }
   let baseline=null,pending=false;
   for(const e of list){
    const help=['help_request','hint_reveal','student_msg'].includes(e.ev)||(e.ev==='tutor'&&['ai','predefined'].includes(e.mode));
    if(help&&!pending){pending=true;episodes++;}
    if(isAttempt(e)){
     if(pending&&baseline){
      const predComparable=typeof predOK(baseline)==='boolean'&&typeof predOK(e)==='boolean';
      const successComparable=typeof baseline.success==='boolean'&&typeof e.success==='boolean';
      const relevant=['diverge','oscillate','local'].includes(outcome(baseline));const adj=adjustment(baseline,e);
      if(predComparable||successComparable||(relevant&&adj!==null)){
       evaluable++;
       if((predComparable&&predOK(baseline)===false&&predOK(e)===true)||(successComparable&&!baseline.success&&e.success)||(relevant&&adj===true))improved++;
      }
     }
     pending=false;baseline=e;
    }
   }
  }
  Object.assign(m,{predictionRevisionCount:revisions,predictionRevisionOpportunities:revisionPairs,predictionRevisionRate:ratio(revisions,revisionPairs),
   learningRateChangeCount:cfgMissing?null:lr,startingPointChangeCount:cfgMissing?null:x0,exactRepeatRunCount:cfgMissing?null:repeats,exactRepeatRunRate:cfgMissing?null:ratio(repeats,pairs),comparableRunPairCount:pairs,
   divergenceOrOscillationOpportunities:div,appropriateLearningRateAdjustments:lrMissing?null:lower,appropriateLearningRateAdjustmentRate:lrMissing?null:ratio(lower,div),
   localMinimumOpportunities:local,appropriateStartingPointAdjustments:xMissing?null:changed,appropriateStartingPointAdjustmentRate:xMissing?null:ratio(changed,local),
   helpEpisodes:episodes,evaluableHelpEpisodes:evaluable,postHelpImprovementCount:improved,postHelpImprovementRate:ratio(improved,evaluable)});
  if(cfgMissing||lrMissing||xMissing)notes.push('Some run settings are missing; affected adjustment metrics are null.');
 }
 // Mission residence time: entry to next step or explicit learning end, including time away.
 const durations=[];
 if(ordered){
  const starts=rows.filter(e=>e.ev==='step_start');
  for(let i=0;i<starts.length;i++){
   const a=starts[i];if(a.stage!=='missions')continue;
   const b=starts[i+1];const from=time(a.t),to=b?time(b.t):time(d.timing?.learning?.endedAt)??time(outer?.find(e=>e?.type==='learning_end')?.t);
   if(from!==null&&to!==null&&to>=from)durations.push((to-from)/1000);
  }
 }
 m.meanMissionTimeSeconds=mean(durations);m.medianMissionTimeSeconds=median(durations);m.missionTimeSampleCount=durations.length;
 if(!d.tests?.pre||!d.tests?.post)issues.push('incomplete_assessment');
 if(pre===null||post===null)notes.push('Final scores/gain unavailable until complete valid manual grading.');
 if(m.timeoutCount>0)issues.push('learning_timeout');
 if(m.incompleteStepCount>0)issues.push('incomplete_steps');
 if(failed.length)issues.push('ai_unavailable');
 if(m.hasExternalAssistance===true)issues.push('external_assistance');
 if(!correctnessKnown)issues.push('missing_prediction_correctness');
 m.dataQualityIssues=[...new Set(issues)];m.needsReview=!!d.reviewRequired||issues.length>0;
 const segments=[];
 const action=e=>e?{event:e.ev,timestamp:e.t??null,missionId:e.step??null,settings:e.cfg??null,control:e.control??null,value:e.value??null,prediction:e.prediction??null,outcome:outcome(e)}:null;
 const add=(type,text,e,linked,next,context={})=>{if(typeof text==='string'&&text.trim())segments.push({segmentType:type,text,timestamp:e.t??null,phase:e.phase??null,missionId:e.step??null,context,linkedOutcome:linked,linkedNextAction:next});};
 for(const list of groups.values())for(let i=0;i<list.length;i++){
  const e=list[i],previous=list.slice(0,i+1).findLast(isAttempt),next=ordered?list.slice(i+1).find(x=>isAttempt(x)||x.ev==='setting_change'):null;
  const context={event:e.ev,condition:d.condition??null,settings:e.cfg??previous?.cfg??null,kind:e.kind??null,mode:e.mode??null};
  const linked=ordered&&previous?{observed:outcome(previous),predictionCorrect:predOK(previous)??null,success:previous.success??null,timestamp:previous.t??null}:null;
  if(isAttempt(e))add('prediction_reason',e.reason,e,linked,action(next),context);
  if(e.ev==='assessment')add('transfer_explanation',e.q3Explanation,e,linked,action(next),context);
  if(e.ev==='explanation')add('written_explanation',e.text,e,linked,action(next),context);
  if(e.ev==='student_msg'||(e.ev==='help_request'&&!['stuck','hint'].includes(e.text)))add('student_chat_message',e.text,e,linked,action(next),context);
  if(e.ev==='tutor')add('tutor_response',e.text,e,linked,action(next),context);
 }
 const feedbackTime=outer?.find(e=>e?.type==='feedback_finalized')?.t??null;
 for(const key of ['helped','difficult','decision','other','assistanceExplanation'])add('questionnaire_free_text',d.feedback?.[key],{t:feedbackTime,phase:'feedback'},null,null,{question:key});
 // Assessment free text is for human coding only, never included in tutor context.
 for(const phase of ['pre','post'])for(const key of ['q3c','q5','q1notes','q2notes','q3notes','q4notes'])add('assessment_free_text',d.tests?.[phase]?.answers?.[key]??d.answers?.[phase]?.[key],{t:d.tests?.[phase]?.submittedAt??null,phase},null,null,{question:key});
 return {processMetrics:m,qualitativeSegments:segments};
}
const api={derive};if(typeof module!=='undefined')module.exports=api;else root.ProcessMetrics=api;
})(globalThis);
