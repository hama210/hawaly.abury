export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  const googleCloud=Boolean(context.env?.GOOGLE_TRANSLATE_API_KEY);
  return Response.json({
    revision:'hawal-inline-v15',
    inlineTranslation:true,
    languages:{ckb:'Central Kurdish (Sorani)',ar:'Arabic',en:'English'},
    googleCloudConfigured:googleCloud,
    preferredProvider:googleCloud?'google-cloud':'google-public-best-effort',
    liveProviderCheck:'not performed',
    note: googleCloud
      ? 'A credential is configured. This status does not guarantee individual translation requests will succeed.'
      : 'Only an unauthenticated best-effort Google endpoint is configured. A Google Cloud Translation key is optional for supported production use.'
  },{headers:{'Cache-Control':'no-store'}});
}