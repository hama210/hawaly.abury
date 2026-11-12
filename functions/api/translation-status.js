export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  const microsoft=Boolean(context.env?.MICROSOFT_TRANSLATOR_KEY);
  const googleCloud=Boolean(context.env?.GOOGLE_TRANSLATE_API_KEY);
  return Response.json({
    revision:'hawal-inline-v13-google-alt',
    inlineTranslation:true,
    languages:{ku:'Central Kurdish (Sorani)',ar:'Arabic'},
    microsoftConfigured:microsoft,
    googleCloudConfigured:googleCloud,
    preferredProvider:microsoft?'microsoft':googleCloud?'google-cloud':'google-public-best-effort',
    liveProviderCheck:'not performed',
    note: microsoft||googleCloud
      ? 'A credential is configured. This status does not guarantee individual translation requests will succeed.'
      : 'Two unauthenticated best-effort Google web endpoints are available. Neither guarantees production reliability. Configure a supported Google Cloud Translation key for dependable translation.'
  },{headers:{'Cache-Control':'no-store'}});
}