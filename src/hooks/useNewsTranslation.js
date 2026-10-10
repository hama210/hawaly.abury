import { useEffect, useMemo, useState } from 'react';
import { newsTranslator, translateNewsFeed } from '../lib/news-translation.js';
import { TRANSLATION_VERSION, originalNewsField } from '../lib/translation-format.js';

export function useNewsTranslation(news, language) {
  const [revision, setRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    const publish = () => {
      if (!timer) timer = setTimeout(() => { timer = null; setRevision(value => value + 1); }, 40);
    };
    translateNewsFeed(news, language, {
      signal: controller.signal,
      onTranslation: publish,
      onProgress: value => { if (!controller.signal.aborted) setProgress(value); }
    }).catch(error => {
      if (!controller.signal.aborted) setProgress(value => ({ ...value, error: error.message, failed: value.failed + 1, completed: value.total }));
    });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [news, language, retry]);

  const translatedNews = useMemo(() => news.map(item => ({
    ...item,
    translation: {
      version: TRANSLATION_VERSION, language,
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
