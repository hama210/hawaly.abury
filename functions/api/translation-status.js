// Configuration check only: never claim that an external provider is online
// without actually translating a sample. Does not disclose credentials.
export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('GET only',{status:405});
  const workersAI=Boolean(context.env?.AI && typeof context.env.AI.run==='function');
  return Response.json({
    revision:'2026-10-10-translation-diagnostics-v2',
    workersAIConfigured:workersAI,
    primaryWhenConfigured:'Cloudflare Workers AI',
    fallbackProviders:['Google Translate (best effort)','MyMemory (best effort)'],
    languages:['ckb','ar','en'],
    diagnosticPage:'/translation-test.html',
    deploymentNote:'If revision is missing, Cloudflare Pages is serving an older deployment.',
    explanation:workersAI
      ? 'Cloudflare AI binding is configured; use the news page to verify translation quality.'
      : 'For reliable Sorani headlines, configure a Workers AI binding named AI for this Pages project and redeploy.'
  },{headers:{'Cache-Control':'no-store'}});
}
