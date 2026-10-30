import { mergeCityRates, positive } from '../lib/market-tools.js';
const STORAGE = 'hawall-last-markets-v1';
let lastKnown = [];
function initialRates() {
  try { const value=JSON.parse(localStorage.getItem(STORAGE) || '[]'); if(Array.isArray(value)) return value; } catch {}
  try { return JSON.parse(document.getElementById('hawall-bootstrap')?.textContent || '{}').markets || []; } catch { return []; }
}
export async function fetchMarkets() {
  if (!lastKnown.length) lastKnown=initialRates();
  try {
    const res = await fetch('/api/markets', {cache:'no-store', signal:AbortSignal.timeout(20000)});
    if (!res.ok) throw new Error('Market API failed');
    const data = await res.json();
    if (!Array.isArray(data.items) || !data.items.length) throw new Error('Invalid market response');
    lastKnown = data.items.map(item => {
      const previous = lastKnown.find(q=>q.symbol===item.symbol);
      const age=Date.now()-Date.parse(previous?.updatedAt || previous?.fetchedAt || '');
      const retained=previous && age>=-300000 && age<7*86400000 ? previous : null;
      const next = !positive(item.price) && positive(retained?.price)
        ? {...retained,dataStatus:'stale',checkedAt:data.checkedAt || item.checkedAt} : item;
      return {...(item.marketKind==='local' ? mergeCityRates(next,retained) : next), retrievalError:false};
    });
    try { localStorage.setItem(STORAGE,JSON.stringify(lastKnown)); } catch {}
    return lastKnown;
  } catch {
    const now=Date.now();
    const saved=lastKnown.filter(q=>{const age=now-Date.parse(q.updatedAt || q.fetchedAt || '');return age>=-300000 && age<7*86400000;});
    return (saved.length ? saved : [{symbol:'USD/IQD',price:null,marketKind:'local'},{symbol:'CBI USD/IQD',price:null,marketKind:'official'}])
      .map(item=>{
        const next={...item,retrievalError:true,dataStatus:positive(item.price)?'stale':'unavailable'};
        if(next.marketKind==='local') for(const city of ['erbil','sulaymaniyah','baghdad']){
          const age=now-Date.parse(next[city]?.updatedAt || next.updatedAt || '');
          if(!Number.isFinite(age) || age>7*86400000) next[city]=null;
        }
        return next;
      });
  }
}
