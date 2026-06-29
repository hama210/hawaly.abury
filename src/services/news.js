import { analyzeArticle } from '../utils/intelligence.js';

const fallback = [
  { title: 'Federal Reserve signals cautious approach on interest rates', source: 'Reuters', category: 'Central Banks', link: 'https://www.reuters.com/markets/', image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80', publishedAt: new Date().toISOString() },
  { title: 'Oil prices watch Middle East risk and OPEC supply signals', source: 'OilPrice', category: 'Oil', link: 'https://oilprice.com/', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1200&q=80', publishedAt: new Date(Date.now()-900000).toISOString() },
  { title: 'Iraq economy focus turns to budget, banking and oil revenue', source: 'Iraq Business News', category: 'Iraq', link: 'https://www.iraq-businessnews.com/', image: 'https://images.unsplash.com/photo-1569163139599-0f4517e36f51?auto=format&fit=crop&w=1200&q=80', publishedAt: new Date(Date.now()-1800000).toISOString() },
  { title: 'Bitcoin traders monitor risk sentiment and ETF flows', source: 'CoinDesk', category: 'Crypto', link: 'https://www.coindesk.com/', image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&w=1200&q=80', publishedAt: new Date(Date.now()-3000000).toISOString() }
];

export async function fetchNews() {
  try {
    const res = await fetch('/api/news?phase=4&ts=' + Date.now());
    if (!res.ok) throw new Error('news api failed');
    const data = await res.json();
    const items = data.items?.length ? data.items : fallback;
    return items.map((item, index) => ({ id: item.id || `${index}-${item.title}`, ...item, intelligence: item.intelligence || analyzeArticle(item) }));
  } catch {
    return fallback.map((item, index) => ({ id: `fallback-${index}`, ...item, intelligence: analyzeArticle(item) }));
  }
}
