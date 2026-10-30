export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  const microsoft=Boolean(context.env?.MICROSOFT_TRANSLATOR_KEY);
  const googleCloud=Boolean(context.env?.GOOGLE_TRANSLATE_API_KEY);
  return Response.json({
    revision:'hawal-inline-v12',
    inlineTranslation:true,
    languages:{ku:'Central Kurdish (Sorani)',ar:'Arabic'},
    microsoftConfigured:microsoft,
    googleCloudConfigured:googleCloud,
    preferredProvider:microsoft?'microsoft':googleCloud?'google-cloud':'google-public-best-effort',
    liveProviderCheck:'not performed',
    note: microsoft||googleCloud
      ? 'A credential is configured. This status does not guarantee individual translation requests will succeed.'
      : 'Only an unauthenticated best-effort Google endpoint is configured. Connect a Microsoft Translator or Google Cloud Translation key for supported production use.'
  },{headers:{'Cache-Control':'no-store'}});
}