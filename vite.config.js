import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const TARGETS = {
  ku: ['ckb', 'ku'],
  ar: ['ar'],
  en: ['en']
};

function clean(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 700);
}

function comparable(value = '') {
  return clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function isUsefulTranslation(original, translated) {
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

function fallbackTranslate(text, lang) {
  const original = clean(text);
  const options = FALLBACKS[lang] || [];
  return options.find(item => item.test.test(original))?.text || original;
}

function jsonHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, jsonHeaders());
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 64_000) reject(new Error('Request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readTranslateBody(req) {
  if (req.method === 'GET') {
    const url = new URL(req.url || '/', 'http://localhost');
    return { lang: url.searchParams.get('lang') || 'ku', texts: [url.searchParams.get('q') || ''] };
  }
  const body = await readRequestBody(req);
  return body ? JSON.parse(body) : {};
}

async function callGoogle(text, target) {
  const q = clean(text);
  if (!q || target === 'en') return q;

  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl='
    + encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 HawaliAburiTranslate',
      'accept': 'application/json,text/plain,*/*'
    }
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  const out = Array.isArray(data?.[0]) ? data[0].map(part => part?.[0] || '').join('').trim() : '';
  return out || q;
}

async function translateOne(text, targets, lang) {
  const original = clean(text);
  if (!original) return '';

  for (const target of targets) {
    try {
      const translated = await callGoogle(original, target);
      if (isUsefulTranslation(original, translated)) return translated;
    } catch {}
  }

  return fallbackTranslate(original, lang);
}

function devTranslateApi() {
  return {
    name: 'hawali-dev-translate-api',
    configureServer(server) {
      server.middlewares.use('/api/translate', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, jsonHeaders());
          res.end();
          return;
        }
        if (!['GET', 'POST'].includes(req.method || '')) {
          sendJson(res, 405, { ok: false, error: 'GET or POST only', translated: [] });
          return;
        }

        try {
          const body = await readTranslateBody(req);
          const lang = body.lang || 'ku';
          const targets = TARGETS[lang] || [lang];
          const texts = Array.isArray(body.texts) ? body.texts.slice(0, 30).map(clean) : [];
          const translated = [];

          for (const text of texts) {
            translated.push(await translateOne(text, targets, lang));
          }

          sendJson(res, 200, { ok: true, lang, targets, translated });
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message || 'Translate failed', translated: [] });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), devTranslateApi()],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
