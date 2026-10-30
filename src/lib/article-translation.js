import { alreadyInTargetLanguage, validateTranslation } from './translation-check.js';
import { getCachedTranslation, saveCachedTranslation, clientFallbackTranslate } from '../hooks/useClientTranslator.js';

// Split publisher-provided RSS body without dropping a single word. The
// translated article is displayed only if every segment passes validation.
export function articleChunks(body, max = 700) {
  const words = String(body || '').trim().split(/\s+/u).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > max) {
      chunks.push(current);
      current = '';
    }
    if (word.length > max) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < word.length; i += max) chunks.push(word.slice(i, i + max));
    } else {
      current += (current ? ' ' : '') + word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function translateArticleBody(text, lang, { signal, fetcher = fetch } = {}) {
  const original = String(text || '').trim();
  if (!original || alreadyInTargetLanguage(original, lang)) {
    return { translated: false, text: original };
  }

  const fullCached = getCachedTranslation(lang, original);
  if (fullCached) {
    return { translated: true, text: fullCached };
  }

  const chunks = articleChunks(original);
  if (!chunks.length || original.length > 25000) {
    return { translated: false, text: original };
  }

  const translated = [];
  try {
    for (let i = 0; i < chunks.length; i += 8) {
      const batch = chunks.slice(i, i + 8);
      let serverResults = null;

      try {
        const response = await fetcher('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, texts: batch }),
          signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(45000)])
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.ok && Array.isArray(data.translated) && data.translated.length === batch.length) {
            serverResults = data;
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
      }

      for (let j = 0; j < batch.length; j++) {
        const chunkText = batch[j];
        let validChunk = '';

        if (serverResults?.translatedFlags?.[j]) {
          const checked = validateTranslation(chunkText, serverResults.translated[j], lang);
          if (checked.ok) {
            validChunk = checked.text;
            saveCachedTranslation(lang, chunkText, validChunk);
          }
        }

        if (!validChunk && fetcher === fetch) {
          validChunk = await clientFallbackTranslate(chunkText, lang, signal);
        }

        if (!validChunk) {
          return { translated: false, text: original };
        }
        translated.push(validChunk);
      }
    }

    const finalBody = translated.join('\n\n');
    saveCachedTranslation(lang, original, finalBody);
    return { translated: true, text: finalBody };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return { translated: false, text: original };
  }
}
