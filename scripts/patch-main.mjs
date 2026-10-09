#!/usr/bin/env node
/**
 * Build-time patch: harden imageFallback + promote City Rate Board on homepage.
 * Safe to re-run; only applies when the old patterns are still present.
 */
import fs from 'node:fs';

const path = 'src/main.jsx';
let src = fs.readFileSync(path, 'utf8');
let changed = false;

const oldFb = `function imageFallback(event) {
  const element=event.currentTarget;
  if(element.dataset.fallback==='logo') {
    element.style.visibility='hidden';
    return;
  }
  if(element.dataset.fallback==='category') {
    element.dataset.fallback='logo';
    element.src='/hawali-logo-512.png';
    return;
  }
  element.dataset.fallback='category';
  element.src=coverForCategory(element.dataset.newsCategory);
}`;

const newFb = `function imageFallback(event) {
  const element = event.currentTarget;
  element.onerror = null;
  if (element.dataset.fallback === 'logo') {
    element.style.opacity = '0';
    element.parentElement?.classList.add('img-failed');
    return;
  }
  if (element.dataset.fallback === 'category') {
    element.dataset.fallback = 'logo';
    element.src = '/hawali-logo-512.png';
    element.onerror = imageFallback;
    return;
  }
  element.dataset.fallback = 'category';
  element.src = coverForCategory(element.dataset.newsCategory || 'markets');
  element.onerror = imageFallback;
}`;

if (src.includes("element.style.visibility='hidden'")) {
  if (!src.includes(oldFb)) {
    console.error('patch-main: imageFallback pattern not found; skip');
  } else {
    src = src.replace(oldFb, newFb);
    changed = true;
    console.log('patch-main: imageFallback hardened');
  }
}

const oldHome = `      <section className={'hawal-screen home-screen '+(activeView==='home'?'':'is-hidden-view')} aria-label={designCopy.home}>
        <div className="home-stage">
          <div className="home-feature-main">
            {hero ? <Hero item={hero} lang={lang} dict={dict} onOpen={setSelected}/> :
              <div className="screen-intro"><p>HAWAL · NEWS</p><h1>{copy.loadingNews}</h1><span>{dashboardCopy[lang].subtitle}</span></div>}
            <aside className="home-market-aside">
              <HomeMarkets markets={markets} lang={lang} onNavigate={navigate}/>
              <FeatureShortcuts lang={lang} onNavigate={navigate} onMoreTarget={setFeatureTarget}/>
            </aside>
          </div>
        </div>`;

const newHome = `      <section className={'hawal-screen home-screen '+(activeView==='home'?'':'is-hidden-view')} aria-label={designCopy.home}>
        <div className="home-rate-board">
          <DollarRates markets={markets} lang={lang}/>
        </div>
        <div className="home-stage">
          <HomeMarkets markets={markets} lang={lang} onNavigate={navigate}/>
          <FeatureShortcuts lang={lang} onNavigate={navigate} onMoreTarget={setFeatureTarget}/>
        </div>
        <div className="home-feature-main home-feature-main--news-first">
          {hero ? <Hero item={hero} lang={lang} dict={dict} onOpen={setSelected}/> :
            <div className="screen-intro"><p>HAWAL · NEWS</p><h1>{copy.loadingNews}</h1><span>{dashboardCopy[lang].subtitle}</span></div>}
        </div>`;

if (src.includes('home-market-aside') && !src.includes('home-rate-board')) {
  if (!src.includes(oldHome)) {
    console.error('patch-main: home-screen pattern not found; skip');
  } else {
    src = src.replace(oldHome, newHome);
    changed = true;
    console.log('patch-main: homepage rate board elevated');
  }
}

if (changed) {
  fs.writeFileSync(path, src);
  console.log('patch-main: wrote', path);
} else {
  console.log('patch-main: nothing to change');
}
