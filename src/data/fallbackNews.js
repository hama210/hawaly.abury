const now = Date.now()
export const fallbackNews = [
  {
    id:'fallback-fed', source:'Federal Reserve Watch', tier:'Official', category:'banks', impact:'High', sentiment:'Neutral',
    titleEn:'Markets watch Federal Reserve comments on interest rates',
    summaryEn:'Central-bank messaging may directly affect USD, gold, and major currency pairs.',
    whyEn:'Because FX markets react strongly to rate expectations.',
    publishedAt:new Date(now-18*60000).toISOString(), link:'https://www.federalreserve.gov/newsevents.htm', image:'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80', affected:['USD','Gold','EUR/USD','US Stocks']
  },
  {
    id:'fallback-iraq-oil', source:'Iraq Economy Monitor', tier:'Iraq', category:'iraq', impact:'High', sentiment:'Bullish',
    titleEn:'Oil and budget headlines may affect Iraq economy',
    summaryEn:'Because Iraq depends heavily on oil revenue, export or price changes matter.',
    whyEn:'Oil is a major source of public revenue in Iraq and affects budgets and currency expectations.',
    publishedAt:new Date(now-45*60000).toISOString(), link:'https://oil.gov.iq/', image:'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=1400&q=80', affected:['Oil','IQD','Iraq Budget']
  },
  {
    id:'fallback-geopolitics', source:'Global Risk Desk', tier:'Major Media', category:'geopolitics', impact:'Medium', sentiment:'Bearish',
    titleEn:'Geopolitical risks raise market caution',
    summaryEn:'War, sanctions and instability can move gold, oil, and the dollar.',
    whyEn:'In risk-off periods, investors often move into safer assets.',
    publishedAt:new Date(now-70*60000).toISOString(), link:'https://www.reuters.com/world/', image:'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80', affected:['Gold','Oil','USD']
  }
]
