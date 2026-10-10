import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './hawal-features.css';
import './redesign.css';
import { DollarRates, MarketDesk, DailyBrief, CalendarLinks, AboutPage, InstallPanel } from './components/MarketDesk.jsx';
import { MarketIntelligence, VerificationDesk, DollarHistory, MarketAlerts } from './components/HawalFeatures.jsx';
import { Navigation, NavIcon, HomeMarkets, FeatureShortcuts, ScreenIntro, navigationCopy } from './components/HawalDashboard.jsx';
import { dashboardCopy } from './lib/dashboard-copy.js';
import { pageRoute, pagePath, timestamp, quoteState, safeUrl } from './lib/market-tools.js';
const route = pageRoute(location.pathname);
let bootstrap = {};
try { bootstrap = JSON.parse(document.getElementById('hawall-bootstrap')?.textContent || '{}'); } catch {};
import { fetchNews, getInitialNews } from './services/news.js';
import { fetchMarkets } from './services/markets.js';
import { LANGS, t } from './utils/i18n.js';
import { analyzeArticle } from './utils/intelligence.js';
import { getSummary, getTitle } from './utils/news.js';
import { articleText, matchesCategory } from './utils/categories.js';
import { articleSelection, storyExcerpt, readerCopy } from './lib/article-content.js';
import { imageForNews, coverForCategory } from './lib/news-images.js';

