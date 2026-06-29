export default function SourceStrip({ t, sources }){
  const shown = sources?.length ? sources : [
    {name:'Reuters', url:'https://www.reuters.com/'},{name:'CNBC', url:'https://www.cnbc.com/markets/'},{name:'MSN', url:'https://www.msn.com/en-us/money'},{name:'Shafaq', url:'https://shafaq.com/'},{name:'Rudaw', url:'https://www.rudaw.net/'},{name:'CBI', url:'https://cbi.iq/'}
  ]
  return <section className="source-strip"><div><h2>{t.sources}</h2><p>Tiered official, financial, Iraq, crypto, and public sources</p></div><div className="source-list">{shown.slice(0,26).map(s=><a key={s.name} href={s.url} target="_blank" rel="noreferrer">{s.name}</a>)}</div></section>
}
