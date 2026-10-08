// An RSS item is not automatically a full article.
// Only show text supplied by its publisher/feed, never invent a body from a headline.
export function cleanArticleText(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}
function comparable(value) {
  return cleanArticleText(value).normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function meaningfulArticleText(value, title) {
  const text=cleanArticleText(value);
  if(!text) return '';
  const key=comparable(text), heading=comparable(title);
  if(!key || (heading && (key===heading || key===heading+' read more' || key===heading+' continue reading'))) return '';
  // The feed sometimes contains the exact headline before an actual description.
  if (heading && key.startsWith(heading+' ') && text.length <= cleanArticleText(title).length+16) return '';
  if(/^(?:read more|continue reading|click here|view article|read the full story|latest news)$/iu.test(text)) return '';
  return text;
}
export function storyExcerpt(item, lang='en') {
  if(!item) return '';
  const heading=item.titleEn || item.title || '';
  const translated=lang==='ku' ? item.summaryKu : lang==='ar' ? item.summaryAr : item.summaryEn;
  const primary=meaningfulArticleText(translated, lang==='ku' ? item.titleKu || heading : lang==='ar' ? item.titleAr || heading : heading);
  if(primary) return primary;
  const backup=meaningfulArticleText(item.summaryEn || item.summary,heading);
  if(backup) return backup;
  return meaningfulArticleText(item.contentEn || item.content,heading);
}
export function articleSelection(item, lang='en') {
  if(!item) return {text:'',original:'',isExtended:false,isAvailable:false};
  const title=item.titleEn || item.title || '';
  const description=meaningfulArticleText(item.summaryEn || item.summary,title);
  const content=meaningfulArticleText(item.contentEn || item.content,title);
  const extended=Boolean(content && content.length > (description?.length || 0)+65);
  const translated=lang==='ku' ? item.summaryKu : lang==='ar' ? item.summaryAr : item.summaryEn;
  const titleTranslated=lang==='ku' ? item.titleKu || title : lang==='ar' ? item.titleAr || title : title;
  const local=meaningfulArticleText(translated,titleTranslated);
  const original=extended ? content : (description || content);
  const text=lang==='en' ? original : (local || original);
  return {text,original,isExtended:extended,isAvailable:Boolean(original)};
}
export const readerCopy = {
  ku:{
    excerpt:'پوختەی هەواڵ لە سەرچاوە', extended:'ناوەڕۆکی دابینکراو لەلایەن سەرچاوە', missing:'ئەم سەرچاوەیە تەنها سەردێڕی هەواڵەکەی ناردووە و ناوەڕۆکێکی بۆ نەدابینکردووە.', notice:'ئەم دەقە تەنها ئەو زانیارییەیە کە سەرچاوە بە RSS بڵاوی کردووەتەوە؛ لەوانەیە هەواڵەکە بە تەواوی نەبێت.', original:'هەواڵی تەواو لە سەرچاوەی ڕەسەن بخوێنەوە', more:'بەردەوامبوونی هەواڵ لە سەرچاوە', translating:'وەرگێڕانی ناوەڕۆک...', noExcerpt:'پوختە بەردەست نییە'
  },
  ar:{
    excerpt:'ملخص الخبر من المصدر', extended:'النص الذي قدمه المصدر', missing:'هذا المصدر أرسل العنوان فقط دون نص للخبر.', notice:'هذا هو النص الذي أتاحه المصدر عبر RSS، وقد لا يكون المقال كاملاً.', original:'اقرأ الخبر الكامل في المصدر الأصلي', more:'تابع الخبر في المصدر', translating:'ترجمة محتوى الخبر...', noExcerpt:'لا يوجد ملخص متاح'
  },
  en:{
    excerpt:'Publisher-provided excerpt',extended:'Publisher-provided article text',missing:'This feed supplies only the headline, without article text.',notice:'This is the text provided in the RSS feed and may not be the complete original article.',original:'Read full story at original source',more:'Continue at source',translating:'Translating article text...',noExcerpt:'No excerpt available'
  }
};
