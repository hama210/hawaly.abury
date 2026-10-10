import { translationQuality } from '../../src/lib/translation-quality.js';

const TARGETS = {
  ku: ['ckb'],
  ar: ['ar'],
  en: ['en']
};
const MAX_BODY_BYTES = 64 * 1024;
// A cache lookup, Google request and cache write all count as Cloudflare
// subrequests. Ten texts remains safely below the per-invocation limit.
const MAX_TEXTS = 10;
const TRANSLATE_CONCURRENCY = 6;
const TRANSLATE_TIMEOUT_MS = 4500;
const TRANSLATION_CACHE_TTL = 7 * 24 * 60 * 60;

function clean(value = ''){
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
}

function comparable(value = ''){
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function isUsefulTranslation(original, translated){
  const output = clean(translated);
  return Boolean(output) && comparable(output) !== comparable(original);
}

// Do not replace a publisher's real headline with an unrelated canned sentence.
// If every provider is unavailable, leave the original text intact and mark it unavailable.
function isScriptAppropriate(text, lang){
  if(lang === 'ku' || lang === 'ar') return /[\u0600-\u06FF]/u.test(text);
  return true;
}

function responseHeaders(request){
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  });
  const origin = request.headers.get('Origin');
  if(origin && origin === new URL(request.url).origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function isAllowedOrigin(request){
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

function errorMessage(error){
  return error instanceof Error ? error.message : String(error);
}

async function callGoogle(text, target){
  const q = clean(text);
  if(!q || target === 'en') return q;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('translation timeout'), TRANSLATE_TIMEOUT_MS);
  try{
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + (/[^\x00-\x7F]/u.test(q) ? 'auto' : 'en') + '&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(q);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 HawaliAburiTranslate/2.0',
        'accept': 'application/json,text/plain,*/*'
      }
    });
    if(!res.ok) throw new Error(`Google Translate ${res.status}`);
    const data = await res.json();
    const output = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : '';
    return output || q;
  }finally{
    clearTimeout(timeoutId);
  }
}

// Secondary translation source when Google is blocked or times out at the edge.
// Public MyMemory access is rate-limited; never assume translation succeeded.
async function callMyMemory(original, lang){
  if(new TextEncoder().encode(original).length > 480) return '';
  const target = lang === 'ku' ? 'ckb-IQ' : 'ar';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('alternate translation timeout'), 3500);
  try{
    const url = 'https://api.mymemory.translated.net/get?q=' +
      encodeURIComponent(original) + '&langpair=' + encodeURIComponent('en|' + target);
    const response = await fetch(url, {signal:controller.signal,headers:{'Accept':'application/json'}});
    if(!response.ok) return '';
    const payload = await response.json();
    if(Number(payload?.responseStatus) !== 200) return '';
    const translated = clean(payload?.responseData?.translatedText || '');
    if(/MYMEMORY WARNING|TRANSLATED\.NET|QUOTA EXCEEDED/i.test(translated)) return '';
    return isUsefulTranslation(original,translated) && isScriptAppropriate(translated,lang) ? translated : '';
  }catch{return '';}
  finally{clearTimeout(timeoutId);}
}

