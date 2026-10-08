import React from 'react';
import { quoteState, safeUrl, timestamp } from '../lib/market-tools.js';

export const tabs = ['home','markets','news','more'];
export const navigationCopy = {
 en:{home:'Home', markets:'Markets', news:'News', more:'More', marketPulse:'Market pulse', marketDesk:'Market Intelligence', marketDetail:'Live quotes, verified sources and context', verifyDesk:'Rumor vs sources', verifyDetail:'Check what publishers and official institutions have actually reported', tools:'Your financial toolkit', toolsDetail:'Historical observations, local alerts and conversion tools', latest:'Latest headlines', explore:'Explore', allNews:'View all news', latestRates:'Latest sourced prices', source:'Source', noQuote:'No dated quote', quickIntelligence:'Intelligence', quickVerify:'Check rumors', quickHistory:'Rate history', quickAlerts:'Alerts', tracked:'Sourced quotes', featured:'Top story'},
 ku:{home:'سەرەکی', markets:'بازاڕ', news:'هەواڵ', more:'زیاتر', marketPulse:'بازاڕەکان', marketDesk:'زیرەکی بازاڕ',marketDetail:'نرخ، سەرچاوە و پاشخانێکی ڕوون',verifyDesk:'دەنگۆ و سەرچاوە',verifyDetail:'بزانە سەرچاوە فەرمی و بڵاوکەرەوەکان چیان ڕاگەیاندووە',tools:'ئامرازە داراییەکان',toolsDetail:'مێژووی نرخەکان، ئاگادارکردنەوە و گۆڕەری دراو',latest:'نوێترین هەواڵەکان',explore:'پشکنین',allNews:'هەموو هەواڵەکان',latestRates:'دوایین نرخی سەرچاوەدار',source:'سەرچاوە',noQuote:'نرخی بەرواردار نییە',quickIntelligence:'زیرەکی بازاڕ',quickVerify:'پشکنینی دەنگۆ',quickHistory:'مێژووی نرخ',quickAlerts:'ئاگادارکردنەوە',tracked:'نرخی سەرچاوەدار',featured:'هەواڵی گرنگ'},
 ar:{home:'الرئيسية',markets:'الأسواق',news:'الأخبار',more:'المزيد',marketPulse:'الأسواق',marketDesk:'ذكاء السوق',marketDetail:'أسعار ومصادر وتحليلات موثقة المصدر',verifyDesk:'الشائعات والمصادر',verifyDetail:'اطلع على ما نشرته الجهات الرسمية والمصادر الإخبارية',tools:'أدوات الأسواق',toolsDetail:'الأسعار التاريخية والتنبيهات وتحويل العملات',latest:'آخر الأخبار',explore:'استكشف',allNews:'جميع الأخبار',latestRates:'أحدث الأسعار بمصادر',source:'المصدر',noQuote:'لا يوجد سعر مؤرخ',quickIntelligence:'ذكاء السوق',quickVerify:'تحقق من الشائعة',quickHistory:'سجل الأسعار',quickAlerts:'التنبيهات',tracked:'أسعار موثقة المصدر',featured:'الخبر الرئيسي'}
};
export function NavIcon({ name, size = 22 }) {
 const paths={
  home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></>,
  markets:<><path d="M3 20h18M5 16V9m7 7V4m7 12v-6"/><path d="M3 11 9 6l4 4 8-7"/></>,
  news:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  search:<><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></>,
  moon:<><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5z"/></>,
  refresh:<><path d="M20 6v6h-6M4 18v-6h6"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/></>,
  shield:<><path d="m12 2 8 4v6c0 5-3.8 8.1-8 10-4.2-1.9-8-5-8-10V6z"/><path d="m8 12 3 3 5-6"/></>,
  bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4"/></>,
  history:<><path d="M3 3v6h6M4 9a9 9 0 1 1-1 5M12 7v5l4 2"/></>,
  chart:<><path d="M3 20h18M4 15l5-6 4 3 7-9"/></>
 };
 return <svg className="hawal-svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.more}</svg>;
}
export function Navigation({ active, onNavigate, lang, mobile = false }) {
 const c=navigationCopy[lang] || navigationCopy.ku;
 return <nav className={mobile?'mobile-nav redesigned-mobile-nav':'desktop-nav'} aria-label={mobile?'Mobile navigation':'Primary navigation'}>
   {tabs.map(tab=><button key={tab} type="button" aria-current={active===tab?'page':undefined} aria-pressed={active===tab} className={active===tab?'active':''} onClick={()=>onNavigate(tab)}>
     <NavIcon name={tab} size={mobile?21:17}/><span>{c[tab]}</span>
   </button>)}
 </nav>;
}
export function HomeMarkets({ markets=[], lang, onNavigate }) {
 const c=navigationCopy[lang] || navigationCopy.ku;
 const local=markets.find(m=>m.symbol==='USD/IQD');
 const items=[
  {title:'USD/IQD',symbol:'USD/IQD',label:'🇮🇶',price:local?.erbil?.sell,state:quoteState(local),type:'local',source:local,unit:'IQD / $100'},
  {title:'Gold (XAU)',symbol:'XAU/USD',label:'◉',unit:'USD / oz',source:markets.find(m=>m.symbol==='XAU/USD')},
  {title:'Brent Oil',symbol:'BRENT/USD',label:'◈',unit:'USD / barrel',source:markets.find(m=>m.symbol==='BRENT/USD')}
 ];
 return <section className="home-markets" aria-label={c.marketPulse}>
   {items.map(item=>{
     const q=item.source;
     const value=item.type==='local'?item.price:q?.price;
     const state=quoteState(q);
     const fresh=state==='reported'&&typeof value==='number'&&Number.isFinite(value)&&value>0;
     const change=Number.isFinite(q?.changePct) && item.type!=='local' ? q.changePct : null;
     const amount=fresh?value.toLocaleString('en-US',{minimumFractionDigits:value<10?2:0,maximumFractionDigits:2}):'—';
     return <button type="button" key={item.symbol} className="pulse-card" onClick={()=>onNavigate('markets')} aria-label={item.title + ', ' + (fresh?amount:c.noQuote)}>
       <div className="pulse-label"><span className={'pulse-symbol pulse-'+item.symbol.split('/')[0].toLowerCase()}>{item.label}</span><span dir="ltr">{item.title}</span></div>
       <strong dir="ltr">{amount}</strong>
       <span className={'pulse-change '+(change>0?'up':change<0?'down':'')}>{change===null?(state==='reported'?c.tracked:c.noQuote):(change>0?'+':'')+change.toFixed(2)+'% '+(change>0?'▲':change<0?'▼':'')}</span>
       <small>{fresh&&q?.updatedAt?timestamp(q.updatedAt,lang):c.noQuote}</small>
     </button>;
   })}
 </section>;
}
const shortcuts=[{key:'intelligence',nav:'markets',icon:'markets'},{key:'verify',nav:'news',icon:'shield'},{key:'history',nav:'more',icon:'chart'},{key:'alerts',nav:'more',icon:'bell'}];
export function FeatureShortcuts({ lang, onNavigate, onMoreTarget }) {
 const c=navigationCopy[lang] || navigationCopy.ku;
 const titles={intelligence:c.quickIntelligence,verify:c.quickVerify,history:c.quickHistory,alerts:c.quickAlerts};
 return <div className="quick-shortcuts">{shortcuts.map(item=><button key={item.key} type="button" onClick={()=>{onNavigate(item.nav);onMoreTarget?.(item.key);}}><span className={'shortcut-icon tone-'+item.key}><NavIcon name={item.icon} size={25}/></span><span>{titles[item.key]}</span></button>)}</div>;
}
export function ScreenIntro({ page, lang }) {
 const c=navigationCopy[lang] || navigationCopy.ku;
 const config={markets:{eyebrow:'FINANCIAL MARKETS',title:c.marketDesk,detail:c.marketDetail},news:{eyebrow:'NEWS & FACT CHECK',title:c.verifyDesk,detail:c.verifyDetail},more:{eyebrow:'YOUR MARKET TOOLS',title:c.tools,detail:c.toolsDetail}};
 const data=config[page]; if(!data)return null;
 return <div className={'screen-intro intro-'+page}><p>{data.eyebrow}</p><h1>{data.title}</h1><span>{data.detail}</span></div>;
}