const categories = ['all', 'iraq', 'kurdistan', 'forex', 'metals', 'oil', 'crypto', 'indices', 'geopolitics'];
const categoryMap = {
  ku: { all:'هەموو', oil:'نەوت', crypto:'کریپتۆ', kurdistan:'کوردستان', iraq:'عێراق / USD/IQD', forex:'EUR و GBP', metals:'زێڕ و زیو', indices:'Dow و Nasdaq', geopolitics:'جەنگ' },
  ar: { all:'الكل', oil:'النفط', crypto:'العملات الرقمية', kurdistan:'كردستان', iraq:'العراق / USD/IQD', forex:'EUR و GBP', metals:'الذهب والفضة', indices:'Dow و Nasdaq', geopolitics:'الحروب' },
  en: { all:'All', oil:'Oil', crypto:'Crypto', kurdistan:'Kurdistan', iraq:'Iraq / USD/IQD', forex:'EUR & GBP', metals:'Gold & Silver', indices:'Dow & Nasdaq', geopolitics:'Wars' }
};
const uiCopy = {
  ku: {
    brandTagline:'هەواڵ و بازاڕی کوردستان', lead:'هەواڵی سەرەکی', localDollar:'نرخی دۆلار لە بازاڕی ناوخۆ',
    sell100:'فرۆشتن / $100', calendar:'ڕۆژژمێری ئابووری', latest:'دوایین هەواڵەکان', allSections:'هەموو بەشەکان',
    refresh:'نوێکردنەوە', theme:'گۆڕینی ڕەنگ', language:'زمان', search:'گەڕان', menu:'بەشەکانی هەواڵ',
    home:'سەرەکی', markets:'بازاڕ', news:'هەواڵ', high:'گرنگ', medium:'مامناوەند', live:'زیندوو', fresh:'نوێ',
    noMarket:'نرخی ناوخۆ بەردەست نییە', translating:'وەرگێڕانی هەواڵەکان...', loadingNews:'هەواڵە نوێیەکان بار دەکرێن...', close:'داخستن',
    effects:'کاریگەری لەسەر بازاڕ', content:'ناوەڕۆکی هەواڵ', loadingContent:'وەرگێڕانی ناوەڕۆک...', up:'فشاری بەرەو سەرەو', down:'فشاری بەرەو خوارەوە', watch:'چاودێری', effectNotice:'ئەمە هەڵسەنگاندنی ئاڕاستەی بازاڕە، نەک سیگناڵی مامەڵەکردن.'
  },
  ar: {
    brandTagline:'أخبار وأسواق كردستان', lead:'الخبر الرئيسي', localDollar:'سعر الدولار في السوق المحلي',
    sell100:'بيع / 100$', calendar:'التقويم الاقتصادي', latest:'أحدث الأخبار', allSections:'كل الأقسام',
    refresh:'تحديث', theme:'تغيير المظهر', language:'اللغة', search:'بحث', menu:'أقسام الأخبار',
    home:'الرئيسية', markets:'الأسواق', news:'الأخبار', high:'مهم', medium:'متوسط', live:'مباشر', fresh:'جديد',
    noMarket:'السعر المحلي غير متاح', translating:'جاري ترجمة الأخبار...', loadingNews:'جاري تحميل أحدث الأخبار...', close:'إغلاق',
    effects:'التأثير في الأسواق', content:'محتوى الخبر', loadingContent:'جاري ترجمة المحتوى...', up:'ضغط صعودي', down:'ضغط هبوطي', watch:'مراقبة', effectNotice:'هذا تقدير لاتجاه ضغط السوق وليس إشارة تداول.'
  },
  en: {
    brandTagline:'Kurdistan news and markets', lead:'Lead Story', localDollar:'Local dollar market',
    sell100:'Sell / $100', calendar:'Economic Calendar', latest:'Latest News', allSections:'All sections',
    refresh:'Refresh', theme:'Change theme', language:'Language', search:'Search', menu:'News sections',
    home:'Home', markets:'Markets', news:'News', high:'High', medium:'Medium', live:'Live', fresh:'New',
    noMarket:'Local rate unavailable', translating:'Translating news...', loadingNews:'Loading the latest news...', close:'Close',
    effects:'Market Effects', content:'News Content', loadingContent:'Translating content...', up:'Upward pressure', down:'Downward pressure', watch:'Watch', effectNotice:'This is directional market context, not a trading signal.'
  }
};
const localRateText = {
  ku: { erbil:'هەولێر', baghdad:'بەغدا' },
  ar: { erbil:'أربيل', baghdad:'بغداد' },
  en: { erbil:'Erbil', baghdad:'Baghdad' }
};
const sourceTierCopy = {
  ku: { official:'فەرمی', major:'جیهانی', local:'ناوخۆیی', specialist:'پسپۆڕ', curated:'هەڵبژێردراو' },
  ar: { official:'رسمي', major:'عالمي', local:'محلي', specialist:'متخصص', curated:'مختار' },
  en: { official:'Official', major:'Major', local:'Local', specialist:'Specialist', curated:'Curated' }
};
const trustBarCopy = {
  ku: { title:'سەرچاوە باوەڕپێکراوەکان', note:'فەرمی، جیهانی و پسپۆڕ · نوێترین هەواڵ لەپێشەوە' },
  ar: { title:'مصادر موثوقة', note:'رسمية وعالمية ومتخصصة · الأحدث أولاً' },
  en: { title:'Trusted sources', note:'Official, major and specialist · newest first' }
};
const conflictBriefCopy = {
  ku: { title:'پوختەی ڕۆژانەی ڕۆژهەڵاتی ناوەڕاست', description:'تەنها گرنگترین پێشهاتەکانی جەنگ، هێرش و پێکدادان؛ بە کورتی و لە سەرچاوەی دیاریکراو.', live:'چاودێری زیندوو', today:'نوێکاری ئەمڕۆ', all:'هەموو', usIran:'ئەمریکا–ئێران', gazaIsrael:'غەزە–ئیسرائیل', lebanon:'لوبنان', redSea:'دەریای سوور', iraqSyria:'عێراق–سوریا', middleEast:'ڕۆژهەڵاتی ناوەڕاست', source:'سەرچاوەی دیاریکراو', empty:'هیچ نوێکارییەکی تازە لەم بەشەدا نییە.', note:'پێشهاتەکانی جەنگ خێرا دەگۆڕێن؛ کاتی بڵاوکردنەوە و سەرچاوەی ڕەسەنی هەر هەواڵێک بپشکنە.' },
  ar: { title:'الموجز اليومي للشرق الأوسط', description:'أهم تطورات الحروب والضربات والاشتباكات فقط، باختصار ومن مصادر محددة.', live:'مراقبة مباشرة', today:'تحديثات اليوم', all:'الكل', usIran:'أمريكا–إيران', gazaIsrael:'غزة–إسرائيل', lebanon:'لبنان', redSea:'البحر الأحمر', iraqSyria:'العراق–سوريا', middleEast:'الشرق الأوسط', source:'مصدر محدد', empty:'لا توجد تحديثات جديدة في هذا القسم.', note:'تتغير تطورات الحرب بسرعة؛ تحقق من وقت النشر والمصدر الأصلي لكل خبر.' },
  en: { title:'Middle East Daily Brief', description:'Only the most important war, strike and fighting developments—short and source-attributed.', live:'Live conflict watch', today:'updates today', all:'All', usIran:'USA–Iran', gazaIsrael:'Gaza–Israel', lebanon:'Lebanon', redSea:'Red Sea', iraqSyria:'Iraq–Syria', middleEast:'Middle East', source:'identified source', empty:'No fresh updates in this section.', note:'Conflict developments change quickly. Check each story’s publication time and original source.' }
};
const trustBarSources = ['Federal Reserve', 'ECB', 'BoE', 'BLS', 'BEA', 'Reuters', 'FT', 'CNBC', 'CBI', 'Shafaq'];
const effectReasonCopy = {
  ku: { safeHaven:'مەترسی جەنگ داواکاری پەنابەری ئارام زیاد دەکات', riskOff:'مەترسی جەنگ هەستی ڕیسک لاواز دەکات', regionalRisk:'مەترسی ناوچەکە داواکاری دۆلار زیاد دەکات', deescalation:'کەمبوونەوەی گرژی هەستی ڕیسک باشتر دەکات', usRates:'گۆڕانی چاوەڕوانی نرخی سوودی ئەمریکا', euroPolicy:'سیاسەتی ECB و داتای ناوچەی یۆرۆ', ukPolicy:'سیاسەتی BoE و داتای بەریتانیا', iraqPolicy:'CBI، بودجە و داهاتی نەوتی عێراق', preciousMetals:'دۆلار، سوود و داواکاری پەنابەر', indexNews:'سوود، قازانج و هەستی Wall Street', marketNews:'هەستی گشتی بازاڕ' },
  ar: { safeHaven:'مخاطر الحرب ترفع طلب الملاذ الآمن', riskOff:'مخاطر الحرب تضعف شهية المخاطرة', regionalRisk:'المخاطر الإقليمية تزيد طلب الدولار', deescalation:'تراجع التوتر يحسن شهية المخاطرة', usRates:'تغير توقعات الفائدة الأمريكية', euroPolicy:'سياسة ECB وبيانات منطقة اليورو', ukPolicy:'سياسة BoE وبيانات بريطانيا', iraqPolicy:'CBI والموازنة وإيرادات نفط العراق', preciousMetals:'الدولار والفائدة وطلب الملاذ الآمن', indexNews:'الفائدة والأرباح ومعنويات وول ستريت', marketNews:'معنويات السوق العامة' },
  en: { safeHaven:'War risk can lift safe-haven demand', riskOff:'War risk can weaken risk appetite', regionalRisk:'Regional risk can increase dollar demand', deescalation:'Lower tension can improve risk appetite', usRates:'Changing US interest-rate expectations', euroPolicy:'ECB policy and euro-area data', ukPolicy:'BoE policy and UK data', iraqPolicy:'CBI policy, budget and Iraqi oil revenue', preciousMetals:'Dollar, rates and safe-haven demand', indexNews:'Rates, earnings and Wall Street sentiment', marketNews:'Broad market sentiment' }
};
const developerCopy = {
  ku: { developedBy:'گەشەپێدراوە لەلایەن' },
  ar: { developedBy:'تطوير' },
  en: { developedBy:'Developed by' }
};
const developer = { name:'Muhammad Muhsin' };

