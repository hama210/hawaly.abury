const TARGETS = {
  ku: ['ckb', 'ku'],
  ar: ['ar'],
  en: ['en']
};

function clean(value = ''){
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
}

function headers(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}

async function callGoogle(text, target){
  const q = clean(text);
  if(!q || target === 'en') return q;

  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 HawaliAburiTranslate',
      'accept': 'application/json,text/plain,*/*'
    }
  });
  if(!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const out = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : '';
  return out || q;
}

async function translateOne(text, targets){
  const original = clean(text);
  if(!original) return '';

  for(const target of targets){
    try{
      const translated = await callGoogle(original, target);
      if(translated) return translated;
    }catch{}
  }

  return original;
}

async function readBody(request){
  if(request.method === 'GET'){
    const url = new URL(request.url);
    return { lang: url.searchParams.get('lang') || 'ku', texts: [url.searchParams.get('q') || ''] };
  }
  return request.json();
}

export async function onRequest({ request }){
  if(request.method === 'OPTIONS') return new Response(null, { headers: headers() });
  if(!['GET','POST'].includes(request.method)) return Response.json({ error: 'GET or POST only' }, { status: 405, headers: headers() });

  try{
    const body = await readBody(request);
    const lang = body.lang || 'ku';
    const targets = TARGETS[lang] || [lang];
    const texts = Array.isArray(body.texts) ? body.texts.slice(0, 30).map(clean) : [];
    const translated = [];

    for(const text of texts){
      translated.push(await translateOne(text, targets));
    }

    return Response.json({ ok: true, lang, targets, translated }, { headers: headers() });
  }catch(error){
    return Response.json({ ok: false, error: error.message || 'Translate failed', translated: [] }, { status: 200, headers: headers() });
  }
}
