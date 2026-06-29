import { Filter, RotateCcw } from 'lucide-react'

export default function AdvancedSearch({ t, filters, setFilters, options }){
  const update = (key, value) => setFilters(prev => ({ ...prev, [key]: value }))
  const reset = () => setFilters({ source:'all', asset:'all', date:'all', country:'all' })
  return <section className="advanced-search-panel">
    <div className="advanced-title"><Filter size={18}/><div><b>{t.advancedSearch || 'Advanced search'}</b><span>{t.filterHint || 'Filter by source, asset, country and date'}</span></div></div>
    <div className="advanced-grid">
      <label><span>{t.source}</span><select value={filters.source} onChange={e=>update('source', e.target.value)}><option value="all">{t.all}</option>{options.sources.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      <label><span>{t.affected}</span><select value={filters.asset} onChange={e=>update('asset', e.target.value)}><option value="all">{t.all}</option>{options.assets.map(a=><option key={a} value={a}>{a}</option>)}</select></label>
      <label><span>{t.country || 'Country'}</span><select value={filters.country} onChange={e=>update('country', e.target.value)}><option value="all">{t.all}</option><option value="iraq">{t.iraq}</option><option value="global">Global</option><option value="usa">USA</option><option value="europe">Europe</option><option value="china">China</option></select></label>
      <label><span>{t.date || 'Date'}</span><select value={filters.date} onChange={e=>update('date', e.target.value)}><option value="all">{t.all}</option><option value="today">{t.today}</option><option value="week">7 days</option><option value="month">30 days</option></select></label>
    </div>
    <button className="reset-filters" onClick={reset}><RotateCcw size={15}/>{t.reset || 'Reset'}</button>
  </section>
}
