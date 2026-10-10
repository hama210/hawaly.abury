// Links to Tradukka's public translation interface, not an undocumented API.
// The publisher's own text stays unchanged in Hawal. The user explicitly
// chooses whether to leave Hawal and request translation at Tradukka.
const BASE='https://tradukka.com/translate';
const MAX_HEADLINE_LENGTH=450;

export function tradukkaHeadlineUrl(item){
  const text=String(item?.titleEn||item?.title||'').replace(/\s+/gu,' ').trim();
  if(!text)return '';
  // Sorani-origin articles should not be submitted to English -> Sorani.
  // Both English and Arabic have documented public Tradukka routes.
  const hasArabicScript=/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(text);
  const sorani=/[ەێۆڕڵڤپچژگک]/u.test(text);
  if(sorani)return '';
  const source=hasArabicScript?'ar':'en';
  const excerpt=text.length>MAX_HEADLINE_LENGTH
    ? text.slice(0,MAX_HEADLINE_LENGTH).replace(/\s+\S*$/u,'').trim()
    : text;
  if(!excerpt)return '';
  return BASE+'/'+source+'/ku/'+encodeURIComponent(excerpt);
}

export function tradukkaLinkCopy(lang='ku'){
  return lang==='ar'
    ? {label:'ترجمة العنوان في Tradukka ↗',notice:'يفتح Tradukka في تبويب جديد. لا تُترجم الأخبار داخل Hawal.'}
    : lang==='en'
      ? {label:'Translate headline with Tradukka ↗',notice:'Opens Tradukka in a new tab. Hawal keeps the publisher text unchanged.'}
      : {label:'وەرگێڕانی سەردێڕ لە Tradukka ↗',notice:'Tradukka لە پەڕەیەکی نوێ دەکرێتەوە. دەقی ڕەسەنی هەواڵ لە Hawal ناگۆڕدرێت.'};
}
