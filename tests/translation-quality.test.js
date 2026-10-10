import test from 'node:test';
import assert from 'node:assert/strict';
import { translationQuality, normalizeTranslation } from '../src/lib/translation-quality.js';

test('accepts faithful Kurdish Sorani and Arabic translations of financial headlines',()=>{
  const source='Iraq dollar rises to 151,000 dinars as Trump comments on USD/IQD';
  const sorani='دۆلار لە عێراق بۆ ١٥١,٠٠٠ دینار بەرز دەبێتەوە، کاتێک ترامپ لەسەر USD/IQD قسە دەکات';
  const arabic='يرتفع الدولار في العراق إلى ١٥١,٠٠٠ دينار بينما يعلّق ترامب على USD/IQD';
  assert.equal(translationQuality(source,sorani,'ku').valid,true);
  assert.equal(translationQuality(source,arabic,'ar').valid,true);
});
test('rejects invented or changed financial figures and currency pairs',()=>{
  const source='Gold XAU/USD rises 4.2% to 4,200';
  assert.equal(translationQuality(source,'زێڕی XAU/USD بە ڕێژەی ٤.٣٪ بۆ ٤,٢٠٠ بەرز بووەوە','ku').reason,'changed-numbers');
  assert.equal(translationQuality(source,'زێڕی EUR/USD بە ڕێژەی ٤.٢٪ بۆ ٤,٢٠٠ بەرز بووەوە','ku').reason,'changed-market-pair');
});
test('rejects Arabic copy masquerading as Sorani, English copy and canned text',()=>{
  assert.equal(translationQuality('Iraq inflation rises','يرتفع التضخم في العراق','ku').reason,'not-sorani');
  assert.equal(translationQuality('Iraq inflation rises','Iraq inflation rises','ku').reason,'unchanged');
  assert.equal(translationQuality('Dollar market report','نوێکارییەکی کاریگەر لە بازاڕەکان','ku').reason,'generic-or-refusal');
  assert.equal(translationQuality('Trump says Iran talks continue','Sorry, I cannot translate the sentence','ku').valid,false);
});
test('cleans model thinking or translation labels rather than showing those to readers',()=>{
  assert.equal(normalizeTranslation('<think>analysis</think>Translation: «نرخی دۆلار بەرز بووەوە»'),'نرخی دۆلار بەرز بووەوە');
});

test('critical names cannot disappear from a translated Iraq or Trump headline',()=>{
  assert.equal(
    translationQuality('Trump says Iran talks will continue','بایدن دەڵێت گفتوگۆکان بەردەوام دەبن','ku').reason,
    'missing-important-name'
  );
  assert.equal(
    translationQuality('Baghdad sees new dollar rules','ڕێسایەکی نوێی دۆلار دەردەچێت','ku').reason,
    'missing-important-name'
  );
  assert.equal(
    translationQuality('Trump speaks about Iran and Iraq','ترامپ لەبارەی ئێران و عێراقەوە قسە دەکات','ku').valid,
    true
  );
});

test('denials cannot become affirmative headlines in Sorani or Arabic',()=>{
  assert.equal(
    translationQuality('Trump did not announce sanctions on Iraq','ترامپ سزای نوێی بەسەر عێراقدا ڕاگەیاند','ku').reason,
    'missing-negation'
  );
  assert.equal(
    translationQuality('Trump did not announce sanctions on Iraq','ترامپ هیچ سزایەکی نوێی بەسەر عێراقدا ڕانەگەیاند','ku').valid,
    true
  );
  assert.equal(
    translationQuality('Iran denies reports of an attack','تؤكد إيران التقارير عن هجوم','ar').reason,
    'missing-negation'
  );
});

test('partial translations of long, detailed headlines are not presented as complete news',()=>{
  const headline='The central bank announced new dollar trading restrictions at commercial banks amid concerns over inflation and increased import costs';
  const tiny='بانکی ناوەندی بڕیارێکی نوێی ڕاگەیاند';
  assert.equal(translationQuality(headline,tiny,'ku').reason,'implausible-length');
});

test('rejects screenshot-style Sorani hallucinated repeated words and sentence loops',()=>{
  const source='The Iraqi central bank announced new dollar exchange regulations for banks and travellers. The policy applies to approved money transfers and commercial transactions.';
  const gibberish='بانکی ناوەندی عێراق بڕیارێکی نوێی دا: گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی گەشەکردنی لە بازاڕدا';
  assert.equal(translationQuality(source,gibberish,'ku').reason,'repetitive-output');
  const loop='بانکی ناوەندی لە بازاڕدا بڕیار دا. بانکی ناوەندی لە بازاڕدا بڕیار دا. بانکی ناوەندی لە بازاڕدا بڕیار دا. بانکی ناوەندی لە بازاڕدا بڕیار دا.';
  assert.equal(translationQuality(source,loop,'ku').reason,'repetitive-output');
});
test('rejects untranslated English paragraph glued to the end of Sorani text',()=>{
  const source='The central bank announced new exchange regulations for Iraq. The bank said its foreign reserves cover external transfers and dollar sales to travellers.';
  const output='بانکی ناوەندی عێراق ڕێنمایی نوێی بۆ ئاڵوگۆڕی دراو ڕاگەیاند. The bank said its foreign reserves cover external transfers and dollar sales to travellers without restrictions';
  assert.equal(translationQuality(source,output,'ku').reason,'mixed-language-output');
});
test('accepts normal Sorani sentences that mention English ticker symbols and outlets',()=>{
  const source='The dollar falls in Iraq while Brent Oil increases';
  const output='نرخی دۆلار لە عێراق دابەزیوە، لە کاتێکدا نرخی Brent Oil بەرزبووەتەوە';
  assert.equal(translationQuality(source,output,'ku').valid,true);
});
