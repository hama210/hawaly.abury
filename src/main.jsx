import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { fetchNews, getInitialNews } from './services/news.js';
import { fetchMarkets } from './services/markets.js';
import { useClientTranslator } from './hooks/useClientTranslator.js';
import { LANGS, t } from './utils/i18n.js';
import { analyzeArticle, localizeSummary } from './utils/intelligence.js';
import { getSummary, getTitle } from './utils/news.js';

const categories = ['all', 'iraq', 'markets', 'geopolitics', 'oil', 'forex'];
const categoryMap = {
  ku: { all:'هەموو', iraq:'عێراق', markets:'ئابووری', geopolitics:'جەنگ', oil:'نەوت و زێڕ', forex:'فۆرێکس' },
  ar: { all:'الكل', iraq:'العراق', markets:'الاقتصاد', geopolitics:'الحرب', oil:'النفط والذهب', forex:'فوركس' },
  en: { all:'All', iraq:'Iraq', markets:'Economy', geopolitics:'War', oil:'Oil & Gold', forex:'Forex' }
};
const uiCopy = {
  ku: {
    brandTagline:'هەواڵ و بازاڕی کوردستان', lead:'هەواڵی سەرەکی', localDollar:'نرخی دۆلار لە بازاڕی ناوخۆ',
    sell100:'فرۆشتن / $100', calendar:'ڕۆژژمێری ئابووری', latest:'دوایین هەواڵەکان', allSections:'هەموو بەشەکان',
    refresh:'نوێکردنەوە', theme:'گۆڕینی ڕەنگ', language:'زمان', search:'گەڕان', menu:'بەشەکانی هەواڵ',
    home:'سەرەکی', markets:'بازاڕ', news:'هەواڵ', high:'گرنگ', medium:'مامناوەند', live:'زیندوو',
    noMarket:'نرخی ناوخۆ بەردەست نییە', translating:'وەرگێڕانی هەواڵەکان...', close:'داخستن'
  },
  ar: {
    brandTagline:'أخبار وأسواق كردستان', lead:'الخبر الرئيسي', localDollar:'سعر الدولار في السوق المحلي',
    sell100:'بيع / 100$', calendar:'التقويم الاقتصادي', latest:'أحدث الأخبار', allSections:'كل الأقسام',
    refresh:'تحديث', theme:'تغيير المظهر', language:'اللغة', search:'بحث', menu:'أقسام الأخبار',
    home:'الرئيسية', markets:'الأسواق', news:'الأخبار', high:'مهم', medium:'متوسط', live:'مباشر',
    noMarket:'السعر المحلي غير متاح', translating:'جاري ترجمة الأخبار...', close:'إغلاق'
  },
  en: {
    brandTagline:'Kurdistan news and markets', lead:'Lead Story', localDollar:'Local dollar market',
    sell100:'Sell / $100', calendar:'Economic Calendar', latest:'Latest News', allSections:'All sections',
    refresh:'Refresh', theme:'Change theme', language:'Language', search:'Search', menu:'News sections',
    home:'Home', markets:'Markets', news:'News', high:'High', medium:'Medium', live:'Live',
    noMarket:'Local rate unavailable', translating:'Translating news...', close:'Close'
  }
};
const localRateText = {
  ku: { erbil:'هەولێر', baghdad:'بەغدا' },
  ar: { erbil:'أربيل', baghdad:'بغداد' },
  en: { erbil:'Erbil', baghdad:'Baghdad' }
};
const calendarEvents = {
  ku: [
    ['وتاری فیدراڵ ڕیزێرڤ', 'USD', 'high'],
    ['کۆگای نەوتی ئەمریکا', 'WTI', 'medium'],
    ['نوێکاری بودجەی عێراق', 'IQD', 'high']
  ],
  ar: [
    ['خطاب الاحتياطي الفيدرالي', 'USD', 'high'],
    ['مخزونات النفط الأمريكية', 'WTI', 'medium'],
    ['تحديثات موازنة العراق', 'IQD', 'high']
  ],
  en: [
    ['Federal Reserve speech', 'USD', 'high'],
    ['US oil inventories', 'WTI', 'medium'],
    ['Iraq budget update', 'IQD', 'high']
  ]
};
const developerCopy = {
  ku: { developedBy:'گەشەپێدراوە لەلایەن', contact:'پەیوەندی', whatsapp:'واتساپ' },
  ar: { developedBy:'تطوير', contact:'اتصال', whatsapp:'واتساب' },
  en: { developedBy:'Developed by', contact:'Contact', whatsapp:'WhatsApp' }
};
const developer = { name:'Muhammad Muhsin', phone:'+9647763326510', whatsapp:'https://wa.me/9647763326510' };

