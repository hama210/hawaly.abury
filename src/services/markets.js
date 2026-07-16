export async function fetchMarkets() {
  try {
    const res = await fetch('/api/markets');
    if (!res.ok) throw new Error('Market API failed');
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    return [
      { symbol: 'USD/IQD', name: 'Iraq local market · 100 USD', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable', marketKind: 'local', quoteAmount: 100 },
      { symbol: 'XAU/USD', name: 'Gold', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable' },
      { symbol: 'XAG/USD', name: 'Silver', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable' },
      { symbol: 'EUR/USD', name: 'Euro Dollar', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable' },
      { symbol: 'GBP/USD', name: 'Pound Dollar', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable' },
      { symbol: 'DOW JONES', name: 'Dow Jones', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable' },
      { symbol: 'NASDAQ', name: 'Nasdaq', price: null, changePct: null, status: 'watch', dataStatus: 'unavailable', source: 'Unavailable' }
    ];
  }
}
