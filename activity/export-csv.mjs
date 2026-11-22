// Offline researcher utility. Never served to participants; no network access.
// Combines collected participant JSON files into summary.csv and events.csv.
// Usage: node export-csv.mjs /path/to/submissions-dir [output-dir]
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import C from './study-core.js';

const [inputDir,outputDir=inputDir]=process.argv.slice(2);
if(!inputDir){
  console.error('Usage: node export-csv.mjs /path/to/submissions-dir [output-dir]');
  process.exit(1);
}

const files=(await readdir(inputDir)).filter(f=>f.endsWith('.json')).sort();
const bySession=new Map();
for(const file of files){
  const data=JSON.parse(await readFile(join(inputDir,file),'utf8'));
  if(data?.schemaVersion!==C.VERSION||!data?.sessionId)continue;
  const prev=bySession.get(data.sessionId);
  const stamp=d=>Date.parse(d.receivedAt||'')||d.exportedAt||0;
  if(!prev||stamp(data)>=stamp(prev))bySession.set(data.sessionId,data);
}

const records=[...bySession.values()];
const summaryRows=records.map(d=>C.participantRow(d));
const eventRows=records.flatMap(d=>(d.events||[]).map(e=>({
  sessionId:d.sessionId,participantId:d.participantId,condition:d.condition,
  sequence:e.sequence,t:e.t,phase:e.phase,type:e.type,data:e
})));

await writeFile(join(outputDir,'summary.csv'),C.csv(summaryRows),'utf8');
await writeFile(join(outputDir,'events.csv'),C.csv(eventRows),'utf8');
console.log(`Exported ${records.length} unique session(s) (${eventRows.length} events) to ${outputDir}`);
