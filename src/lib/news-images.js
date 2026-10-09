// Source images are optional; when absent or fragile, use a local illustrated category cover.
const CATEGORIES=new Set(['iraq','kurdistan','forex','metals','oil','crypto','indices','geopolitics','markets']);
// These publishers serve legitimate news photos, but some refuse browser hotlinking.
// Do not discard them: serve their images through our restricted same-origin proxy.
export const IMAGE_PROXY_HOSTS=[
  'images.mktw.net','media.shafaq.com','i.iranintl.com','ichef.bbci.co.uk',
  'd1ldvf68ux039x.cloudfront.net','cdn.sanity.io','static.aljazeera.net',
  'www.aljazeera.com','media.guim.co.uk'
];
export function isProxyableNewsImage(url){
  try{
    const u=new URL(url);
    return u.protocol==='https:' && IMAGE_PROXY_HOSTS.some(host => u.hostname === host);
  }catch{return false;}
}
export function coverForCategory(category) {
  const categoryKey=String(category||'').toLowerCase();
  return '/news-covers/'+(CATEGORIES.has(categoryKey)?categoryKey:'markets')+'.svg';
}
const unescapeHtml=value=>String(value||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
  .replace(/&apos;|&#39;/gi,"'")
  .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
  .replace(/&#(\d+);/g,(_,decimal)=>String.fromCodePoint(Number(decimal)));
export function verifiedImageUrl(raw,baseUrl='') {
  const text=unescapeHtml(raw).trim();
  if(!text||/^(?:data|blob|javascript):/i.test(text)) return '';
  try {
    const url=new URL(text,baseUrl||undefined);
    if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password) return '';
    if(/(?:favicon|tracking[-_]?pixel|blank\.gif|1x1)/i.test(url.pathname)) return '';
    return url.href;
  }catch{return '';}
}
function attr(tag,name){
  const double=new RegExp('\\b'+name+'\\s*=\\s*"([^"]*)"','i').exec(tag);
  const single=new RegExp("\\b"+name+"\\s*=\\s*'([^']*)'","i").exec(tag);
  return unescapeHtml(double?.[1]||single?.[1]||'');
}
function matches(entry,tagName){
  return [...String(entry||'').matchAll(new RegExp('<'+tagName+'\\b[^>]*>','gi'))].map(m=>m[0]);
}
function eligible(tag){
  const type=attr(tag,'type').toLowerCase(),medium=attr(tag,'medium').toLowerCase();
  if(type&&!type.startsWith('image/'))return false;
  if(medium&&medium!=='image')return false;
  const width=Number(attr(tag,'width')),height=Number(attr(tag,'height'));
  return !((width>0&&width<100)||(height>0&&height<100));
}
export function extractNewsImage(entry,feedUrl){
  const source=String(entry||'');
  const urls=[
    ...matches(source,'media:content').filter(eligible).map(tag=>attr(tag,'url')),
    ...matches(source,'media:thumbnail').filter(eligible).map(tag=>attr(tag,'url')),
    ...matches(source,'enclosure').filter(eligible).map(tag=>attr(tag,'url')),
    ...matches(source,'itunes:image').filter(eligible).map(tag=>attr(tag,'href')),
    ...(source.match(/<image\b[^>]*>[\s\S]*?<url[^>]*>([\s\S]*?)<\/url>/i)?.slice(1,2)||[]),
    ...matches(source,'img').filter(eligible).map(tag=>attr(tag,'src'))
  ];
  for(const candidate of urls){
    const url=verifiedImageUrl(candidate,feedUrl);
    if(url)return url;
  }
  return '';
}
// OpenGraph photos are usually present on direct publisher article pages even
// when the publisher RSS feed contains a headline without media.
export function extractOpenGraphImage(html, articleUrl){
  const source=String(html||'').slice(0,256*1024);
  const tags=[...source.matchAll(/<meta\b[^>]*>/gi)].map(entry=>entry[0]);
  for(const key of ['og:image:secure_url','og:image','twitter:image','twitter:image:src']){
    for(const tag of tags){
      const label=(attr(tag,'property')||attr(tag,'name')).toLowerCase();
      if(label!==key)continue;
      const found=verifiedImageUrl(attr(tag,'content'),articleUrl);
      if(found)return found;
    }
  }
  return '';
}
const ARTICLE_PUBLISHERS=[
  'bbc.com','bbc.co.uk','cnbc.com','marketwatch.com','theguardian.com',
  'aljazeera.com','shafaq.com','rudaw.net','kurdistan24.net','reuters.com',
  'apnews.com','dw.com','euronews.com','ft.com','npr.org','nbcnews.com',
  'cbsnews.com','iranintl.com','fxstreet.com','forexlive.com','coindesk.com',
  'iraq-businessnews.com','ina.iq','dvidshub.net','federalreserve.gov',
  'ecb.europa.eu','bankofengland.co.uk','bea.gov','bls.gov','treasury.gov','cbi.iq'
];
export function trustedArticleUrl(raw){
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:' || url.username || url.password || url.port) return '';
    const hostname=url.hostname.toLowerCase();
    if(!ARTICLE_PUBLISHERS.some(domain=>hostname===domain||hostname.endsWith('.'+domain)))return '';
    return url.href;
  }catch{return '';}
}
const IMAGE_CDN_DOMAINS=[
  ...IMAGE_PROXY_HOSTS,
  'images.unsplash.com','cdn.cnn.com','media.cnn.com','assets.bwbx.io',
  'cloudfront.net','akamaihd.net','wp.com','bbci.co.uk','aljazeera.com',
  'theguardian.com','shafaq.com','reuters.com','apnews.com','euronews.com',
  'npr.org','cnbc.com','ft.com','marketwatch.com','coindesk.com',
  'rudaw.net','kurdistan24.net','fxstreet.com','forexlive.com','dw.com',
  'dvidshub.net','iranintl.com','ina.iq'
];
export function trustedRemoteImage(raw){
  const url=verifiedImageUrl(raw);
  if(!url)return '';
  const hostname=new URL(url).hostname.toLowerCase();
  return IMAGE_CDN_DOMAINS.some(domain=>hostname===domain||hostname.endsWith('.'+domain)) ? url : '';
}

export function imageForNews(item){
  const url=verifiedImageUrl(item?.image);
  if(url)return isProxyableNewsImage(url) ? '/api/news-image?src='+encodeURIComponent(url) : url;
  const article=trustedArticleUrl(item?.link);
  if(article && item?.imageSource==='illustration')
    return '/api/article-image?article='+encodeURIComponent(article)+'&category='+encodeURIComponent(item?.category||'markets');
  return coverForCategory(item?.category);
}
