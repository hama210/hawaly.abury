import { useEffect, useMemo, useRef, useState } from 'react';
import {
  alreadyInTargetLanguage,
  validateTranslation
} from '../lib/translation-check.js';

const PREFIX = 'hawal-inline-translation-v14:';
const TTL = 24 * 60 * 60 * 1000;

const BATCH = 8;
const CONCURRENCY = 3;

const entries = new Map();
const skipped = new Map();

function original(item, field) {
  if (field === 'title') {
    return String(item.titleEn || item.title || '').trim();
  }
  if (field === 'content') {
    return String(item.contentEn || item.content || '').trim();
  }
  return String(item.summaryEn || item.summary || '').trim();
}

function cacheKey(lang, text) {

  let hash = 2166136261;

  const raw = `${lang}\u0000${text}`;

  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return PREFIX + lang + ':' + (hash >>> 0).toString(36);
}

export function getCachedTranslation(lang, text) {
  if (!text) return '';

  const key = cacheKey(lang, text);

  let entry = entries.get(key);

  if (!entry) {
    try {
      entry = JSON.parse(
        localStorage.getItem(key) || sessionStorage.getItem(key) || 'null'
      );
    } catch {}

    if (entry) {
      entries.set(key, entry);
    }
  }

  if (
    !entry ||
    entry.original !== text ||
    Date.now() - entry.savedAt > TTL
  ) {
    return '';
  }

  const result = validateTranslation(
    text,
    entry.text,
    lang
  );

  return result.ok ? result.text : '';
}

export function saveCachedTranslation(lang, originalText, candidate) {

  const approved = validateTranslation(
    originalText,
    candidate,
    lang
  );

  if (!approved.ok) {
    return false;
  }

  const key = cacheKey(lang, originalText);

  const value = {
    original: originalText,
    text: approved.text,
    savedAt: Date.now()
  };

  entries.set(key, value);

  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}

  return true;
}

