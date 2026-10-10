// Both the browser and Pages use the same keyless Google request and parser.
export const translationVersion='hawal-google-keyless-v2';
export const googleTargets={ku:'ckb',ar:'ar'};

export function decodeGoogleText(value){
  return String(value||'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi,(_,code)=>{
    const names={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
    const name=code.toLowerCase();
    if(names[name])return names[name];
    const number=name.startsWith('#x')?parseInt(name.slice(2),16):parseInt(name.slice(1),10);
    return Number.isSafeInteger(number)&&number>0&&number<0x110000?String.fromCodePoint(number):'';
  }).replace(/\s+/gu,' ').trim();
}

export async function requestGoogleTranslation(text,lang,{fetcher=fetch,signal,timeout=7000}={}){
  const target=googleTargets[lang];
  if(!target)throw new Error('Unsupported translation language');
  signal?.throwIfAborted();
  const controller=new AbortController();
  const abort=()=>controller.abort(signal.reason);
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Translation timed out','TimeoutError')),timeout);
  try{
    const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='+target+'&dt=t&q='+encodeURIComponent(text);
    const response=await fetcher(url,{
      signal:controller.signal,redirect:'error',credentials:'omit',
      referrerPolicy:'no-referrer',headers:{Accept:'application/json'}
    });
    if(!response.ok)throw new Error('translator status '+response.status);
    const result=await response.json();
    if(!Array.isArray(result?.[0]))throw new Error('Invalid Google response');
    return decodeGoogleText(result[0].map(segment=>Array.isArray(segment)?segment[0]||'':'').join(''));
  }finally{
    clearTimeout(timer);
    signal?.removeEventListener('abort',abort);
  }
}

export function translationFailure(error){
  const status=/translator status (\d+)/.exec(String(error?.message||''))?.[1];
  return status?'http-'+status:error?.name==='AbortError'||error?.name==='TimeoutError'?'timeout':'network-error';
}
