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

async function translateOne(text, targets) {
  const original = clean(text);
  if (!original) return '';

  for (const target of targets) {
    try {
      const translated = await callGoogle(original, target);
      if (translated) return translated;
    } catch {}
  }

  return original;
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
            translated.push(await translateOne(text, targets));
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
