export async function fetchMarkets() {
  try {
    const res = await fetch('/api/markets?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Market API failed');
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    return [
      { symbol: 'XAU/USD', name: 'Gold', price: '—', changePct: 0, status: 'watch' },
      { symbol: 'WTI', name: 'Oil', price: '—', changePct: 0, status: 'watch' },
      { symbol: 'BTC/USD', name: 'Bitcoin', price: '—', changePct: 0, status: 'watch' },
      { symbol: 'EUR/USD', name: 'Euro Dollar', price: '—', changePct: 0, status: 'watch' },
      { symbol: 'USD/IQD', name: 'Iraqi Dinar', price: '—', changePct: 0, status: 'watch' }
    ];
  }
}
