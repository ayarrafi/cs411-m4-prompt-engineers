import {test} from 'node:test';import assert from 'node:assert/strict';import {tutorPayload} from '../tutor-context.mjs';import {scenarios} from './tutor-scenarios.mjs';import {generateTutor} from '../tutor-provider.mjs';
test('bounded context excludes study records, early keys and excess conversation',()=>{
 const p=tutorPayload({stage:'theory',hintLevel:1,keyIdea:'secret answer',pre:{q1:'B'},post:{q1:'A'},participantId:'P01',studentText:'x'.repeat(2000)},Array.from({length:10},()=>({role:'user',content:'y'.repeat(2000)})));
 assert.equal(p.context.pre,undefined);assert.equal(p.context.post,undefined);assert.equal(p.context.participantId,undefined);assert.equal(p.context.keyIdea,undefined);assert.equal(p.context.studentText.length,600);assert.equal(p.conversation.length,4);assert.equal(p.conversation[0].content.length,400);
 for(const stage of ['pre','post','assess'])assert.throws(()=>tutorPayload({stage},[]));
 assert.equal(tutorPayload({stage:'missions',hintLevel:3,keyIdea:'guidance'},[]).context.keyIdea,'guidance');
});
test('realistic scenarios retain context and use bounded non-thinking requests (mocked model)',async()=>{
 for(const scenario of scenarios){
  await generateTutor({providerName:'groq',model:'qwen/qwen3.8-27b',apiKey:'test',instructions:'rules',context:scenario.context,conversation:[],fetchImpl:async(url,options)=>{
   const body=JSON.parse(options.body);assert.equal(body.max_completion_tokens,320);assert.equal(body.reasoning_effort,'none');assert.equal(JSON.parse(body.messages[1].content).context.studentText,scenario.context.studentText??undefined);
   return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'What do you notice on the plot?'}}],usage:{prompt_tokens:100,completion_tokens:10,total_tokens:110}})};
  }});
 }
});
