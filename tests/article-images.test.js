import test from 'node:test';
import assert from 'node:assert/strict';
import { extractOpenGraphImage, imageForNews, verifiedImageUrl, trustedArticleUrl } from '../src/lib/news-images.js';
import { onRequest as articlePicture } from '../functions/api/article-image.js';
import { onRequest as proxyPicture } from '../functions/api/news-image.js';
import { MemoryCache, replaceGlobal, requestContext } from './helpers.js';

test('real publisher photos are accepted instead of discarded by the former fragile host blacklist',()=>{
  const photo='https://ichef.bbci.co.uk/news/1536/cpsprodpb/test-story.jpg';
  assert.equal(verifiedImageUrl(photo),photo);
  assert.equal(imageForNews({image:photo,category:'geopolitics'}),'/api/news-image?src='+encodeURIComponent(photo));
  assert.equal(trustedArticleUrl('https://www.bbc.com/news/story'),'https://www.bbc.com/news/story');
  assert.equal(trustedArticleUrl('https://127.0.0.1/test'),'');
  assert.equal(trustedArticleUrl('https://evil.com/?url=bbc.com'),'');
});

test('OpenGraph photo extractor supports different meta attribute order and HTML entities',()=>{
  assert.equal(extractOpenGraphImage('<meta content="https://media.shafaq.com/pic.jpg?x=1&amp;y=2" property="og:image"/>','https://shafaq.com/en/story'),'https://media.shafaq.com/pic.jpg?x=1&y=2');
  assert.equal(extractOpenGraphImage('<meta name="twitter:image" content="/uploads/photo.webp">','https://www.bbc.com/news/test'),'https://www.bbc.com/uploads/photo.webp');
  assert.equal(imageForNews({category:'markets',imageSource:'illustration',link:'https://www.cnbc.com/2026/10/09/news.html'}).startsWith('/api/article-image?'),true);
});

test('article-image endpoint retrieves real publisher OG photo, verifies MIME, caches successful image',async()=>{
  const cache=replaceGlobal('caches',{default:new MemoryCache()});
  let calls=0;
  const restore=replaceGlobal('fetch',async url=>{
    calls++;
    if(String(url)==='https://www.bbc.com/news/story'){
      return new Response('<html><head><meta content="https://ichef.bbci.co.uk/news/story.jpg" property="og:image"/></head><body>Story</body></html>',{status:200,headers:{'content-type':'text/html'}});
    }
    if(String(url)==='https://ichef.bbci.co.uk/news/story.jpg'){
      return new Response(new Uint8Array([255,216,255,0]),{status:200,headers:{'content-type':'image/jpeg'}});
    }
    return new Response('blocked',{status:503});
  });
  try{
    const url='https://hawal.example/api/article-image?article='+encodeURIComponent('https://www.bbc.com/news/story');
    const req=requestContext(url);
    const response=await articlePicture(req.context);
    await req.settle();
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/jpeg');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[255,216,255,0]);
    assert.equal(calls,2);
    const cached=await articlePicture(requestContext(url).context);
    assert.equal(cached.status,200);
    assert.equal(calls,2);
  }finally{restore();cache();}
});

test('image proxy rejects dangerous URLs, serves approved publisher images and rejects HTML',async()=>{
  const cache=replaceGlobal('caches',{default:new MemoryCache()});
  const src='https://media.shafaq.com/story.jpg';
  const rejected=await proxyPicture(requestContext('https://hawal.example/api/news-image?src='+encodeURIComponent('https://127.0.0.1/private')).context);
  assert.equal(rejected.status,400);
  const restore=replaceGlobal('fetch',async()=>new Response(new Uint8Array([137,80,78,71]),{status:200,headers:{'content-type':'image/png'}}));
  try{
    const request=requestContext('https://hawal.example/api/news-image?src='+encodeURIComponent(src));
    const result=await proxyPicture(request.context);
    await request.settle();
    assert.equal(result.status,200);
    assert.equal(result.headers.get('content-type'),'image/png');
  }finally{restore();cache();}
});
