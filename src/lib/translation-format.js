export const TRANSLATION_VERSION = 'hawal-news-v3';
export const TRANSLATION_LANGUAGES = {
  ku: { code: 'ckb', name: 'Central Kurdish (Sorani), written in the Kurdish Arabic alphabet' },
  ar: { code: 'ar', name: 'Modern Standard Arabic' },
  en: { code: 'en', name: 'English' }
};
export const MAX_TRANSLATION_TEXT = 1500;
export const MAX_TRANSLATION_BATCH = 8;
export const MAX_TRANSLATION_CHARS = 5000;

export function cleanTranslationText(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
  const decoded = String(value ?? '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key) => {
    if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? entity;
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : entity;
  });
  return decoded.normalize('NFC').replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

// Avoid needless requests for native text. Uncertain text goes to the model.
export function isTargetLanguage(text, language) {
  const letters = text.match(/\p{L}/gu) || [];
  if (!letters.length) return true;
  const arabic = letters.filter(letter => /\p{Script=Arabic}/u.test(letter)).length;
  if (language === 'en') {
    return letters.every(letter => /[A-Za-z]/.test(letter))
      && /\b(?:the|a|an|in|on|to|of|for|and|is|are|was|with|as|from|by|at|says|said|after|over|amid|gold|oil|dollar|market|markets)\b/i.test(text);
  }
  if (arabic / letters.length < 0.75) return false;
  const sorani = /[ەێۆڕڵ]/u.test(text);
  return language === 'ku' ? sorani : language === 'ar' && !sorani;
}

function figures(text) {
  const normalized = text.replace(/[٠-٩۰-۹]/gu, digit => {
    const code = digit.charCodeAt(0);
    return String(code - (code >= 0x6f0 ? 0x6f0 : 0x660));
  }).replace(/٬/gu, ',').replace(/٫/gu, '.');
  return (normalized.match(/\d+(?:[,.]\d+)*/g) || [])
    .map(number => number.replace(/,/g, '')).sort();
}

// These checks catch corrupted output; they do not claim to prove semantics.
export function checkTranslatedText(source, candidate, language) {
  if (typeof candidate !== 'string') return { ok: false, error: 'invalid-output' };
  const text = cleanTranslationText(candidate);
  if (!text || /<[^>]+>|\uFFFD|(?:^|\n)```/u.test(text)
      || /\b(?:as an ai|here is the translation|i cannot translate)\b/i.test(text)) {
    return { ok: false, error: 'invalid-output' };
  }
  if (text === cleanTranslationText(source) && !isTargetLanguage(source, language)
      && !(language === 'en' && /^[\p{Script=Latin}\P{L}]+$/u.test(text))) {
    return { ok: false, error: 'untranslated-output' };
  }
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length && language !== 'en') {
    const arabic = letters.filter(letter => /\p{Script=Arabic}/u.test(letter)).length;
    if (arabic / letters.length < 0.4) return { ok: false, error: 'wrong-language' };
    if (language === 'ku' && letters.length > 12 && !/[ەێۆڕڵ]/u.test(text)) {
      return { ok: false, error: 'wrong-language' };
    }
    const words = text.match(/\p{L}+/gu) || [];
    if (words.some(word => /\p{Script=Arabic}/u.test(word) && /[A-Za-z]/.test(word))
        || /\b(?:the|and|but|because|nothing|during|without|would|could|should|despite|between|through)\b/.test(text)) {
      return { ok: false, error: 'mixed-language' };
    }
  }
  if (language === 'en' && letters.length
      && letters.filter(letter => /\p{Script=Latin}/u.test(letter)).length / letters.length < 0.75) {
    return { ok: false, error: 'wrong-language' };
  }
  if (JSON.stringify(figures(source)) !== JSON.stringify(figures(text))) {
    return { ok: false, error: 'changed-number' };
  }
  for (const pair of source.match(/\b[A-Z]{3}\/\s*[A-Z]{3}\b/g) || []) {
    if (!text.replace(/\s/g, '').includes(pair.replace(/\s/g, ''))) {
      return { ok: false, error: 'changed-currency-pair' };
    }
  }
  if (/(\p{L}{2,})(?:\s+\1){4,}/iu.test(text)) return { ok: false, error: 'repeated-output' };
  return { ok: true, text };
}

export function translationChunks(value, limit = MAX_TRANSLATION_TEXT) {
  const text = cleanTranslationText(value);
  if (!text) return [];
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    let end = remaining.lastIndexOf('\n', limit);
    if (end < limit / 2) end = remaining.lastIndexOf(' ', limit);
    if (end < 1) end = limit;
    if (/[\uD800-\uDBFF]/u.test(remaining[end - 1])) end--;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function originalNewsField(item, field) {
  return cleanTranslationText(item?.[field + 'En'] || item?.[field] || '');
}

export function localizedNewsField(item, field, language) {
  const localized = item?.translation;
  return localized?.version === TRANSLATION_VERSION && localized.language === language
    ? localized[field] || originalNewsField(item, field) : originalNewsField(item, field);
}
