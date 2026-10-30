import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { FEEDS } from './functions/api/news.js';
import { onRequest as translateRequest } from './functions/api/translate.js';
import { onRequest as translationStatusRequest } from './functions/api/translation-status.js';

// Use the SAME production translation handlers in Vite development.
// The previous dev-only handler sent generic hard-coded topic sentences and
// omitted translatedFlags, so the UI discarded its apparent translations.
const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8'
};

function sendJson(res, status, payload) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > 16000) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.pause();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function serveProductionHandler(req, res, handler, path, env) {
  try {
    const method = req.method || 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);
    const origin = (req.socket?.encrypted ? 'https://' : 'http://') + (req.headers.host || 'localhost:5173');
    const headers = new Headers();
    if (req.headers.origin) headers.set('Origin', req.headers.origin);
    if (req.headers['content-type']) headers.set('Content-Type', req.headers['content-type']);
    const request = new Request(origin + path, { method, headers, ...(body === undefined ? {} : { body }) });
    const response = await handler({ request, env, waitUntil: promise => { Promise.resolve(promise).catch(() => {}); } });
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  } catch (error) {
    sendJson(res, error?.status || 500, { ok:false, error:error?.status === 413 ? 'Request too large' : 'Translation API failed' });
  }
}

function devTranslateApi() {
  return {
    name: 'hawali-dev-translate-api',
    configureServer(server) {
      // Keys stay on the dev server. Only VITE_-prefixed variables are exposed
      // by Vite to client code; the official translator keys are never copied.
      const env = { ...loadEnv(server.config.mode, server.config.root, ''), ...process.env };

      server.middlewares.use('/api/sources', (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok:false, error:'GET only', sources:[] });
          return;
        }
        const sources = [...new Set(FEEDS.map(feed => feed.source).filter(Boolean))];
        sendJson(res, 200, { sources, count:sources.length });
      });

      server.middlewares.use('/api/translation-status', (req, res) =>
        serveProductionHandler(req, res, translationStatusRequest, '/api/translation-status', env)
      );
      server.middlewares.use('/api/translate', (req, res) =>
        serveProductionHandler(req, res, translateRequest, '/api/translate', env)
      );
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
