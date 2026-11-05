// Only lesson fields can reach the provider. Raw study records are never forwarded.
const fields=['stage','situation','step','function','currentSettings','lastSettings','studentText','studentPrediction','studentReason','lastOutcome','predictionCorrect','hintLevel','failureCounts','attempts','trajectory','explorationRuns','behaviourSignals','targetTolerance','keyIdea','question','minima'];
function bound(value,depth=0){
  if(depth>3)return null;
  if(typeof value==='string')return value.slice(0,600);
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value==='boolean'||value===null)return value;
  if(Array.isArray(value))return value.slice(-4).map(v=>bound(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,10).map(([k,v])=>[k.slice(0,40),bound(v,depth+1)]));
  return null;
}
export function tutorPayload(context,conversation){
  if(!context||!['explore','theory','missions'].includes(context.stage))throw new Error('invalid_learning_context');
  const clean=Object.fromEntries(fields.filter(k=>context[k]!==undefined).map(k=>[k,bound(context[k])]));
  clean.hintLevel=Math.max(0,Math.min(3,Number(context.hintLevel)||0));
  // The model does not need exact answer keys before a student has struggled.
  if(clean.stage==='explore'||(clean.hintLevel<3&&clean.situation!=='explain'))delete clean.keyIdea;
  const history=(Array.isArray(conversation)?conversation:[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-4).map(m=>({role:m.role,content:m.content.slice(0,400)}));
  return {context:clean,conversation:history};
}
