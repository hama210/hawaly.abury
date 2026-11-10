import { dashboardCopy } from './dashboard-copy.js';
import { pagePath, quoteState, positive, safeUrl, timestamp } from './market-tools.js';
import { getTitle } from '../utils/news.js';
export const SITE_URL = 'https://hawaly-aburyy.pages.dev';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const scriptJson = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function serverContent({ lang, page, news = [], markets = [] }) {
 const c = dashboardCopy[lang];
 const e = escapeHtml;
 const nav = `<nav>${['home','about','contact'].map(p=>`<a href="${pagePath(lang,p)}">${e(c[p])}</a>`).join(' · ')} · ${['ku','ar','en'].map(l=>`<a href="${pagePath(l,page)}">${{ku:'کوردی',ar:'العربية',en:'English'}[l]}</a>`).join(' · ')}</nav>`;
 const intro = `<header><h1>${e(page === 'home' ? 'هەواڵی ئابوری · Hawall' : c[page])}</h1>${nav}</header>`;
 if (page !== 'home') return `<main class="shell information-page">${intro}<p>${e(page==='about'?c.aboutText:c.contactText)}</p>${page==='about'?`<h2>${e(c.methodology)}</h2><p>${e(c.methodologyText)}</p>`:'<a href="https://github.com/hama210/hawaly.abury/issues">GitHub</a>'}<p>${e(c.disclaimer)}</p></main>`;
 const local = markets.find(q=>q.symbol==='USD/IQD');
 const official = markets.find(q=>q.marketKind==='official');
 const number = n=>positive(n)?n.toLocaleString('en-US'):'—';
 const meta = item=>`<small>${e(c[quoteState(item)])}${item?.updatedAt?' · '+e(timestamp(item.updatedAt,lang)):''}${safeUrl(item?.sourceUrl)?` · <a href="${e(safeUrl(item.sourceUrl))}">${e(item.source)}</a>`:''}</small>`;
 const rates = `<section class="desk-panel"><h2>${e(c.rates)} — ${e(c.unit)}</h2><p>${e(c.official)}: <b>${number(positive(official?.price)?official.price*100:null)}</b> ${meta(official)}</p>${['erbil','sulaymaniyah','baghdad'].map(city=>`<p>${e(c[city])}: ${e(c.buy)} <b>${number(local?.[city]?.buy)}</b> · ${e(c.sell)} <b>${number(local?.[city]?.sell)}</b> ${meta(local?.[city]?local:null)}</p>`).join('')}</section>`;
 const stories = news.filter(n=>safeUrl(n.link)).slice(0,12).map(item=>`<article><h3><a href="${e(safeUrl(item.link))}">${e(getTitle(item,lang))}</a></h3><p>${e(item.source)} · <time datetime="${e(item.publishedAt)}">${e(timestamp(item.publishedAt,lang))}</time></p></article>`).join('');
 return `<main class="shell server-summary">${intro}${rates}<section class="desk-panel"><h2>${e(c.five)}</h2>${stories || `<p>${e(c.noBrief)}</p>`}</section><p>${e(c.disclaimer)}</p></main>`;
}
export function renderPage(template, data) {
 const {lang,page} = data;
 const c = dashboardCopy[lang];
 const url = SITE_URL + pagePath(lang,page);
 const title = `${page==='home'?c.title:c[page]} | Hawall · هەواڵی ئابوری`;
 const description = page==='home'?c.subtitle:page==='about'?c.aboutText:c.contactText;
 let html = template.replace(/<html\b[^>]*>/i,`<html lang="${lang==='ku'?'ckb':lang}" dir="${lang==='en'?'ltr':'rtl'}">`).replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`);
 html=html.replace(/<meta\b[^>]*(?:name="description"|property="og:(?:title|description|url|locale)"|name="twitter:(?:title|description)")[^>]*>/gi,'').replace(/<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/gi,'');
 const tags=`<meta name="description" content="${escapeHtml(description)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><meta property="og:locale" content="${lang==='ku'?'ckb_IQ':lang==='ar'?'ar_IQ':'en_US'}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><link rel="canonical" href="${url}">${['ku','ar','en'].map(l=>`<link rel="alternate" hreflang="${l}" href="${SITE_URL+pagePath(l,page)}">`).join('')}<link rel="alternate" hreflang="x-default" href="${SITE_URL+pagePath('ku',page)}">`;
 html=html.replace('</head>',tags+'</head>');
 html=html.replace(/<div id="root">[\s\S]*?<\/div>/,`<div id="root">${serverContent(data)}</div>`);
 return html.replace('</body>',`<script id="hawall-bootstrap" type="application/json">${scriptJson(data)}</script></body>`);
}