function timeAgo(value, lang) {
  const ts = new Date(value || Date.now()).getTime();
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.max(1, Math.round(diff / 60000));
  if (min < 60) return lang === 'en' ? `${min}m ago` : lang === 'ar' ? `قبل ${min} دقيقة` : `${min} خولەک لەمەوبەر`;
  const hours = Math.round(min / 60);
  if (hours < 24) return lang === 'en' ? `${hours}h ago` : lang === 'ar' ? `قبل ${hours} ساعة` : `${hours} کاتژمێر لەمەوبەر`;
  const days = Math.round(hours / 24);
  return lang === 'en' ? `${days}d ago` : lang === 'ar' ? `قبل ${days} يوم` : `${days} ڕۆژ لەمەوبەر`;
}

function translatedTitle(item, lang) {
  return getTitle(item || {}, lang) || item?.title || '';
}

function translatedSummary(item, lang) {
  return getSummary(item || {}, lang) || localizeSummary(item || {}, lang);
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
  if (event.currentTarget.dataset.fallback) return;
  event.currentTarget.dataset.fallback = 'true';
  event.currentTarget.src = '/hawali-logo-512.png';
}

function articleText(item) {
  return `${item.title || ''} ${item.titleEn || ''} ${item.titleKu || ''} ${item.titleAr || ''} ${item.summary || ''} ${item.summaryEn || ''} ${item.summaryKu || ''} ${item.summaryAr || ''} ${item.source || ''} ${item.sourceGroup || ''} ${item.category || ''} ${(item.intelligence?.assets || []).join(' ')}`.toLowerCase();
}

function matchesCategory(item, category) {
  if (category === 'all') return true;
  const text = articleText(item);
  const aliases = {
    iraq:['iraq', 'iqd', 'cbi', 'baghdad', 'kurdistan', 'kurdish'],
    markets:['market', 'econom', 'business', 'stock', 'bank', 'finance', 'inflation'],
    geopolitics:['geopolit', 'war', 'conflict', 'iran', 'strike', 'military', 'shipping', 'red sea'],
    oil:['oil', 'gold', 'xau', 'wti', 'opec', 'energy', 'crude'],
    forex:['forex', 'currency', 'dollar', 'usd', 'eur', 'gbp', 'exchange rate']
  };
  return aliases[category]?.some(term => text.includes(term)) || false;
}

function selectMarketItems(markets) {
  const targets = ['USD/IQD', 'XAU/USD', 'WTI', 'BTC/USD', 'EUR/USD'];
  const selected = targets.map(symbol => markets.find(item => item.symbol === symbol)).filter(Boolean);
  return [...selected, ...markets.filter(item => !selected.includes(item))].slice(0, 5);
}

