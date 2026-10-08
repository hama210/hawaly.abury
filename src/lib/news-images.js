// Source images are optional; when absent, render a local illustrated category cover.
const CATEGORIES=new Set(['iraq','kurdistan','forex','metals','oil','crypto','indices','geopolitics','markets']);
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
export function imageForNews(item){
  return verifiedImageUrl(item?.image)||coverForCategory(item?.category);
}
