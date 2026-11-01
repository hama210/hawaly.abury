export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  const googleCloud=Boolean(context.env?.GOOGLE_TRANSLATE_API_KEY);
  return Response.json({revision:'hawal-google-v13',inlineTranslation:true,
    languages:{ku:'Central Kurdish (Sorani)',ar:'Arabic'}, googleCloudConfigured:googleCloud,
    preferredProvider:googleCloud?'google-cloud':'google-public-best-effort',
    liveProviderCheck:'not performed',
    note:'Configuration does not prove translation availability. Check translation-health. Public Google translation may be blocked or rate-limited.'
  },{headers:{'Cache-Control':'no-store'}});
}
