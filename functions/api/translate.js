const TARGETS = { ku: 'ckb', ar: 'ar', en: 'en' };

function clean(value = ''){
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 900);
}

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=3600'
  };
}

async function googleTranslate(text, target){
  const q = clean(text);
  if(!q) return '';
  if(target === 'en') return q;
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 HawaliAburiTranslate/1.0',
      'accept': 'application/json,text/plain,*/*'
    }
  });
  if(!res.ok) throw new Error('Google Translate failed: ' + res.status);
  const data = await res.json();
  return Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : q;
}

export async function onRequest({ request }){
  if(request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if(request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: corsHeaders() });

  try{
    const body = await request.json();
    const lang = body.lang || 'ku';
    const target = TARGETS[lang] || lang;
    const texts = Array.isArray(body.texts) ? body.texts.slice(0, 20).map(clean) : [];
    const translated = [];

    for(const text of texts){
      translated.push(await googleTranslate(text, target));
    }

    return Response.json({ lang, target, translated }, { headers: corsHeaders() });
  }catch(error){
    return Response.json({ error: error.message || 'Translate failed' }, { status: 500, headers: corsHeaders() });
  }
}
