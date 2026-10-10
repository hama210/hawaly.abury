import {
  TRANSLATION_VERSION, TRANSLATION_LANGUAGES, MAX_TRANSLATION_TEXT,
  MAX_TRANSLATION_BATCH, MAX_TRANSLATION_CHARS, cleanTranslationText,
  checkTranslatedText, isTargetLanguage, translationChunks, originalNewsField
} from './translation-format.js';

const TTL = 24 * 60 * 60 * 1000;
const abortError = () => new DOMException('Translation cancelled', 'AbortError');
const failed = (text, error) => ({ source: text, text, state: 'failed', error });

export function createNewsTranslator({ fetcher = (...args) => fetch(...args), now = Date.now, storage = () => globalThis.sessionStorage, retryDelay = 2000 } = {}) {
  const cache = new Map();
  const jobs = new Map();
  let active = 0, sequence = 0, pausedUntil = 0, pauseError = '';
  const keyFor = (text, language) => `${TRANSLATION_VERSION}:${language}:${text}`;

  function remember(text, language, result) {
    const key = keyFor(text, language);
    const entry = { source: text, text: result.text, savedAt: now() };
    cache.set(key, entry);
    if (cache.size > 1500) cache.delete(cache.keys().next().value);
    try { storage()?.setItem(key, JSON.stringify(entry)); } catch {}
  }

  function peek(value, language) {
    const text = cleanTranslationText(value);
    if (!text || isTargetLanguage(text, language)) return { source: text, text, state: 'original' };
    const key = keyFor(text, language);
    let entry = cache.get(key);
    if (!entry) {
      try { entry = JSON.parse(storage()?.getItem(key) || 'null'); } catch {}
    }
    if (entry?.source === text && now() - entry.savedAt < TTL) {
      const checked = checkTranslatedText(text, entry.text, language);
      if (checked.ok) return { source: text, text: checked.text, state: 'translated' };
    }
    return null;
  }

  function finish(job, result) {
    if (result.state === 'translated') remember(job.text, job.language, result);
    if (jobs.get(job.key) === job) jobs.delete(job.key);
    for (const subscriber of job.subscribers) {
      subscriber.signal?.removeEventListener('abort', subscriber.abort);
      subscriber.resolve(result);
    }
    job.subscribers.clear();
  }

  async function run(group) {
    active++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    for (const job of group) {
      job.running = true;
      job.cancelGroup = () => {
        if (group.every(row => !row.subscribers.size)) controller.abort();
      };
    }
    let rows;
    try {
      const response = await fetcher('/api/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: group[0].language, texts: group.map(job => job.text) }),
        signal: controller.signal
      });
      const data = await response.json();
      if (response.status === 429 || response.status === 503) {
        pausedUntil = now() + (data.error === 'daily-limit' ? 5 * 60 * 1000 : 60 * 1000);
        pauseError = data.error || 'service-unavailable';
      }
      if (data.version !== TRANSLATION_VERSION || data.language !== group[0].language
          || !Array.isArray(data.results) || data.results.length !== group.length) {
        throw new Error(data.error || 'invalid-response');
      }
      rows = group.map((job, index) => {
        const row = data.results[index];
        if (row?.source !== job.text) return failed(job.text, 'invalid-response');
        if (row.state === 'failed') return failed(job.text, row.error || 'translation-failed');
        const checked = checkTranslatedText(job.text, row.text, job.language);
        return checked.ok ? { source: job.text, text: checked.text, state: 'translated' }
          : failed(job.text, checked.error);
      });
    } catch (error) {
      const reason = error.name === 'AbortError' ? 'request-timeout' : error.message || 'request-failed';
      if (group.some(job => job.subscribers.size)) {
        pausedUntil = now() + 15000; pauseError = reason;
      }
      rows = group.map(job => failed(job.text, reason));
    } finally {
      clearTimeout(timeout);
      group.forEach((job, index) => finish(job, rows[index]));
      active--;
      queueMicrotask(pump);
    }
  }

  function pump() {
    if (now() < pausedUntil) {
      for (const job of [...jobs.values()]) if (!job.running) finish(job, failed(job.text, pauseError));
      return;
    }
    while (active < 2) {
      const ready = [...jobs.values()].filter(job => !job.running && job.subscribers.size)
        .sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
      if (!ready.length) return;
      const group = [], language = ready[0].language;
      let chars = 0;
      for (const job of ready) {
        if (job.language !== language || group.length >= MAX_TRANSLATION_BATCH
            || chars + job.text.length > Math.min(2400, MAX_TRANSLATION_CHARS)) continue;
        group.push(job); chars += job.text.length;
      }
      void run(group);
    }
  }

  function passage(text, language, { signal, priority = 10 } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    const saved = peek(text, language);
    if (saved) return Promise.resolve(saved);
    if (now() < pausedUntil) return Promise.resolve(failed(text, pauseError));
    const key = keyFor(text, language);
    let job = jobs.get(key);
    if (!job) {
      job = { key, text, language, priority, sequence: sequence++, running: false, subscribers: new Set() };
      jobs.set(key, job);
    } else job.priority = Math.min(job.priority, priority);
    return new Promise((resolve, reject) => {
      const subscriber = { resolve, reject, signal };
      subscriber.abort = () => {
        job.subscribers.delete(subscriber);
        reject(abortError());
        if (!job.subscribers.size && jobs.get(key) === job) jobs.delete(key);
        job.cancelGroup?.();
      };
      job.subscribers.add(subscriber);
      signal?.addEventListener('abort', subscriber.abort, { once: true });
      queueMicrotask(pump);
    });
  }

  async function attempt(value, language, options = {}) {
    if (!Object.hasOwn(TRANSLATION_LANGUAGES, language)) throw new Error('Unsupported language');
    if (options.signal?.aborted) throw abortError();
    const text = cleanTranslationText(value), saved = peek(text, language);
    if (saved) return saved;
    if (text.length <= MAX_TRANSLATION_TEXT) return passage(text, language, options);
    const chunks = translationChunks(text);
    const rows = await Promise.all(chunks.map(chunk => passage(chunk, language, options)));
    if (options.signal?.aborted) throw abortError();
    const unsuccessful = rows.find(row => row.state === 'failed');
    if (unsuccessful) return failed(text, unsuccessful.error);
    const joined = rows.map(row => row.text).join('\n\n');
    const checked = checkTranslatedText(text, joined, language);
    if (!checked.ok) return failed(text, checked.error);
    const result = { source: text, text: checked.text, state: 'translated' };
    remember(text, language, result);
    return result;
  }

  async function translate(value, language, options = {}) {
    const first = await attempt(value, language, options);
    if (first.state !== 'failed' || options.retry === false
        || ['daily-limit', 'translation-not-configured'].includes(first.error)) return first;
    const delay = Math.max(retryDelay, pausedUntil - now() + 100);
    await new Promise((resolve, reject) => {
      if (options.signal?.aborted) { reject(abortError()); return; }
      const abort = () => { clearTimeout(timer); reject(abortError()); };
      const timer = setTimeout(() => {
        options.signal?.removeEventListener('abort', abort); resolve();
      }, delay);
      options.signal?.addEventListener('abort', abort, { once: true });
    });
    return attempt(value, language, options);
  }

  return { translate, peek, retry() { pausedUntil = 0; pauseError = ''; } };
}

export const newsTranslator = createNewsTranslator();

export function newsTranslationJobs(items) {
  const unique = new Map();
  for (const [priority, field] of ['title', 'summary'].entries()) {
    for (const item of items || []) {
      const text = originalNewsField(item, field) || (field === 'summary' ? originalNewsField(item, 'content') : '');
      if (text && !unique.has(text)) unique.set(text, { text, priority: 10 + priority * 10 });
    }
  }
  return [...unique.values()];
}

export async function translateNewsFeed(items, language, { client = newsTranslator, signal, onProgress = () => {}, onTranslation = () => {} } = {}) {
  const plan = newsTranslationJobs(items);
  const progress = { total: plan.length, completed: 0, failed: 0, error: '' };
  onProgress({ ...progress });
  await Promise.all(plan.map(async job => {
    const result = await client.translate(job.text, language, { signal, priority: job.priority });
    if (signal?.aborted) return;
    progress.completed++;
    if (result.state === 'failed') { progress.failed++; progress.error ||= result.error; }
    onTranslation(result);
    onProgress({ ...progress });
  }));
  return progress;
}
