import { useEffect, useMemo, useRef, useState } from 'react';
import { newsTranslator, newsTranslationJobs } from '../lib/news-translation.js';
import { TRANSLATION_VERSION, originalNewsField } from '../lib/translation-format.js';

export function useNewsTranslation(news, language) {
  const [revision, setRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, error: '' });
  const task = useRef(null);
  useEffect(() => {
    let work = task.current;
    if (!work || work.closed || work.language !== language || work.retry !== retry) {
      if (work) { work.closed = true; work.controller.abort(); clearTimeout(work.timer); }
      work = { language, retry, controller: new AbortController(), results: new Map(), queued: new Set(), requests: new Map(), closed: false };
      task.current = work;
    }
    work.plan = newsTranslationJobs(news);
    const currentSources = new Set(work.plan.map(job => job.text));
    for (const text of work.queued) {
      if (currentSources.has(text)) continue;
      work.requests.get(text)?.abort();
      work.requests.delete(text); work.queued.delete(text); work.results.delete(text);
    }
    const report = () => {
      if (work.closed) return;
      const results = work.plan.map(job => work.results.get(job.text)).filter(Boolean);
      const failures = results.filter(result => result.state === 'failed');
      setProgress({ total: work.plan.length, completed: results.length, failed: failures.length, error: failures[0]?.error || '', providerCode: failures[0]?.providerCode });
    };
    const publish = () => {
      if (!work.timer) work.timer = setTimeout(() => {
        work.timer = null;
        if (!work.closed) setRevision(value => value + 1);
      }, 40);
    };
    for (const job of work.plan) {
      if (work.queued.has(job.text)) continue;
      work.queued.add(job.text);
      const saved = newsTranslator.peek(job.text, language);
      if (saved) { work.results.set(job.text, saved); continue; }
      const controller = new AbortController();
      work.requests.set(job.text, controller);
      newsTranslator.translate(job.text, language, { signal: AbortSignal.any([work.controller.signal, controller.signal]), priority: job.priority })
        .then(result => {
          if (work.closed || controller.signal.aborted) return;
          work.results.set(job.text, result); report(); publish();
        }).catch(error => {
          if (work.closed || error.name === 'AbortError') return;
          work.results.set(job.text, { state: 'failed', error: error.message }); report();
        }).finally(() => { if (work.requests.get(job.text) === controller) work.requests.delete(job.text); });
    }
    report();
  }, [news, language, retry]);

  useEffect(() => () => {
    const work = task.current;
    if (work) { work.closed = true; work.controller.abort(); clearTimeout(work.timer); }
  }, []);

  const translatedNews = useMemo(() => news.map(item => ({
    ...item,
    translation: {
      version: TRANSLATION_VERSION, language,
      errors: Object.fromEntries(['title', 'summary', 'content'].map(field => [field,
        task.current?.language === language ? task.current.results.get(originalNewsField(item, field))?.error : undefined])),
      ...Object.fromEntries(['title', 'summary', 'content'].map(field =>
        [field, newsTranslator.peek(originalNewsField(item, field), language)?.text || '']))
    }
  })), [news, language, revision]);

  return {
    translatedNews, progress,
    translating: progress.completed < progress.total,
    translationIssue: progress.error,
    retryTranslations() { newsTranslator.retry(); setRetry(value => value + 1); }
  };
}
