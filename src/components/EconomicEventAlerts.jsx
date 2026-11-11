import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchEconomicCalendar } from '../services/economic-calendar.js';
import { calendarEventTitle } from '../lib/calendar-i18n.js';
import { pagePath } from '../lib/market-tools.js';
import {
  ECONOMIC_ALERTS_SETTINGS_KEY, ECONOMIC_ALERTS_SENT_KEY, ECONOMIC_ALERTS_TOPICS,
  ECONOMIC_ALERTS_MINUTES, normalizeEconomicAlertSettings, upcomingEconomicEvents,
  dueEconomicAlerts, pruneEconomicAlertDelivery, formatEconomicCountdown
} from '../lib/economic-event-alerts.js';

const LOG_KEY = 'hawal_economic_alert_log_v1';
const T = {
  ku:{
    title:'ئاگادارکردنەوەی هەواڵە ئابوورییەکان',
    eyebrow:'HAWAL · EVENT ALERTS',
    description:'ئاگادارکردنەوە پێش هەواڵە گرنگەکانی بازاڕ؛ بە پێی کاڵەندەری ڕاستەقینە.',
    activate:'چالاککردن', deactivate:'ناچالاککردن', active:'چالاکە', inactive:'ناچالاکە',
    timing:'چەند خولەک پێش هەواڵەکە؟', choices:'کام هەواڵانەت دەوێت؟',
    cpi:'CPI · هەڵاوسان',nfp:'NFP · دامەزراندنی کار',fed:'Fed · بڕیاری سوود و FOMC',other:'هەواڵە گرنگەکانی تر',
    upcoming:'هەواڵە داهاتووە دیاریکراوەکان',recent:'دوایین ئاگادارکردنەوەکان',
    empty:'هێشتا هیچ هەواڵێکی گونجاو نییە؛ فلتەرەکان بپشکنە.',
    noNotices:'هێشتا ئاگادارکردنەوەیەک نەنێردراوە.',minutes:'خولەک',
    browser:'چالاککردنی ئاگادارکردنەوەی وێبگەڕ',granted:'ئاگادارکردنەوەی وێبگەڕ ڕێگەپێدراوە.',
    denied:'وێبگەڕ ڕێگەی ئاگادارکردنەوەی نەداوە؛ لە ڕێکخستنەکان چالاکی بکە.',
    unsupported:'ئەم وێبگەڕە پشتگیری ئاگادارکردنەوە ناکات. ئاگادارکردنەوەی ناو پەڕە کار دەکات.',
    onlyOpen:'تەنها کاتێک HAWAL کراوەیە ئەم بیرخستنەوانە کار دەکەن؛ ئاگادارکردنەوەی پاشبنەمایی بەڵێن نەدراوە.',
    permissionTip:'لە ئایفۆن، ئاگادارکردنەوەی وێب لەوانەیە پێویستی بە Add to Home Screen هەبێت.',
    reminder:'بیرخستنەوەی هەواڵ',before:'نزیکبوونەوەی بڵاوکردنەوە',calendar:'کردنەوەی کاڵەندەر',
    fetchError:'کاڵەندەر نوێ نەبووەوە؛ کاتی هەواڵەکان پشتڕاست بکەرەوە.',
    waiting:'هەواڵەکان دەخوێندرێنەوە...',source:'سەرچاوە: ShowMyTrades',dismiss:'داخستن'
  },
  ar:{
    title:'تنبيهات الأخبار الاقتصادية',eyebrow:'HAWAL · EVENT ALERTS',
    description:'تذكير قبل البيانات الاقتصادية المهمة، اعتماداً على المواعيد المنشورة في التقويم.',
    activate:'تفعيل',deactivate:'إيقاف',active:'مفعّل',inactive:'متوقف',
    timing:'كم دقيقة قبل الحدث؟',choices:'ما الأحداث التي تتابعها؟',
    cpi:'CPI · التضخم',nfp:'NFP · الوظائف',fed:'Fed · الفائدة و FOMC',other:'بقية الأخبار عالية التأثير',
    upcoming:'الأحداث القادمة المحددة',recent:'آخر التنبيهات',
    empty:'لا توجد أحداث مناسبة قريباً؛ تحقق من الاختيارات.',
    noNotices:'لم يتم إطلاق تنبيه بعد.',minutes:'دقيقة',
    browser:'تفعيل إشعارات المتصفح',granted:'إشعارات المتصفح مسموحة.',
    denied:'إشعارات المتصفح محظورة؛ راجع إعدادات المتصفح.',
    unsupported:'هذا المتصفح لا يدعم الإشعارات. ستظل تنبيهات الصفحة متاحة.',
    onlyOpen:'تعمل التذكيرات عندما تكون HAWAL مفتوحة فقط؛ لا توجد إشعارات خلفية مضمونة.',
    permissionTip:'قد تتطلب إشعارات iPhone إضافة الموقع إلى الشاشة الرئيسية.',
    reminder:'تذكير اقتصادي',before:'موعد الإصدار يقترب',calendar:'فتح التقويم',
    fetchError:'تعذر تحديث التقويم؛ تحقق من موعد الحدث من المصدر.',
    waiting:'جارٍ تحميل الأحداث...',source:'المصدر: ShowMyTrades',dismiss:'إغلاق'
  },
  en:{
    title:'Economic event alerts',eyebrow:'HAWAL · EVENT ALERTS',
    description:'Reminders before major economic releases, using real published calendar times.',
    activate:'Enable alerts',deactivate:'Disable alerts',active:'Enabled',inactive:'Disabled',
    timing:'Notify how many minutes before?',choices:'Which releases matter to you?',
    cpi:'CPI · Inflation',nfp:'NFP · Payrolls',fed:'Fed · Rates and FOMC',other:'Other high-impact events',
    upcoming:'Upcoming selected releases',recent:'Recent reminders',
    empty:'No matching upcoming releases. Check your choices.',
    noNotices:'No reminders have fired yet.',minutes:'minutes',
    browser:'Enable browser notifications',granted:'Browser notifications are allowed.',
    denied:'Browser notifications are blocked. Check browser settings.',
    unsupported:'Browser notifications are unavailable; on-page alerts still work.',
    onlyOpen:'Reminders work only while HAWAL is open. Background push delivery is not provided.',
    permissionTip:'On iPhone, browser notifications may require Add to Home Screen.',
    reminder:'Economic reminder',before:'Release is approaching',calendar:'Open calendar',
    fetchError:'Calendar could not refresh; verify times with the source.',
    waiting:'Loading releases...',source:'Source: ShowMyTrades',dismiss:'Dismiss'
  }
};