function timeAgo(value, lang) {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '—';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return lang === 'en' ? `${min}m ago` : lang === 'ar' ? `قبل ${min} دقيقة` : `${min} خولەک لەمەوبەر`;
  const hours = Math.round(min / 60);
  if (hours < 24) return lang === 'en' ? `${hours}h ago` : lang === 'ar' ? `قبل ${hours} ساعة` : `${hours} کاتژمێر لەمەوبەر`;
  const days = Math.round(hours / 24);
  return lang === 'en' ? `${days}d ago` : lang === 'ar' ? `قبل ${days} يوم` : `${days} ڕۆژ لەمەوبەر`;
}

function isNewStory(item) {
  const publishedAt = Date.parse(item?.publishedAt);
  return Number.isFinite(publishedAt) && Date.now() - publishedAt <= 90 * 60 * 1000;
}

function sourceTitle(item) {
  return getTitle(item || {}) || item?.title || '';
}

function sourceSummary(item) {
  return getSummary(item || {});
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '?' || value === '—') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (Math.abs(number) >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits:2 });
  if (Math.abs(number) >= 10) return number.toLocaleString('en-US', { maximumFractionDigits:2 });
  return number.toLocaleString('en-US', { minimumFractionDigits:4, maximumFractionDigits:4 });
}

function formatChange(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `${Number(value) > 0 ? '+' : ''}${value}%`;
}

function changeClass(value) {
  return Number(value) > 0 ? 'up' : Number(value) < 0 ? 'down' : 'flat';
}

function impactLabel(key, lang) {
  const dict = t[lang] || t.ku;
  return key === 'high' ? dict.high : key === 'medium' ? dict.medium : dict.low;
}

function sentimentLabel(key, lang) {
  const dict = t[lang] || t.ku;
  return key === 'bullish' ? dict.bullish : key === 'bearish' ? dict.bearish : dict.neutral;
}

function copyLink(url) {
  navigator.clipboard?.writeText(url || location.href);
}

function imageFallback(event) {
  const element=event.currentTarget;
  if(element.dataset.fallback==='logo') {
    element.style.visibility='hidden';
    return;
  }
  if(element.dataset.fallback==='category') {
    element.dataset.fallback='logo';
    element.src='/hawali-logo-512.png';
    return;
  }
  element.dataset.fallback='category';
  element.src=coverForCategory(element.dataset.newsCategory);
}

function selectMarketItems(markets) {
  const targets = ['EUR/USD', 'GBP/USD', 'XAU/USD', 'XAG/USD', 'WTI/USD', 'BRENT/USD', 'BTC/USD', 'DOW JONES', 'NASDAQ'];
  const selected = targets.map(symbol => markets.find(item => item.symbol === symbol)).filter(Boolean);
  return selected;
}

function directionSymbol(direction) {
  return direction === 'up' ? '▲' : direction === 'down' ? '▼' : '●';
}

function EffectBadge({ effect, lang, detailed = false }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  const reasons = effectReasonCopy[lang] || effectReasonCopy.en;
  return <span className={`effect-badge effect-${effect.direction || 'watch'} ${detailed ? 'detailed' : ''}`}>
    <b>{directionSymbol(effect.direction)} {effect.asset}</b>
    {detailed && <small>{copy[effect.direction] || copy.watch} · {reasons[effect.reason] || reasons.marketNews}</small>}
  </span>;
}

function SourceTrustBadge({ tier = 'curated', lang }) {
  const label = sourceTierCopy[lang]?.[tier] || sourceTierCopy.en[tier] || sourceTierCopy.en.curated;
  return <span className={`source-trust source-trust-${tier}`}>✓ {label}</span>;
}

function TrustBar({ lang }) {
  const copy = trustBarCopy[lang] || trustBarCopy.en;
  return <section className="trust-bar" aria-label={copy.title}>
    <div className="trust-copy"><strong>✓ {copy.title}</strong><small>{copy.note}</small></div>
    <div className="trust-names">{trustBarSources.map(source => <span key={source}>{source}</span>)}</div>
  </section>;
}

