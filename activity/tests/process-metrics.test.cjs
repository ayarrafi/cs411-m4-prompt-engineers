const {test}=require('node:test');const assert=require('node:assert/strict');
const {derive}=require('../process-metrics.js');
const base=()=>({condition:'ai',phase:'complete',createdAt:'2026-01-01T00:00:00Z',timing:{pre:{startedAt:0},learning:{activeMs:5000,endedAt:20000},feedback:{endedAt:30000}},tests:{pre:{score:{total:3,manualStatus:'complete',objectiveTotal:2}},post:{score:{total:6,manualStatus:'complete',objectiveTotal:4}}},feedback:{assistance:'No',helped:'The plot helped.'},incompleteSteps:[],events:[]});
function session(details,condition='ai'){const d=base();d.condition=condition;d.events=details.map((e,i)=>({sequence:i,t:new Date(i*1000).toISOString(),phase:'learning',type:'lesson_event',detail:{step:'m1',...e}}));return d;}
const start={ev:'step_start',stage:'missions'};
const run=(out='diverge',cfg={x0:3,lr:1,steps:10},extra={})=>({ev:'mission_run',cfg,observed:out,success:out==='global',prediction:'global',predOK:out==='global',signals:{secondsBeforePredicting:2,runs:1},...extra});
const metric=d=>derive(d).processMetrics;
test('completed AI: deterministic outcomes, denominators, timing, qualitative links, no mutation',()=>{
 const d=session([start,run('diverge',undefined,{reason:'I expect convergence'}),{ev:'help_request',text:'Why?'},{ev:'tutor_request',context:{hintLevel:2}},{ev:'tutor',mode:'ai',text:'Compare steps.',usage:{totalTokens:123}},run('global',{x0:3,lr:.2,steps:10}),{ev:'explanation',text:'Smaller updates worked.'},{ev:'step_start',step:'assess',stage:'assess'}]);
 const before=JSON.stringify(d),r=derive(d),m=r.processMetrics;
 assert.equal(m.preScore,3);assert.equal(m.postScore,6);assert.equal(m.normalizedGain,.5);assert.equal(m.preObjectiveScore,2);
 assert.equal(m.totalStudyTimeSeconds,30);assert.equal(m.activeLearningTimeSeconds,5);assert.equal(m.meanMissionTimeSeconds,7);
 assert.equal(m.missionSuccessCount,1);assert.equal(m.missionAttemptedCount,1);assert.equal(m.missionSuccessRate,1);assert.equal(m.meanAttemptsPerMission,2);
 assert.equal(m.predictionAccuracy,.5);assert.equal(m.maxHintDepth,2);assert.equal(m.aiResponseCount,1);assert.equal(m.helpRequestCount,1);
 assert.equal(m.helpEpisodes,1);assert.equal(m.postHelpImprovementCount,1);assert.equal(m.postHelpImprovementRate,1);
 assert.equal(r.qualitativeSegments.find(x=>x.segmentType==='tutor_response').linkedNextAction.outcome,'global');
 assert.equal(r.qualitativeSegments.find(x=>x.segmentType==='prediction_reason').linkedOutcome.observed,'diverge');
 assert.equal(JSON.stringify(d),before);assert.deepEqual(derive(d),r);
});
test('completed control: hint episodes coalesce, AI rates and hint depth not applicable',()=>{
 const m=metric(session([start,run(),{ev:'hint_reveal',index:0},{ev:'tutor',mode:'predefined',text:'Try again'},run('global',{x0:3,lr:.1,steps:10})],'control'));
 assert.equal(m.predefinedHintOpenCount,1);assert.equal(m.aiResponseCount,0);assert.equal(m.aiFailureRate,null);assert.equal(m.maxHintDepth,null);assert.equal(m.helpEpisodes,1);
});
test('manual pending/incomplete and perfect pretest keep dependent values null',()=>{
 const d=session([start]);d.tests.pre.score={total:null,objectiveTotal:4,manualStatus:'pending'};delete d.tests.post;d.learningStatus='time_limit_incomplete';d.incompleteSteps=['m1','m2'];
 const m=metric(d);assert.equal(m.preScore,null);assert.equal(m.preObjectiveScore,4);assert.equal(m.postScore,null);assert.equal(m.normalizedGain,null);assert.equal(m.needsReview,true);assert.equal(m.timeoutCount,1);assert.equal(m.incompleteStepCount,2);
 const perfect=base();perfect.tests.pre.score.total=9;assert.equal(metric(perfect).normalizedGain,null);
});
test('divergence/oscillation: lower rate succeeds; unchanged or higher does not',()=>{
 for(const out of ['diverge','oscillate'])for(const lr of [.2,1,1.2]){
  const m=metric(session([start,run(out),run('global',{x0:3,lr,steps:10})]));
  assert.equal(m.divergenceOrOscillationOpportunities,1);assert.equal(m.appropriateLearningRateAdjustments,lr<1?1:0);assert.equal(m.appropriateLearningRateAdjustmentRate,lr<1?1:0);
 }
});
test('local minimum: changed starting point is observable proxy; no next attempt remains opportunity',()=>{
 const m=metric(session([start,run('local'),run('global',{x0:-3,lr:1,steps:10})]));assert.equal(m.localMinimumOpportunities,1);assert.equal(m.appropriateStartingPointAdjustments,1);
 const last=metric(session([start,run('local')]));assert.equal(last.localMinimumOpportunities,1);assert.equal(last.appropriateStartingPointAdjustmentRate,0);
});
test('exact repeat includes iteration count; changes between runs, not slider input counts',()=>{
 const m=metric(session([start,run(),{ev:'setting_change',control:'lr',value:.1},run(),run('global',{x0:3,lr:1,steps:20})]));
 assert.equal(m.exactRepeatRunCount,1);assert.equal(m.exactRepeatRunRate,.5);assert.equal(m.learningRateChangeCount,0);assert.equal(m.comparableRunPairCount,2);
});
test('help without improvement, before baseline or without next action',()=>{
 let m=metric(session([start,run(),{ev:'help_request',text:'stuck'},run()]));assert.equal(m.postHelpImprovementCount,0);assert.equal(m.postHelpImprovementRate,0);
 m=metric(session([start,{ev:'help_request',text:'stuck'},run(),{ev:'hint_reveal'}]));assert.equal(m.helpEpisodes,2);assert.equal(m.evaluableHelpEpisodes,0);assert.equal(m.postHelpImprovementRate,null);
});
test('AI unavailable, review flags, refreshes, visibility and assistance',()=>{
 const d=session([start,run(),{ev:'tutor',mode:'unavailable',available:false,error:'provider_rate_limited'}]);d.feedback.assistance='Yes';
 d.events.push({type:'browser_refresh',t:new Date(3000).toISOString()},{type:'visibility',t:new Date(4000).toISOString()});
 const m=metric(d);assert.equal(m.aiFailureCount,1);assert.equal(m.aiFailureRate,1);assert.equal(m.aiUnavailableCount,1);assert.equal(m.browserRefreshCount,1);assert.equal(m.visibilityChangeCount,1);assert.equal(m.hasExternalAssistance,true);assert.equal(m.needsReview,true);
});
test('legacy data: missing arrays, snapshot fallback, no double counting and unknown settings',()=>{
 for(const d of [{},null,{events:[null,{}]},{lesson:{state:{log:[null]}}}])assert.doesNotThrow(()=>JSON.stringify(derive(d)));
 const empty=metric({});assert.equal(empty.totalSimulationRuns,null);assert.equal(empty.predictionAccuracy,null);assert.equal(empty.needsReview,true);
 const d=session([start,run(),run()]);d.lesson={state:{log:d.events.map(e=>({...e.detail,t:e.t}))}};
 assert.equal(metric(d).missionRuns,2);delete d.events;assert.equal(metric(d).missionRuns,2);assert.equal(metric(d).eventSource,'lesson.state.log');
 delete d.lesson.state.log[2].cfg;assert.equal(metric(d).exactRepeatRunCount,null);
});
test('revisions require same variant and evidence; unrelated missions cannot be paired',()=>{
 const d=session([start,run(),run('global',undefined,{prediction:'slow'}),{ev:'variant_change'},run('global',undefined,{prediction:'local'}),{ev:'step_start',step:'m2',stage:'missions'},run('global',undefined,{step:'m2',prediction:'diverge'})]);
 const m=metric(d);assert.equal(m.predictionRevisionCount,1);assert.equal(m.predictionRevisionOpportunities,1);assert.equal(m.predictionRevisionRate,1);
});
test('theory attempts count as simulations; no inferred settings and malformed ordering gives null sequences',()=>{
 const d=session([{...start,stage:'theory',step:'t1'},{ev:'check_answer',step:'t1',prediction:5,correct:4.2,ok:false},{ev:'check_answer',step:'t1',prediction:4.2,correct:4.2,ok:true}]);
 assert.equal(metric(d).totalSimulationRuns,2);assert.equal(metric(d).predictionAccuracy,.5);
 d.events[2].t=d.events[0].t;const m=metric(d);assert.equal(m.predictionRevisionCount,null);assert.equal(m.needsReview,true);
});
test('mission latency excludes stale later-attempt signals and unknown legacy latency',()=>{
 const d=session([start,run(),run('global',undefined,{signals:{runs:2,secondsBeforePredicting:99}})]);
 assert.equal(metric(d).meanPredictionLatencySeconds,2);assert.equal(metric(d).predictionLatencySampleCount,1);
});
test('offline enrichment accepts old JSON and preserves existing fields',()=>{
 const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');const {join}=require('node:path');const {tmpdir}=require('node:os');const {execFileSync}=require('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'metrics-'));
 try{const path=join(dir,'old.json');const d={schemaVersion:'cs411-m4-v1',custom:'preserve',answers:{pre:{q5:'Repeated updates'}}};writeFileSync(path,JSON.stringify(d));
 const result=JSON.parse(execFileSync(process.execPath,[join(__dirname,'../analyze-session.mjs'),path]));assert.equal(result.custom,'preserve');assert.deepEqual(result.answers,d.answers);assert.equal(result.processMetrics.totalSimulationRuns,null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('missing mission identity is unknown, not zero missions; next action retains changed control',()=>{
 const d=session([start,run('global',undefined,{step:null})]);assert.equal(metric(d).missionAttemptedCount,null);assert.equal(metric(d).missionSuccessRate,null);assert.equal(metric(d).meanAttemptsPerMission,null);
 const r=derive(session([start,run(),{ev:'tutor',mode:'ai',text:'Try changing one setting.'},{ev:'setting_change',control:'lr',value:.2}]));
 assert.equal(r.qualitativeSegments[0].linkedNextAction.control,'lr');assert.equal(r.qualitativeSegments[0].linkedNextAction.value,.2);
});
