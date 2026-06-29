import { impactClass } from '../utils/news.js'
export default function ImpactBadge({ impact }){ return <span className={`impact-badge ${impactClass(impact)}`}>● {impact || 'Low'}</span> }
