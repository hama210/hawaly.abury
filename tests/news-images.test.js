import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { coverForCategory, verifiedImageUrl, extractNewsImage, imageForNews } from '../src/lib/news-images.js';
import { onRequest } from '../functions/api/news.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

test('publisher images are extracted from RSS thumbnails, enclosures, Atom and HTML descriptions',()=>{
  const feed='https://example.com/rss/business.xml';
  assert.equal(extractNewsImage('<media:thumbnail url="https://cdn.example.com/photo.jpg?size=600&amp;crop=1"/>',feed),'https://cdn.example.com/photo.jpg?size=600&crop=1');
  assert.equal(extractNewsImage('<media:content type="video/mp4" url="https://cdn.example.com/video.mp4"/><media:thumbnail url="//cdn.example.com/cover.webp"/>',feed),'https://cdn.example.com/cover.webp');
  assert.equal(extractNewsImage('<enclosure url="/press/photos/photo.jpg" type="image/jpeg"/>',feed),'https://example.com/press/photos/photo.jpg');
  assert.equal(extractNewsImage('<content><![CDATA[<p>Market report</p><img src="https://cdn.example.com/lead.jpg"></img>]]></content>',feed),'https://cdn.example.com/lead.jpg');
  assert.equal(extractNewsImage('<media:content url="https://cdn.example.com/very-small.jpg" type="image/jpeg" width="1" height="1"/><media:thumbnail url="https://cdn.example.com/big.jpg"/>',feed),'https://cdn.example.com/big.jpg');
  assert.equal(extractNewsImage('<media:content type="image/jpeg" url="https://cdn.example.com/good.jpg"/>',feed),'https://cdn.example.com/good.jpg');
});
test('malformed and unsafe image links fall back to local category covers',()=>{
  assert.equal(verifiedImageUrl('javascript:alert(1)','https://news.example.com/rss'),'');
  assert.equal(verifiedImageUrl('data:image/png;base64,ABC'),'');
  assert.equal(verifiedImageUrl('https://bad.example.com/favicon.ico'),'');
  assert.equal(extractNewsImage('<enclosure url="https://cdn.example.com/audio.mp3" type="audio/mpeg"/>','https://example.com/rss'),'');
  assert.equal(imageForNews({image:'javascript:alert(1)',category:'oil'}),'/news-covers/oil.svg');
  assert.equal(imageForNews({image:'https://cdn.example.com/photo.jpg',category:'markets'}),'https://cdn.example.com/photo.jpg');
  assert.equal(coverForCategory('unknown'),'/news-covers/markets.svg');
  for(const category of ['iraq','kurdistan','forex','metals','oil','crypto','indices','geopolitics','markets']) {
    const path='public'+coverForCategory(category);
    assert.ok(fs.existsSync(path),'missing category cover '+path);
    assert.match(fs.readFileSync(path,'utf8'),/<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  }
});
test('the news API sends real publisher media URLs, otherwise an always-available local cover',async()=>{
  const rss='<rss><channel>'+
    '<item><title>Iraq banking and dinar policy changes in Baghdad</title><link>https://example.com/first</link><description>Authorities reported banking reforms affecting Iraq dollar trading.</description><media:thumbnail url="https://cdn.example.com/iraq-photo.jpg"/><pubDate>'+new Date().toUTCString()+'</pubDate></item>'+
    '<item><title>Erbil dollar market reports new banking measures</title><link>https://example.com/second</link><description>Iraq currency traders discussed the latest banking and budget measures.</description><pubDate>'+new Date().toUTCString()+'</pubDate></item>'+
    '</channel></rss>';
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const restoreFetch=replaceGlobal('fetch',async url=>String(url).includes('shafaq.com/rss/en/Economy')?new Response(rss,{status:200,headers:{'content-type':'application/rss+xml'}}):new Response('not found',{status:404}));
  try{
    const call=requestContext('https://example.com/api/news?mode=fast&limit=40');
    const data=await (await onRequest(call.context)).json();
    await call.settle();
    const photo=data.items.find(q=>q.title.startsWith('Iraq banking'));
    const fallback=data.items.find(q=>q.title.startsWith('Erbil dollar'));
    assert.ok(photo);assert.ok(fallback);
    assert.equal(photo.image,'https://cdn.example.com/iraq-photo.jpg');
    assert.equal(photo.imageSource,'publisher');
    assert.equal(fallback.image,'/news-covers/iraq.svg');
    assert.equal(fallback.imageSource,'illustration');
  }finally{restoreCache();restoreWarn();restoreFetch();}
});
test('mobile news cards, lead story and modal use safe fallbacks, not raw broken links',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8');
  const styles=fs.readFileSync('src/styles.css','utf8');
  assert.equal((main.match(/src=\{imageForNews\(item\)\}/g)||[]).length,3);
  assert.match(main,/data-news-category=\{item\.category/);
  assert.match(main,/imageFallback\(event\)/);
  assert.match(main,/coverForCategory\(element\.dataset\.newsCategory\)/);
  assert.match(main,/referrerPolicy="no-referrer"/);
  assert.match(styles,/\.story-image img \{ width:100%; height:100%; object-fit:cover;/);
  assert.match(fs.readFileSync('public/_routes.json','utf8'),/news-covers\/\*/);
});