export async function clientFallbackTranslate(text, lang, signal) {
  if (!text || lang === 'en') return '';
  const tl = lang === 'ku' ? 'ckb' : lang;
  const endpoints = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${tl}&q=${encodeURIComponent(text)}`
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
      if (!res.ok) continue;
      const data = await res.json();
      let candidate = '';
      if (Array.isArray(data) && Array.isArray(data[0])) {
        candidate = data[0].map(seg => (Array.isArray(seg) ? seg[0] : (typeof seg === 'string' ? seg : ''))).join('').trim();
      } else if (Array.isArray(data) && typeof data[0] === 'string') {
        candidate = data[0].trim();
      } else if (data?.sentences && Array.isArray(data.sentences)) {
        candidate = data.sentences.map(s => s?.trans || '').join('').trim();
      }
      const checked = validateTranslation(text, candidate, lang);
      if (checked.ok) {
        saveCachedTranslation(lang, text, checked.text);
        return checked.text;
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }
  return '';
}

function createWorker(lang, setTick, setBusy, setIssue) {

  return {
    lang,
    running: 0,
    queue: [],
    seen: new Set(),
    controller: new AbortController(),
    closed: false,
    setTick,
    setBusy,
    setIssue,
    pump: null
  };
}

export function useClientTranslator(
  news,
  lang,
  visibleLimit = 60
) {

  const source = Array.isArray(news)
    ? news
    : [];

  const [version, setVersion] = useState(0);
  const [translating, setTranslating] = useState(false);
  const [translationIssue, setTranslationIssue] = useState('');
  const [retryTick, setRetryTick] = useState(0);

  const task = useRef(null);

  const translatedNews = useMemo(() => {

    return source.map(item => {

      const clean = {
        ...item,
        titleKu: '',
        titleAr: '',
        summaryKu: '',
        summaryAr: '',
        contentKu: '',
        contentAr: '',
        _hawalInlineVerified: true
      };

      if (lang === 'en') {
        return clean;
      }

      const title = original(item, 'title');
      const summary = original(item, 'summary');
      const content = original(item, 'content');

      const fields =
        lang === 'ku'
          ? ['titleKu', 'summaryKu', 'contentKu']
          : ['titleAr', 'summaryAr', 'contentAr'];

      return {
        ...clean,
        [fields[0]]:
          getCachedTranslation(lang, title) || '',

        [fields[1]]:
          getCachedTranslation(lang, summary) || '',

        [fields[2]]:
          getCachedTranslation(lang, content) || ''
      };
    });

  }, [source, lang, version]);

  useEffect(() => {

    let work = task.current;

    if (!work || work.lang !== lang) {

      if (work) {
        work.closed = true;
        work.controller.abort();
      }

      work = createWorker(
        lang,
        setVersion,
        setTranslating,
        setTranslationIssue
      );
      setTranslationIssue('');

      task.current = work;
    }

    if (lang === 'en') {
      setTranslating(false);
      return;
    }

    // Translate visible items first, then remaining items so filtered tabs & briefs are also translated
    const limit = Math.min(Math.max(1, visibleLimit), source.length);
    const prioritized = [
      ...source.slice(0, limit),
      ...source.slice(limit)
    ];

    const now = Date.now();

    const headlines = [];
    const summaries = [];

    for (const item of prioritized) {

      for (const field of ['title', 'summary']) {

        const text = original(item, field);

        if (!text || text.length > 1150) {
          continue;
        }

        if (
          alreadyInTargetLanguage(text, lang)
        ) {
          continue;
        }

        if (
          getCachedTranslation(lang, text)
        ) {
          continue;
        }

        const key = cacheKey(lang, text);

        if (
          work.seen.has(key) ||
          (skipped.get(key) || 0) > now
        ) {
          continue;
        }

        work.seen.add(key);

        (
          field === 'title'
            ? headlines
            : summaries
        ).push({
          text,
          key
        });
      }
    }

    work.queue.push(
      ...headlines,
      ...summaries
    );

    if (!work.pump) {

      work.pump = () => {

        if (work.closed) {
          return;
        }

        while (
          work.running < CONCURRENCY &&
          work.queue.length
        ) {

          const group =
            work.queue.splice(0, BATCH);

          work.running++;

          fetch('/api/translate', {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              lang: work.lang,
              texts: group.map(
                item => item.text
              )
            }),
            signal: work.controller.signal
          })
            .then(async response => {

              const result =
                await response
                  .json()
                  .catch(() => null);

              let changed = false;
              const failedJobs = [];

              if (
                response.ok &&
                result?.ok &&
                Array.isArray(result.translated) &&
                result.translated.length === group.length
              ) {
                group.forEach((job, index) => {
                  const translated = result.translated[index];
                  const approved =
                    result.translatedFlags?.[index] &&
                    saveCachedTranslation(work.lang, job.text, translated);

                  if (approved) {
                    changed = true;
                  } else {
                    failedJobs.push({
                      job,
                      reason: String(result.failureReasons?.[index] || 'translation-unavailable')
                    });
                  }
                });
              } else {
                group.forEach(job => {
                  failedJobs.push({ job, reason: 'request-failed' });
                });
              }

              // Client-side direct fallback for any item that failed on server (e.g. Cloudflare 429 or static host)
              if (failedJobs.length && !work.closed) {
                for (const entry of failedJobs) {
                  if (work.closed) break;
                  const direct = await clientFallbackTranslate(entry.job.text, work.lang, work.controller.signal);
                  if (direct) {
                    changed = true;
                  } else {
                    work.setIssue(entry.reason.slice(0, 180));
                    skipped.set(entry.job.key, Date.now() + 25 * 1000);
                  }
                }
              }

              if (changed && !work.closed) {
                work.setIssue('');
                work.setTick(value => value + 1);
              }
            })
            .catch(async error => {

              if (
                work.closed ||
                error?.name ===
                  'AbortError'
              ) {
                return;
              }

              let changed = false;
              for (const job of group) {
                if (work.closed) break;
                try {
                  const direct = await clientFallbackTranslate(job.text, work.lang, work.controller.signal);
                  if (direct) {
                    changed = true;
                  } else {
                    skipped.set(job.key, Date.now() + 15 * 1000);
                  }
                } catch {}
              }

              if (changed && !work.closed) {
                work.setIssue('');
                work.setTick(value => value + 1);
              } else if (!work.closed) {
                work.setIssue('request-failed');
              }
            })
            .finally(() => {

              group.forEach(job => {
                work.seen.delete(
                  job.key
                );
              });

              work.running--;

              if (!work.closed) {
                work.pump();
              }
            });
        }

        work.setBusy(
          work.running > 0 ||
            work.queue.length > 0
        );
      };
    }

    work.pump();

  }, [
    source,
    lang,
    visibleLimit,
    retryTick
  ]);

  useEffect(() => {

    return () => {

      if (task.current) {

        task.current.closed = true;

        task.current.controller.abort();
      }
    };
  }, []);

  const retryTranslations = () => {
    skipped.clear();
    if (task.current) {
      task.current.closed = true;
      task.current.controller.abort();
      task.current = null;
    }
    setTranslationIssue('');
    setRetryTick(value => value + 1);
  };

  return {
    translatedNews,
    translating,
    translationIssue,
    retryTranslations
  };
}
