const now = Date.now()
export const fallbackNews = [
  {
    id:'fallback-fed', source:'Federal Reserve Watch', tier:'Official', category:'banks', impact:'High', sentiment:'Neutral',
    titleKu:'بازاڕەکان چاوەڕێی قسەکانی فیدڕاڵ ڕیزێرڤن لەسەر نرخی سوود',
    titleAr:'الأسواق تترقب تصريحات الفيدرالي حول أسعار الفائدة',
    titleEn:'Markets watch Federal Reserve comments on interest rates',
    summaryKu:'بڕیار و قسەکانی بانکە ناوەندییەکان دەتوانن کاریگەری ڕاستەوخۆ لەسەر دۆلار، زێڕ و جووتە دراوەکان هەبێت.',
    summaryAr:'قرارات وتصريحات البنوك المركزية قد تؤثر مباشرة على الدولار والذهب وأزواج العملات.',
    summaryEn:'Central-bank messaging may directly affect USD, gold, and major currency pairs.',
    whyKu:'چونکە بازاڕی فۆرێکس بە تایبەتی هەستیارە بە گۆڕانی چاوەڕوانی نرخی سوود.',
    whyAr:'لأن سوق الفوركس حساس جداً لتغير توقعات الفائدة.', whyEn:'Because FX markets react strongly to rate expectations.',
    publishedAt:new Date(now-18*60000).toISOString(), link:'https://www.federalreserve.gov/newsevents.htm', image:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80', affected:['USD','Gold','EUR/USD','US Stocks']
  },
  {
    id:'fallback-iraq-oil', source:'Iraq Economy Monitor', tier:'Iraq', category:'iraq', impact:'High', sentiment:'Bullish',
    titleKu:'هەواڵەکانی نەوت و بودجە دەتوانن کاریگەری لەسەر ئابووری عێراق بکەن',
    titleAr:'أخبار النفط والموازنة قد تؤثر على اقتصاد العراق', titleEn:'Oil and budget headlines may affect Iraq economy',
    summaryKu:'بەهۆی پشتبەستنی عێراق بە داهاتی نەوت، هەر گۆڕانکارییەک لە نرخ و هەناردە کاریگەری ئابووری هەیە.',
    summaryAr:'بسبب اعتماد العراق على عائدات النفط، فإن تغيّر الأسعار أو الصادرات يؤثر اقتصادياً.', summaryEn:'Because Iraq depends heavily on oil revenue, export or price changes matter.',
    whyKu:'نەوت بەشێکی گرنگی داهاتی گشتی عێراقە و لەسەر بودجە، دینار و پڕۆژەکان کاریگەرە.', whyAr:'النفط جزء مهم من إيرادات العراق ويؤثر على الموازنة والدينار والمشاريع.', whyEn:'Oil is a major source of public revenue in Iraq and affects budgets and currency expectations.',
    publishedAt:new Date(now-45*60000).toISOString(), link:'https://oil.gov.iq/', image:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1400&q=80', affected:['Oil','IQD','Iraq Budget']
  },
  {
    id:'fallback-geopolitics', source:'Global Risk Desk', tier:'Major Media', category:'geopolitics', impact:'Medium', sentiment:'Bearish',
    titleKu:'مەترسییە جیوپۆلیتیکییەکان ڕیسک لە بازاڕەکان زیاد دەکەن', titleAr:'المخاطر الجيوسياسية تزيد التوتر في الأسواق', titleEn:'Geopolitical risks raise market caution',
    summaryKu:'هەواڵی جەنگ، سزاکان و ناسەقامگیری دەتوانێت زێڕ، نەوت و دۆلار بجوڵێنێت.', summaryAr:'أخبار الحرب والعقوبات وعدم الاستقرار قد تحرك الذهب والنفط والدولار.', summaryEn:'War, sanctions and instability can move gold, oil, and the dollar.',
    whyKu:'وەبەرهێنەران لە کاتی ترسدا پەنای بۆ داراییە پارێزراوەکان دەبەن.', whyAr:'عند الخوف، يتجه المستثمرون إلى الأصول الآمنة.', whyEn:'In risk-off periods, investors often move into safer assets.',
    publishedAt:new Date(now-70*60000).toISOString(), link:'https://www.reuters.com/world/', image:'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80', affected:['Gold','Oil','USD']
  }
]
