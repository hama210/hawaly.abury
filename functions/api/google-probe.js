// Temporary fixed-input diagnostic for comparing Google's public endpoints.
const url=host=>'https://'+host+'/translate_a/single?client=gtx&sl=en&tl=ckb&dt=t&q='+encodeURIComponent('Gold prices fell in Baghdad today.');
export async function onRequest({request}){
  if(request.method!=='GET')return new Response('GET only',{status:405});
  const result={};
  for(const host of ['translate.googleapis.com','translate.google.com']){
    try{
      const response=await fetch(url(host),{redirect:'follow',headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500)});
      const body=await response.text();
      result[host]={ok:response.ok,status:response.status,contentType:response.headers.get('content-type'),sample:body.slice(0,250)};
    }catch(error){result[host]={ok:false,type:error?.name||'Error',message:String(error?.message||'unknown').slice(0,180)};}
  }
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
