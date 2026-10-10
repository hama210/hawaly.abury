import { useEffect, useMemo, useRef, useState } from 'react';
import {translatePassages} from '../lib/keyless-translation.js';
import {
  alreadyInTargetLanguage,
  validateTranslation
} from '../lib/translation-check.js';

const PREFIX = 'hawal-google-keyless-v2:';
const TTL = 24 * 60 * 60 * 1000;

const BATCH = 4;
const CONCURRENCY = 1;

const entries = new Map();
const skipped = new Map();

function original(item, field) {
  return String(
    field === 'title'
      ? (item.titleEn || item.title || '')
      : (item.summaryEn || item.summary || '')
  ).trim();
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

function cached(lang, text) {

  const key = cacheKey(lang, text);

  let entry = entries.get(key);

  if (!entry) {
    try {
      entry = JSON.parse(
        sessionStorage.getItem(key) || 'null'
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

function save(lang, originalText, candidate) {

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
    sessionStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {}

  return true;
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
  visibleLimit = 28
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
        _hawalInlineVerified: true
      };

      if (lang === 'en') {
        return clean;
      }

      const title = original(item, 'title');
      const summary = original(item, 'summary');

      const fields =
        lang === 'ku'
          ? ['titleKu', 'summaryKu']
          : ['titleAr', 'summaryAr'];

      return {
        ...clean,
        [fields[0]]:
          cached(lang, title) || '',

        [fields[1]]:
          cached(lang, summary) || ''
      };
    });

  }, [source, lang, version]);

  useEffect(() => {

    let work = task.current;

    if (!work || work.closed || work.lang !== lang) {

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

    const visible = source.slice(
      0,
      Math.min(
        Math.max(1, visibleLimit),
        source.length
      )
    );

    const now = Date.now();

    const headlines = [];
    const summaries = [];

    for (const item of visible) {

      for (const field of ['title', 'summary']) {

        const text = original(item, field);

        if (!text) {
          continue;
        }

        if (
          alreadyInTargetLanguage(text, lang)
        ) {
          continue;
        }

        if (
          cached(lang, text)
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

          translatePassages(group.map(item=>item.text),work.lang,{
            signal: work.controller.signal
          })
            .then(result => {
              if(work.closed)return;

              if (
                !result?.ok ||
                !Array.isArray(
                  result.translated
                ) ||
                result.translated.length !==
                  group.length
              ) {
                throw new Error(
                  'translation failed'
                );
              }

              let changed = false;

              group.forEach(
                (job, index) => {

                  const translated =
                    result.translated[index];

                  const approved =
                    result.translatedFlags?.[
                      index
                    ] &&
                    save(
                      work.lang,
                      job.text,
                      translated
                    );

                  if (approved) {
                    changed = true;
                    work.setIssue('');
                  } else {
                    const reason = String(result.failureReasons?.[index] || 'translation-unavailable');
                    console.warn('[Hawal translator] '+reason.slice(0,180));
                    work.setIssue(reason.slice(0,180));

                    skipped.set(
                      job.key,
                      Date.now() +
                        30 * 1000
                    );
                  }
                }
              );

              if (
                changed &&
                !work.closed
              ) {
                work.setTick(
                  value => value + 1
                );
              }
            })
            .catch(error => {

              if (
                work.closed ||
                error?.name ===
                  'AbortError'
              ) {
                return;
              }

              work.setIssue('request-failed');
              group.forEach(job => {

                skipped.set(
                  job.key,
                  Date.now() +
                    15 * 1000
                );
              });
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
