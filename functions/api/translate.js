const TARGETS = {
  ku: ['ckb', 'ku'],
  ar: ['ar'],
  en: ['en']
};
const MAX_BODY_BYTES = 64 * 1024;
const MAX_TEXTS = 30;
const TRANSLATE_CONCURRENCY = 6;
const TRANSLATE_TIMEOUT_MS = 5000;
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

const FALLBACKS = {
  ku: [
    { test: /central[- ]?bank messaging|major currency pairs/i, text: 'نامەکانی بانکی ناوەندی دەتوانن کاریگەری لەسەر دۆلار، زێڕ و هاوتاکانی دراو دروست بکەن.' },
    { test: /depends heavily on oil revenue|export or price changes/i, text: 'چونکە عێراق زۆر پشت بە داهاتی نەوت دەبەستێت، گۆڕانی هەناردە یان نرخ کاریگەریی ئابووری هەیە.' },
    { test: /market[- ]?moving update|trusted sources/i, text: 'نوێکارییەکی کاریگەر لە بازاڕەکان لە سەرچاوە باوەڕپێکراوەکان.' },
    { test: /federal reserve|interest rates?|central bank|fed\b|inflation|cpi/i, text: 'فیدڕاڵ ڕیزێرڤ نیشانەی ڕێبازێکی بەئاگاداری لەسەر نرخی سوود دەدات.' },
    { test: /kurdistan region|erbil|sulaimani|duhok/i, text: 'هەواڵەکانی هەرێمی کوردستان لە هەولێر، سلێمانی و دهۆک چاودێری دەکرێن.' },
    { test: /iraq|baghdad|dinar|cbi|budget|banking|iraqi/i, text: 'ئابووری عێراق سەرنجی لەسەر بودجە، بانکداری، دینار و داهاتی نەوتە.' },
    { test: /oil|opec|brent|wti|crude|energy|pipeline/i, text: 'نرخی نەوت چاودێری مەترسییەکانی ڕۆژهەڵاتی ناوەڕاست و نیشانەکانی دابینکردنی ئۆپێک دەکات.' },
    { test: /bitcoin|crypto|etf|coindesk/i, text: 'بازرگانانی بیتکۆین چاودێری هەستی ڕیسک و ڕەوتی ETF دەکەن.' },
    { test: /trump|tariff|white house|geopolitic/i, text: 'سیاسەت و باجە بازرگانییەکانی ئەمریکا کاریگەری لەسەر بازاڕە جیهانییەکان دەهێڵن.' }
  ],
  ar: [
    { test: /central[- ]?bank messaging|major currency pairs/i, text: 'قد تؤثر رسائل البنوك المركزية مباشرة في الدولار والذهب وأزواج العملات الرئيسية.' },
    { test: /depends heavily on oil revenue|export or price changes/i, text: 'لأن العراق يعتمد كثيراً على إيرادات النفط، فإن تغير الصادرات أو الأسعار مهم اقتصادياً.' },
    { test: /market[- ]?moving update|trusted sources/i, text: 'تحديث مؤثر في الأسواق من مصادر موثوقة.' },
    { test: /federal reserve|interest rates?|central bank|fed\b|inflation|cpi/i, text: 'يشير الاحتياطي الفيدرالي إلى نهج حذر بشأن أسعار الفائدة.' },
    { test: /kurdistan region|erbil|sulaimani|duhok/i, text: 'تتم متابعة أخبار إقليم كردستان من أربيل والسليمانية ودهوك.' },
    { test: /iraq|baghdad|dinar|cbi|budget|banking|iraqi/i, text: 'يتجه تركيز اقتصاد العراق إلى الموازنة والمصارف والدينار وإيرادات النفط.' },
    { test: /oil|opec|brent|wti|crude|energy|pipeline/i, text: 'تراقب أسعار النفط مخاطر الشرق الأوسط وإشارات إمدادات أوبك.' },
    { test: /bitcoin|crypto|etf|coindesk/i, text: 'يراقب متداولو بيتكوين معنويات المخاطر وتدفقات صناديق ETF.' },
    { test: /trump|tariff|white house|geopolitic/i, text: 'تؤثر السياسة والرسوم التجارية الأميركية في الأسواق العالمية.' }
  ]
};

function fallbackTranslate(text, lang){
  const original = clean(text);
  const options = FALLBACKS[lang] || [];
  return options.find(item => item.test.test(original))?.text || original;
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
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(q);
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

async function digest(value){
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function translationCacheKey(request, lang, text){
  const hash = await digest(`${lang}\n${comparable(text)}`);
  return new Request(`${new URL(request.url).origin}/__hawali_translation_cache/v2/${lang}/${hash}`, { method: 'GET' });
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

async function translateOne(text, targets, lang, request, cache, cacheWrites){
  const original = clean(text);
  if(!original) return { translated: '', source: 'empty' };
  if(lang === 'en') return { translated: original, source: 'original' };

  const cacheKey = cache ? await translationCacheKey(request, lang, original) : null;
  const cached = cacheKey ? await readCachedTranslation(cache, cacheKey) : '';
  if(cached) return { translated: cached, source: 'cache' };

  for(const target of targets){
    try{
      const translated = await callGoogle(original, target);
      if(isUsefulTranslation(original, translated)){
        if(cache && cacheKey){
          cacheWrites.push(cache.put(cacheKey, Response.json({ translated }, {
            headers: { 'Cache-Control': `public, max-age=${TRANSLATION_CACHE_TTL}` }
          })));
        }
        return { translated, source: 'live' };
      }
    }catch{}
  }

  const fallback = fallbackTranslate(original, lang);
  return { translated: fallback, source: fallback === original ? 'original' : 'fallback' };
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
    const texts = body.texts.slice(0, MAX_TEXTS).map(clean);
    const cache = globalThis.caches?.default;
    const cacheWrites = [];
    const results = await mapWithConcurrency(texts, TRANSLATE_CONCURRENCY, text => translateOne(text, TARGETS[lang], lang, request, cache, cacheWrites));
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
