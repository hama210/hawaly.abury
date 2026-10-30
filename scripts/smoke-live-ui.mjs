import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const site = process.env.SITE_URL || 'https://hawaly-aburyy.pages.dev/';
const executablePath = ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium']
  .find(path => existsSync(path));
if (!executablePath) throw new Error('No installed Chromium/Google Chrome browser was found');

const browser = await puppeteer.launch({
  executablePath,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
});
const failures = [];
let passed = false;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  page.on('pageerror',error=>failures.push('PAGE ERROR: '+error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push('CONSOLE: '+message.text());});

  console.log('Checking live rendered UI:',site);
  const response = await page.goto(site,{waitUntil:'domcontentloaded',timeout:90000});
  console.log('HTML HTTP status:',response?.status());
  if(!response?.ok())throw new Error('HTML page failed to load');
  await page.waitForSelector('.story-card',{timeout:90000});
  const state = await page.evaluate(() => ({
    lang:document.documentElement.lang,dir:document.documentElement.dir,
    mobileNav:!!document.querySelector('.redesigned-mobile-nav'),
    cards:document.querySelectorAll('.home-news .story-card').length,
    hero:document.querySelector('.lead-story h2')?.textContent?.trim()?.slice(0,120)||'',
    published:[...document.querySelectorAll('.home-news .story-card time')].slice(0,10).map(t=>t.dateTime),
    serverSummaryVisible:!!document.querySelector('#root > .server-summary') &&
      getComputedStyle(document.querySelector('#root > .server-summary')).display!=='none',
    warning:document.querySelector('.home-screen .news-feed-warning')?.textContent?.trim()||''
  }));
  console.log('Mobile render:',JSON.stringify(state));
  if(state.cards<1 || !state.hero)throw new Error('News cards/hero are not visible in mobile DOM');
  if(state.serverSummaryVisible)throw new Error('SSR-only page remains visible to JavaScript visitors');
  const newest=Math.max(...state.published.map(x=>Date.parse(x)).filter(Number.isFinite));
  if(!Number.isFinite(newest) || Date.now()-newest > 24*3600*1000){
    throw new Error('News cards visible but none in the last 24 hours');
  }
  await page.screenshot({path:'hawall-mobile-smoke.png',fullPage:false});
  await page.setViewport({width:1365,height:900,deviceScaleFactor:1,isMobile:false,hasTouch:false});
  await page.reload({waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForSelector('.story-card',{timeout:90000});
  const desktop=await page.evaluate(()=>({
    cards:document.querySelectorAll('.home-news .story-card').length,
    hero:document.querySelector('.lead-story h2')?.textContent?.trim()||'',
    hiddenSSR:!document.querySelector('#root > .server-summary')
  }));
  console.log('Desktop reload:',JSON.stringify(desktop));
  if(!desktop.cards || !desktop.hero)throw new Error('Desktop reload lost news');
  await page.screenshot({path:'hawall-desktop-smoke.png',fullPage:false});
  if(failures.length)console.log('Browser diagnostics:',JSON.stringify(failures.slice(0,12)));
  passed=true;
} finally {
  await browser.close();
}
if(!passed)process.exitCode=1;