function Header({ lang, setLang, theme, setTheme, query, setQuery, dict, refreshing, onRefresh }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  return <header className="site-header">
    <a className="brand" href="#top" aria-label={dict.site}>
      <span className="brand-mark"><img src="/hawali-logo-96.webp" alt="" /></span>
      <span className="brand-copy"><strong>{dict.site}</strong><small>{copy.brandTagline}</small></span>
    </a>
    <label className="search-wrap">
      <span aria-hidden="true">⌕</span>
      <span className="sr-only">{copy.search}</span>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={dict.search} />
    </label>
    <div className="header-tools">
      <label className="language-control">
        <span className="sr-only">{copy.language}</span>
        <select value={lang} onChange={event => setLang(event.target.value)} aria-label={copy.language}>
          {Object.entries(LANGS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </label>
      <button className="icon-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={copy.theme}>{theme === 'dark' ? '☀' : '☾'}</button>
      <button className={`icon-button refresh-button ${refreshing ? 'is-loading' : ''}`} type="button" onClick={onRefresh} disabled={refreshing} aria-label={copy.refresh}>↻</button>
    </div>
  </header>;
}

function MarketStrip({ markets, lang }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  const localCopy = localRateText[lang] || localRateText.en;
  return <section className="market-strip" id="markets" aria-label={copy.markets}>
    {selectMarketItems(markets).map(market => <div className="market-item" key={market.symbol}>
      <span className="market-symbol">{market.symbol.replace('/USD', '')}</span>
      <span className="market-value">
        <strong>{formatPrice(market.price)}</strong>
        {market.marketKind === 'local'
          ? <small>{localCopy.erbil}</small>
          : <small className={changeClass(market.changePct)}>{formatChange(market.changePct)}</small>}
      </span>
    </div>)}
    {!markets.length && Array.from({ length:5 }, (_, index) => <div className="market-item market-skeleton" key={index}><span>—</span><strong>—</strong></div>)}
  </section>;
}

function BreakingBar({ items, lang, dict }) {
  const highImpact = items.filter(item => item.intelligence?.impact === 'high');
  const stories = (highImpact.length ? highImpact : items).slice(0, 2);
  return <section className="breaking-bar" aria-label={dict.breaking}>
    <strong className="breaking-label"><span className="live-dot" />{dict.breaking}</strong>
    <div className="breaking-copy">{stories.map((item, index) => <span key={item.id || index}>{translatedTitle(item, lang)}</span>)}</div>
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
  const intel = item.intelligence || analyzeArticle(item);
  return <article className="lead-story" role="button" tabIndex="0" onClick={() => onOpen(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onOpen(item); }}>
    <img src={item.image} alt="" onError={imageFallback} />
    <div className="lead-overlay" />
    <div className="lead-copy">
      <span className="lead-label">{uiCopy[lang]?.lead || uiCopy.ku.lead}</span>
      <h1>{translatedTitle(item, lang)}</h1>
      <p>{translatedSummary(item, lang)}</p>
      <div className="story-meta"><span>{item.source}</span><span>•</span><span>{timeAgo(item.publishedAt, lang)}</span><span>•</span><span>{impactLabel(intel.impact, lang)}</span></div>
    </div>
  </article>;
}

function LocalRatePanel({ markets, lang }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  const places = localRateText[lang] || localRateText.en;
  const local = markets.find(market => market.marketKind === 'local' || market.symbol === 'USD/IQD');
  const rows = [
    [places.erbil, local?.erbil?.sell || local?.erbil?.market || local?.erbil?.buy || local?.price],
    [places.baghdad, local?.baghdad?.sell || local?.baghdad?.market || local?.baghdad?.buy || local?.price]
  ];
  return <section className="side-panel rate-panel">
    <div className="panel-title"><h2>{copy.localDollar}</h2><span>{copy.live}</span></div>
    {local ? <div className="rate-grid">{rows.map(([place, value]) => <div className="rate-box" key={place}><small>{place}</small><strong>{formatPrice(value)}</strong><span>{copy.sell100}</span></div>)}</div> : <p className="empty-note">{copy.noMarket}</p>}
  </section>;
}

function CalendarPanel({ lang }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  return <section className="side-panel calendar-panel">
    <h2>{copy.calendar}</h2>
    <div className="event-list">{calendarEvents[lang].map(([title, asset, impact]) => <div className="event-row" key={title}><span>{title}</span><small>{asset} • {impact === 'high' ? copy.high : copy.medium}</small></div>)}</div>
  </section>;
}

function NewsCard({ item, lang, onOpen }) {
  const intel = item.intelligence || analyzeArticle(item);
  return <article className="story-card">
    <button className="story-image" type="button" onClick={() => onOpen(item)} aria-label={translatedTitle(item, lang)}><img src={item.image} alt="" loading="lazy" onError={imageFallback} /></button>
    <div className="story-copy">
      <div className="story-source"><span>{item.source}</span><span>{timeAgo(item.publishedAt, lang)}</span></div>
      <button className="story-title" type="button" onClick={() => onOpen(item)}>{translatedTitle(item, lang)}</button>
      <div className="story-tags"><span>{item.category || impactLabel(intel.impact, lang)}</span>{intel.assets?.slice(0, 2).map(asset => <span key={asset}>{asset}</span>)}</div>
    </div>
  </article>;
}

function ArticleModal({ item, lang, dict, onClose }) {
  useEffect(() => {
    if (!item) return undefined;
    const handleKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [item, onClose]);
  if (!item) return null;
  const intel = item.intelligence || analyzeArticle(item);
  return <div className="modal-backdrop" onClick={onClose} role="presentation"><article className="article-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={event => event.stopPropagation()}>
    <div className="modal-image"><img src={item.image} alt="" onError={imageFallback} /></div>
    <div className="modal-content">
      <button className="modal-close" type="button" onClick={onClose} aria-label={uiCopy[lang]?.close}>×</button>
      <div className="story-meta"><span>{item.source}</span><span>•</span><span>{timeAgo(item.publishedAt, lang)}</span><span>•</span><span>{dict.sentiment}: {sentimentLabel(intel.sentiment, lang)}</span></div>
      <h2 id="modal-title">{translatedTitle(item, lang)}</h2>
      <p>{translatedSummary(item, lang)}</p>
      <h3>{dict.why}</h3><p>{intel.why}</p>
      <div className="modal-assets">{intel.assets?.map(asset => <span key={asset}>{asset}</span>)}</div>
      <div className="modal-actions"><a className="primary-button" href={item.link} target="_blank" rel="noreferrer">{dict.original} ↗</a><button type="button" onClick={() => copyLink(item.link)}>{dict.share}</button></div>
    </div>
  </article></div>;
}

function SourcesDisclosure({ lang }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const copy = uiCopy[lang] || uiCopy.ku;
  const disclosure = {
    ku: { all:'هەموو سەرچاوەکانی هەواڵ', loading:'بارکردنی سەرچاوەکان', note:'ئەم ماڵپەڕە تەنها سەردێڕ، پوختە و لینکی هەواڵە گشتییەکان کۆدەکاتەوە. ناوەڕۆک موڵکی سەرچاوە ڕەسەنەکانیەتی.', contact:'بۆ داواکاری سەرچاوە یان لابردنەوە، پەیوەندی بکە.' },
    ar: { all:'كل مصادر الأخبار', loading:'تحميل المصادر', note:'يجمع هذا الموقع عناوين الأخبار العامة وملخصات قصيرة وروابط المصادر الأصلية. المحتوى يعود إلى ناشريه الأصليين.', contact:'لطلب إضافة مصدر أو إزالة محتوى، تواصل معنا.' },
    en: { all:'All news sources', loading:'Loading sources', note:'This site collects public headlines, short summaries, and links to original publishers. Content belongs to its original publishers.', contact:'For source or removal requests, contact us.' }
  }[lang];
  useEffect(() => {
    let alive = true;
    fetch('/api/sources').then(response => response.ok ? response.json() : Promise.reject()).then(data => { if (alive && Array.isArray(data.sources)) setSources(data.sources.filter(Boolean)); }).catch(() => { if (alive) setSources([]); });
    return () => { alive = false; };
  }, []);
  return <aside className={`sources-corner ${open ? 'is-open' : ''}`}>
    {open && <div className="sources-panel" role="dialog" aria-label={disclosure.all}>
      <div className="sources-head"><div><strong>{disclosure.all}</strong><small>{sources.length ? `${sources.length} ${t[lang]?.sources}` : disclosure.loading}</small></div><button type="button" onClick={() => setOpen(false)} aria-label={copy.close}>×</button></div>
      <p>{disclosure.note}</p><p className="source-contact">{disclosure.contact} <a href={`tel:${developer.phone}`} dir="ltr">{developer.phone}</a></p>
      <div className="sources-list">{sources.length ? sources.map(source => <span key={source}>{source}</span>) : <span>{disclosure.loading}...</span>}</div>
    </div>}
    <button className="sources-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}><span>Sources</span><b>{sources.length || '...'}</b></button>
  </aside>;
}

function SiteFooter({ lang }) {
  const copy = developerCopy[lang] || developerCopy.en;
  return <footer className="site-footer"><div><span>{copy.developedBy}</span><strong>{developer.name}</strong></div><nav><a href={`tel:${developer.phone}`} dir="ltr">☎ {developer.phone}</a><a href={developer.whatsapp} target="_blank" rel="noreferrer">{copy.whatsapp} ↗</a></nav></footer>;
}

function MobileNav({ lang }) {
  const copy = uiCopy[lang] || uiCopy.ku;
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
  return <nav className="mobile-nav" aria-label="Mobile navigation"><button type="button" onClick={() => go('top')}><span>⌂</span>{copy.home}</button><button type="button" onClick={() => go('markets')}><span>⌁</span>{copy.markets}</button><button type="button" onClick={() => go('latest')}><span>▤</span>{copy.news}</button></nav>;
}

function App() {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ku');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [news, setNews] = useState(getInitialNews);
  const [markets, setMarkets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const dict = t[lang] || t.ku;
  const copy = uiCopy[lang] || uiCopy.ku;
  const { translatedNews, translating } = useClientTranslator(news, lang);
  const displayNews = translatedNews.length ? translatedNews : news;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGS[lang].dir;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lang', lang);
    localStorage.setItem('theme', theme);
  }, [lang, theme]);

  useEffect(() => {
    let alive = true;
    const update = items => { if (alive && items?.length) setNews(items); };
    const load = () => fetchNews(update).then(update);
    load();
    const interval = setInterval(load, 300000);
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
      const [latest, nextMarkets] = await Promise.all([fetchNews(items => { if (items?.length) setNews(items); }), fetchMarkets()]);
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
  const hero = filtered[0];
  const rest = filtered.slice(1);

  return <div className="page" id="top">
    <div className="shell">
      <Header lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} query={query} setQuery={setQuery} dict={dict} refreshing={refreshing} onRefresh={refreshAll} />
      <MarketStrip markets={markets} lang={lang} />
      <BreakingBar items={displayNews} lang={lang} dict={dict} />
      <CategoryTabs active={active} setActive={setActive} lang={lang} />
      {filtered.length ? <>
        <section className="main-grid"><Hero item={hero} lang={lang} dict={dict} onOpen={setSelected} /><aside className="home-side"><LocalRatePanel markets={markets} lang={lang} /><CalendarPanel lang={lang} /></aside></section>
        <section className="latest-section" id="latest">
          <div className="section-heading"><h2>{copy.latest}</h2><span>{translating ? copy.translating : active === 'all' ? copy.allSections : categoryMap[lang]?.[active]}</span></div>
          {rest.length ? <div className="news-grid" aria-live="polite">{rest.map(item => <NewsCard key={item.id} item={item} lang={lang} onOpen={setSelected} />)}</div> : <div className="empty-state">{dict.noResults}</div>}
        </section>
      </> : <div className="empty-state page-empty">{dict.noResults}</div>}
      <SiteFooter lang={lang} />
    </div>
    <MobileNav lang={lang} />
    <SourcesDisclosure lang={lang} />
    <ArticleModal item={selected} lang={lang} dict={dict} onClose={() => setSelected(null)} />
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
    navigator.serviceWorker.register('/sw.js?v=20260716-redesign', { updateViaCache:'none' }).then(registration => registration.update()).catch(() => {});
  });
}
