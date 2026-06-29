export default function Skeleton(){ return <div className="skeleton-grid">{Array.from({length:6}).map((_,i)=><div className="skeleton-card" key={i}><span/><b/><p/><p/></div>)}</div> }
