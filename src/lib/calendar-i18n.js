const dictionary = {
  ku: {
    title:'کاڵەندەری ئابووری', lead:'هەواڵە کاریگەرەکانی بازاڕ بە کاتی هەولێر',
    date:'کات', event:'هەواڵ', currency:'دراو', impact:'کاریگەری',
    forecast:'پێشبینی', previous:'پێشوو', actual:'ئەنجامی ڕاستەقینە',
    all:'هەموو', allCurrency:'هەموو دراوەکان', major:'زۆر', medium:'مامناوەند', low:'کەم',
    holiday:'پشوو', today:'ئەمڕۆ', week:'٧ ڕۆژ', metals:'تەنها کاریگەرەکانی زێڕ و زیو',
    refresh:'نوێکردنەوە', loading:'هەواڵەکان وەردەگیرێن...', error:'نەتوانرا کاڵەندەرەکە بار بکرێت.',
    retry:'دووبارە هەوڵ بدە', empty:'هیچ ڕووداوێک بۆ ئەم فلتەرە نەدۆزرایەوە.',
    source:'سەرچاوە', updated:'دوایین نوێکردنەوەی داتا', notAvailable:'—',
    official:'کاتی فەرمی', tentative:'کاتەکە هێشتا پشتڕاست نەکراوەتەوە',
    moved:'کاتی ڕووداو گۆڕاوە', detail:'شیکردنەوەی هەواڵ', original:'ناوی ڕەسەنی هەواڵ',
    up:'ئەگەری فشاری بەرزبوونەوە', down:'ئەگەری فشاری دابەزین',
    neutral:'بە پێی پێشبینی دەرچوو', pending:'هێشتا ئەنجام دەرنەچووە',
    unknown:'ئاراستە نادیارە', awaiting_actual:'پێش بڵاوکردنەوەی Actual ناتوانرێت کاریگەری هەڵبسەنگێنرێت.',
    no_forecast:'پێشبینی بەردەست نییە؛ ناتوانرێت surprise هەژمار بکرێت.',
    incompatible_units:'یەکەی Actual و Forecast جیاوازە؛ بەراورد ناکرێن.',
    unsupported_indicator:'بۆ ئەم جۆرە هەواڵە یاسایەکی سادەی ئاراستە بوونی نییە.',
    matched:'Actual و Forecast یەکسانن؛ کاریگەری لە نرخی بازاڕ لەوانەیە هەبێت.',
    conditional:'ئەمە تەنها ئاراستەی ئەگەرییە، نەک پێشبینیی نرخی ڕاستەقینە.',
    rate_expectations:'هەڵاوسانی چاوەڕواننەکراو دەتوانێت چاوەڕوانیی سوود بگۆڕێت؛ وەڵامی بازاڕ هەمیشە یەکسان نییە.',
    policy_expectations:'جیاوازیی نرخی سوود لە پێشبینی دەتوانێت دراو بجوڵێنێت؛ وردەکاریی بڕیارەکە گرنگە.',
    warning:'شیکردنەوەی خۆکارییە و سیگناڵی مامەڵە نییە. نرخەکان دەکرێت پێچەوانە بجوڵێن.',
    delay:'سەرچاوەکە داتا نزیکەی هەر ١٥ خولەک نوێ دەکاتەوە؛ ئەنجامی هەواڵەکان کەمێک دوا دەکەون.',
    recentWindow:'سەرچاوەکە تەنها لە ٦ کاتژمێر لەمەوبەرەوە تا ٧ ڕۆژی داهاتوو داتا دەدات.',
    soon:'هەواڵێکی گرنگ لە ١٥ خولەکی داهاتوودا',
    count:'ژمارەی ڕووداوەکان', sourceTitle:'ناوی سەرچاوە بە ئینگلیزی',
    actualHigher:'Actual لە Forecast بەرزترە', actualLower:'Actual لە Forecast کەمترە',
    period:'ماوە', unknownTitle:'ناوی ڕەسەنی ئینگلیزی', showDetails:'وردەکاری و کاریگەری',
    ratesDisclaimer:'بۆ زێڕ و زیو، فشاری دۆلار تەنها یەک فاکتەرە؛ بازاڕ دەتوانێت بەپێچەوانە بجوڵێت.'
  },
  ar: {
    title:'التقويم الاقتصادي',lead:'أحداث الأسواق بتوقيت أربيل',
    date:'الوقت',event:'الحدث',currency:'العملة',impact:'التأثير',forecast:'المتوقع',previous:'السابق',actual:'الفعلي',
    all:'الكل',allCurrency:'كل العملات',major:'مرتفع',medium:'متوسط',low:'منخفض',holiday:'عطلة',today:'اليوم',week:'7 أيام',
    metals:'أخبار مؤثرة على الذهب والفضة',refresh:'تحديث',loading:'جارٍ تحميل البيانات...',error:'تعذر تحميل التقويم.',
    retry:'إعادة المحاولة',empty:'لا توجد أحداث مطابقة.',source:'المصدر',updated:'آخر تحديث للبيانات',notAvailable:'—',
    official:'موعد رسمي',tentative:'الموعد غير مؤكد',moved:'تم تعديل موعد الحدث',detail:'تحليل الخبر',original:'الاسم الأصلي',
    up:'احتمال ضغط صعودي',down:'احتمال ضغط هبوطي',neutral:'مطابق للتوقعات',pending:'لم يصدر الفعلي بعد',
    unknown:'الاتجاه غير واضح',awaiting_actual:'ينتظر صدور النتيجة الفعلية.',
    no_forecast:'التوقعات غير متاحة؛ لا يمكن حساب المفاجأة.',incompatible_units:'الوحدات مختلفة؛ المقارنة غير ممكنة.',
    unsupported_indicator:'لا توجد قاعدة اتجاه موثوقة لهذا الخبر.',matched:'النتيجة مطابقة للتوقعات، وقد يتحرك السوق.',
    conditional:'اتجاه محتمل لا يمثل توقعاً مؤكداً للسعر.',
    rate_expectations:'قد تؤثر مفاجأة التضخم على توقعات الفائدة؛ رد السوق ليس مضموناً.',
    policy_expectations:'قد تغير مفاجأة الفائدة اتجاه العملة؛ التفاصيل مهمة.',
    warning:'تحليل آلي وليس إشارة تداول؛ قد تتحرك الأسعار عكس التوقع.',
    delay:'بيانات المزود مخزنة نحو 15 دقيقة وقد تتأخر نتائج الأخبار.',
    recentWindow:'يغطي المصدر آخر 6 ساعات تقريباً و7 أيام قادمة فقط.',
    soon:'حدث عالي التأثير خلال 15 دقيقة',count:'عدد الأحداث',sourceTitle:'الاسم الأصلي بالإنجليزية',
    actualHigher:'الفعلي أعلى من المتوقع',actualLower:'الفعلي أقل من المتوقع',
    period:'الفترة',unknownTitle:'العنوان الإنجليزي الأصلي',showDetails:'التفاصيل والتأثير',
    ratesDisclaimer:'تأثير الدولار عامل واحد فقط للذهب والفضة؛ الأسعار قد تتحرك عكس ذلك.'
  },
  en: {
    title:'Economic calendar',lead:'Market-moving events in Erbil time',
    date:'Time',event:'Event',currency:'Currency',impact:'Impact',forecast:'Forecast',previous:'Previous',actual:'Actual',
    all:'All',allCurrency:'All currencies',major:'High',medium:'Medium',low:'Low',holiday:'Holiday',today:'Today',week:'7 days',
    metals:'Gold / silver focus (USD events)',refresh:'Refresh',loading:'Loading the calendar...',error:'Calendar is unavailable.',
    retry:'Try again',empty:'No matching events.',source:'Source',updated:'Data last updated',notAvailable:'—',
    official:'Official schedule',tentative:'Time not confirmed',moved:'Event was moved',detail:'Event analysis',original:'Original title',
    up:'Possible upward pressure',down:'Possible downward pressure',neutral:'Matched forecast',pending:'Actual not yet published',
    unknown:'Direction unclear',awaiting_actual:'Actual has not been published; no result to evaluate.',
    no_forecast:'Forecast unavailable; surprise cannot be calculated.',incompatible_units:'Incompatible units; comparison unavailable.',
    unsupported_indicator:'No reliable simple directional rule for this release.',matched:'Actual matches forecast; market may still move.',
    conditional:'Possible pressure only; not a prediction of actual price movement.',
    rate_expectations:'Inflation surprises may change rate expectations; the market response is not guaranteed.',
    policy_expectations:'A rate surprise may move currencies; decision details also matter.',
    warning:'Automated context, not a trade signal. Prices can move in the opposite direction.',
    delay:'Provider data is cached about 15 minutes; actual releases may arrive with a delay.',
    recentWindow:'The source only covers approximately the past 6 hours and the next 7 days.',
    soon:'High-impact release within 15 minutes',count:'Events',sourceTitle:'English source title',
    actualHigher:'Actual above forecast',actualLower:'Actual below forecast',
    period:'Period',unknownTitle:'Original English title',showDetails:'Details and market context',
    ratesDisclaimer:'USD pressure is one factor in precious metals; their prices can move in the opposite direction.'
  }
};
export const calendarText = lang => dictionary[lang] || dictionary.ku;

