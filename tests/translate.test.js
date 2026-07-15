import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequest } from '../functions/api/translate.js'
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js'

function translationRequest(texts, options = {}){
  return requestContext('https://example.com/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': options.origin || 'https://example.com' },
    body: JSON.stringify({ lang: options.lang || 'ar', texts })
  })
}

test('translation batches work concurrently and reuse edge-cached text', async () => {
  const cache = new MemoryCache()
  const restoreCaches = replaceGlobal('caches', { default: cache })
  const restoreWarn = silenceWarnings()
  let calls = 0
  let active = 0
  let maxActive = 0
  const restoreFetch = replaceGlobal('fetch', async url => {
    calls += 1
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active -= 1
    const original = new URL(String(url)).searchParams.get('q')
    return Response.json([[[`ترجمة ${original}`]]])
  })

  try{
    const texts = Array.from({ length: 12 }, (_, index) => `Market story ${index}`)
    const first = translationRequest(texts)
    const firstResponse = await onRequest(first.context)
    const firstPayload = await firstResponse.json()
    await first.settle()
    assert.equal(firstPayload.ok, true)
    assert.ok(firstPayload.sources.every(source => source === 'live'))
    assert.equal(calls, texts.length)
    assert.ok(maxActive > 1)
    assert.ok(maxActive <= 6)

    const second = translationRequest(texts)
    const secondResponse = await onRequest(second.context)
    const secondPayload = await secondResponse.json()
    assert.ok(secondPayload.sources.every(source => source === 'cache'))
    assert.equal(calls, texts.length)
  }finally{
    restoreFetch()
    restoreWarn()
    restoreCaches()
  }
})

test('translation accepts only same-origin POST requests and enforces the body limit', async () => {
  const get = requestContext('https://example.com/api/translate')
  assert.equal((await onRequest(get.context)).status, 405)

  const crossOrigin = translationRequest(['hello'], { origin: 'https://attacker.example' })
  assert.equal((await onRequest(crossOrigin.context)).status, 403)

  const oversized = translationRequest(['x'.repeat(66_000)])
  assert.equal((await onRequest(oversized.context)).status, 413)
})