function clientConflictRegion(item, lang) {
  const rawText = `${item?.titleEn || item?.title || ''} ${item?.summaryEn || item?.summary || ''} ${sourceTitle(item)} ${sourceSummary(item)}`;
  const text = rawText.toLowerCase();
  const iran = /\b(iran|iranian|tehran|irgc)\b|strait of hormuz|\bhormuz\b/i.test(rawText);
  const usa = /(?:^|[^A-Za-z])(?:US|USA|U\.S\.?)(?=[^A-Za-z]|$)/.test(rawText) || /\b(united states|american|pentagon|centcom|white house|trump|rubio)\b/i.test(rawText);
  const development = /\b(war|conflict|hostilities|attack|attacks|airstrike|airstrikes|strike|strikes|missile|missiles|drone|drones|ceasefire|truce|blockade|sanction|sanctions|escalation|de-escalation|deescalation|peace|deal|agreement|talk|talks|negotiation|negotiations|standoff|stand-off|crisis|threat|ultimatum)\b|strait of hormuz|\bhormuz\b/i.test(rawText);
  if (iran && usa && development) return 'usIran';
  if (item?.conflictRegion) return item.conflictRegion;
  const war = /\b(war|conflict|attack|attacks|airstrike|airstrikes|strike|strikes|missile|missiles|drone|drones|fighting|clash|clashes|invasion|ceasefire|truce|blockade|bombing|bombardment|shelling|explosion)\b|under fire|opens? fire|هێرش|شەڕ|پێکدادان|مووشەک|فڕۆکەی بێفڕۆکەوان|ئاگربەست|êrîş|şer|mûşek|هجوم|حرب|اشتباك|صاروخ|مسيّرة|وقف إطلاق النار/i.test(text);
  const regional = /\b(iran|iranian|tehran|irgc|israel|israeli|gaza|hamas|west bank|lebanon|hezbollah|syria|iraq|yemen|houthi|gulf|oman)\b|middle east|strait of hormuz|red sea|ئێران|ئیسرائیل|غەزە|لوبنان|سوریا|عێراق|یەمەن|دەریای سوور|إيران|إسرائيل|غزة|لبنان|سوريا|العراق|اليمن|البحر الأحمر/i.test(text);
  if (!war || !regional) return null;
  if (/\b(iran|iranian|tehran|irgc)\b|strait of hormuz/i.test(text) && /\b(usa|u\.s\.|united states|american|pentagon|centcom|white house)\b/i.test(text)) return 'usIran';
  if (/\b(gaza|hamas|west bank|israel|israeli)\b/i.test(text)) return 'gazaIsrael';
  if (/\b(lebanon|lebanese|hezbollah|beirut)\b/i.test(text)) return 'lebanon';
  if (/\b(yemen|yemeni|houthi)\b|red sea/i.test(text)) return 'redSea';
  if (/\b(iraq|iraqi|baghdad|syria|syrian|damascus)\b/i.test(text)) return 'iraqSyria';
  return 'middleEast';
}

function MiddleEastBrief({ items, lang, onOpen }) {
  const [filter, setFilter] = useState('all');
  const copy = conflictBriefCopy[lang] || conflictBriefCopy.en;
  const filters = ['all', 'usIran', 'gazaIsrael', 'lebanon', 'redSea', 'iraqSyria'];
  const allConflict = useMemo(() => items.map(item => ({ item, region:clientConflictRegion(item, lang) })).filter(entry => entry.region), [items, lang]);
  useEffect(() => {
    if (filter !== 'all' && !allConflict.some(entry => entry.region === filter)) setFilter('all');
  }, [allConflict, filter]);
  const shown = allConflict.filter(entry => filter === 'all' || entry.region === filter).slice(0, 8);
  const todayCount = allConflict.filter(({ item }) => {
    const published = Date.parse(item.publishedAt || 0);
    return Number.isFinite(published) && Date.now() - published <= 86400000;
  }).length;
  if (!allConflict.length) return null;
  const shorten = value => {
    const clean = String(value || '').replace(/\s+/g, ' ').trim();
    return clean.length > 190 ? `${clean.slice(0, 190).replace(/\s+\S*$/, '')}…` : clean;
  };
  return <section className="middle-east-brief" aria-labelledby="middle-east-title">
    <div className="brief-heading"><div><span className="brief-live"><i />{copy.live}</span><h2 id="middle-east-title">{copy.title}</h2><p>{copy.description}</p></div><div className="brief-count"><strong>{todayCount}</strong><span>{copy.today}</span></div></div>
    <div className="brief-filters" role="tablist" aria-label={copy.title}>{filters.map(key => <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{copy[key]}</button>)}</div>
    {shown.length ? <div className="brief-list">{shown.map(({ item, region }) => <article className="brief-item" key={item.id}><div className="brief-time"><time dateTime={item.publishedAt} title={timestamp(item.publishedAt,lang)}>{timestamp(item.publishedAt,lang)}</time><i /></div><button type="button" className="brief-copy" onClick={() => onOpen(item)}><span className="brief-region">{copy[region]}</span><h3 dir="auto">{sourceTitle(item)}</h3><p>{shorten(sourceSummary(item))}</p><small>{item.source} · {copy.source}</small></button></article>)}</div> : <div className="brief-empty">{copy.empty}</div>}
    <p className="brief-note">{copy.note}</p>
  </section>;
}

function focusedIntelligence(item) {
  const analyzed = analyzeArticle(item || {});
  const stored = item?.intelligence || {};
  return { ...analyzed, ...stored, effects: stored.effects?.length ? stored.effects : analyzed.effects, assets: stored.assets?.length ? stored.assets : analyzed.assets };
}

function Header({ lang, setLang, theme, setTheme, query, setQuery, dict, refreshing, onRefresh, onSearch }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  const [searchOpen,setSearchOpen] = useState(false);
  return <header className="site-header">
    <a className="brand" href={pagePath(lang)} aria-label={dict.site}>
      <span className="brand-copy"><strong className="hawal-wordmark" dir="ltr">H<span className="brand-accent">Λ</span>WAL</strong><small>{copy.brandTagline}</small></span>
    </a>
    <label className={'search-wrap '+(searchOpen || query ? 'is-open' : '')}>
      <NavIcon name="search" size={17}/>
      <span className="sr-only">{copy.search}</span>
      <input type="search" value={query} onChange={event => {setQuery(event.target.value);if(event.target.value)onSearch();}} placeholder={dict.search} />
    </label>
    <div className="header-tools">
      <button className="icon-button header-search-toggle" type="button" aria-label={copy.search} aria-expanded={searchOpen || Boolean(query)} onClick={()=>{setSearchOpen(open=>!open);onSearch();}}><NavIcon name="search" size={19}/></button>
      <button className="icon-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={copy.theme}><NavIcon name={theme === 'dark' ? 'sun':'moon'} size={20}/></button>
      <button className={'icon-button refresh-button '+(refreshing ? 'is-loading' : '')} type="button" onClick={onRefresh} disabled={refreshing} aria-label={copy.refresh}><NavIcon name="refresh" size={19}/></button>
    </div>
  </header>;
}
function LanguagePills({lang,onLanguage}){
 const langs=[['ku','کوردی','☀'],['ar','العربية',''],['en','English','']];
 const flag={ku:'☀',ar:'🇮🇶',en:'🇬🇧'};
 return <nav className="language-pills" aria-label={uiCopy[lang]?.language || 'Language'}>
   {langs.map(([value,label])=><button type="button" key={value} className={lang===value?'active':''} aria-current={lang===value?'true':undefined} onClick={()=>value!==lang&&onLanguage(value)}>
     <span>{label}</span><span aria-hidden="true">{flag[value]}</span>
   </button>)}
 </nav>;
}

