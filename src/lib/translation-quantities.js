// Compare quoted quantities, not just their digits. Keep magnitude, currency,
// explicit sign and percentage attached to each number, allowing script changes.
const aliases = [
  ['million', /\bmillions?\b|ملیۆن|مليون|ملايين|ملیون/giu],
  ['billion', /\bbillions?\b|ملیار|مليارات|مليار/giu],
  ['trillion', /\btrillions?\b|تریلیۆن|تريليونات|تريليون/giu],
  ['thousand', /\bthousands?\b|هەزار|ألف|آلاف/giu],
  ['USD', /\b(?:USD|US dollars?|dollars?)\b|دۆلار|دولار|\$/giu],
  ['IQD', /\b(?:IQD|Iraqi dinars?|dinars?)\b|دینار|دينار/giu],
  ['EUR', /\b(?:EUR|euros?)\b|یۆرۆ|يورو|€/giu],
  ['GBP', /\b(?:GBP|British pounds?)\b|پاوەند|جنيه إسترليني|£/giu],
];

export function quantitySignatures(value) {
  let text = value.replace(/[٠-٩۰-۹]/gu, digit => String(digit.charCodeAt(0) - (digit >= '۰' ? 0x6f0 : 0x660)))
    .replace(/٬/gu, ',').replace(/٫/gu, '.').replace(/٪/gu, '%').replace(/−/gu, '-');
  // Pair codes are checked separately; they must not become a monetary unit.
  text = text.replace(/\b[A-Z]{3}\/\s*[A-Z]{3}\b/g, ' PAIR ');
  // Arabic inflections do not change the unit (e.g. 5 ملايين / 5 دولارات).
  text = text.replace(/دولارات/gu, 'دولار').replace(/دينارات/gu, 'دينار');
  for (const [unit, pattern] of aliases) text = text.replace(pattern, ` ${unit} `);
  text = text.replace(/(\d)([MBT])\b/g, (_, digit, suffix) => `${digit} ${{M:'million',B:'billion',T:'trillion'}[suffix]}`);
  const currency = '(?:USD|IQD|EUR|GBP)';
  const magnitude = '(?:thousand|million|billion|trillion)';
  const pattern = new RegExp(`([+-]?)\\s*(${currency})?\\s*([+-]?)\\s*(\\d+(?:[,.]\\d+)*)(?:\\s*(${magnitude}))?(?:\\s*(${currency}))?(\\s*%)?`, 'g');
  return [...text.matchAll(pattern)].map(match => {
    const [, sign, before, innerSign, number, scale, after, percent] = match;
    // A hyphen between numbers is a range/date separator, not a negative sign.
    const prior = text.slice(0, match.index).trimEnd().at(-1);
    const explicitSign = sign === '-' && /\d/.test(prior || '') ? '' : sign;
    return [explicitSign + innerSign, number.replace(/,/g, ''), scale || '', before || after || '', percent ? '%' : ''].join(':');
  }).sort();
}
