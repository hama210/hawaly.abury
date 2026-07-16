const rules = [
  { asset:'USD/IQD', words:['iraq','iqd','central bank of iraq','cbi','dinar','usd/iqd','budget','baghdad','kurdistan','oil revenue'] },
  { asset:'EUR/USD', words:['eur/usd','ecb','euro','europe','eurozone','european central bank'] },
  { asset:'GBP/USD', words:['gbp/usd','boe','sterling','pound','bank of england','uk economy','british economy'] },
  { asset:'XAU/USD', words:['gold','xau','bullion','safe haven'] },
  { asset:'XAG/USD', words:['silver','xag','precious metals'] },
  { asset:'DOW JONES', words:['dow','dow jones','djia','industrial average','wall street'] },
  { asset:'NASDAQ', words:['nasdaq','technology stocks','tech stocks','wall street'] }
];

const highWords = ['fed','fomc','cpi','nfp','rate decision','interest rate','war','attack','strike','strikes','blockade','strait of hormuz','sanction','opec','central bank','recession','inflation','gdp','oil exports','central bank of iraq'];
const mediumWords = ['pmi','retail sales','speech','claims','forecast','budget','trade','earnings','inventory'];
const bearishWords = ['war','attack','strike','strikes','blockade','falls','drops','declines','losses','lower','slides','weak','slump','sanction','recession','inflation rises','risk off','cuts outlook'];
const bullishWords = ['rises','gains','strong','growth','beats','risk on','recovery','surges','ceasefire','truce'];
const warTerms = /\b(war|conflict|attack|airstrike|strike|strikes|missile|drone|invasion|ceasefire|truce|blockade|military|sanction|sanctions|houthi|nato|centcom|irgc)\b|strait of hormuz|red sea/i;

