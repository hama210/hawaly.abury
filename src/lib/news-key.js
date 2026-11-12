// Shared Unicode-safe deduplication for publisher news headlines.
// Preserve Sorani/Arabic letters; the old ASCII-only key dropped them entirely.
// Normalize Arabic/Persian letter and digit variants before comparing titles.
export function canonicalNewsKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064A\u0649]/gu, 'ی')
    .replace(/\u0643/gu, 'ک')
    .replace(/[\u064B-\u065F\u0670]/gu, '')
    .replace(/[٠-٩]/gu, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/gu, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .slice(0, 110);
}
