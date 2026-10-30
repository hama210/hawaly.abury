import { dashboardCopy } from './dashboard-copy.js';
import { polishCopy } from './polish-copy.js';
import { pagePath, quoteState, positive, safeUrl, timestamp, cityRecord, formatNumber } from './market-tools.js';
import { getTitle } from '../utils/news.js';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const scriptJson = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function siteOrigin(configured, requestUrl='') {
  try { const url=new URL(configured); if(url.protocol==='https:' && !url.username && !url.password) return url.origin; } catch {}
  try { const url=new URL(requestUrl); return ['https:','http:'].includes(url.protocol)?url.origin:''; } catch { return ''; }
}
export function seoAsset(path, origin) {
  if(path==='/robots.txt') return 'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: '+origin+'/sitemap.xml\n';
  return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+['home','about','contact'].flatMap(page=>['ku','ar','en'].map(lang=>'<url><loc>'+escapeHtml(origin+pagePath(lang,page))+'</loc>'+['ku','ar','en'].map(l=>'<xhtml:link rel="alternate" hreflang="'+(l==='ku'?'ckb':l)+'" href="'+escapeHtml(origin+pagePath(l,page))+'"/>').join('')+'</url>')).join('')+'</urlset>';
}
export function serverContent({ lang, page, news = [], markets = [], contact={} }) {
 const c=dashboardCopy[lang], p=polishCopy[lang], e=escapeHtml;
 const nav=`<nav>${['home','about','contact'].map(k=>`<a href="${pagePath(lang,k)}">${e(c[k])}</a>`).join(' · ')} · ${['ku','ar','en'].map(l=>`<a href="${pagePath(l,page)}">${{ku:'کوردی',ar:'العربية',en:'English'}[l]}</a>`).join(' · ')}</nav>`;
 const intro=`<header><h1>${e(page==='home'?c.title:c[page])} · Hawal</h1>${nav}</header>`;
 if(page!=='home') return `<main class="shell information-page">${intro}<p>${e(page==='about'?c.aboutText:p.contactIntro)}</p>${page==='about'?`<h2>${e(p.methodology)}</h2><p>${e(p.collection)}</p><p>${e(p.timing)}</p><p>${e(p.retention)}</p><p>${e(p.translationPolicy)}</p><h2>${e(p.corrections)}</h2><p>${e(p.correctionText)}</p><h2>${e(p.privacy)}</h2><p>${e(p.privacyText)}</p>`:`<p><a href="https://github.com/hama210/hawaly.abury/issues/new">${e(p.feedback)}</a></p><p>${e(p.reportNote)}</p>`}<p>${e(c.disclaimer)}</p></main>`;
 const meta=item=>`<small>${e(quoteState(item)==='unavailable'?p.unavailable:c[quoteState(item)])}${item?.updatedAt?' · '+e(timestamp(item.updatedAt,lang)):''}${safeUrl(item?.sourceUrl)?` · <a href="${e(safeUrl(item.sourceUrl))}">${e(item.source)}</a>`:''}</small>`;
 const checked=markets.map(q=>q.checkedAt || q.fetchedAt).filter(Boolean).sort().at(-1);
 const rates=`<section class="desk-panel"><h2>${e(c.rates)} · ${e(c.unit)}</h2><p>${e(checked?c.checked+': '+timestamp(checked,lang):p.unknownCheck)}</p>${['official','erbil','sulaymaniyah','baghdad'].map(city=>{
   const q=cityRecord(markets,city);
   return `<article><h3>${e(c[city])}</h3>${q?city==='official'?`<b>${e(formatNumber(q.price*100,lang))}</b><p>${e(c.reference)}</p>`:['buy','sell'].map(side=>`<span>${e(c[side])}: <b>${e(positive(q[side])?formatNumber(q[side],lang):p.missingSide)}</b></span>`).join(' · '):`<strong>${e(p.unavailable)}</strong><p>${e(p.emptyRate)}</p>`}${meta(q)}</article>`;
 }).join('')}</section>`;
 const stories=news.filter(n=>safeUrl(n.link)).slice(0,12).map(item=>`<article><small>${e(p.originalLanguage)}</small><h3><a href="${e(safeUrl(item.link))}">${e(getTitle(item,lang))}</a></h3><p>${e(item.source)} · <time datetime="${e(item.publishedAt)}">${e(timestamp(item.publishedAt,lang))}</time></p></article>`).join('');
 return `<main class="shell server-summary">${intro}${rates}<section class="desk-panel"><h2>${e(p.headlineSummary)}</h2>${stories || `<p>${e(c.noBrief)}</p>`}</section><p>${e(c.disclaimer)}</p></main>`;
}
export function structuredData(data, origin) {
 const c=dashboardCopy[data.lang], p=polishCopy[data.lang];
 const organization={'@type':'Organization','@id':origin+'/#organization',name:'Hawal',url:origin+'/',logo:origin+'/hawali-logo-512.png'};
 const graph=[organization,{'@type':'WebSite','@id':origin+'/#website',name:'Hawal',url:origin+'/',inLanguage:['ckb','ar','en'],publisher:{'@id':origin+'/#organization'}}];
 const variables=[];
 for(const city of ['official','erbil','sulaymaniyah','baghdad']){
   const q=cityRecord(data.markets || [],city);
   if(!q || !safeUrl(q.sourceUrl)) continue;
   for(const side of city==='official'?['reference']:['buy','sell']){
     const value=city==='official'?q.price*100:q[side];
     if(positive(value))variables.push({'@type':'PropertyValue',name:c[city]+' · '+c[side],value,unitText:'IQD per 100 USD',description:[c[quoteState(q)],timestamp(q.updatedAt,data.lang),q.source,q.sourceUrl].filter(Boolean).join(' · ')});
   }
 }
 if(variables.length&&data.page==='home')graph.push({'@type':'Dataset',name:c.rates,url:origin+pagePath(data.lang),description:p.collection+' '+c.disclaimer,variableMeasured:variables,creator:{'@id':origin+'/#organization'}});
 return {'@context':'https://schema.org','@graph':graph};
}
export function renderPage(template, data) {
 const {lang,page}=data, c=dashboardCopy[lang], origin=siteOrigin(data.siteUrl);
 const url=origin+pagePath(lang,page);
 const title=`${page==='home'?c.title:c[page]} | Hawal`;
 const description=page==='home'?c.subtitle+' · '+c.rates+' · '+c.converter:page==='about'?c.aboutText:polishCopy[lang].contactIntro;
 let html=template.replace(/<html\b[^>]*>/i,`<html lang="${lang==='ku'?'ckb':lang}" dir="${lang==='en'?'ltr':'rtl'}">`).replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`);
 html=html.replace(/<meta\b[^>]*(?:name="description"|property="og:(?:title|description|url|locale|image)"|name="twitter:(?:title|description|image)")[^>]*>/gi,'').replace(/<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/gi,'').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi,'');
 const tags=`<meta name="description" content="${escapeHtml(description)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(url)}"><meta property="og:locale" content="${lang==='ku'?'ckb_IQ':lang==='ar'?'ar_IQ':'en_US'}"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(origin)}/og-image.png"><meta name="twitter:image" content="${escapeHtml(origin)}/og-image.png"><link rel="canonical" href="${escapeHtml(url)}">${['ku','ar','en'].map(l=>`<link rel="alternate" hreflang="${l==='ku'?'ckb':l}" href="${escapeHtml(origin+pagePath(l,page))}">`).join('')}<link rel="alternate" hreflang="x-default" href="${escapeHtml(origin+pagePath('ku',page))}"><script type="application/ld+json">${scriptJson(structuredData(data,origin))}</script>`;
 // Hide the crawler-readable SSR summary only after JavaScript is known to be
 // running. It differs from the React dashboard and must never flash on refresh.
 // With JavaScript disabled the original summary remains visible and readable.
 const clientBoot = '<style>html.hawal-js #root>.server-summary{display:none!important}'+
   'html.hawal-js #root:has(>.server-summary)::before{content:"";display:block;'+
   'height:124px;margin:20px auto;max-width:1100px;border-radius:16px;'+
   'background:linear-gradient(110deg,#071629,#10253b,#071629)}</style>'+
   '<script>document.documentElement.classList.add("hawal-js")</script>';
 html=html.replace('</head>',tags+clientBoot+'</head>');
 html=html.replace(/<div id="root">[\s\S]*?<\/div>/,`<div id="root">${serverContent(data)}</div>`);
 return html.replace('</body>',`<script id="hawall-bootstrap" type="application/json">${scriptJson(data)}</script></body>`);
}
