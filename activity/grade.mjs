// Offline researcher utility. Never served to participants; no network access.
// node grade.mjs participant.json > blinded-review.json
// node grade.mjs participant.json grades.json > graded-participant.json
import {readFile} from 'node:fs/promises';
import C from './study-core.js';
const [participantPath,gradesPath]=process.argv.slice(2);
if(!participantPath)throw new Error('Usage: node grade.mjs participant.json [grades.json]');
const d=JSON.parse(await readFile(participantPath,'utf8'));
if(!gradesPath){
  const tests={};for(const phase of ['pre','post']){const a=d.tests[phase]?.answers;if(a)tests[phase]={q3c:a.q3c,q5:a.q5,notes:{q1:a.q1notes,q2:a.q2notes,q3:a.q3notes,q4:a.q4notes},responses:{q1:a.q1,q2:a.q2,q3a:a.q3a,q3b:a.q3b,q4:a.q4}};}
  console.log(JSON.stringify({sessionId:d.sessionId,rubric:C.rubric,tests},null,2));
}else{
  const grades=JSON.parse(await readFile(gradesPath,'utf8'));
  if(grades.sessionId!==d.sessionId)throw new Error('Grade/session mismatch');
  for(const phase of ['pre','post']){
    if(!d.tests[phase])throw new Error('Cannot grade an unsubmitted test');
    const score=C.score(phase,d.tests[phase].answers,grades[phase]);
    if(score.manualStatus!=='complete')throw new Error('Each test requires q3c: 0 or 1 and q5: three 0/1 rubric items');
    d.tests[phase].score=score;
  }
  d.manualGrading={gradedAt:new Date().toISOString(),source:'researcher_supplied_rubric_scores'};
  d.gains=C.gains(d.tests.pre.score.total,d.tests.post.score.total);
  console.log(JSON.stringify(d,null,2));
}
