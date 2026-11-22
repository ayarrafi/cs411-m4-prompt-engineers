// Centralized submission persistence to a private GitHub repository.
// Uses native fetch (Node 22+) with zero npm dependencies; credentials stay server-side.
export class SubmissionStoreError extends Error {
  constructor(code){super(code);this.code=code;}
}

const REPO_RE=/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const SAFE_SEGMENT_RE=/^[A-Za-z0-9._-]+$/;

export function submissionConfig(env){
  const repo=(env.GITHUB_DATA_REPO||'').trim();
  const token=(env.GITHUB_DATA_TOKEN||'').trim();
  const branch=(env.GITHUB_DATA_BRANCH||'main').trim()||'main';
  const rawPath=(env.GITHUB_DATA_PATH??'submissions').trim().replace(/^\/+|\/+$/g,'');
  if(repo&&!REPO_RE.test(repo))throw new Error('GITHUB_DATA_REPO must be in owner/repo format');
  if(rawPath&&!rawPath.split('/').every(seg=>SAFE_SEGMENT_RE.test(seg)&&seg!=='.'&&seg!=='..')){
    throw new Error('GITHUB_DATA_PATH contains invalid path segments');
  }
  return {repo,token,branch,pathPrefix:rawPath,configured:!!(repo&&token)};
}

function safeId(value,fallback){
  const cleaned=String(value||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
  return cleaned||fallback;
}

function mapStatus(status){
  if(status===429)return 'store_rate_limited';
  if(status===401||status===403)return 'store_auth_error';
  if(status===404)return 'store_repo_error';
  return 'store_error';
}

export async function saveSubmission({submission,repo,token,branch='main',pathPrefix='submissions',fetchImpl=fetch}){
  if(!repo||!token)throw new SubmissionStoreError('store_not_configured');
  const pid=safeId(submission?.participantId,'unassigned');
  const sid=safeId(submission?.sessionId,'session').slice(0,8);
  const fileName=`${pid}-${sid}.json`;
  const filePath=pathPrefix?`${pathPrefix}/${fileName}`:fileName;
  const encodedPath=filePath.split('/').map(encodeURIComponent).join('/');
  const baseUrl=`https://api.github.com/repos/${repo}/contents/${encodedPath}`;
  const headers={
    Authorization:`Bearer ${token}`,
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'cs411-gradient-descent-lab'
  };
  const content=Buffer.from(JSON.stringify(submission,null,2)+'\n','utf8').toString('base64');

  const putFile=async(sha)=>{
    const body={message:`Submit ${pid} (${sid})`,content,branch,...(sha?{sha}:{})};
    try{
      return await fetchImpl(baseUrl,{
        method:'PUT',
        signal:AbortSignal.timeout(20000),
        headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
    }catch(error){
      throw new SubmissionStoreError(['TimeoutError','AbortError'].includes(error?.name)?'store_timeout':'store_network_error');
    }
  };

  let response=await putFile(null);
  // If the file already exists (e.g., idempotent retry), fetch its current SHA and update it.
  if(response.status===422||response.status===409){
    let existing;
    try{
      existing=await fetchImpl(`${baseUrl}?ref=${encodeURIComponent(branch)}`,{
        method:'GET',
        signal:AbortSignal.timeout(20000),
        headers
      });
    }catch(error){
      throw new SubmissionStoreError(['TimeoutError','AbortError'].includes(error?.name)?'store_timeout':'store_network_error');
    }
    if(existing.ok){
      let meta;try{meta=await existing.json();}catch{throw new SubmissionStoreError('store_error');}
      if(typeof meta?.sha==='string'&&meta.sha){
        response=await putFile(meta.sha);
      }
    }
  }

  if(!response.ok)throw new SubmissionStoreError(mapStatus(response.status));
  let result;try{result=await response.json();}catch{result=null;}
  return {path:filePath,commitSha:result?.commit?.sha??null};
}