const titles = [
 [/core (?:consumer price index|cpi)/i,['هەڵاوسانی بنەڕەتی (Core CPI)','التضخم الأساسي (Core CPI)']],
 [/(?:consumer price index|\bcpi\b)/i,['هەڵاوسانی نرخەکان (CPI)','مؤشر أسعار المستهلكين (CPI)']],
 [/core (?:personal consumption expenditures|pce)/i,['هەڵاوسانی بنەڕەتی PCE','التضخم الأساسي PCE']],
 [/(?:personal consumption expenditures|\bpce\b)/i,['پێوەری هەڵاوسانی PCE','مؤشر التضخم PCE']],
 [/producer price index|\bppi\b/i,['نرخی بەرهەمهێنەران (PPI)','أسعار المنتجين (PPI)']],
 [/non.?farm payroll/i,['کارە نوێیەکانی دەرەوەی کشتوکاڵ (NFP)','الوظائف غير الزراعية (NFP)']],
 [/unemployment rate/i,['ڕێژەی بێکاری','معدل البطالة']],
 [/initial jobless claims|unemployment claims/i,['داواکاریی نوێی بێکاری','طلبات إعانة البطالة الجديدة']],
 [/continuing claims/i,['داواکاریی بەردەوامی بێکاری','طلبات الإعانة المستمرة']],
 [/average hourly earnings/i,['تێکڕای مووچەی کاتژمێری','متوسط الأجور في الساعة']],
 [/interest rate decision|fed funds rate|policy rate|cash rate target/i,['بڕیاری نرخی سوود','قرار سعر الفائدة']],
 [/fomc statement/i,['ڕاگەیاندنی فیدراڵ ڕیزێرڤ','بيان الاحتياطي الفيدرالي']],
 [/fomc press conference/i,['کۆنفرانسی ڕۆژنامەوانی فیدراڵ ڕیزێرڤ','المؤتمر الصحفي للفيدرالي']],
 [/fomc meeting minutes|fomc minutes/i,['تۆماری کۆبوونەوەی فیدراڵ ڕیزێرڤ','محضر اجتماع الفيدرالي']],
 [/gross domestic product|\bgdp\b/i,['بەرهەمی ناوخۆیی (GDP)','الناتج المحلي الإجمالي (GDP)']],
 [/retail sales/i,['فرۆشتنی تاکەکەسی','مبيعات التجزئة']],
 [/jolts job openings|job openings/i,['هەلی کاری بەتاڵ (JOLTS)','الوظائف الشاغرة (JOLTS)']],
 [/manufacturing pmi/i,['پێوەری چالاکیی پیشەسازی (PMI)','مؤشر مديري مشتريات التصنيع']],
 [/services pmi/i,['پێوەری چالاکیی خزمەتگوزاری (PMI)','مؤشر مديري مشتريات الخدمات']],
 [/consumer confidence/i,['متمانەی بەکارهێنەران','ثقة المستهلك']],
 [/industrial production/i,['بەرهەمهێنانی پیشەسازی','الإنتاج الصناعي']],
 [/building permits/i,['مۆڵەتی بیناسازی','تصاريح البناء']],
 [/housing starts/i,['دەستپێکردنی بیناسازیی نیشتەجێبوون','بدء بناء المساكن']],
 [/durable goods orders/i,['داواکاریی کاڵای بەردەوام','طلبات السلع المعمرة']],
 [/trade balance/i,['هاوسەنگی بازرگانی','الميزان التجاري']],
 [/holiday|bank holiday/i,['پشووی بازاڕ','عطلة السوق']],
 [/speech|speaks|speaking|testimony/i,['وتاری بەرپرسی بانکی ناوەندی','خطاب مسؤول البنك المركزي']]
];

export function calendarEventTitle(title, lang) {
  if (lang === 'en') return title;
  const match = titles.find(entry => entry[0].test(title));
  if (!match) return title; // preserve unknown text, never invent a translation
  const period = /(?:\bMoM\b|m\/m|month.on.month)/i.test(title) ? (lang === 'ku' ? ' — مانگانە' : ' — شهرياً')
    : /(?:\bYoY\b|y\/y|year.on.year)/i.test(title) ? (lang === 'ku' ? ' — ساڵانە' : ' — سنوياً') : '';
  return match[1][lang === 'ar' ? 1 : 0] + period;
}
