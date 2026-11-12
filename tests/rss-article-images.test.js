import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeNewsText,onRequest} from '../functions/api/news.js';
import {extractNewsImage,verifiedImageUrl} from '../src/lib/news-images.js';
import {articleSelection} from '../src/lib/article-content.js';
import {MemoryCache,replaceGlobal,requestContext,silenceWarnings} from './helpers.js';

test('publisher HTML paragraph and list boundaries do not fuse article words',()=>{
  const html='<![CDATA[<p>Iraq raised bank oversight.</p><p>Baghdad traders expect updated rates.</p><ul><li>Oil</li><li>Gold</li></ul>]]>';
  const clean=decodeNewsText(html);
  assert.equal(clean,'Iraq raised bank oversight. Baghdad traders expect updated rates. Oil Gold');
  assert.equal(decodeNewsText('&lt;p&gt;Erbil banks&lt;/p&gt;&lt;p&gt;Dollar markets&lt;/p&gt;'),
    'Erbil banks Dollar markets');
  assert.equal(decodeNewsText('<p>Before</p><script>track()</script><p>After</p>'),'Before After');
});

test('publisher Atom enclosure image and HTML-escaped RSS image are recognized',()=>{
  const feed='https://news.example.com/feed';
  assert.equal(extractNewsImage('<entry><link rel="enclosure" type="image/jpeg" href="/media/lead.jpg" /></entry>',feed),
    'https://news.example.com/media/lead.jpg');
  assert.equal(extractNewsImage('<entry><link rel="alternate" href="https://example.com/article"/>'+
    '<link rel="enclosure" type="audio/mpeg" href="/audio.mp3"/></entry>',feed),'');
  assert.equal(extractNewsImage('<description>&lt;p&gt;Market news&lt;/p&gt;'+
    '&lt;img src=&quot;https://cdn.example.com/gold.jpg?x=1&amp;y=2&quot; /&gt;</description>',feed),
    'https://cdn.example.com/gold.jpg?x=1&y=2');
});

test('malformed publisher numeric HTML entities do not crash RSS image parsing',()=>{
  const feed='https://example.com/rss';
  assert.doesNotThrow(()=>verifiedImageUrl('https://cdn.example.com/image&#x110000;.jpg',feed));
  assert.doesNotThrow(()=>verifiedImageUrl('https://cdn.example.com/image&#xD800;.jpg',feed));
  const mixed='<media:content type="video/mp4" url="https://cdn.example.com/video.mp4"/>'+
    '<media:thumbnail url="https://cdn.example.com/lead.jpg?bad=&#x110000;&amp;size=600"/>';
  assert.doesNotThrow(()=>extractNewsImage(mixed,feed));
});

test('HAWAL reader shows additional publisher-supplied syndicated paragraphs without inventing content',async()=>{
  const fresh=new Date().toUTCString();
  const title='Iraq central bank issues guidance for currency markets';
  const description='<p>Iraq bank officials updated currency market guidance.</p>'+
    '<p>Baghdad traders are reviewing the details.</p>';
  const body='<p>Iraq bank officials updated currency market guidance.</p>'+
    '<p>Baghdad traders are reviewing the details and the accompanying financial circulars.</p>'+
    '<p>Implementation and compliance dates were outlined for participating institutions in the financial sector.</p>';
  const rss='<rss><channel><item><title>'+title+'</title>'+
    '<link>https://shafaq.com/en/Economy/example</link>'+
    '<description><![CDATA['+description+']]></description>'+
    '<content:encoded><![CDATA['+body+']]></content:encoded>'+
    '<pubDate>'+fresh+'</pubDate></item></channel></rss>';
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarn=silenceWarnings();
  const restoreFetch=replaceGlobal('fetch',async url=>
    String(url).includes('shafaq.com/rss/en/Economy')
      ?new Response(rss,{status:200,headers:{'Content-Type':'application/rss+xml'}})
      :new Response('unavailable',{status:503}));
  try{
    const req=requestContext('https://hawal.example/api/news?mode=fast&limit=20&refresh=1');
    const response=await onRequest(req.context);
    const payload=await response.json();
    await req.settle();
    const item=payload.items.find(x=>x.title===title);
    assert.ok(item);
    assert.equal(item.summary,'Iraq bank officials updated currency market guidance. Baghdad traders are reviewing the details.');
    assert.match(item.content,/guidance\. Baghdad traders/);
    assert.match(item.content,/circulars\. Implementation and compliance dates/);
    assert.equal(item.contentStatus,'rss-text');
    const reader=articleSelection(item);
    assert.equal(reader.isAvailable,true);
    assert.equal(reader.isExtended,true);
    assert.equal(reader.original,item.content);
    assert.doesNotMatch(reader.original,/<p>|<script>/);
  }finally{restoreFetch();restoreWarn();restoreCache();}
});
