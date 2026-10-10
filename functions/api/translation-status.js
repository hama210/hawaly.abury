export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  const googleCloud=Boolean(context.env?.GOOGLE_TRANSLATE_API_KEY);
  return Response.json({
    revision:'hawal-google-v1',
    inlineTranslation:true,
    languages:{ku:'Central Kurdish (Sorani)',ar:'Arabic'},
    googleCloudConfigured:googleCloud,
    preferredProvider:googleCloud?'google-cloud':'google-public-best-effort',
    liveProviderCheck:'not performed',
    note:googleCloud
      ? 'Google Cloud Translation key configured; verify actual requests via /api/translation-health.'
      : 'Google Translate public web endpoint is used as best-effort only; it may be rate-limited or unavailable. For reliable production use, configure a Google Cloud Translation API key.'
  },{headers:{'Cache-Control':'no-store'}});
}
