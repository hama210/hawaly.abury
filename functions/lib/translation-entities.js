// Keep named countries out of inference: models must copy the reserved tokens.
const countries = [
  [/\bSaudi(?: Arabia)?\b|(?:المملكة العربية السعودية|السعودية)/giu, 'عەرەبستانی سعودی'],
  [/\bSouth Korea\b|كوريا الجنوبية/giu, 'کۆریای باشوور'],
  [/\bUnited Arab Emirates\b|الإمارات العربية المتحدة/giu, 'ئیماراتی عەرەبییە یەکگرتووەکان'],
  [/\bUnited States(?: of America)?\b|\bUSA\b|\bUS\b|الولايات المتحدة(?: الأمريكية)?/gu, 'ویلایەتە یەکگرتووەکانی ئەمریکا'],
  [/\bKuwait\b|(?:الكويت|كويت)/giu, 'کوێت'],
  [/\bOman\b/giu, 'عومان'],
  [/\bIraq\b|(?:العراق|عراق)/giu, 'عێراق'],
  [/\bYemen\b|(?:اليمن|يمن)/giu, 'یەمەن'],
  [/\bIran\b|إيران/giu, 'ئێران'],
  [/\bIsrael\b|إسرائيل/giu, 'ئیسرائیل'],
  [/\bUkraine\b|أوكرانيا/giu, 'ئۆکراین'],
  [/\bRussia\b|روسيا/giu, 'ڕووسیا'],
  [/\bLebanon\b|لبنان/giu, 'لوبنان'],
  [/\bQatar\b|قطر/giu, 'قەتەر']
];

export function protectSoraniCountries(sources) {
  let prefix = 'HAWAL_COUNTRY_';
  while (sources.some(source => source.includes(prefix))) prefix += '_';
  let sequence = 0;
  const records = sources.map(source => {
    const entities = [];
    let text = source;
    for (const [pattern, name] of countries) {
      text = text.replace(pattern, () => {
        const token = `[[${prefix}${sequence++}]]`;
        entities.push({token, name});
        return token;
      });
    }
    return {text, entities};
  });
  return {
    texts: records.map(row => row.text),
    restore(index, value) {
      if (typeof value !== 'string') return null;
      let text = value;
      for (const {token, name} of records[index].entities) {
        if (text.split(token).length !== 2) return null;
        text = text.replace(token, name);
      }
      return text.includes(`[[${prefix}`) ? null : text;
    }
  };
}
