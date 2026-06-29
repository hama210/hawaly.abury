import { Activity, BarChart3, Brain, ShieldAlert, Zap } from 'lucide-react'
export default function IntelligencePanel({ t, highCount, updatedAt }){
  const blocks = [
    [t.risk, 'Risk Watch', 'neutral', Activity],
    [t.dollar, 'Mixed', 'warning', BarChart3],
    [t.gold, 'Volatile', 'good', Zap],
    [t.iraqImpact, 'Oil / IQD', 'warning', ShieldAlert],
  ]
  return <section className="intelligence-panel">
    <div className="panel-heading"><Brain size={20}/><div><h2>{t.intelligence}</h2><p>{t.premium}</p></div></div>
    <div className="intel-grid">{blocks.map(([label,value,state,Icon])=><div key={label} className="intel-card"><Icon size={18}/><span>{label}</span><b className={state}>{value}</b></div>)}</div>
    <div className="pulse-row"><span>● {t.live}</span><span>{t.high}: {highCount}</span><span>{t.updated}: {updatedAt || '—'}</span></div>
  </section>
}
