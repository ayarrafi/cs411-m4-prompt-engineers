/* Pure scoring/export functions. Q3C and Q5 are always manually graded. */
(function(root){
'use strict';
const VERSION='cs411-m4-v1';
const rubric={q3c:'1 point: identifies closer AND gives a valid justification (pre: 3 → 2.4 toward 0; post: 4 → 2.5 toward 1).',q5:['Gradient determines update direction','Iterative updates','Minimizing the objective is the goal']};
function score(phase,a,manual={}){
  const post=phase==='post';
  const objective={q1:Number(a.q1===(post?'A':'B')),q2:Number(a.q2==='A'),q3a:Number(a.q3a==='B'),q3b:Number(String(a.q3b??'').trim()!=='' && Number.isFinite(Number(a.q3b)) && Math.abs(Number(a.q3b)-(post?2.5:2.4))<1e-6),q4:Number(a.q4===(post?'True':'False'))};
  const q3c=Number.isInteger(manual.q3c)&&manual.q3c>=0&&manual.q3c<=1?manual.q3c:null;
  const q5=Array.isArray(manual.q5)&&manual.q5.length===3&&manual.q5.every(x=>x===0||x===1)?manual.q5:null;
  const objectiveTotal=Object.values(objective).reduce((a,b)=>a+b,0);
  return {objective,objectiveTotal,objectiveMaximum:5,manual:{q3c,q5},manualStatus:q3c!==null&&q5!==null?'complete':'pending',total:q3c!==null&&q5!==null?objectiveTotal+q3c+q5.reduce((a,b)=>a+b,0):null,maximum:9};
}
function gains(pre,post){
  if(!Number.isFinite(pre)||!Number.isFinite(post)||pre<0||post<0||pre>9||post>9) return {raw:null,normalized:null};
  return {raw:post-pre,normalized:pre===9?null:(post-pre)/(9-pre)};
}
function csv(rows){
  if(!rows.length) return '';
  const cols=Object.keys(rows[0]);
  const cell=v=>{ let s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v); if(typeof v==='string' && /^[=+@\-\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };
  return [cols.map(cell).join(','),...rows.map(r=>cols.map(k=>cell(r[k])).join(','))].join('\r\n');
}
function participantRow(d){
  const row={schemaVersion:d.schemaVersion,sessionId:d.sessionId,participantId:d.participantId,condition:d.condition,phase:d.phase,consent:d.consent?.accepted??false,priorExperience:d.answers.pre?.experience??'',learningStatus:d.learningStatus??'not_started',reviewRequired:d.reviewRequired,reviewReasons:d.reviewReasons,externalAssistance:d.feedback?.assistance??''};
  for(const phase of ['pre','post']){
    const s=d.tests[phase]?.score;
    for(const q of ['q1','q2','q3a','q3b','q4']) row[phase+'_'+q]=s?.objective[q]??null;
    row[phase+'_objectiveTotal']=s?.objectiveTotal??null; row[phase+'_manualStatus']=s?.manualStatus??'not_submitted'; row[phase+'_q3c']=s?.manual.q3c??null; row[phase+'_q5']=s?.manual.q5??null; row[phase+'_total']=s?.total??null;
  }
  for(const phase of ['pre','learning','post','feedback']){ const t=d.timing[phase]; row[phase+'_wallSeconds']=t?( (t.endedAt??d.exportedAt)-t.startedAt)/1000:null; row[phase+'_activeEstimateSeconds']=t?(t.activeMs||0)/1000:null; }
  const gain=gains(d.tests.pre?.score.total,d.tests.post?.score.total); row.rawGain=gain.raw;row.normalizedGain=gain.normalized;
  return row;
}
const api={VERSION,rubric,score,gains,csv,participantRow};
if(typeof module!=='undefined') module.exports=api; else root.StudyCore=api;
})(globalThis);
