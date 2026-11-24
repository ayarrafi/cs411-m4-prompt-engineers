// Non-destructive offline enrichment: node analyze-session.mjs input.json > enriched.json
import {readFile} from 'node:fs/promises';
import P from './process-metrics.js';
const path=process.argv[2];
if(!path)throw new Error('Usage: node analyze-session.mjs input.json > enriched.json (use a different output file)');
const d=JSON.parse(await readFile(path,'utf8'));
if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('Expected a session JSON object');
console.log(JSON.stringify({...d,...P.derive(d)},null,2));
