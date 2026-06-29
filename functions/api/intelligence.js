export async function onRequest() {
  return Response.json({
    mode: 'ai-ready-rule-based',
    message: 'Real AI can be enabled later with OPENAI_API_KEY.',
    status: { risk: 'Neutral', dollar: 'Watch', gold: 'Active', oil: 'Sensitive', btc: 'Volatile', iraq: 'Watch CBI and oil headlines' }
  }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
