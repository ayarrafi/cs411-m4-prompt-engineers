// Explicit live smoke test: synthetic lesson data only, no participant data.
// Run with node --env-file=.env test-tutor.mjs while the server is running.
const token=(process.env.STUDY_AI_TOKENS||'').split(',').filter(Boolean)[0];
const origin=process.env.APP_ORIGIN;
if(!origin||!token)throw new Error('Set APP_ORIGIN and STUDY_AI_TOKENS in .env first.');
try{
  const response=await fetch(new URL('/api/tutor',origin),{
    method:'POST',signal:AbortSignal.timeout(26000),headers:{'Content-Type':'application/json',Origin:origin},
    body:JSON.stringify({token,context:{stage:'explore',situation:'help',function:'f(x) = x²',currentSettings:{x0:3,eta:0.1,steps:10},studentText:'What should I look for when comparing two runs?'},conversation:[]})
  });
  const data=await response.json();
  if(!response.ok||typeof data.text!=='string'){
    const hints={tutor_not_configured:'Check the server environment and restart it.',invalid_study_access_code:'Use the same STUDY_AI_TOKENS for the server and this test.',origin_not_allowed:'APP_ORIGIN must match exactly.',provider_auth_error:'Check GROQ_API_KEY (or the selected provider key).',provider_configuration_error:'Check TUTOR_MODEL is available in your account.',provider_rate_limited:'Check your Groq account quotas; retry after the limit resets.'};
    console.error(`Tutor test failed (HTTP ${response.status}). ${hints[data.error]||'Check provider availability and server configuration.'}`);process.exitCode=1;
  }else{console.log(`Tutor replied via ${data.provider} / ${data.model}:\n${data.text}`);}
}catch{console.error('Could not complete tutor test. Start the server and check APP_ORIGIN/network access.');process.exitCode=1;}
