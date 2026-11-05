const {test}=require('node:test');const assert=require('node:assert/strict');
const M=require('../math.js'),C=require('../study-core.js');
test('official objective scoring independent of rule choice; manual grades pending',()=>{
  const a={q1:'B',q2:'A',q3a:'A',q3b:'2.4',q3c:'closer',q4:'False',q5:'test'};
  const s=C.score('pre',a);assert.equal(s.objective.q3b,1);assert.equal(s.objective.q3a,0);assert.equal(s.objectiveTotal,4);assert.equal(s.total,null);assert.equal(s.manualStatus,'pending');
  assert.equal(C.score('pre',{...a,q3a:'B'},{q3c:1,q5:[1,1,1]}).total,9);
  assert.equal(C.score('post',{q1:'A',q2:'A',q3a:'B',q3b:'2.5',q4:'True'}).objectiveTotal,5);
  for(const x of ['',null,'NaN','Infinity','2.41'])assert.equal(C.score('pre',{q3b:x}).objective.q3b,0);
});
test('manual rubrics reject fabricated/incomplete/out-of-range grades',()=>{
  for(const manual of [{q3c:1},{q3c:2,q5:[1,1,1]},{q3c:1,q5:[1,1,2]},{q3c:1,q5:3}])assert.equal(C.score('pre',{},manual).total,null);
});
test('gains require complete valid scores and perfect baseline is undefined',()=>{
  assert.deepEqual(C.gains(null,8),{raw:null,normalized:null});assert.deepEqual(C.gains(9,8),{raw:-1,normalized:null});assert.deepEqual(C.gains(3,6),{raw:3,normalized:.5});
});
test('math: updates, oscillation boundary, divergence, minima, flat floor',()=>{
  assert.ok(Math.abs(M.trajectory(M.BOWL,3,.1,1)[1]-2.4)<1e-12);assert.equal(M.trajectory(M.SHIFT,4,.25,1)[1],2.5);
  assert.equal(M.outcome(M.BOWL,M.trajectory(M.BOWL,2,1,10),.05),'oscillate');
  assert.equal(M.outcome(M.BOWL,M.trajectory(M.BOWL,2,1.1,10),.05),'diverge');
  assert.equal(M.outcome(M.BOWL,M.trajectory(M.BOWL,2,.5,8),.05),'global');
  assert.equal(M.outcome(M.BOWL,M.trajectory(M.BOWL,2,.01,8),.05),'slow');
  assert.equal(M.outcome(M.VALLEYS,M.trajectory(M.VALLEYS,2.5,.1,25),.05),'local');
  assert.equal(M.outcome(M.VALLEYS,M.trajectory(M.VALLEYS,-1,.2,25),.05),'global');
  assert.equal(M.outcome(M.FLAT,M.trajectory(M.FLAT,1,1,12),.25),'global');
  assert.ok(M.trajectory(M.FLAT,4.5,1.2,30).every(Number.isFinite));
  assert.throws(()=>M.trajectory(M.BOWL,NaN,.1,10));assert.throws(()=>M.trajectory(M.BOWL,1,.1,1001));
});
test('CSV escapes multiline, quotes, Unicode and spreadsheet formulas',()=>{
  const s=C.csv([{id:'P01',text:' line 1\n"η" ',formula:'=1+1',pending:null}]);assert.ok(s.includes('" line 1\n""η"" "'));assert.ok(s.includes('"\'=1+1"'));assert.ok(s.endsWith(',""'));assert.ok(C.csv([{gain:-1}]).endsWith('"-1"'));
});
test('participant export does not conflate transfer score with official total',()=>{
 const d={schemaVersion:C.VERSION,tests:{pre:{score:C.score('pre',{})}},answers:{pre:{}},timing:{learning:{startedAt:1000,endedAt:3000,activeMs:500}},events:[],lesson:{state:{results:{assess:{score:3}}}},exportedAt:4000};
 const r=C.participantRow(d);assert.equal(r.pre_total,null);assert.equal(r.post_total,null);assert.equal(r.learning_wallSeconds,2);assert.equal(r.learning_activeEstimateSeconds,.5);assert.equal(r.rawGain,null);
});
