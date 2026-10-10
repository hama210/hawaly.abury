// Safeguards for financial-news translation into Central Kurdish (Sorani)
// and Arabic. These checks catch broken/other-language output and factual
// corruption; they cannot prove a translation is linguistically perfect.
const LETTERS=/[\p{L}]/gu;
const ARABIC_SCRIPT=/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/gu;
const KURDISH_CHARACTERS=/[ەێۆڕڵڤپچژگک]/u;
const ARABIC_LETTERS=/[أإآء-ي]/u;
const THINK=/<think>[\s\S]*?<\/think>/gi;
const METADATA=/^(?:(?:translation|translated text|kurdish|sorani|arabic|output|headline)\s*[:：]\s*)+/i;
const REFUSAL=/\b(?:as an ai|cannot translate|can't translate|here(?:'s| is) the translation|sorry|unable to translate)\b/i;
const KURDISH_GENERIC=/^(?:هەواڵێکی گرنگ لە بازاڕ|نوێکارییەکی کاریگەر لە بازاڕەکان|بانکی ناوەندی نیشانەی ڕێبازێکی بەئاگاداری)/u;
const NUMERIC=/[0-9٠-٩۰-۹][0-9٠-٩۰-۹,،٫٬.\s]*[0-9٠-٩۰-۹]|[0-9٠-٩۰-۹]/gu;
const PAIR=/\b(?:USD|EUR|GBP|IQD|XAU|XAG|BTC|ETH)\/(?:USD|EUR|GBP|IQD|XAU|XAG|BTC|ETH)\b/gi;

// Preserve named entities most likely to move markets or be confused in news.
const IMPORTANT_ENTITIES=[
  { english:/\btrump\b/i, target:/ترام[پب]|تر[ەم]*م[پب]/u },
  { english:/\biraq\b/i, target:/عێراق|العراق|عراق/u },
  { english:/\biran\b/i, target:/ئێران|إيران|ايران|ایران/u },
  { english:/\bsaudi(?: arabia)?\b/i, target:/سعود|سعوود/u },
  { english:/\bbaghdad\b/i, target:/بەغدا|بغداد/u },
  { english:/\berbil\b/i, target:/هەولێر|أربيل|اربيل|اربیل/u }
];

function digits(value){
  return String(value).replace(/[٠-٩]/g,ch=>String(ch.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,ch=>String(ch.charCodeAt(0)-0x6f0));
}
function numbers(value){
  return (digits(value).match(NUMERIC)||[]).map(v=>{
    const n=v.replace(/[\s,،٬]/g,'').replace('٫','.');
    return /^\d+\.\d+$/.test(n) ? n : n.replace(/\./g,'');
  }).filter(Boolean).sort();
}
function tickerPairs(value){return (String(value).toUpperCase().match(PAIR)||[]).sort();}
function sameMeaningNumbers(a,b){
  const aa=numbers(a),bb=numbers(b);
  return aa.length===bb.length && aa.every((v,i)=>v===bb[i]);
}
function arabicScriptRatio(value){
  const letters=value.match(LETTERS)||[];
  if(!letters.length)return 0;
  return (value.match(ARABIC_SCRIPT)||[]).length/letters.length;
}

export function normalizeTranslation(value=''){
  return String(value||'').replace(THINK,'').replace(/\x60{3}(?:\w+)?/g,'')
    .replace(METADATA,'').replace(/\s+/gu,' ').trim()
    .replace(/^["“”«»']+|["“”«»']+$/g,'').trim();
}

export function translationQuality(source, candidate, lang){
  const original=String(source||'').trim();
  const output=normalizeTranslation(candidate);
  if(!original || !output || lang==='en') return {valid:false, text:output,reason:'empty'};
  if(original.normalize('NFKC').toLowerCase()===output.normalize('NFKC').toLowerCase())
    return {valid:false,text:output,reason:'unchanged'};
  if(REFUSAL.test(output)||KURDISH_GENERIC.test(output))
    return {valid:false,text:output,reason:'generic-or-refusal'};
  if(output.length>Math.max(230,original.length*4) || output.length<Math.max(3,original.length*(original.length>55?.30:.20)))
    return {valid:false,text:output,reason:'implausible-length'};
  if(arabicScriptRatio(output)<0.50)
    return {valid:false,text:output,reason:'wrong-script'};
  if(lang==='ku' && !KURDISH_CHARACTERS.test(output))
    return {valid:false,text:output,reason:'not-sorani'};
  if(lang==='ar' && !ARABIC_LETTERS.test(output))
    return {valid:false,text:output,reason:'not-arabic'};
  // Omission of an explicit negation reverses the meaning of political news.
  // Reject clear cases before they reach the persistent browser/edge caches.
  const sourceNegated=/\b(?:not|never|no longer|without|denies|denied|deny|rejects|rejected|refuses|refused|rules out|ruled out)\b/i.test(original);
  const targetNegated=lang==='ku'
    ? /نە|ناکر|ناتوان|نییە|ڕەت|بێ|قبوڵ ناکات|ڕەزامەند نییە/u.test(output)
    : /(?:^|\s)(?:لا|لم|لن|ليس|ليست|بدون|دون|غير|رفض|ينفي|نفت|نفى|نفى)(?=\s|$)|نفي|مرفوض/u.test(output);
  if(sourceNegated&&!targetNegated)
    return {valid:false,text:output,reason:'missing-negation'};
  if(!sameMeaningNumbers(original,output))
    return {valid:false,text:output,reason:'changed-numbers'};
  if(IMPORTANT_ENTITIES.some(entity=>entity.english.test(original)&&!entity.target.test(output)))
    return {valid:false,text:output,reason:'missing-important-name'};
  const oldPairs=tickerPairs(original),newPairs=tickerPairs(output);
  if(oldPairs.length!==newPairs.length || oldPairs.some((p,i)=>p!==newPairs[i]))
    return {valid:false,text:output,reason:'changed-market-pair'};
  return {valid:true,text:output,reason:'ok'};
}
