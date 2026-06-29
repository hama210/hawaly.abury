export default function FilterBar({ t, category, setCategory, impact, setImpact }){
  const categories = ['all','iraq','forex','calendar','oil','stocks','crypto','banks']
  return <section className="filter-bar"><div>{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{t[c] || c}</button>)}</div><div><button className={impact==='all'?'active':''} onClick={()=>setImpact('all')}>{t.all}</button><button className={impact==='high'?'active danger':''} onClick={()=>setImpact('high')}>High</button><button className={impact==='medium'?'active warn':''} onClick={()=>setImpact('medium')}>Medium</button><button className={impact==='low'?'active good':''} onClick={()=>setImpact('low')}>Low</button></div></section>
}
