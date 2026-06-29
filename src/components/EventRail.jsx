import { CalendarClock, Radio, Star, Zap } from 'lucide-react'

const events = [
  ['FOMC / Fed Speakers','USD, Gold, Stocks','high'],
  ['US CPI / PCE Inflation','USD, EUR/USD, Gold','high'],
  ['OPEC / Oil Inventory','Oil, Iraq, Energy','medium'],
  ['CBI / Iraq Banking','IQD, Iraq Banks','medium'],
  ['China PMI / Growth','Oil, AUD, Stocks','medium'],
]

export default function EventRail({ lang='ku' }){
  const title = lang==='ku' ? 'ڕووداوە کاریگەرەکانی ئەمڕۆ' : lang==='ar' ? 'الأحداث المؤثرة اليوم' : 'High Impact Watchlist'
  const desc = lang==='ku' ? 'ئەو بابەتانەی زۆرجار کاریگەرییان لەسەر نرخ و بازاڕ هەیە' : lang==='ar' ? 'مواضيع قد تحرك الأسعار والأسواق' : 'Events that often move markets and prices'
  return <section className="event-rail">
    <div className="event-head"><CalendarClock size={21}/><div><h2>{title}</h2><p>{desc}</p></div></div>
    <div className="event-list">
      {events.map(([name, assets, impact],i)=><article key={name} className={impact==='high'?'event-card high':'event-card'}>
        <span>{impact==='high'?<Zap size={16}/>:<Radio size={16}/>} {impact==='high'?'Critical':'Watch'}</span>
        <b>{name}</b><small>{assets}</small>
        <div className="event-meter"><i style={{width: impact==='high'?'92%':'66%'}}/></div>
      </article>)}
    </div>
  </section>
}
