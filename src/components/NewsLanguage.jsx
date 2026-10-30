import React from 'react';
import { polishCopy } from '../lib/polish-copy.js';
import { getTitle, getSummary } from '../utils/news.js';
import { alreadyInTargetLanguage } from '../lib/translation-check.js';
export function NewsLanguage({item,lang}) {
  const p=polishCopy[lang], title=item.titleEn || item.title || '', summary=item.summaryEn || item.summary || '';
  const translated=getTitle(item,lang)!==title;
  const partial=translated && summary && getSummary(item,lang)===summary && !alreadyInTargetLanguage(summary,lang);
  return <small className={'news-language '+(translated?'translated':'original')}>
    {translated ? (partial?p.partialTranslation:p.translated) : p.originalLanguage}
  </small>;
}
