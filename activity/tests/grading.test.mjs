import {fileURLToPath} from 'node:url';
import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
test('offline grading blinds condition, validates rubric, and computes valid gains',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gdlab-grade-'));
 try{
  const p=join(dir,'participant.json'),g=join(dir,'grades.json');
  await writeFile(p,JSON.stringify({sessionId:'session-test',condition:'ai',tests:{pre:{answers:{q1:'B',q2:'A',q3a:'B',q3b:'2.4',q3c:'Closer',q4:'False',q5:'Explanation'}},post:{answers:{q1:'A',q2:'A',q3a:'B',q3b:'2.5',q3c:'Closer',q4:'True',q5:'Explanation'}}}}));
  const command=fileURLToPath(new URL('../grade.mjs',import.meta.url));
  const review=JSON.parse(execFileSync(process.execPath,[command,p]));assert.equal(review.condition,undefined);assert.equal(review.tests.pre.q5,'Explanation');
  await writeFile(g,JSON.stringify({sessionId:'session-test',pre:{q3c:1,q5:[1,1,1]},post:{q3c:1,q5:[1,1,1]}}));
  const graded=JSON.parse(execFileSync(process.execPath,[command,p,g]));assert.equal(graded.tests.pre.score.total,9);assert.equal(graded.gains.raw,0);assert.equal(graded.gains.normalized,null);
 }finally{await rm(dir,{recursive:true,force:true});}
});