const storageRead = (key, fallback) => {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; }
  catch { return fallback; }
};
const storageWrite = (key,value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const readRecent = () => {
  const saved=storageRead(LOG_KEY,[]);
  return (Array.isArray(saved)?saved:[])
    .filter(item=>item && typeof item.key==='string' && typeof item.title==='string'
      && Number.isFinite(item.when) && Date.now()-item.when<86400000)
    .slice(0,8);
};

function notifyInBrowser(title,body,key) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const options={body,tag:'hawal-event-'+key,icon:'/hawali-logo-192.png',data:{url:'/calendar'}};
  const showFallback = () => { try { new Notification(title,options); } catch {} };
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistration) {
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration?.showNotification) return registration.showNotification(title,options);
      showFallback();
    }).catch(showFallback);
  } else showFallback();
}

const timeBaghdad = (value, lang) => new Intl.DateTimeFormat(lang==='ku'?'en-GB':lang==='ar'?'ar-IQ':'en-GB',{
  timeZone:'Asia/Baghdad',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false
}).format(new Date(value));

export default function EconomicEventAlerts({lang='ku',events,visible=true}) {
  const copy = T[lang] || T.ku;
  const external = Array.isArray(events);
  const [settings,setSettings] = useState(()=>normalizeEconomicAlertSettings(storageRead(ECONOMIC_ALERTS_SETTINGS_KEY,{})));
  const [loaded,setLoaded] = useState({events:[],status:'loading'});
  const [now,setNow] = useState(Date.now());
  const [recent,setRecent] = useState(readRecent);
  const [toast,setToast] = useState(null);
  const [permissionText,setPermissionText] = useState('');
  const deliveredRef = useRef(pruneEconomicAlertDelivery(storageRead(ECONOMIC_ALERTS_SENT_KEY,{})));
  const live = external ? events : loaded.events;

  useEffect(()=>{storageWrite(ECONOMIC_ALERTS_SETTINGS_KEY,settings);},[settings]);
  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),30000);
    return ()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    if (external || (!settings.enabled && !visible)) return undefined;
    let mounted=true;
    let controller;
    const load=()=>{
      controller?.abort();
      controller=new AbortController();
      fetchEconomicCalendar(controller.signal).then(result=>{
        if(mounted) setLoaded({events:result.events,status:'ready'});
      }).catch(()=>{if(mounted && !controller.signal.aborted) setLoaded(before=>({...before,status:'error'}));});
    };
    load();
    const refresh=window.setInterval(load,15*60000);
    return ()=>{mounted=false;controller?.abort();window.clearInterval(refresh);};
  },[external,visible,settings.enabled]);

  useEffect(()=>{
    const due=dueEconomicAlerts(live,settings,deliveredRef.current,now);
    if(!due.length) return;
    const sent={...deliveredRef.current};
    for(const notice of due) sent[notice.key]=now;
    deliveredRef.current=pruneEconomicAlertDelivery(sent,now);
    storageWrite(ECONOMIC_ALERTS_SENT_KEY,deliveredRef.current);
    const batch=due.slice(0,5).map(({key,event})=>({key,when:now,title:event.title,time:event.time,currency:event.currency}));
    setRecent(previous=>{
      const merged=[...batch,...previous.filter(item=>!batch.some(next=>next.key===item.key))].slice(0,8);
      storageWrite(LOG_KEY,merged);
      return merged;
    });
    setToast(batch[0]);
    due.slice(0,3).forEach(({key,event})=>notifyInBrowser('HAWAL · '+copy.reminder,
      calendarEventTitle(event.title,lang)+' · '+event.currency+' · '+timeBaghdad(event.time,lang),key));
  },[live,settings,now,lang]);

  useEffect(()=>{
    if(!toast) return undefined;
    const timer=window.setTimeout(()=>setToast(null),12000);
    return ()=>window.clearTimeout(timer);
  },[toast]);

  const upcoming=useMemo(()=>upcomingEconomicEvents(live,settings,now,5),[live,settings,now]);
  const toggleTopic=(topic,checked)=>setSettings(previous=>({
    ...previous,topics:{...previous.topics,[topic]:checked}
  }));
  const askPermission=async()=>{
    if (typeof Notification === 'undefined' || typeof Notification.requestPermission !== 'function') {
      setPermissionText(copy.unsupported);return;
    }
    try {
      const result=await Notification.requestPermission();
      setPermissionText(result==='granted'?copy.granted:copy.denied);
    } catch {setPermissionText(copy.unsupported);}
  };

  return <>
    <section className="ea-panel" id="economic-alerts" aria-labelledby="economic-alerts-title" dir={lang==='en'?'ltr':'rtl'}>
      <div className="ea-heading">
        <div><p className="ea-kicker">{copy.eyebrow}</p><h2 id="economic-alerts-title">🔔 {copy.title}</h2></div>
        <span className={'ea-state'+(settings.enabled?' is-enabled':'')}>{settings.enabled?copy.active:copy.inactive}</span>
      </div>
      <p className="ea-description">{copy.description}</p>
      <div className="ea-settings">
        <fieldset className="ea-topic-options">
          <legend>{copy.choices}</legend>
          {ECONOMIC_ALERTS_TOPICS.map(topic=><label key={topic} className="ea-check">
            <input type="checkbox" checked={settings.topics[topic]}
              onChange={event=>toggleTopic(topic,event.target.checked)}/><span>{copy[topic]}</span>
          </label>)}
        </fieldset>
        <label className="ea-timing">{copy.timing}
          <select value={settings.minutesBefore} onChange={event=>setSettings(prev=>({...prev,minutesBefore:Number(event.target.value)}))}>
            {ECONOMIC_ALERTS_MINUTES.map(minutes=><option key={minutes} value={minutes}>{minutes} {copy.minutes}</option>)}
          </select>
        </label>
      </div>
      <div className="ea-actions">
        <button className="ea-enable" type="button" onClick={()=>setSettings(prev=>({...prev,enabled:!prev.enabled}))}>
          {settings.enabled?copy.deactivate:copy.activate}
        </button>
        <button className="ea-permission" type="button" onClick={askPermission}>{copy.browser}</button>
        <a href={pagePath(lang,'calendar')} className="ea-calendar-link">{copy.calendar} ↗</a>
      </div>
      {permissionText && <p className="ea-notice" role="status">{permissionText}</p>}
      <p className="ea-caveat">{copy.onlyOpen} {copy.permissionTip}</p>
      <div className="ea-columns">
        <div><h3>{copy.upcoming}</h3>
          {!external && loaded.status==='loading' && !live.length && <p className="ea-empty">{copy.waiting}</p>}
          {!external && loaded.status==='error' && <p className="ea-notice" role="status">{copy.fetchError}</p>}
          {upcoming.length ? <ul className="ea-event-list">{upcoming.map(event=><li key={event.id+'-'+event.time}>
            <b dir="auto">{calendarEventTitle(event.title,lang)}</b>
            <small dir="ltr">{event.currency} · {timeBaghdad(event.time,lang)} (UTC+3)</small>
            <strong className="ea-countdown">{formatEconomicCountdown(event.time,now,lang)}</strong>
          </li>)}</ul> : (!(!external && loaded.status==='loading' && !live.length) && <p className="ea-empty">{copy.empty}</p>)}
        </div>
        <div><h3>{copy.recent}</h3>
          {recent.length ? <ul className="ea-log">{recent.map(item=><li key={item.key}>
            <b dir="auto">{calendarEventTitle(item.title,lang)}</b>
            <small dir="ltr">{item.currency} · {timeBaghdad(item.when,lang)} (UTC+3)</small>
          </li>)}</ul> : <p className="ea-empty">{copy.noNotices}</p>}
        </div>
      </div>
      <p className="ea-source">{copy.source}</p>
    </section>
    {toast && typeof document !== 'undefined' && createPortal(
      <div className="ea-toast" role="status" dir={lang==='en'?'ltr':'rtl'}>
        <div><strong>🔔 {copy.before}</strong><p dir="auto">{calendarEventTitle(toast.title,lang)}</p></div>
        <a href={pagePath(lang,'calendar')}>{copy.calendar}</a>
        <button type="button" onClick={()=>setToast(null)} aria-label={copy.dismiss}>×</button>
      </div>,document.body
    )}
  </>;
}
