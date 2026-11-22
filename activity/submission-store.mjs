// Centralized submission persistence to Firebase Storage (Google Cloud Storage).
// Uses Node 22+ built-in crypto + native fetch with zero npm dependencies; credentials stay server-side.
import {createSign} from 'node:crypto';
import {readFileSync} from 'node:fs';

export class SubmissionStoreError extends Error {
  constructor(code){super(code);this.code=code;}
}

const BUCKET_RE=/^[A-Za-z0-9._-]+$/;
const tokenCache=new Map();

function parseServiceAccount(raw){
  let text=raw.trim();
  if(!text.startsWith('{')){
    // Allow base64-encoded service account JSON in environment variables.
    try{text=Buffer.from(text,'base64').toString('utf8').trim();}catch{}
  }
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error('Firebase service account JSON is invalid');}
  if(typeof parsed?.client_email!=='string'||!parsed.client_email||typeof parsed?.private_key!=='string'||!parsed.private_key.includes('BEGIN')){
    throw new Error('Firebase service account JSON must contain client_email and private_key');
  }
  return {
    clientEmail:parsed.client_email,
    privateKey:parsed.private_key.replace(/\\n/g,'\n'),
    tokenUri:typeof parsed.token_uri==='string'&&parsed.token_uri?parsed.token_uri:'https://oauth2.googleapis.com/token'
  };
}

export function submissionConfig(env){
  const bucket=(env.FIREBASE_STORAGE_BUCKET||'').trim().replace(/^gs:\/\//,'').replace(/\/+$/,'');
  if(bucket&&!BUCKET_RE.test(bucket))throw new Error('FIREBASE_STORAGE_BUCKET is invalid');
  const rawJson=(env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
  const jsonPath=(env.FIREBASE_SERVICE_ACCOUNT_PATH||'').trim();
  let creds=null;
  if(rawJson){
    creds=parseServiceAccount(rawJson);
  }else if(jsonPath){
    let fileText;
    try{fileText=readFileSync(jsonPath,'utf8');}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH could not be read');}
    creds=parseServiceAccount(fileText);
  }
  return {
    bucket,
    clientEmail:creds?.clientEmail||'',
    privateKey:creds?.privateKey||'',
    tokenUri:creds?.tokenUri||'https://oauth2.googleapis.com/token',
    configured:!!(bucket&&creds?.clientEmail&&creds?.privateKey)
  };
}

function safeId(value,fallback){
  const cleaned=String(value||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
  return cleaned||fallback;
}

function mapStatus(status){
  if(status===429)return 'store_rate_limited';
  if(status===401||status===403)return 'store_auth_error';
  if(status===404)return 'store_bucket_error';
  return 'store_error';
}

async function getAccessToken({clientEmail,privateKey,tokenUri,fetchImpl}){
  const cacheKey=`${clientEmail}|${tokenUri}`;
  if(fetchImpl===fetch){
    const cached=tokenCache.get(cacheKey);
    if(cached&&cached.expiresAt>Date.now()+60000)return cached.token;
  }
  const now=Math.floor(Date.now()/1000);
  const header=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
  const claims=Buffer.from(JSON.stringify({
    iss:clientEmail,
    scope:'https://www.googleapis.com/auth/devstorage.read_write',
    aud:tokenUri,
    iat:now,
    exp:now+3600
  })).toString('base64url');
  const signingInput=`${header}.${claims}`;
  let signature;
  try{
    signature=createSign('RSA-SHA256').update(signingInput).end().sign(privateKey,'base64url');
  }catch{
    throw new SubmissionStoreError('store_auth_error');
  }
  const body=`grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(`${signingInput}.${signature}`)}`;
  let response;
  try{
    response=await fetchImpl(tokenUri,{
      method:'POST',
      signal:AbortSignal.timeout(20000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body
    });
  }catch(error){
    throw new SubmissionStoreError(['TimeoutError','AbortError'].includes(error?.name)?'store_timeout':'store_network_error');
  }
  if(!response.ok){
    const code=response.status===429?'store_rate_limited':[400,401,403].includes(response.status)?'store_auth_error':'store_error';
    throw new SubmissionStoreError(code);
  }
  let data;try{data=await response.json();}catch{throw new SubmissionStoreError('store_error');}
  if(typeof data?.access_token!=='string'||!data.access_token)throw new SubmissionStoreError('store_auth_error');
  if(fetchImpl===fetch){
    const ttlMs=Math.max(60,Number(data.expires_in)||3600)*1000;
    tokenCache.set(cacheKey,{token:data.access_token,expiresAt:Date.now()+ttlMs});
  }
  return data.access_token;
}

export async function saveSubmission({submission,bucket,clientEmail,privateKey,tokenUri='https://oauth2.googleapis.com/token',fetchImpl=fetch}){
  if(!bucket||!clientEmail||!privateKey)throw new SubmissionStoreError('store_not_configured');
  const condition=submission?.condition==='ai'?'ai':submission?.condition==='control'?'control':'unknown';
  const pid=safeId(submission?.participantId,'unassigned');
  const objectPath=`${condition}/${pid}.json`;
  const accessToken=await getAccessToken({clientEmail,privateKey,tokenUri,fetchImpl});
  const uploadUrl=`https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  let response;
  try{
    response=await fetchImpl(uploadUrl,{
      method:'POST',
      signal:AbortSignal.timeout(20000),
      headers:{
        Authorization:`Bearer ${accessToken}`,
        'Content-Type':'application/json; charset=utf-8'
      },
      body:JSON.stringify(submission,null,2)+'\n'
    });
  }catch(error){
    throw new SubmissionStoreError(['TimeoutError','AbortError'].includes(error?.name)?'store_timeout':'store_network_error');
  }
  if(!response.ok)throw new SubmissionStoreError(mapStatus(response.status));
  let result;try{result=await response.json();}catch{result=null;}
  return {path:objectPath,generation:result?.generation??null};
}
