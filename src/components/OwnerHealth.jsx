import React,{useEffect,useState} from 'react';
import './OwnerHealth.css';

const names={news:'سەرچاوەکانی هەواڵ',markets:'نرخی دراو و کانزاکان',
  calendar:'کاڵەندەری ئابووری',metalsHistory:'مێژووی زێڕ و زیو'};
const states={healthy:'باشە',stale:'داتای کۆن / پشکنینی ناتەواو',quiet:'بێ هەواڵی نوێ',failed:'کێشە / بەردەست نییە'};
const dateLabel=value=>{
  if(!value)return '—';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Baghdad',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false
  }).format(date)+' (بەغدا)':'—';
};
const cleanNumber=n=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('en-US'):'—';
const Status=({value})=><span className={'oh-state oh-'+(value||'stale')}>{states[value]||states.stale}</span>;

function Row({name,status,notes=[],url}){
  return <li className="oh-row">
    <div><strong dir="auto">{name}</strong>{notes.filter(Boolean).map((note,i)=><small key={i} dir="auto">{note}</small>)}</div>
    <Status value={status}/>{url&&/^https:\/\//.test(url)&&<a href={url} target="_blank" rel="noopener noreferrer">سەرچاوە ↗</a>}
  </li>;
}
export default function OwnerHealth(){
  const [report,setReport]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const run=()=>{
      setLoading(true);
      fetch('/owner-health/api',{credentials:'same-origin',cache:'no-store',signal:controller.signal,
        headers:{Accept:'application/json'}})
        .then(async response=>{
          if(!response.ok)throw new Error(response.status===403?'مۆڵەتی چوونەژوورەوە بۆ خاوەنەکە پشتڕاست نەکراوەتەوە.':'کێشە لە نوێکردنەوەی پشکنین.');
          return response.json();
        }).then(payload=>{
          if(controller.signal.aborted)return;
          setReport(payload);setError('');setLoading(false);
        }).catch(cause=>{
          if(controller.signal.aborted)return;
          setError(cause.message);setLoading(false);
        });
    };
    run();
    const timer=window.setInterval(run,15*60*1000);
    return ()=>{controller.abort();window.clearInterval(timer);};
  },[revision]);
  const sections=report?.sections||{};
  const news=sections.news,market=sections.markets,calendar=sections.calendar,history=sections.metalsHistory;
  return <main className="oh-page" dir="rtl">
    <header className="oh-header">
      <div><p>HAWAL · PRIVATE OWNER MONITOR</p><h1>چاودێری تایبەتی سەرچاوەکان</h1>
        <span>تەنها بۆ خاوەنی پشتڕاستکراوە؛ بۆ Admin و سەردانکەر داخراوە.</span></div>
      <button type="button" disabled={loading} onClick={()=>setRevision(r=>r+1)}>{loading?'پشکنین...':'دووبارە پشکنین ↻'}</button>
    </header>
    <div className="oh-headline">
      <div><span>دۆخی گشتی</span>{report?<Status value={report.status}/>:<span>چاوەڕوانی پشکنین</span>}</div>
      <div><span>دوایین پشکنین</span><strong>{dateLabel(report?.checkedAt)}</strong></div>
      <div><span>جارێکی دیکە</span><strong>هەر ١٥ خولەک — تەنها کاتێک پەڕەکە کراوەیە</strong></div>
    </div>
    {error&&<div className="oh-error" role="alert">{error}</div>}
    {!report&&loading&&<p className="oh-loading" role="status">سەرچاوەکان دەخرێنە ژێر پشکنین...</p>}
    {report&&<div className="oh-grid">
      <section className="oh-panel"><h2>{names.news} <Status value={news?.status}/></h2>
        <p>پشکنراوە: {cleanNumber(news?.sourceCount)} / {cleanNumber(news?.expectedSourceCount)} سەرچاوە · {cleanNumber(news?.articles)} هەواڵ</p>
        <p>دوایین هەواڵی دۆزراوە: {dateLabel(news?.latest)}</p>
        {news?.partial&&<p className="oh-caution">پشکنینی هەموو سەرچاوەکان تەواو نەبووە؛ ئەمە وەک کێشەی کاتی داتاکە نیشان دەدرێت.</p>}
        <ul>{news?.sources?.map((s,i)=><Row key={s.name+'-'+i} name={s.name} status={s.status}
          notes={[s.articles+' هەواڵ',s.reason]}/>)}</ul>
      </section>
      <section className="oh-panel"><h2>{names.markets} <Status value={market?.status}/></h2>
        {market?.error&&<p className="oh-caution">{market.error}</p>}
        <ul>{market?.sources?.map(s=><Row key={s.name} name={s.name} status={s.status}
          notes={['کاتی نرخ: '+dateLabel(s.updatedAt),s.source]} url={s.url}/>)}</ul>
      </section>
      <section className="oh-panel"><h2>{names.calendar} <Status value={calendar?.status}/></h2>
        <p>{cleanNumber(calendar?.count)} ڕووداو · دوایین نوێکردنەوە: {dateLabel(calendar?.updatedAt)}</p>
        {(calendar?.error||calendar?.note)&&<p className="oh-caution">{calendar.error||calendar.note}</p>}
      </section>
      <section className="oh-panel"><h2>{names.metalsHistory} <Status value={history?.status}/></h2>
        {history?.error&&<p className="oh-caution">{history.error}</p>}
        <ul>{history?.sources?.map(s=><Row key={s.name} name={s.name} status={s.status}
          notes={[cleanNumber(s.points)+' خاڵ',dateLabel(s.updatedAt)]}/>)}</ul>
      </section>
    </div>}
    <footer className="oh-footer">
      <p>پشکنینەکان داتای ڕاستەقینەی API بەکاردەهێنن؛ دۆخی Quiet واتە سەرچاوەکە لەوانەیە تەنها هەواڵی تازەی نەبێت.</p>
      <p>ئەم وەشانە تەنها کاتێک پەڕەکەت کراوەیە هەر ١٥ خولەک پشکنین دەکات. بۆ پشکنینی پاشبنەمایی و هەڵگرتنی مێژوو پێویستە خزمەتگوزاریی پلاندانراوی Cloudflare جیاواز ڕێکبخرێت.</p>
    </footer>
  </main>;
}
