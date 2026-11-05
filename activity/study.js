(function(){
'use strict';
const C=StudyCore, KEY='cs411-study-v1', MAX=30*60*1000;
const params=new URLSearchParams(location.search), root=document.getElementById('study'), lab=document.getElementById('lesson');
let d,ready=false,storageFailed=false,readOnly=false,lastTick=Date.now(),lastInteraction=Date.now(),token=params.get('token')||'',tabId=crypto.randomUUID();
// The relay access code is kept only in this tab's session storage, never exported.
try{token=token||sessionStorage.getItem('gdlab-relay-token')||'';if(token)sessionStorage.setItem('gdlab-relay-token',token);}catch{}
if(params.has('token')){params.delete('token');history.replaceState(null,'',location.pathname+'?'+params.toString());}
const iso=()=>new Date().toISOString();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function event(type,data={}){ if(!d)return; d.events.push({sequence:d.events.length,t:iso(),phase:d.phase,type,...data}); }
function flag(reason){ d.reviewRequired=true;if(!d.reviewReasons.includes(reason))d.reviewReasons.push(reason); }
function storageWarning(){ if(storageFailed)return;storageFailed=true;flag('local_storage_unavailable');const p=document.createElement('p');p.id='storage-warning';p.role='alert';p.textContent='Recovery storage is unavailable or full. Keep this tab open and download your data regularly using Export.';document.body.prepend(p); }
function persist(){if(!d||readOnly)return; if(d.phase==='learning'&&ready) d.lesson=window.Lesson.snapshot();try{localStorage.setItem(KEY,JSON.stringify(d));}catch{storageWarning();}}
function tick(){
  const now=Date.now(), elapsed=Math.max(0,now-lastTick); const t=d?.timing[d.phase];
  if(t&&!t.endedAt&&document.visibilityState==='visible'&&document.hasFocus()&&now-lastInteraction<60000) t.activeMs+=Math.min(elapsed,2000);
  lastTick=now;
  if(d?.phase==='learning'&&now-d.timing.learning.startedAt>=MAX) finishLearning('time_limit_incomplete');
  const clock=document.getElementById('phase-clock');
  if(clock&&t){const seconds=Math.max(0,Math.floor((now-t.startedAt)/1000)); clock.textContent=d.phase==='learning'?`Time remaining: ${format(Math.max(0,1800-seconds))}`:`Elapsed: ${format(seconds)}`;}
}
function format(s){return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function transition(phase){
  tick(); const previous=d.phase;if(d.timing[previous]&&!d.timing[previous].endedAt)d.timing[previous].endedAt=Date.now();
  d.phase=phase;d.timing[phase]??={startedAt:Date.now(),activeMs:0};event('phase_start',{previous});persist();render();
}
function isLearning(){return !!d&&d.phase==='learning'&&!readOnly;}
function finishLearning(status){
  if(!isLearning())return;
  if(ready)d.lesson=window.Lesson.snapshot();window.Lesson.stop();d.learningStatus=status;
  d.incompleteSteps=['explore','rule','t1','t2','m1','m2','m3','m4','assess'].filter(id=>!d.lesson?.state.results[id]?.done);
  // Mark phase before transition to avoid timer recursion.
  d.timing.learning.endedAt=Date.now();d.phase='learning-ended';
  event('learning_end',{status,incompleteSteps:d.incompleteSteps});persist();render();
}
function download(kind){
  tick();persist();const data={...d,exportedAt:Date.now(),scoringRubric:C.rubric,gains:C.gains(d.tests.pre?.score.total,d.tests.post?.score.total)};
  let body,type,ext;
  if(kind==='participant'){body=JSON.stringify(data,null,2);type='application/json';ext='json';}
  else if(kind==='summary'){body=C.csv([C.participantRow(data)]);type='text/csv';ext='csv';}
  else{body=C.csv(d.events.map(e=>({sessionId:d.sessionId,participantId:d.participantId,condition:d.condition,sequence:e.sequence,t:e.t,phase:e.phase,type:e.type,data:e})));type='text/csv';ext='csv';}
  const a=document.createElement('a');const url=URL.createObjectURL(new Blob([body],{type}));a.href=url;a.download=`${d.participantId||'unassigned'}-${d.sessionId.slice(0,8)}-${kind}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportUI(){return '<div class="export" aria-label="Download study data"><button type="button" class="btn ghost" data-export="participant">Export participant JSON</button><button type="button" class="btn ghost" data-export="summary">Export summary CSV</button><button type="button" class="btn ghost" data-export="events">Export events CSV</button></div>';}
const phases=['consent','pre','learning','learning-ended','post','feedback','complete'];
function render(){
  lab.hidden=!isLearning();lab.inert=!isLearning();root.innerHTML='';
  if(!d){root.innerHTML='<section class="card"><h1>Gradient Descent Lab study</h1><p>Please open the AI or control entry link supplied by the research team. A valid link includes <code>?condition=ai</code> or <code>?condition=control</code>.</p></section>';return;}
  const header=document.createElement('section');header.className='card';header.innerHTML=`<div class="status"><strong>CS-411 · Gradient Descent Lab study</strong><span id="phase-clock" role="timer"></span></div><p>Participant: ${escape(d.participantId||'not yet entered')} · Assigned support: ${escape(d.condition==='ai'?'AI tutor':'Predefined support')}</p><progress aria-label="Study progress" max="6" value="${phases.indexOf(d.phase)}"></progress>${exportUI()}`;root.append(header);
  if(readOnly){header.insertAdjacentHTML('beforeend','<p role="alert">This study is active in another tab. Continue there. This tab is read-only to prevent conflicting responses.</p>');return;}
  if(isLearning()){
    header.insertAdjacentHTML('beforeend','<p>Learning activity · maximum 30 minutes, including time away from this tab. The internal transfer check is part of the lesson, not the official post-test.</p>');
    if(!ready){ready=true;window.Lesson.start(d.condition,d.lesson);}
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));return;
  }
  const box=document.createElement('section');box.className='card study-form';root.append(box);
  if(d.phase==='consent') consent(box);
  if(d.phase==='pre'||d.phase==='post') assessment(box,d.phase);
  if(d.phase==='learning-ended'){
    box.innerHTML=`<h2>Learning activity ended</h2><p>${d.learningStatus==='completed'?'You have completed the lesson.':'The common 30-minute maximum has been reached. Your unfinished work has been saved and marked incomplete.'}</p><p>The official post-test comes next. Work independently without the simulation, tutor, learning notes, or external resources.</p><button class="btn" id="begin-post">Begin post-test</button>`;
    box.querySelector('button').onclick=()=>transition('post');
  }
  if(d.phase==='feedback') feedback(box);
  if(d.phase==='complete') box.innerHTML='<h2>Thank you — your responses are finalized</h2><p>No scores or answer key are displayed. Download the participant JSON and deliver it using the secure channel specified by your research team. The CSV files are optional analysis copies. This website does not submit data to a collection server.</p><p>Keep the downloaded file until the research team confirms receipt. Your recovery copy remains in this browser. To remove it after delivery, use the button below.</p><button class="btn ghost" id="erase">Remove local recovery copy</button>';
  const erase=document.getElementById('erase');if(erase)erase.onclick=()=>{if(confirm('Have you downloaded and delivered your participant JSON? Removing the recovery copy cannot be undone.')){localStorage.removeItem(KEY);readOnly=true;box.innerHTML='<h2>Local recovery copy removed</h2><p>Your downloaded files are unaffected. You may close this tab.</p>';}};
  const heading=box.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus();}
}
function consent(box){
  box.innerHTML=`<h2>Participant information and consent</h2><p>This CS-411 educational study compares two forms of support for learning gradient descent. The research team assigns participants to a group outside this application. Participation is voluntary; you may stop at any time without submitting your export.</p><p>Allow approximately 45–49 minutes: pre-test 5–7 minutes, learning up to 30 minutes, post-test 5–7 minutes, feedback about 5 minutes. Both groups receive the same activity and assessments.</p><p>We save your anonymous ID, answers, written explanations, settings, timings, and tutor conversations for research analysis. Do not enter your name, email, or other identifying details. Data stays in this browser until you download and deliver it. In the AI group, lesson context and tutor messages are sent through the study relay to its configured AI provider; assessment answers are never sent to the tutor.</p><p>Review the research team's accompanying information sheet for investigator contact, AI provider, retention period, and withdrawal arrangements. Contact the team before consenting if those details were not supplied.</p><form id="consent-form"><label for="participant-id">Anonymous participant ID supplied by the team</label><input id="participant-id" name="participantId" type="text" required pattern="[A-Za-z0-9_-]{2,40}" maxlength="40" autocomplete="off" value="${escape(d.participantId)}"><p class="hintline">Use only letters, numbers, hyphens, or underscores.</p><label class="opt"><input name="agree" type="checkbox" required> I have read the study information, understand what is saved and analyzed, and voluntarily consent to participate.</label><button class="btn">Consent and begin pre-test</button></form>`;
  box.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);d.participantId=f.get('participantId');d.consent={accepted:true,t:iso(),informationVersion:C.VERSION};event('consent');transition('pre');};
}
const objective='What is the main objective of gradient descent?';
const general='In your own words, explain how gradient descent works. Describe the general process rather than solving a particular numerical example.';
function radios(name,options,a){return options.map(([v,text])=>`<label class="opt"><input type="radio" name="${name}" value="${v}" required ${a[name]===v?'checked':''}><span>${escape(text)}</span></label>`).join('');}
function textArea(name,label,a,required=false){return `<label for="${name}">${escape(label)}</label><textarea id="${name}" name="${name}" ${required?'required':''}>${escape(a[name]||'')}</textarea>`;}
function notes(q,a){return `<details ${a[q+'notes']?'open':''}><summary>Notes / Justification (optional)</summary>${textArea(q+'notes','Notes / Justification',a)}</details>`;}
function assessment(box,phase){
  const post=phase==='post',a=d.answers[phase];
  box.innerHTML=`<h2>${post?'Post-test':'Pre-test'}</h2><p>Suggested time: 5–7 minutes. Work independently, without AI assistance, the simulation, notes, or external resources. All main responses are required. Optional notes are unscored. Responses are final when submitted; no correctness feedback is shown.</p><form id="assessment">
  <fieldset><legend>Q1 — Direction of descent (1 point)</legend><p>Suppose f'(x) ${post?'&lt;':'&gt;'} 0 at your current position. In which direction should you move to locally decrease f(x)?</p>${radios('q1',[['A','A. Towards larger values of x'],['B','B. Towards smaller values of x'],['C','C. The direction cannot be determined']],a)}${notes('q1',a)}</fieldset>
  <fieldset><legend>Q2 — Objective (1 point)</legend><p>${objective}</p>${radios('q2',[['A','A. Find a minimum of a function'],['B','B. Find a maximum of a function'],['C','C. Calculate the derivative exactly'],['D','D. Find every stationary point']],a)}${notes('q2',a)}</fieldset>
  <fieldset><legend>Q3 — Gradient descent algorithm (3 points)</legend><p>Part A: Which update rule corresponds to gradient descent?</p>${radios('q3a',[['A',"A. x[n+1] = x[n] + ηf'(x[n])"],['B',"B. x[n+1] = x[n] − ηf'(x[n])"],['C','C. x[n+1] = x[n] − ηf(x[n])'],['D','D. x[n+1] = x[n] + ηf(x[n])']],a)}
  <p>Part B: ${post?'Consider f(x) = (x − 1)², starting at x₀ = 4, with η = 0.25.':'For f(x) = x², starting at x₀ = 3 with η = 0.1,'} apply the correct gradient descent update once.</p><label for="q3b">x₁ =</label><input type="number" step="any" name="q3b" id="q3b" required value="${escape(a.q3b||'')}">
  ${textArea('q3c','Part C: Does this move closer to or farther from the minimum? Explain briefly.',a,true)}${notes('q3',a)}</fieldset>
  <fieldset><legend>Q4 — ${post?'Learning rate and convergence':'Learning rate'} (1 point)</legend><p>True or False: “${post?'If gradient descent repeatedly overshoots the minimum, reducing the learning rate may help it converge.':'Increasing the learning rate always makes gradient descent converge faster.'}”</p>${radios('q4',[['True','True'],['False','False']],a)}${notes('q4',a)}</fieldset>
  <fieldset><legend>Q5 — General understanding (3 points)</legend>${textArea('q5',general,a,true)}</fieldset>
  ${post?'':`<fieldset><legend>Background (unscored)</legend><p>What is your prior experience with gradient descent?</p>${radios('experience',['Never encountered it.','Heard of it but never studied it.','Studied it theoretically.','Previously implemented or used it.'].map(x=>[x,x]),a)}</fieldset>`}
  <button class="btn" type="submit">Finalize ${post?'post-test':'pre-test'} responses</button></form>`;
  const form=box.querySelector('form');form.oninput=()=>{d.answers[phase]=Object.fromEntries(new FormData(form));persist();};
  form.onsubmit=e=>{e.preventDefault();if(d.tests[phase])return;const values=Object.fromEntries(new FormData(form));if(!values.q3c.trim()||!values.q5.trim())return;
    if(!confirm('Finalize these responses? You cannot edit this test after submission.'))return;
    d.answers[phase]=values;d.tests[phase]={submittedAt:iso(),answers:{...values},score:C.score(phase,values)};event('test_finalized',{test:phase});transition(post?'feedback':'learning');};
}
function feedback(box){
  const a=d.feedback;
  box.innerHTML=`<h2>Activity feedback</h2><p>Approximately 5 minutes. These responses do not affect your test score.</p><form>
  ${textArea('helped','What part of the activity helped you understand gradient descent the most? Please describe a specific example.',a,true)}
  ${textArea('difficult','What did you find difficult or confusing during the activity? What did you do to overcome it?',a,true)}
  ${textArea('decision','Describe one decision you made while experimenting with gradient descent. What motivated your choice, and what did you learn from the result?',a,true)}
  ${textArea('other','Is there anything else you would like to mention about the activity or your learning experience? (optional)',a)}
  <fieldset><legend>External assistance</legend><p>Did you use any external AI tool or other unauthorized assistance during the activity or assessments?</p>${radios('assistance',[['No','No'],['Yes','Yes'],['Prefer not to say','Prefer not to say']],a)}${textArea('assistanceExplanation','Please explain (optional).',a)}</fieldset><button class="btn">Finalize feedback and finish</button></form>`;
  const form=box.querySelector('form');form.oninput=()=>{d.feedback=Object.fromEntries(new FormData(form));persist();};form.onsubmit=e=>{e.preventDefault();if(d.phase!=='feedback')return;d.feedback=Object.fromEntries(new FormData(form));event('feedback_finalized');transition('complete');};
}
function boot(){
  let saved;try{saved=localStorage.getItem(KEY);}catch{}
  if(saved){try{d=JSON.parse(saved);if(d.schemaVersion!==C.VERSION||!phases.includes(d.phase))throw new Error();}catch{root.innerHTML='<section class="card"><h1>Recovery data could not be read</h1><p>Contact the research team before restarting. Your stored data has not been overwritten.</p><button id="recover">Download original recovery data</button></section>';document.getElementById('recover').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([saved],{type:'text/plain'}));a.download='recovery-data.txt';a.click();};return;}}
  if(!d){const condition=params.get('condition');if(!['ai','control'].includes(condition)){render();return;}
    d={schemaVersion:C.VERSION,sessionId:crypto.randomUUID(),participantId:/^[A-Za-z0-9_-]{2,40}$/.test(params.get('pid')||'')?params.get('pid'):'',condition,phase:'consent',consent:{accepted:false},answers:{pre:{},post:{}},tests:{},feedback:{},events:[],timing:{},reviewRequired:false,reviewReasons:[],createdAt:iso()};
  }else{
    event('browser_refresh');if(params.get('condition')&&params.get('condition')!==d.condition){flag('assignment_link_mismatch');event('assignment_link_ignored');}
  }
  function launch(){tick();persist();render();setInterval(()=>{if(!readOnly){tick();persist();}},1000);}
  // An exclusive Web Lock prevents concurrent tabs from writing the same session.
  if(navigator.locks){navigator.locks.request(KEY,{ifAvailable:true},async lock=>{if(!lock){readOnly=true;render();return;}launch();await new Promise(()=>{});});}else{flag('multi_tab_lock_unavailable');launch();}
}
root.addEventListener('click',e=>{const kind=e.target.dataset.export;if(kind)download(kind);});
for(const type of ['pointerdown','keydown','input'])document.addEventListener(type,()=>{lastInteraction=Date.now();queueMicrotask(persist);},{passive:true});
document.addEventListener('visibilitychange',()=>{tick();event('visibility',{state:document.visibilityState});persist();});
window.addEventListener('pagehide',()=>{tick();persist();});
window.addEventListener('error',e=>{if(d){flag('client_error');event('client_error',{message:e.message});persist();}});
window.addEventListener('unhandledrejection',()=>{if(d){flag('unhandled_rejection');event('client_error',{message:'Unhandled asynchronous error'});persist();}});
window.Study={boot,isLearning,finishLearning,tutorToken:()=>token,lessonEvent(e){if(!d)return;event('lesson_event',{detail:e});if(e.ev==='tutor'&&e.mode==='unavailable')flag('ai_assistance_interrupted');}};
})();
