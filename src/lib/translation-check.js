// Guardrails for translated financial headlines. These checks catch obvious
// corruption, but do not certify the linguistic accuracy of machine translation.
const arabicScript=/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/gu;
const kurdishLetters=/[ەێۆڕڵڤپچژگک]/u;
const pairs=/\b(?:USD|EUR|IQD|GBP|XAU|XAG|BTC|ETH)\/(?:USD|EUR|IQD|GBP|XAU|XAG|BTC|ETH)\b/gi;
const numeric=/[0-9٠-٩۰-۹]+(?:[,،٬.٫][0-9٠-٩۰-۹]+)*/gu;
const refusal=/\b(?:as an ai|i cannot translate|sorry|here is the translation)\b/i;

function normalizedDigits(text){
  return String(text).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0));
}
function values(text){
  return (normalizedDigits(text).match(numeric)||[])
    .map(value=>value.replace(/[,.،٬٫]/g,'')).sort();
}
function repeated(output){
  const words=String(output).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
  if(words.length<9)return false;
  let run=1;
  for(let i=1;i<words.length;i++){
    run=words[i]===words[i-1]?run+1:1;
    if(run>=4 && words[i].length>2)return true;
  }
  for(const span of [2,3,4]){
    const counts=new Map();
    for(let i=0;i+span<=words.length;i++){
      const key=words.slice(i,i+span).join(' ');
      counts.set(key,(counts.get(key)||0)+1);
      if(counts.get(key)>=4)return true;
    }
  }
  return false;
}
function englishLeak(value){
  // Preserve genuine Latin proper names and market tickers.
  const adjusted=value.replace(/\b(?:USD|EUR|IQD|GBP|XAU|XAG|BTC|ETH|CBI|BBC|CNBC|Reuters|OPEC)\b/gi,'');
  return /[A-Za-z]{3,}(?:[\s,.;:!?"'()]+[A-Za-z]{3,}){5,}/.test(adjusted);
}
export function validateTranslation(original,candidate,target){
  const src=String(original||'').trim();
  const text=String(candidate||'').replace(/<think>[\s\S]*?<\/think>/gi,'')
    .replace(/^["“”«»\s]+|["“”«»\s]+$/g,'').trim();
  if(!src||!text||src.toLowerCase()===text.toLowerCase())return {ok:false,reason:'untranslated',text:src};
  if(text.length>Math.max(240,src.length*4)||text.length<Math.max(5,src.length*.20))
    return {ok:false,reason:'length',text:src};
  if(refusal.test(text)||repeated(text)||englishLeak(text))
    return {ok:false,reason:'broken',text:src};
  const allLetters=(text.match(/\p{L}/gu)||[]).length;
  const targetLetters=(text.match(arabicScript)||[]).length;
  if(allLetters>0 && targetLetters/allLetters<.58)
    return {ok:false,reason:'wrong-script',text:src};
  if(target==='ku'&&!kurdishLetters.test(text))
    return {ok:false,reason:'not-sorani',text:src};
  if(target==='ar'&& !/[أإآء-ي]/u.test(text))
    return {ok:false,reason:'not-arabic',text:src};
  const a=values(src),b=values(text);
  if(a.length!==b.length||a.some((v,i)=>v!==b[i]))
    return {ok:false,reason:'changed-number',text:src};
  const oldPairs=(src.match(pairs)||[]).map(v=>v.toUpperCase()).sort();
  const newPairs=(text.match(pairs)||[]).map(v=>v.toUpperCase()).sort();
  if(oldPairs.join('|')!==newPairs.join('|'))
    return {ok:false,reason:'changed-pair',text:src};
  if(/\b(?:not|never|denies|denied|refused|rejects|without|no longer)\b/i.test(src)){
    const negative=target==='ku'
      ? /نە|ناکر|ناتوان|نییە|ڕەت|بێ/u.test(text)
      : /لا|لم|لن|ليس|رفض|ينف|دون|بدون|غير/u.test(text);
    if(!negative)return {ok:false,reason:'missing-negation',text:src};
  }
  return {ok:true,reason:'ok',text};
}
export function alreadyInTargetLanguage(text,target){
  const raw=String(text||'');
  const letters=(raw.match(/\p{L}/gu)||[]).length;
  if(!letters)return false;
  const ratio=(raw.match(arabicScript)||[]).length/letters;
  return ratio>.7 && (target==='ku'?kurdishLetters.test(raw):!kurdishLetters.test(raw));
}