function MarketStrip({ markets, lang }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  const localCopy = localRateText[lang] || localRateText.en;
  const selected = selectMarketItems(markets);
  return <section className="market-strip" id="markets" aria-label={copy.markets}>
    {selected.map(market => {
      const state = quoteState(market);
      const sourceUrl = safeUrl(market.sourceUrl);
      const reportedAt = market.updatedAt ? timestamp(market.updatedAt, lang) : dashboardCopy[lang].undated;
      return <article className="market-item" key={market.symbol}>
        <div className="market-item-heading">
          <span className="market-symbol" title={market.name || market.symbol} dir="ltr">{market.symbol.replace('/USD', '')}{market.quoteType === 'futures' ? ' · Futures' : ''}</span>
          {market.marketKind !== 'local' && <span className={`market-change ${changeClass(market.changePct)}`} dir="ltr">{formatChange(market.changePct)}</span>}
        </div>
        <strong className="market-price" dir="ltr">{formatPrice(market.price)}</strong>
        <small className={`market-state ${state}`}>{dashboardCopy[lang][state] || state}</small>
        {market.marketKind === 'local' && <small className="market-city">{localCopy.erbil}</small>}
        <time className="market-updated" dateTime={market.updatedAt || undefined} title={reportedAt}>{reportedAt}</time>
        {sourceUrl && <a className="market-source" href={sourceUrl} target="_blank" rel="noopener noreferrer" title={market.source || ''}><span dir="auto">{market.source || 'Source'}</span><span aria-hidden="true">↗</span></a>}
      </article>;
    })}
    {!selected.length && Array.from({ length:6 }, (_, index) => <div className="market-item market-skeleton" key={index}><span>—</span><strong>—</strong></div>)}
  </section>;
}

function BreakingBar({ items, lang, dict }) {
  const highImpact = items.filter(item => item.intelligence?.impact === 'high');
  const stories = (highImpact.length ? highImpact : items).slice(0, 2);
  return <section className="breaking-bar" aria-label={dict.breaking}>
    <strong className="breaking-label"><span className="live-dot" />{dict.breaking}</strong>
    <div className="breaking-copy">{stories.map((item, index) => <span key={item.id || index} dir="auto">{sourceTitle(item)}</span>)}</div>
  </section>;
}

function CategoryTabs({ active, setActive, lang }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  return <nav className="category-tabs" aria-label={copy.menu}>
    {categories.map(category => <button type="button" key={category} className={active === category ? 'active' : ''} aria-pressed={active === category} onClick={() => setActive(category)}>{categoryMap[lang]?.[category] || category}</button>)}
  </nav>;
}

function Hero({ item, lang, dict, onOpen }) {
  if (!item) return null;
  const intel = focusedIntelligence(item);
  return <article className="lead-story" role="button" tabIndex="0" onClick={() => onOpen(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onOpen(item); }}>
    <img src={imageForNews(item)} data-news-category={item.category || "markets"} alt="" decoding="async" fetchPriority="high" referrerPolicy="no-referrer" onError={imageFallback} />
    <div className="lead-overlay" />
    <div className="lead-copy">
      <span className="lead-label">{uiCopy[lang]?.lead || uiCopy.ku.lead}</span>
      <h2 dir="auto">{sourceTitle(item)}</h2>
      {storyExcerpt(item, lang) && <p dir="auto">{storyExcerpt(item, lang)}</p>}
      <div className="hero-effects">{intel.effects?.slice(0, 4).map(effect => <EffectBadge key={effect.asset} effect={effect} lang={lang} />)}</div>
      <div className="story-meta"><span className="source-with-trust"><span>{item.source}</span><SourceTrustBadge tier={item.sourceTier} lang={lang} /></span>{isNewStory(item) && <span className="fresh-pill">{uiCopy[lang]?.fresh}</span>}<span>•</span><time dateTime={item.publishedAt} title={timestamp(item.publishedAt,lang)}>{timestamp(item.publishedAt,lang)}</time><span>•</span><span>{impactLabel(intel.impact, lang)}</span></div>
    </div>
  </article>;
}

function NewsCard({ item, lang, onOpen }) {
  const intel = focusedIntelligence(item);
  return <article className="story-card">
    <button className="story-image" type="button" onClick={() => onOpen(item)} aria-label={sourceTitle(item)}><img src={imageForNews(item)} data-news-category={item.category || "markets"} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={imageFallback} /></button>
    <div className="story-copy">
      <div className="story-source"><span className="source-with-trust"><span>{item.source}</span><SourceTrustBadge tier={item.sourceTier} lang={lang} /></span><span className="story-age">{isNewStory(item) && <b className="fresh-pill">{uiCopy[lang]?.fresh}</b>}<time dateTime={item.publishedAt}>{timestamp(item.publishedAt,lang)}</time></span></div>
      <a className="story-original" href={safeUrl(item.link)} target="_blank" rel="noreferrer">{dashboardCopy[lang].original} ↗</a><button dir="auto" className="story-title" type="button" onClick={() => onOpen(item)}>{sourceTitle(item)}</button>
      {storyExcerpt(item,lang) && <p dir="auto" className="story-excerpt">{storyExcerpt(item,lang)}</p>}
      <div className="card-effects">{intel.effects?.slice(0, 3).map(effect => <EffectBadge key={effect.asset} effect={effect} lang={lang} />)}</div>
    </div>
  </article>;
}