// Reliable optional translation backend: add a Cloudflare Workers AI binding
// named AI to the Pages project. Without it, external providers remain in use.
async function callWorkersAI(text,lang,ai,context=''){
  if(!ai || typeof ai.run!=='function')return '';
  const target=lang==='ku'?'Central Kurdish (Sorani), using Kurdish Arabic-script spelling':'Modern Standard Arabic';
  const glossary = lang==='ku'
    ? 'You must write genuine Iraqi Central Kurdish (Sorani) in Kurdish Arabic script, not Arabic or Latin Kurmanji. Examples of terminology: Iraq=عێراق; Baghdad=بەغدا; Erbil=هەولێر; Iran=ئێران; Trump=ترامپ; dollar=دۆلار; dinar=دینار; exchange rate=نرخی ئاڵوگۆڕ; interest rates=نرخی سوود; central bank=بانکی ناوەندی; war=جەنگ; ceasefire=ئاگربەست; Saudi Arabia=عەرەبستانی سعوودی. Use natural Sorani journalism.'
    : 'Write idiomatic Modern Standard Arabic used by professional news agencies; never use Kurdish wording.';
  const prompt='You are an experienced Kurdish and Arabic news translator, not a summarizer. Translate the COMPLETE meaning of the source passage into '+target+'. '+
    glossary+' Write smooth natural journalistic sentences. NEVER shorten, summarize, soften, exaggerate, invert, or omit any assertion. '+
    'Preserve who did what to whom, exact attribution, hedging (reportedly, could, may), tense, negation, and uncertainty. '+
    'Preserve each proper name, numerical value, currency pair like USD/IQD or XAU/USD, percentage and date exactly. '+
    'Background context may help resolve ambiguity, but do not translate it or introduce facts from it. '+
    'Output ONLY the faithful translated passage with no explanation or introduction. /no_think';
  try{
    const reply=await ai.run('@cf/qwen/qwen3-30b-a3b-fp8',{
      messages:[{role:'system',content:prompt},{role:'user',content:
        'SOURCE PASSAGE (translate in full):\n'+text+
        (context?'\n\nBACKGROUND CONTEXT (for interpretation only, not to be translated):\n'+clean(context).slice(0,350):'')+
        '\n\nReturn only the translation of SOURCE PASSAGE.'}],
      max_tokens:430,temperature:0,stream:false,enable_thinking:false
    });
    const raw=String(reply?.response||reply?.choices?.[0]?.message?.content||'');
    const translated=clean(raw.replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/^["“”']|["“”']$/g,''));
    if(translated.length>Math.max(240,text.length*4))return '';
    return isUsefulTranslation(text,translated)&&isScriptAppropriate(translated,lang)?translated:'';
  }catch{return '';}
}

async function digest(value){
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function translationCacheKey(request, lang, text, context=''){
  const hash = await digest(`${lang}\n${comparable(text)}\n${comparable(context)}`);
  return new Request(`${new URL(request.url).origin}/__hawali_translation_cache/v4/${lang}/${hash}`, { method: 'GET' });
}

async function readCachedTranslation(cache, key){
  if(!cache) return '';
  const response = await cache.match(key);
  if(!response) return '';
  try{
    const payload = await response.json();
    return clean(payload?.translated);
  }catch{
    return '';
  }
}

async function translateOne(text, targets, lang, request, cache, cacheWrites, ai, context=''){
  const original = clean(text);
  if(!original) return { translated: '', source: 'empty' };
  if(lang === 'en') return { translated: original, source: 'original' };

  const cacheKey = cache ? await translationCacheKey(request, lang, original, context) : null;
  const cached = cacheKey ? await readCachedTranslation(cache, cacheKey) : '';
  if(cached){
    const quality=translationQuality(original,cached,lang);
    if(quality.valid) return { translated: quality.text, source: 'cache' };
  }

  const generated=await callWorkersAI(original,lang,ai,context);
  const aiQuality=translationQuality(original,generated,lang);
  if(aiQuality.valid){
    if(cache && cacheKey) cacheWrites.push(cache.put(cacheKey,Response.json({translated:aiQuality.text},{
      headers:{'Cache-Control':`public, max-age=${TRANSLATION_CACHE_TTL}`}
    })));
    return {translated:aiQuality.text,source:'workers-ai'};
  }

  for(const target of targets){
    try{
      const translated = await callGoogle(original, target);
      const quality=translationQuality(original,translated,lang);
      if(quality.valid){
        if(cache && cacheKey){
          cacheWrites.push(cache.put(cacheKey, Response.json({ translated: quality.text }, {
            headers: { 'Cache-Control': `public, max-age=${TRANSLATION_CACHE_TTL}` }
          })));
        }
        return { translated: quality.text, source: 'live' };
      }
    }catch{}
  }

  const alternate = await callMyMemory(original, lang);
  const alternateQuality=translationQuality(original,alternate,lang);
  if(alternateQuality.valid){
    if(cache && cacheKey) cacheWrites.push(cache.put(cacheKey, Response.json({ translated: alternateQuality.text }, {
      headers:{ 'Cache-Control': `public, max-age=${TRANSLATION_CACHE_TTL}` }
    })));
    return { translated:alternateQuality.text, source:'alternate' };
  }
  return { translated:original, source:'unavailable' };
}

async function mapWithConcurrency(values, concurrency, mapper){
  const output = new Array(values.length);
  let cursor = 0;
  async function run(){
    while(cursor < values.length){
      const index = cursor++;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, run));
  return output;
}

async function readBody(request){
  const contentLength = Number(request.headers.get('content-length') || 0);
  if(Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw new Error('Request body is too large');
  const text = await request.text();
  if(new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('Request body is too large');
  return text ? JSON.parse(text) : {};
}

export async function onRequest(context){
  const { request } = context;
  const headers = responseHeaders(request);
  if(!isAllowedOrigin(request)) return Response.json({ ok: false, error: 'Origin not allowed', translated: [] }, { status: 403, headers });
  if(request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if(request.method !== 'POST'){
    headers.set('Allow', 'POST, OPTIONS');
    return Response.json({ ok: false, error: 'POST only', translated: [] }, { status: 405, headers });
  }

  try{
    const body = await readBody(request);
    const lang = String(body.lang || 'ku');
    if(!TARGETS[lang]) return Response.json({ ok: false, error: 'Unsupported language', translated: [] }, { status: 400, headers });
    if(!Array.isArray(body.texts)) return Response.json({ ok: false, error: 'texts must be an array', translated: [] }, { status: 400, headers });
    if(body.texts.length > MAX_TEXTS){
      return Response.json({ ok: false, error: `A maximum of ${MAX_TEXTS} texts is allowed per request`, translated: [] }, { status: 413, headers });
    }
    // Optional per-text context is used only to disambiguate news translation
    // for AI; it must never be inserted into the translated output.
    if(body.contexts !== undefined && (!Array.isArray(body.contexts) || body.contexts.length !== body.texts.length || body.contexts.some(value=>typeof value!=='string'))){
      return Response.json({ok:false,error:'contexts must match texts',translated:[]},{status:400,headers});
    }
    const texts = body.texts.map(clean);
    const contexts = texts.map((_,i)=>clean(body.contexts?.[i]||'').slice(0,350));
    const cache = globalThis.caches?.default;
    const cacheWrites = [];
    const results = await mapWithConcurrency(texts, TRANSLATE_CONCURRENCY, (text,i) => translateOne(text, TARGETS[lang], lang, request, cache, cacheWrites, context.env?.AI, contexts[i]));
    if(cacheWrites.length){
      const write = Promise.all(cacheWrites).catch(error => {
        console.warn(JSON.stringify({ event: 'translation_cache_write_failed', error: errorMessage(error) }));
      });
      if(context.waitUntil) context.waitUntil(write);
      else await write;
    }

    return Response.json({
      ok: true,
      lang,
      targets: TARGETS[lang],
      translated: results.map(result => result.translated),
      sources: results.map(result => result.source)
    }, { headers });
  }catch(error){
    const message = errorMessage(error);
    const status = message === 'Request body is too large' ? 413 : 400;
    return Response.json({ ok: false, error: message || 'Translate failed', translated: [] }, { status, headers });
  }
}
