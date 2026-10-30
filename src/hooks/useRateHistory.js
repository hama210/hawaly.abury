import { useEffect, useState } from 'react';
import { HISTORY_KEY, normalizeHistory, collectRates } from '../lib/hawal-features.js';
export function useRateHistory(markets) {
  const [history,setHistory]=useState(()=>{
    try { return normalizeHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); } catch { return []; }
  });
  useEffect(()=>{
    const additions=collectRates(markets);
    if (!additions.length) return;
    setHistory(old=>{
      const next=normalizeHistory([...old,...additions]);
      if (JSON.stringify(old)===JSON.stringify(next)) return old;
      try { localStorage.setItem(HISTORY_KEY,JSON.stringify(next)); } catch {}
      return next;
    });
  },[markets]);
  return history;
}