function ArticleModal({ item, lang, dict, onClose }) {
  const reader = readerCopy[lang] || readerCopy.ku;
  const selectedText = articleSelection(item);
  const sourceLink = safeUrl(item?.link);
  useEffect(() => {
    if (!item) return undefined;
    const handleKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [item, onClose]);
  if (!item) return null;
  const intel = focusedIntelligence(item);
  const copy = uiCopy[lang] || uiCopy.ku;
  return <div className="modal-backdrop" onClick={onClose} role="presentation"><article className="article-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}>
    <div className="modal-image"><img src={imageForNews(item)} data-news-category={item.category || "markets"} alt="" decoding="async" fetchPriority="high" referrerPolicy="no-referrer" onError={imageFallback} /></div>
    <div className="modal-content">
      <button className="modal-close" type="button" onClick={onClose} aria-label={uiCopy[lang]?.close}>×</button>
      <div className="story-meta"><span className="source-with-trust"><span>{item.source}</span><SourceTrustBadge tier={item.sourceTier} lang={lang} /></span><span>•</span><time dateTime={item.publishedAt} title={timestamp(item.publishedAt,lang)}>{timestamp(item.publishedAt,lang)}</time><span>•</span><span>{dict.sentiment}: {sentimentLabel(intel.sentiment, lang)}</span></div>
      <h2 id="modal-title" dir="auto">{sourceTitle(item)}</h2>
      <section className="article-reader" aria-label={copy.content}>
        <div className="article-reader-heading"><h3>{selectedText.isAvailable ? (selectedText.isExtended ? reader.extended : reader.excerpt) : copy.content}</h3><span className={'article-availability '+(selectedText.isAvailable?'has-text':'title-only')}>{selectedText.isAvailable?'RSS':'—'}</span></div>
        {selectedText.isAvailable ? <>
          <p className="article-body" dir="auto">{selectedText.original}</p>
          <p className="reader-note">{reader.notice}</p></> :
          <p className="article-body article-missing">{reader.missing}</p>}
        {sourceLink && <a className="reader-source-link" href={sourceLink} target="_blank" rel="noopener noreferrer">{reader.original} ↗</a>}
      </section>
      <h3>{copy.effects}</h3>
      <div className="effect-grid">{intel.effects?.map(effect => <EffectBadge key={effect.asset} effect={effect} lang={lang} detailed />)}</div>
      <p className="effect-notice">{copy.effectNotice}</p>
      <div className="modal-actions">{sourceLink && <a className="primary-button" href={sourceLink} target="_blank" rel="noopener noreferrer">{reader.more} ↗</a>}<button type="button" onClick={() => copyLink(sourceLink || location.href)}>{dict.share}</button></div>
    </div>
  </article></div>;
}

function SourcesDisclosure({ lang, news, sourceHealth = {} }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const copy = uiCopy[lang] || uiCopy.ku;
  const disclosure = {
    ku: { all:'سەرچاوە گرنگ و هەڵبژێردراوەکان', loading:'بارکردنی سەرچاوەکان', note:'تەنها سەرچاوە گرنگە فەرمی، جیهانی، دارایی و ناوخۆییەکان بۆ USD/IQD، دراو، کانزا، پێوەرەکان و جەنگ هەڵبژێردراون. ناوەڕۆک موڵکی بڵاوکەرەوەی ڕەسەنە.' },
    ar: { all:'المصادر المهمة والمختارة', loading:'تحميل المصادر', note:'تُستخدم فقط المصادر الرسمية والعالمية والمالية والمحلية المهمة لـ USD/IQD والعملات والمعادن والمؤشرات والحروب. المحتوى يعود إلى ناشريه الأصليين.' },
    en: { all:'Important curated sources', loading:'Loading sources', note:'Only important official, global, financial, and local sources are used for USD/IQD, currencies, metals, indices, and wars. Content belongs to its original publishers.' }
  }[lang];
  const statusCopy = {
    ku:{ active:'هەواڵی تازە', quiet:'هیچ هەواڵێکی تازەی گونجاو نییە', failed:'سەرچاوە وەڵام نادات', unchecked:'هێشتا پشکنین نەکراوە' },
    ar:{ active:'أخبار حديثة', quiet:'لا توجد أخبار حديثة مناسبة', failed:'المصدر غير متاح', unchecked:'لم يتم الفحص بعد' },
    en:{ active:'Fresh headlines', quiet:'No matching recent news', failed:'Feed unavailable', unchecked:'Not checked yet' }
  }[lang];
  const activeSources = useMemo(() => new Set(news.flatMap(item => [item.sourceGroup, item.source]).filter(Boolean)), [news]);
  useEffect(() => {
    let alive = true;
    fetch('/api/sources?v=fresh-latest-v3', { cache:'no-store' }).then(response => response.ok ? response.json() : Promise.reject()).then(data => {
      if (!alive) return;
      if (Array.isArray(data.details)) setSources(data.details.filter(item => item?.source));
      else if (Array.isArray(data.sources)) setSources(data.sources.filter(Boolean).map(source => ({ source, tier:'curated' })));
    }).catch(() => { if (alive) setSources([]); });
    return () => { alive = false; };
  }, []);
  return <aside className={`sources-corner ${open ? 'is-open' : ''}`}>
    {open && <div className="sources-panel" role="dialog" aria-label={disclosure.all}>
      <div className="sources-head"><div><strong>{disclosure.all}</strong><small>{sources.length ? `${sources.length} ${t[lang]?.sources}` : disclosure.loading}</small></div><button type="button" onClick={() => setOpen(false)} aria-label={copy.close}>×</button></div>
      <p>{disclosure.note}</p>
      <div className="sources-list">{sources.length ? sources.map(source => { const status = sourceHealth[source.source]?.status || (activeSources.has(source.source) ? 'active' : 'unchecked'); const active = status === 'active'; return <span className={active ? 'source-active' : 'source-quiet'} key={source.source}><b>{source.source}</b><small>{sourceTierCopy[lang]?.[source.tier] || sourceTierCopy.en.curated} · {statusCopy[status] || statusCopy.unchecked}</small></span>; }) : <span>{disclosure.loading}...</span>}</div>
    </div>}
    <button className="sources-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>Sources</span><b>{sources.length || '...'}</b></button>
  </aside>;
}

function SiteFooter({ lang }) {
  const copy = developerCopy[lang] || developerCopy.en;
  return <footer className="site-footer"><nav>{['home','about','contact'].map(page => <a key={page} href={pagePath(lang,page)}>{dashboardCopy[lang][page]}</a>)}</nav><p>{dashboardCopy[lang].disclaimer}</p><div><span>{copy.developedBy}</span><strong>{developer.name}</strong></div></footer>;
}


function App() {
  const [lang, setLang] = useState(route.lang);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [news, setNews] = useState(() => bootstrap.news?.length ? bootstrap.news : getInitialNews());
  const [sourceHealth, setSourceHealth] = useState({});
  const receiveHealth = stats => {
    if (!Array.isArray(stats?.sources)) return;
    setSourceHealth(previous => ({
      ...previous,
      ...Object.fromEntries(stats.sources.map(source => [source.source, source]))
    }));
  };
  const [loadingNews, setLoadingNews] = useState(true);
  const [homeVisibleCount, setHomeVisibleCount] = useState(24);
  const [newsVisibleCount, setNewsVisibleCount] = useState(36);
  const [markets, setMarkets] = useState(bootstrap.markets || []);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [featureTarget, setFeatureTarget] = useState(null);
  const dict = t[lang] || t.ku;
  const copy = uiCopy[lang] || uiCopy.ku;
  // News text remains in the original publisher language on every UI locale.
  const displayNews = news;
  const designCopy = navigationCopy[lang] || navigationCopy.ku;
  const navigate = view => {
    setActiveView(view);
    setFeatureTarget(null);
    if (view === 'home') { setActive('all'); setQuery(''); }
    window.scrollTo({ top:0, behavior:'smooth' });
  };
  useEffect(() => {
    if (!featureTarget) return;
    const id = featureTarget === 'history' ? 'dollar-history' : featureTarget === 'alerts' ? 'market-alerts' : featureTarget === 'verify' ? 'verify' : 'intelligence';
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
  }, [activeView,featureTarget]);

  useEffect(() => {
    document.documentElement.lang = lang === 'ku' ? 'ckb' : lang;
    document.documentElement.dir = LANGS[lang].dir;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lang', lang);
    localStorage.setItem('theme', theme);
  }, [lang, theme]);

  useEffect(() => {
    let alive = true;
    const update = items => { if (alive && items?.length) setNews(items); };
    const load = (initial = false) => fetchNews(update, { onHealth: stats => { if (alive) receiveHealth(stats); } }).then(update).finally(() => { if (alive && initial) setLoadingNews(false); });
    load(true);
    const interval = setInterval(() => load(false), 120000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => fetchMarkets().then(items => { if (alive) setMarkets(items); });
    load();
    const interval = setInterval(load, 60000);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const [latest, nextMarkets] = await Promise.all([fetchNews(items => { if (items?.length) setNews(items); }, { force:true, onHealth:receiveHealth }), fetchMarkets()]);
      if (latest?.length) setNews(latest);
      setMarkets(nextMarkets);
    } finally {
      setRefreshing(false);
    }
  }

  const filtered = useMemo(() => displayNews.filter(item => {
    const search = query.trim().toLowerCase();
    return (!search || articleText(item).includes(search)) && matchesCategory(item, active);
  }), [displayNews, query, active]);
  const hero = displayNews[0];
  const rest = displayNews.slice(1);

  return <div className="page" id="top">
    <div className="shell">
      <Header lang={lang} setLang={next=>{location.href=pagePath(next,route.page);}} theme={theme} setTheme={setTheme}
        query={query} setQuery={setQuery} dict={dict} refreshing={refreshing} onRefresh={refreshAll} onSearch={()=>navigate('news')}/>
      <LanguagePills lang={lang} onLanguage={next=>{location.href=pagePath(next,route.page);}}/>
      {route.page !== 'home' ? <AboutPage lang={lang} page={route.page}/> : <>
      <Navigation active={activeView} onNavigate={navigate} lang={lang}/>
      <section className={'hawal-screen home-screen '+(activeView==='home'?'':'is-hidden-view')} aria-label={designCopy.home}>
        <div className="home-stage">
          <div className="home-feature-main">
            {hero ? <Hero item={hero} lang={lang} dict={dict} onOpen={setSelected}/> :
              <div className="screen-intro"><p>HAWAL · NEWS</p><h1>{copy.loadingNews}</h1><span>{dashboardCopy[lang].subtitle}</span></div>}
            <aside className="home-market-aside">
              <HomeMarkets markets={markets} lang={lang} onNavigate={navigate}/>
              <FeatureShortcuts lang={lang} onNavigate={navigate} onMoreTarget={setFeatureTarget}/>
            </aside>
          </div>
        </div>
        {Boolean(displayNews.length) && <BreakingBar items={displayNews} lang={lang} dict={dict}/>}
        <section className="latest-section home-news" id="latest-home">
          <div className="home-headerline"><h2>{designCopy.latest}</h2><button type="button" onClick={()=>navigate('news')}>{designCopy.allNews} →</button></div>
          {rest.length ? <><div className="news-grid">{rest.slice(0, homeVisibleCount).map(item=><NewsCard key={item.id} item={item} lang={lang} onOpen={setSelected}/>)}</div>
            {rest.length > homeVisibleCount && <button className="news-load-more" onClick={() => setHomeVisibleCount(value => value + 24)}>{lang==='ku' ? 'هەواڵی زیاتر پیشان بدە' : lang==='ar' ? 'عرض المزيد من الأخبار' : 'Show more news'} ({rest.length - homeVisibleCount})</button>}</> :
            <div className="empty-state">{loadingNews?copy.loadingNews:dict.noResults}</div>}
        </section>
        {(active==='all'||active==='geopolitics') && <MiddleEastBrief items={displayNews} lang={lang} onOpen={setSelected}/>}
        <TrustBar lang={lang}/>
      </section>

      <section className={'hawal-screen markets-screen '+(activeView==='markets'?'':'is-hidden-view')} aria-label={designCopy.markets}>
        <ScreenIntro page="markets" lang={lang}/>
        {activeView==='markets' && <MarketIntelligence markets={markets} news={displayNews} lang={lang}/>}
        <DollarRates markets={markets} lang={lang}/>
        <div className="section-heading"><h2>{designCopy.latestRates}</h2><span>{dashboardCopy[lang].disclaimer}</span></div>
        <MarketStrip markets={markets} lang={lang}/>
        <DailyBrief items={displayNews} lang={lang}/>
      </section>

      <section className={'hawal-screen news-screen '+(activeView==='news'?'':'is-hidden-view')} aria-label={designCopy.news}>
        <ScreenIntro page="news" lang={lang}/>
        {activeView==='news' && <VerificationDesk news={displayNews} lang={lang}/>}
        {Boolean(displayNews.length) && <BreakingBar items={displayNews} lang={lang} dict={dict}/>}
        <CategoryTabs active={active} setActive={setActive} lang={lang}/>
        <div className="topic-shortcuts" aria-label="News topics">
          {[
            ['Trump','Trump','ترامپ','ترامب'],
            ['Saudi','Saudi / Yemen','سعوودیە / یەمەن','السعودية / اليمن'],
            ['dollar','Iraq dollar','دۆلاری عێراق','دولار العراق'],
            ['Iran','Iran / US','ئێران / ئەمریکا','إيران / أمريكا']
          ].map(([term,en,ku,ar]) => <button key={term} type="button" aria-pressed={query.toLowerCase() === term.toLowerCase()} onClick={() => {setActive('all'); setQuery(query.toLowerCase() === term.toLowerCase() ? '' : term);}}>{lang==='ku'?ku:lang==='ar'?ar:en}</button>)}
        </div>
        <section className="latest-section" id="latest">
          <div className="section-heading"><h2>{copy.latest}</h2><span>{active==='all'?copy.allSections:categoryMap[lang]?.[active]}</span></div>
          {filtered.length ? <><div className="news-grid" aria-live="polite">{filtered.slice(0, newsVisibleCount).map(item=><NewsCard key={item.id} item={item} lang={lang} onOpen={setSelected}/>)}</div>
            {filtered.length > newsVisibleCount && <button className="news-load-more" onClick={() => setNewsVisibleCount(value => value + 36)}>{lang==='ku' ? 'هەواڵی زیاتر پیشان بدە' : lang==='ar' ? 'عرض المزيد من الأخبار' : 'Show more news'} ({filtered.length - newsVisibleCount})</button>}</> :
            <div className="empty-state">{loadingNews?copy.loadingNews:dict.noResults}</div>}
        </section>
        {(active==='all'||active==='geopolitics') && <MiddleEastBrief items={displayNews} lang={lang} onOpen={setSelected}/>}
      </section>

      <section className={'hawal-screen more-screen '+(activeView==='more'?'':'is-hidden-view')} aria-label={designCopy.more}>
        <ScreenIntro page="more" lang={lang}/>
        <div className="hawal-feature-grid">
          <DollarHistory markets={markets} lang={lang}/>
          <MarketAlerts markets={markets} news={displayNews} lang={lang}/>
        </div>
        <MarketDesk markets={markets} lang={lang}/>
        <CalendarLinks lang={lang}/>
        <InstallPanel lang={lang}/>
      </section>
      </>}
      <SiteFooter lang={lang}/>
    </div>
    {route.page==='home' && <Navigation mobile active={activeView} onNavigate={navigate} lang={lang}/>}
    <SourcesDisclosure lang={lang} news={displayNews} sourceHealth={sourceHealth}/>
    <ArticleModal item={selected} lang={lang} dict={dict} onClose={()=>setSelected(null)}/>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations?.().then(registrations => registrations.forEach(registration => registration.unregister())).catch(() => {});
      window.caches?.keys?.().then(keys => Promise.all(keys.filter(key => key.startsWith('hawali-aburi')).map(key => caches.delete(key)))).catch(() => {});
      return;
    }
    navigator.serviceWorker.register('/sw.js?v=20261009-hawal-full-feed-v2', { updateViaCache:'none' }).then(registration => registration.update()).catch(() => {});
  });
}
