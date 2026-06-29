const rules = [
  { asset: 'USD', words: ['fed','federal reserve','dollar','rate','interest','fomc','treasury','us economy','cpi','nfp'] },
  { asset: 'Gold', words: ['gold','xau','inflation','safe haven','fed','rates','war','risk'] },
  { asset: 'Oil', words: ['oil','brent','wti','opec','energy','crude','iraq oil','eia'] },
  { asset: 'EUR/USD', words: ['ecb','euro','europe','eurozone','eurusd'] },
  { asset: 'GBP/USD', words: ['boe','pound','uk','britain','gbp'] },
  { asset: 'BTC', words: ['bitcoin','btc','crypto','etf','coinbase','binance'] },
  { asset: 'IQD', words: ['iraq','iqd','central bank of iraq','cbi','dinar','usd/iqd','budget','baghdad','kurdistan'] },
  { asset: 'Stocks', words: ['stocks','nasdaq','s&p','dow','shares','earnings','tesla','nvidia','apple','microsoft'] }
];

const highWords = ['fed','fomc','cpi','nfp','rate decision','interest rate','war','attack','sanction','opec','central bank','recession','inflation','gdp','oil exports','central bank of iraq'];
const mediumWords = ['pmi','retail sales','speech','claims','forecast','budget','trade','earnings','inventory'];
const bearishWords = ['war','attack','falls','drops','weak','slump','sanction','recession','inflation rises','risk off','cuts outlook'];
const bullishWords = ['rises','gains','strong','growth','beats','risk on','eases','recovery','surges'];

export function analyzeArticle(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.source || ''} ${item.category || ''}`.toLowerCase();
  const assets = rules.filter(r => r.words.some(w => text.includes(w))).map(r => r.asset);
  const impact = highWords.some(w => text.includes(w)) ? 'high' : mediumWords.some(w => text.includes(w)) ? 'medium' : 'low';
  const sentiment = bearishWords.some(w => text.includes(w)) ? 'bearish' : bullishWords.some(w => text.includes(w)) ? 'bullish' : 'neutral';
  const iraqImpact = ['iraq','baghdad','kurdistan','cbi','dinar','iqd','oil exports','ministry of oil','rudaw','shafaq'].some(w => text.includes(w));
  const why = getWhy(impact, assets, iraqImpact);
  return { impact, sentiment, assets: assets.length ? [...new Set(assets)] : ['Markets'], iraqImpact, why };
}

function getWhy(impact, assets, iraq) {
  if (iraq) return 'This story may affect Iraq through oil revenue, banking policy, USD/IQD expectations, government spending, or regional risk.';
  if (impact === 'high') return 'This is a market-moving story because it can shift expectations around rates, inflation, oil, currencies, or geopolitical risk.';
  if (assets.includes('Gold')) return 'Gold can react when investors reassess inflation, interest rates, or safe-haven demand.';
  if (assets.includes('Oil')) return 'Oil-sensitive news can affect inflation, energy companies, and economies that depend on crude exports.';
  return 'This story adds context to current market sentiment and may matter if similar headlines continue.';
}

export function localizeSummary(item, lang) {
  const title = item.title || 'Market news update';
  if (lang === 'ku') return `پوختە: ئەم هەواڵە پەیوەندی بە بازاڕ و ئابوورییەوە هەیە. سەرچاوە: ${item.source || 'سەرچاوە'}.`;
  if (lang === 'ar') return `ملخص: هذا الخبر مرتبط بالأسواق والاقتصاد وقد يؤثر على توقعات المستثمرين. المصدر: ${item.source || 'مصدر'}.`;
  return item.summary || `Summary: ${title}`;
}
