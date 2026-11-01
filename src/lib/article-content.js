// An RSS item is not automatically a full article.
// Only show text supplied by its publisher/feed, never invent a body from a headline.
const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…'};
export function cleanArticleText(value) {
  let text=String(value ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1');
  for(let pass=0;pass<2;pass++) text=text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(raw,key)=>{
    if(key[0]!=='#')return entities[key.toLowerCase()] ?? raw;
    const number=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    return number>0 && number<=0x10ffff && !(number>=0xd800 && number<=0xdfff)?String.fromCodePoint(number):'';
  });
  return text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<\/?(?:p|div|li|h[1-6]|br|blockquote)\b[^>]*>/gi,'\n')
    .replace(/<[^>]*>/g,' ')
    .replace(/[^\S\n]+/gu,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function comparable(value) {
  return cleanArticleText(value).normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function meaningfulArticleText(value, title, source = '') {
  const text=cleanArticleText(value);
  if(!text) return '';
  const key=comparable(text), heading=comparable(title);
  if(source && key===heading+' '+comparable(source)) return '';
  if(!key || (heading && (key===heading || key===heading+' read more' || key===heading+' continue reading'))) return '';
  // The feed sometimes contains the exact headline before an actual description.
  if (heading && key.startsWith(heading+' ') && text.length <= cleanArticleText(title).length+16) return '';
  if(/^(?:read more|continue reading|click here|view article|read the full story|latest news)$/iu.test(text)) return '';
  return text;
}
export function storyExcerpt(item,lang='en') {
  if(!item)return '';
  const headline=item.titleEn || item.title || '';
  const translated=item._hawalInlineVerified===true?(lang==='ku'?item.summaryKu:lang==='ar'?item.summaryAr:''):'';
  const translatedHeadline=lang==='ku'?item.titleKu:lang==='ar'?item.titleAr:'';
  const local=meaningfulArticleText(translated,translatedHeadline||headline);
  if(local)return local;
  const summary=meaningfulArticleText(item.summaryEn || item.summary,headline);
  if(summary)return summary;
  return meaningfulArticleText(item.contentEn || item.content,headline);
}
export function articleSelection(item) {
  if(!item)return {text:'',original:'',isExtended:false,isAvailable:false};
  const title=item.titleEn || item.title || '';
  const description=meaningfulArticleText(item.summaryEn || item.summary,title);
  const content=meaningfulArticleText(item.contentEn || item.content,title);
  const extended=Boolean(content && content.length > (description?.length || 0)+65);
  const original=extended ? content : (description || content);
  return {text:original,original,isExtended:extended,isAvailable:Boolean(original)};
}
export const readerCopy = {
  ku:{
    excerpt:'پوختەی هەواڵ لە سەرچاوە', extended:'ناوەڕۆکی دابینکراو لەلایەن سەرچاوە', missing:'ئەم سەرچاوەیە تەنها سەردێڕی هەواڵەکەی ناردووە و ناوەڕۆکێکی بۆ نەدابینکردووە.', notice:'ئەم دەقە تەنها ئەو زانیارییەیە کە سەرچاوە بە RSS بڵاوی کردووەتەوە؛ لەوانەیە هەواڵەکە بە تەواوی نەبێت.', original:'هەواڵی تەواو لە سەرچاوەی ڕەسەن بخوێنەوە', more:'بەردەوامبوونی هەواڵ لە سەرچاوە', noExcerpt:'پوختە بەردەست نییە'
  },
  ar:{
    excerpt:'ملخص الخبر من المصدر', extended:'النص الذي قدمه المصدر', missing:'هذا المصدر أرسل العنوان فقط دون نص للخبر.', notice:'هذا هو النص الذي أتاحه المصدر عبر RSS، وقد لا يكون المقال كاملاً.', original:'اقرأ الخبر الكامل في المصدر الأصلي', more:'تابع الخبر في المصدر', noExcerpt:'لا يوجد ملخص متاح'
  },
  en:{
    excerpt:'Publisher-provided excerpt',extended:'Publisher-provided article text',missing:'This feed supplies only the headline, without article text.',notice:'This is the text provided in the RSS feed and may not be the complete original article.',original:'Read full story at original source',more:'Continue at source',noExcerpt:'No excerpt available'
  }
};