function marketEffects(text, sentiment, iraqImpact){
  const effects = [];
  const add = (asset, direction, reason) => {
    if(!effects.some(effect => effect.asset === asset)) effects.push({ asset, direction, reason });
  };
  const relief = /ceasefire|truce|peace deal|de-escalation|deescalation/i.test(text);
  const conflict = warTerms.test(text);
  const regional = /iraq|iran|middle east|gulf|hormuz|red sea|houthi|israel|gaza|lebanon|syria/i.test(text);
  const hawkish = /rate hike|higher for longer|hawkish|hot inflation|inflation rises|strong jobs|strong payroll/i.test(text);
  const dovish = /rate cut|dovish|cooling inflation|inflation falls|weak jobs|weak payroll|economic slowdown/i.test(text);
  const positive = /rises?|gains?|strong|beats|surges?|record high|optimism|rally|climbs?|advances?|higher/i.test(text);
  const negative = /falls?|drops?|weak|slump|selloff|recession|cuts outlook|warning|loss|losses|lower|declines?|eases?|slides?/i.test(text);
  const localDollarUp = /(?:dollar|usd)[^.!?]{0,70}(?:rises?|gains?|higher|climbs?|surges?|edges? up)|(?:rises?|gains?|climbs?|surges?|edges? up)[^.!?]{0,70}(?:dollar|usd)/i.test(text);
  const localDollarDown = /(?:dollar|usd)[^.!?]{0,70}(?:falls?|drops?|lower|declines?|eases?|slides?|edges? lower)|(?:falls?|drops?|declines?|eases?|slides?|edges? lower)[^.!?]{0,70}(?:dollar|usd)/i.test(text);

  if(iraqImpact && (localDollarUp || localDollarDown)) add('USD/IQD', localDollarUp ? 'up' : 'down', 'iraqPolicy');
  if(conflict){
    add('XAU/USD', relief ? 'down' : 'up', relief ? 'deescalation' : 'safeHaven');
    add('XAG/USD', relief ? 'down' : 'up', relief ? 'deescalation' : 'safeHaven');
    add('NASDAQ', relief ? 'up' : 'down', relief ? 'deescalation' : 'riskOff');
    add('DOW JONES', relief ? 'up' : 'down', relief ? 'deescalation' : 'riskOff');
    if(regional || iraqImpact) add('USD/IQD', relief ? 'down' : 'up', relief ? 'deescalation' : 'regionalRisk');
  }
  if(hawkish || dovish){
    const dollarUp = hawkish && !dovish;
    add('EUR/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('GBP/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('XAU/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('XAG/USD', dollarUp ? 'down' : 'up', 'usRates');
    add('NASDAQ', dollarUp ? 'down' : 'up', 'usRates');
  }
  if(/eur\/usd|euro|ecb|eurozone|european central bank/i.test(text)) add('EUR/USD', positive ? 'up' : negative ? 'down' : 'watch', 'euroPolicy');
  if(/gbp\/usd|sterling|pound|bank of england|\bboe\b|uk economy|british economy/i.test(text)) add('GBP/USD', positive ? 'up' : negative ? 'down' : 'watch', 'ukPolicy');
  if(/gold|xau|bullion/i.test(text)) add('XAU/USD', positive ? 'up' : negative ? 'down' : 'watch', 'preciousMetals');
  if(/silver|xag|precious metals/i.test(text)) add('XAG/USD', positive ? 'up' : negative ? 'down' : 'watch', 'preciousMetals');
  if(/nasdaq|technology stocks|tech stocks/i.test(text)) add('NASDAQ', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'indexNews');
  if(/dow|dow jones|djia|industrial average/i.test(text)) add('DOW JONES', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'indexNews');
  if(iraqImpact) add('USD/IQD', localDollarUp ? 'up' : localDollarDown ? 'down' : positive ? 'down' : negative ? 'up' : 'watch', 'iraqPolicy');
  if(!effects.length){
    add('NASDAQ', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'marketNews');
    add('DOW JONES', sentiment === 'bullish' ? 'up' : sentiment === 'bearish' ? 'down' : 'watch', 'marketNews');
  }
  return effects.slice(0, 6);
}

export function analyzeArticle(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.content || ''} ${item.source || ''} ${item.category || ''}`.toLowerCase();
  const impact = highWords.some(word => text.includes(word)) ? 'high' : mediumWords.some(word => text.includes(word)) ? 'medium' : 'low';
  const sentiment = bearishWords.some(word => text.includes(word)) ? 'bearish' : bullishWords.some(word => text.includes(word)) ? 'bullish' : 'neutral';
  const iraqImpact = ['iraq','baghdad','kurdistan','cbi','dinar','iqd','oil exports','ministry of oil','rudaw','shafaq'].some(word => text.includes(word));
  const effects = marketEffects(text, sentiment, iraqImpact);
  const assets = [...new Set([...rules.filter(rule => rule.words.some(word => text.includes(word))).map(rule => rule.asset), ...effects.map(effect => effect.asset)])];
  const why = getWhy(impact, assets, iraqImpact);
  return { impact, sentiment, assets: assets.length ? assets : ['NASDAQ', 'DOW JONES'], effects, iraqImpact, why };
}

function getWhy(impact, assets, iraq) {
  if (iraq) return 'This story may affect the local USD/IQD market through dollar demand, banking policy, public finance, oil revenue, or regional risk.';
  if (impact === 'high') return 'This can change risk appetite, interest-rate expectations, currency demand, precious metals, and US equity indices.';
  if (assets.includes('XAU/USD') || assets.includes('XAG/USD')) return 'Gold and silver can react to the dollar, interest rates, inflation expectations, and safe-haven demand.';
  return 'This story adds focused context for USD/IQD, EUR/USD, GBP/USD, precious metals, Dow Jones, or Nasdaq.';
}

export function localizeSummary(item, lang) {
  const title = item.title || 'Market news update';
  if (lang === 'ku') return `پوختە: ئەم هەواڵە کاریگەرییەکانی لەسەر دراو، کانزا و بازاڕی پشکەکان چاودێری دەکات. سەرچاوە: ${item.source || 'سەرچاوە'}.`;
  if (lang === 'ar') return `ملخص: يتابع هذا الخبر تأثيره في العملات والمعادن ومؤشرات الأسهم. المصدر: ${item.source || 'مصدر'}.`;
  return item.summary || `Summary: ${title}`;
}
