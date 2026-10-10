import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { meaningfulArticleText, articleSelection, storyExcerpt, readerCopy } from '../src/lib/article-content.js';
import { onRequest } from '../functions/api/news.js';
import { MemoryCache, replaceGlobal, requestContext, silenceWarnings } from './helpers.js';

test('an RSS headline repeated as a description is not presented as an article',()=>{
  const title='Iraq dollar rises as central bank signals policy update';
  assert.equal(meaningfulArticleText(title,title),'');
  assert.equal(meaningfulArticleText('  '+title+'! ',title),'');
  assert.equal(meaningfulArticleText('Read more',title),'');
  const selected=articleSelection({title,summary:title,content:title},'en');
  assert.equal(selected.isAvailable,false);
  assert.equal(selected.text,'');
  assert.equal(storyExcerpt({title,summary:title},'ku'),'');
});

test('genuine publisher excerpts and richer syndicated text show up on article cards and reader',()=>{
  const item={
    title:'Iraq financial policy update',titleKu:'نوێکاری سیاسەتی دارایی عێراق',
    summary:'Banks in Iraq published an update about foreign currency policy.',
    summaryKu:'بانکەکانی عێراق نوێکارییەکیان لەسەر سیاسەتی دراو بڵاوکردەوە.',
    content:'Banks in Iraq published an update about foreign currency policy. Officials described implementation steps, noted the effects of compliance rules, and set out the dates that financial institutions should consider in their operations.'
  };
  assert.equal(storyExcerpt(item,'ku'),item.summary);
  assert.equal(storyExcerpt(item,'en'),item.summary);
  const en=articleSelection(item,'en');
  assert.equal(en.isAvailable,true);
  assert.equal(en.isExtended,true);
  assert.equal(en.original,item.content);
  const ku=articleSelection(item,'ku');
  assert.equal(ku.text,item.content);
  assert.equal(ku.original,item.content);
  assert.match(readerCopy.ku.missing,/سەردێڕ/);
});

test('news API distinguishes title-only RSS from source excerpts instead of duplicating headings',async()=>{
  const fresh=new Date().toUTCString();
  const item=(title,description,link)=>
    '<item><title>'+title+'</title><link>'+link+'</link><description>'+description+'</description><pubDate>'+fresh+'</pubDate></item>';
  const rss='<rss><channel>'+
    item('Iraq central bank adjusts dollar policy','Iraq central bank adjusts dollar policy','https://example.com/iraq-policy')+
    item('Erbil dollar market sees banking changes','Local banks reported an update to currency trading hours today.','https://example.com/erbil-bank')+
    '</channel></rss>';
  const restoreCache=replaceGlobal('caches',{default:new MemoryCache()});
  const restoreWarning=silenceWarnings();
  const restoreFetch=replaceGlobal('fetch',async url=>String(url).includes('shafaq.com/rss/en/Economy')
    ? new Response(rss,{headers:{'content-type':'application/rss+xml'}})
    : new Response('unavailable',{status:503}));
  try{
    const call=requestContext('https://example.com/api/news?mode=fast&limit=30');
    const response=await onRequest(call.context);
    const result=await response.json();
    await call.settle();
    const headline=result.items.find(x=>x.title==='Iraq central bank adjusts dollar policy');
    const excerpt=result.items.find(x=>x.title==='Erbil dollar market sees banking changes');
    assert.ok(headline);
    assert.equal(headline.summary,'');
    assert.equal(headline.content,'');
    assert.equal(headline.contentStatus,'headline-only');
    assert.equal(articleSelection(headline).isAvailable,false);
    assert.ok(excerpt);
    assert.equal(excerpt.contentStatus,'excerpt');
    assert.equal(excerpt.summary,'Local banks reported an update to currency trading hours today.');
  }finally{
    restoreFetch();restoreWarning();restoreCache();
  }
});

test('redesigned modal offers a source link and a helpful empty state',()=>{
  const main=fs.readFileSync('src/main.jsx','utf8');
  const css=fs.readFileSync('src/redesign.css','utf8');
  assert.match(main,/articleSelection\(item\)/);
  assert.match(main,/storyExcerpt\(item,lang\)/);
  assert.match(main,/reader\.missing/);
  assert.match(main,/reader\.notice/);
  assert.match(main,/reader\.original/);
  assert.match(main,/const sourceLink = safeUrl\(item\?\.link\)/);
  assert.doesNotMatch(main,/function articleChunks\(/);
  assert.match(main,/translateArticleBody/);
  assert.match(main,/articleBody \|\| selectedText\.original/);
  assert.match(main,/articleTranslated/);
  assert.match(css,/\.article-reader/);
  assert.match(css,/\.story-excerpt/);
  assert.doesNotMatch(main,/body \|\| translatedSummary\(item, lang\)/);
});

test('original publisher content is unchanged in every interface language',()=>{
  const item={title:'Dollar policy update',titleKu:'هەواڵێکی هەڵە',
    summary:'Central bank keeps its dollar policy unchanged.',
    summaryKu:'وەرگێڕانێکی هەڵەی کۆن',
    content:'Officials say no change is planned for foreign exchange operations.'};
  for(const lang of ['ku','ar','en']){
    assert.equal(storyExcerpt(item,lang),item.summary);
    const selected=articleSelection(item,lang);
    assert.equal(selected.text,item.summary);
    assert.equal(selected.original,item.summary);
  }
});
