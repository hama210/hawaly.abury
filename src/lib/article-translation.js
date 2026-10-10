import {alreadyInTargetLanguage,validateTranslation} from './translation-check.js';
import {translatePassages} from './keyless-translation.js';

// Split publisher-provided RSS body without dropping a single word. The
// translated article is displayed only if every segment passes validation.
export function articleChunks(body,max=700){
  const words=String(body||'').trim().split(/\s+/u).filter(Boolean);
  const chunks=[];
  let current='';
  for(const word of words){
    if(current && current.length+word.length+1>max){
      chunks.push(current);
      current='';
    }
    if(word.length>max){
      if(current){chunks.push(current);current='';}
      for(let i=0;i<word.length;i+=max)chunks.push(word.slice(i,i+max));
    }else{
      current+=(current?' ':'')+word;
    }
  }
  if(current)chunks.push(current);
  return chunks;
}
export async function translateArticleBody(text,lang,{signal,fetcher,translator=translatePassages}={}){
  const original=String(text||'').trim();
  if(!original||lang==='en'||alreadyInTargetLanguage(original,lang))
    return {translated:false,text:original};
  const chunks=articleChunks(original);
  if(!chunks.length || original.length>25000)
    return {translated:false,text:original};
  const translated=[];
  try{
    for(let i=0;i<chunks.length;i+=8){
      const batch=chunks.slice(i,i+8);
      // An injected fetcher is retained for callers that supply the existing
      // server contract; the browser uses the shared keyless translation queue.
      let data;
      if(fetcher){
        const response=await fetcher('/api/translate',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({lang,texts:batch}),signal
        });
        if(!response.ok)return {translated:false,text:original};
        data=await response.json();
      }else data=await translator(batch,lang,{signal});
      if(!data.ok||!Array.isArray(data.translated)||data.translated.length!==batch.length)
        return {translated:false,text:original};
      for(let j=0;j<batch.length;j++){
        if(alreadyInTargetLanguage(batch[j],lang)){
          translated.push(batch[j]);
          continue;
        }
        if(!data.translatedFlags?.[j])return {translated:false,text:original};
        const checked=validateTranslation(batch[j],data.translated[j],lang);
        // Never mix untranslated source chunks into a translated article.
        // If a single chunk fails validation, keep the entire original text.
        if(!checked.ok)return {translated:false,text:original};
        translated.push(checked.text);
      }
    }
    return {translated:true,text:translated.join('\n\n')};
  }catch(error){
    if(error?.name==='AbortError')throw error;
    return {translated:false,text:original};
  }
}
