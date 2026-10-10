// Translation validation for financial and news content.
// Protects against broken AI output while allowing
// proper names, institutions and market terminology.

const arabicScript=/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/gu;
const kurdishLetters=/[ەێۆڕڵڤپچژگک]/u;

const pairs=/\b(?:USD|EUR|IQD|GBP|XAU|XAG|BTC|ETH)\/(?:USD|EUR|IQD|GBP|XAU|XAG|BTC|ETH)\b/gi;

const numeric=/[0-9٠-٩۰-۹]+(?:[,،٬.٫][0-9٠-٩۰-۹]+)*/gu;

const refusal=
 /\b(?:as an ai|i cannot translate|sorry|here is the translation|unable to translate)\b/i;

function normalizedDigits(text){
  return String(text)
    .replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0));
}

function values(text){
  return (normalizedDigits(text).match(numeric)||[])
    .map(v=>v.replace(/[,.،٬٫]/g,''))
    .sort();
}

function repeated(output){
  const words=
    String(output)
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)||[];

  if(words.length<12) return false;

  let run=1;

  for(let i=1;i<words.length;i++){
    run=words[i]===words[i-1]?run+1:1;

    if(run>=5 && words[i].length>2){
      return true;
    }
  }

  for(const span of [2,3,4]){
    const counts=new Map();

    for(let i=0;i+span<=words.length;i++){
      const key=words.slice(i,i+span).join(' ');

      counts.set(key,(counts.get(key)||0)+1);

      if(counts.get(key)>=5){
        return true;
      }
    }
  }

  return false;
}

function englishLeak(value){

  const adjusted=String(value).replace(
    /\b(?:USD|EUR|IQD|GBP|XAU|XAG|BTC|ETH|CBI|BBC|CNBC|Reuters|Bloomberg|OPEC|Fed|ECB|BoE|IMF|World Bank|Trump|Netanyahu|Washington|Wall Street|Nasdaq)\b/gi,
    ''
  );

  const englishWords=
    adjusted.match(/[A-Za-z]{4,}/g)||[];

  return englishWords.length>25;
}

export function validateTranslation(original,candidate,target){

  const src=String(original||'').trim();

  const text=String(candidate||'')
    .replace(/<think>[\s\S]*?<\/think>/gi,'')
    .replace(/^["“”«»\s]+|["“”«»\s]+$/g,'')
    .trim();

  if(!src||!text){
    return {
      ok:false,
      reason:'empty',
      text:src
    };
  }

  if(src.toLowerCase()===text.toLowerCase()){
    return {
      ok:false,
      reason:'untranslated',
      text:src
    };
  }

  // relaxed sizing

  if(text.length < (src.length<=12 ? 2 : Math.max(5,src.length*0.15))){
    return {
      ok:false,
      reason:'too-short',
      text:src
    };
  }

  if(text.length > Math.max(400,src.length*5)){
    return {
      ok:false,
      reason:'too-long',
      text:src
    };
  }

  if(refusal.test(text)){
    return {
      ok:false,
      reason:'refusal',
      text:src
    };
  }

  if(repeated(text)){
    return {
      ok:false,
      reason:'repetition',
      text:src
    };
  }

  if(englishLeak(text)){
    return {
      ok:false,
      reason:'english-leak',
      text:src
    };
  }

  const allLetters=
    (text.match(/\p{L}/gu)||[]).length;

  const targetLetters=
    (text.match(arabicScript)||[]).length;

  // relaxed script validation

  if(
    allLetters>0 &&
    targetLetters/allLetters<0.35
  ){
    return {
      ok:false,
      reason:'wrong-script',
      text:src
    };
  }

  // Sorani detection
  // don't reject valid Sorani for missing one letter

  if(target==='ku'){
    const arabicCount=
      (text.match(arabicScript)||[]).length;

    // Short headlines (e.g. "Gold" -> "زێڕ") must be translatable too.
    // Longer financial news still needs sufficient target-script text.
    const minimum=Math.min(10,Math.max(2,Math.ceil(src.length*0.2)));
    if(arabicCount<minimum){
      return {
        ok:false,
        reason:'not-sorani',
        text:src
      };
    }
  }

  // Arabic detection

  if(target==='ar'){
    if(!/[أإآء-ي]/u.test(text)){
      return {
        ok:false,
        reason:'not-arabic',
        text:src
      };
    }
  }

  // preserve numbers but allow formatting differences

  const a=values(src);
  const b=values(text);

  // All quoted numbers must survive translation; omitting a figure or
  // changing a price is especially dangerous in financial news.
  if(a.length && (a.length!==b.length || a.some((value,index)=>value!==b[index]))){
    return {
      ok:false,
      reason:'changed-number',
      text:src
    };
  }

  // preserve market pairs

  const oldPairs=
    (src.match(pairs)||[])
      .map(v=>v.toUpperCase())
      .sort();

  const newPairs=
    (text.match(pairs)||[])
      .map(v=>v.toUpperCase())
      .sort();

  if(oldPairs.join('|')!==newPairs.join('|')){
    return {
      ok:false,
      reason:'changed-pair',
      text:src
    };
  }

  // negation preservation

  const sourceNegative=
    /\b(?:not|never|denies|denied|refused|rejects|without|no longer|fails|failure)\b/i
      .test(src);

  if(sourceNegative){

    const negative=
      target==='ku'
        ? /نە|نا|نییە|ڕەت|بێ/u.test(text)
        : /لا|لم|لن|ليس|رفض|ينفي|دون|بدون|غير/u.test(text);

    if(!negative){
      return {
        ok:false,
        reason:'missing-negation',
        text:src
      };
    }
  }

  return {
    ok:true,
    reason:'ok',
    text
  };
}

export function alreadyInTargetLanguage(text,target){

  const raw=String(text||'');

  const letters=
    (raw.match(/\p{L}/gu)||[]).length;

  if(!letters){
    return false;
  }

  const ratio=
    (raw.match(arabicScript)||[]).length/letters;

  if(target==='ku'){
    return ratio>0.75 && kurdishLetters.test(raw);
  }

  if(target==='ar'){
    return ratio>0.75 && !kurdishLetters.test(raw);
  }

  return false;
}
