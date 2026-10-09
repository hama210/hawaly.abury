import { trustedArticleUrl } from '../../src/lib/news-images.js';

// Google News RSS includes encoded article identifiers, not direct publisher
// URLs. Best-effort resolution only: the unofficial Google RPC can rate-limit
// or change. We never guess the source URL on a failed lookup.
export function googleNewsArticleId(raw){
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.hostname!=='news.google.com')return '';
    const match=url.pathname.match(/^\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]{12,1500})$/);
    return match?.[1]||'';
  }catch{return '';}
}
export function isGoogleNewsArticle(raw){return Boolean(googleNewsArticleId(raw));}

function legacyPublisherUrl(id){
  try{
    const bytes=atob(id.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(id.length/4)*4,'='));
    const urls=[...bytes.matchAll(/https:\/\/[^\x00-\x20"<>]+/g)].map(match=>match[0]);
    return urls.map(trustedArticleUrl).find(Boolean)||'';
  }catch{return '';}
}
export async function resolveGoogleNewsArticle(raw,{signal}={}){
  const id=googleNewsArticleId(raw);
  if(!id)return '';
  const legacy=legacyPublisherUrl(id);
  if(legacy)return legacy;
  try{
    const page=await fetch('https://news.google.com/rss/articles/'+id,{
      signal,redirect:'manual',
      headers:{
        'Accept':'text/html',
        'Accept-Language':'en-US,en;q=0.8',
        'Cookie':'CONSENT=PENDING+987',
        'User-Agent':'Mozilla/5.0 (compatible; HawalNews/1.0)'
      }
    });
    if(!page.ok)return '';
    const html=(await page.text()).slice(0,1024*1024);
    const signature=html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const timestamp=Number(html.match(/data-n-a-ts="(\d+)"/)?.[1]);
    if(!signature||!Number.isSafeInteger(timestamp)||timestamp<1)return '';
    const payload=[
      'garturlreq',
      [['X','X',['X','X'],null,null,1,1,'US:en',null,1,null,null,null,null,null,0,1],
        'X','X',1,[1,1,1],1,1,null,0,0,null,0],
      id,timestamp,signature
    ];
    const body='f.req='+encodeURIComponent(JSON.stringify([[['Fbv4je',JSON.stringify(payload)]]]));
    const reply=await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute',{
      method:'POST',signal,redirect:'manual',body,
      headers:{
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        'Origin':'https://news.google.com',
        'Referer':'https://news.google.com/',
        'X-Same-Domain':'1',
        'User-Agent':'Mozilla/5.0 (compatible; HawalNews/1.0)'
      }
    });
    if(!reply.ok)return '';
    const rawBody=await reply.text();
    const afterPrefix=rawBody.slice(rawBody.indexOf('\n\n')+2);
    const frames=JSON.parse(afterPrefix);
    const frame=frames.find(row=>Array.isArray(row)&&row[0]==='wrb.fr'&&row[1]==='Fbv4je');
    if(!frame?.[2])return '';
    const decoded=JSON.parse(frame[2]);
    return decoded?.[0]==='garturlres' ? trustedArticleUrl(decoded[1]) : '';
  }catch{return '';}
}
