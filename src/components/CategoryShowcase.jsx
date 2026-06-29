import { Banknote, Bitcoin, Building2, Flame, Landmark, LineChart, RadioTower, ShieldAlert } from 'lucide-react'

const cats = [
  ['iraq','Iraq Intelligence','هەواڵی عێراق','أخبار العراق', Landmark],
  ['forex','Forex','فۆرێکس','الفوركس', Banknote],
  ['oil','Oil & Energy','نەوت و وزە','النفط والطاقة', Flame],
  ['stocks','Stocks','پشکەکان','الأسهم', LineChart],
  ['crypto','Crypto','کریپتۆ','العملات الرقمية', Bitcoin],
  ['banks','Central Banks','بانکە ناوەندییەکان','البنوك المركزية', Building2],
  ['war','Geopolitics','جیوپۆلیتیک','الجيوسياسة', ShieldAlert],
  ['breaking','Breaking','فوری','عاجل', RadioTower],
]

export default function CategoryShowcase({ lang='ku', setCategory }){
  return <section className="category-showcase">
    {cats.map(([key,en,ku,ar,Icon]) => <button key={key} onClick={()=>setCategory(key==='breaking'?'all':key)}>
      <Icon size={21}/><b>{lang==='ku'?ku:lang==='ar'?ar:en}</b><span>{key.toUpperCase()}</span>
    </button>)}
  </section>
}
