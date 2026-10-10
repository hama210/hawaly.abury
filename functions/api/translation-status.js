export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  return Response.json({
    revision:'hawal-google-keyless-v2',
    inlineTranslation:true,
    languages:{ku:'Central Kurdish (Sorani)',ar:'Arabic'},
    apiKeyRequired:false,
    preferredProvider:'google-browser',
    serverFallback:'google-public',
    liveProviderCheck:'not performed',
    note:'The browser requests Google Translate directly, with a keyless Pages fallback. The health endpoint checks only the server route; verify browser translations on the website.'
  },{headers:{'Cache-Control':'no-store'}});
}
