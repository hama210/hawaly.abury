import { Activity, CircleDollarSign, Droplets, Flame, Gauge, TrendingUp, Bitcoin, ShieldAlert } from 'lucide-react'

const pulse = [
  { key:'risk', label:'Risk Mood', ku:'هەستی ڕیسک', ar:'مزاج المخاطر', value:'Cautious', kuValue:'ئاگادار', arValue:'حذر', state:'warn', icon:Gauge },
  { key:'usd', label:'US Dollar', ku:'دۆلاری ئەمریکی', ar:'الدولار', value:'Mixed', kuValue:'تێکەڵ', arValue:'مختلط', state:'neutral', icon:CircleDollarSign },
  { key:'gold', label:'Gold', ku:'زێڕ', ar:'الذهب', value:'Volatile', kuValue:'ناجێگیر', arValue:'متقلب', state:'hot', icon:Flame },
  { key:'oil', label:'Oil', ku:'نەوت', ar:'النفط', value:'Sensitive', kuValue:'هەستیار', arValue:'حساس', state:'warn', icon:Droplets },
  { key:'crypto', label:'Crypto', ku:'کریپتۆ', ar:'العملات الرقمية', value:'Active', kuValue:'چالاک', arValue:'نشط', state:'good', icon:Bitcoin },
  { key:'geo', label:'Geopolitics', ku:'جیوپۆلیتیک', ar:'الجيوسياسة', value:'Elevated', kuValue:'بەرز', arValue:'مرتفع', state:'hot', icon:ShieldAlert },
]

function text(item, lang, type='label'){
  if(type==='value') return lang==='ku' ? item.kuValue : lang==='ar' ? item.arValue : item.value
  return lang==='ku' ? item.ku : lang==='ar' ? item.ar : item.label
}

export default function MarketPulse({ lang='ku' }){
  const title = lang==='ku' ? 'ناوەندی زیرەکی بازاڕ' : lang==='ar' ? 'مركز ذكاء السوق' : 'Market Intelligence Center'
  const sub = lang==='ku' ? 'خوێندنەوەی خێرای ڕیسک، دۆلار، زێڕ، نەوت و جیوپۆلیتیک' : lang==='ar' ? 'قراءة سريعة للمخاطر والدولار والذهب والنفط والجيوسياسة' : 'Fast read on risk, USD, gold, oil and geopolitical pressure'
  return <section className="market-pulse">
    <div className="pulse-hero">
      <div className="orb"><Activity size={26}/></div>
      <div><h2>{title}</h2><p>{sub}</p></div>
      <span className="live-pill"><i/>LIVE</span>
    </div>
    <div className="pulse-cards">
      {pulse.map(item => { const Icon = item.icon; return <article className={`pulse-card ${item.state}`} key={item.key}>
        <Icon size={21}/><span>{text(item, lang)}</span><b>{text(item, lang, 'value')}</b><small>{item.state==='hot'?'High attention':item.state==='good'?'Positive flow':'Monitor'}</small>
      </article> })}
    </div>
  </section>
}
