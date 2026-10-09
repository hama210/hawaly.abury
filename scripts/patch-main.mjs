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
  const element=event.currentTarget;
  element.onerror=null;
  element.classList.add('img-failed');
  if(element.dataset.fallback==='logo') {
    element.style.visibility='hidden';
    return;
  }
  if(element.dataset.fallback==='category') {
    element.dataset.fallback='logo';
    element.src='/hawali-logo-96.webp';
    element.onerror=imageFallback;
    return;
  }
  element.dataset.fallback='category';
  element.src=coverForCategory(element.dataset.newsCategory||'markets');
  element.onerror=imageFallback;
}`;

if (src.includes("element.style.visibility='hidden'") && src.includes('function imageFallback')) {
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
        <div className="update-ribbon" role="status">
          <div>
            <strong>{lang==='en' ? 'Iraq Market Desk is live' : lang==='ar' ? 'مكتب سوق العراق مباشر' : 'مێزی بازاڕی عێراق چالاکە'}</strong>
            <span>{lang==='en' ? 'City USD rates first · clearer empty states · reliable news covers' : lang==='ar' ? 'أسعار الدولار حسب المدينة أولاً · حالات فارغة أوضح · صور أخبار موثوقة' : 'نرخی دۆلاری شارەکان لە پێشەوە · دۆخی بەتاڵ ڕوونتر · وێنەی هەواڵی باوەڕپێکراو'}</span>
          </div>
          <div className="badge">v6.1</div>
        </div>
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

if (src.includes('home-market-aside') && !src.includes('update-ribbon')) {
  if (!src.includes(oldHome)) {
    console.error('patch-main: home-screen pattern not found; skip');
  } else {
    src = src.replace(oldHome, newHome);
    changed = true;
    console.log('patch-main: homepage rate board + update ribbon');
  }
}

if (changed) {
  fs.writeFileSync(path, src);
  console.log('patch-main: wrote', path);
} else {
  console.log('patch-main: nothing to change');
}
