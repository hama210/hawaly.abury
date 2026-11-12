import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchFeeds} from '../functions/api/news.js';
import {imageForNews,imageRecoveryForNews,isProxyableNewsImage} from '../src/lib/news-images.js';
import {replaceGlobal} from './helpers.js';

test('an official publisher feed with no relevant recent news is quiet, not searched again',async()=>{
  const calls=[];
  const restore=replaceGlobal('fetch',async url=>{
    calls.push(String(url));
    return new Response('<rss><channel><item><title>Community sports day</title>'+
      '<description>Local celebrations take place in town.</description>'+
      '<pubDate>'+new Date().toUTCString()+'</pubDate></item></channel></rss>',{status:200});
  });
  try{
    const [quiet]=await fetchFeeds([{source:'BBC Business',category:'oil',tier:'major',
      url:'https://feeds.bbci.co.uk/news/business/rss.xml'}],100,1);
    assert.equal(quiet.ok,false);
    assert.equal(quiet.error,'no usable recent items');
    assert.deepEqual(calls,['https://feeds.bbci.co.uk/news/business/rss.xml']);
    assert.ok(quiet.durationMs>=0);
  }finally{restore();}
});

test('publisher HTTP 429 avoids another Google News search that would compound the rate limit',async()=>{
  const calls=[];
  const restore=replaceGlobal('fetch',async url=>{
    calls.push(String(url));
    return new Response('Too Many Requests',{status:429});
  });
  try{
    const [status]=await fetchFeeds([{source:'FXStreet',category:'forex',tier:'specialist',
      url:'https://www.fxstreet.com/rss/news'}],100,1);
    assert.equal(status.ok,false);
    assert.equal(status.error,'429');
    assert.equal(calls.length,1);
    assert.ok(!calls[0].includes('news.google.com'));
  }finally{restore();}
});

test('publisher 403 can still recover through same-publisher Google News search',async()=>{
  const calls=[];
  const restore=replaceGlobal('fetch',async url=>{
    calls.push(String(url));
    if(String(url).includes('news.google.com/rss/search')){
      return new Response('<rss><channel><item>'+
        '<title>Oil prices and markets in UK - BBC</title>'+
        '<link>https://www.bbc.com/news/business-123456</link>'+
        '<description>Oil prices were discussed by market analysts.</description>'+
        '<pubDate>'+new Date().toUTCString()+'</pubDate></item></channel></rss>',{status:200});
    }
    return new Response('Forbidden',{status:403});
  });
  try{
    const [found]=await fetchFeeds([{source:'BBC Business',category:'oil',tier:'major',
      url:'https://feeds.bbci.co.uk/news/business/rss.xml'}],100,1);
    assert.equal(calls.length,2);
    assert.equal(found.ok,true);
    assert.equal(found.via,'publisher-search');
    assert.equal(found.source,'BBC Business');
    assert.equal(found.directError,'403');
    assert.ok(found.durationMs>=0);
    assert.equal(found.items.length,1);
  }finally{restore();}
});

test('Guardian image CDN observed in live RSS is proxied only from exact HTTPS host',()=>{
  const img='https://i.guim.co.uk/img/media/safe-photo.jpg?width=900';
  assert.equal(isProxyableNewsImage(img),true);
  assert.equal(imageForNews({image:img,imageSource:'publisher',category:'geopolitics'}),
    '/api/news-image?src='+encodeURIComponent(img));
  for(const url of ['http://i.guim.co.uk/a.jpg',
    'https://i.guim.co.uk.evil.test/a.jpg','https://evil.test/a.jpg',
    'https://user:pass@i.guim.co.uk/a.jpg','https://i.guim.co.uk:8443/a.jpg']){
    assert.equal(isProxyableNewsImage(url),false);
  }
});

test('broken RSS photo gets one publisher-specific OpenGraph recovery URL, never untrusted publisher',()=>{
  const item={image:'https://media.shafaq.com/original.webp',imageSource:'publisher',
    category:'iraq',link:'https://shafaq.com/en/Economy/story'};
  assert.equal(imageRecoveryForNews(item),
    '/api/article-image?article='+encodeURIComponent(item.link)+'&category=iraq');
  assert.equal(imageRecoveryForNews({...item,link:'https://evil.test/news'}),'');
  assert.equal(imageRecoveryForNews({...item,imageSource:'illustration'}),'');
  assert.equal(imageRecoveryForNews({...item,image:'/news-covers/iraq.svg',
    imageSource:'illustration'}),'');
  assert.equal(imageRecoveryForNews({...item,image:'http://media.shafaq.com/old.jpg'}),'');
});

test('news UI retries publisher image once and then shows an honest no-photo state',()=>{
  const src=fs.readFileSync('src/main.jsx','utf8');
  assert.match(src,/element\.dataset\.newsRecoveryTried!=='1'/);
  assert.match(src,/element\.src=recovery/);
  assert.match(src,/element\.parentElement\?\.classList\.add\('img-failed'\)/);
  assert.equal((src.match(/data-news-recovery=\{imageRecoveryForNews\(item\)/g)||[]).length,3);
  assert.equal((src.match(/src=\{imageForNews\(item\) \|\| undefined\}/g)||[]).length,3);
});
