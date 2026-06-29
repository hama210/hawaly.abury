export async function onRequest() {
  return Response.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    message: 'Phase 1 foundation API. Phase 2 will add live source aggregation.',
    items: []
  }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
