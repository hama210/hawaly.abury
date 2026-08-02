export function articleText(item = {}) {
  return `${item.title || ''} ${item.titleEn || ''} ${item.titleKu || ''} ${item.titleAr || ''} ${item.summary || ''} ${item.summaryEn || ''} ${item.summaryKu || ''} ${item.summaryAr || ''} ${item.content || ''} ${item.source || ''} ${item.sourceGroup || ''} ${item.category || ''}`.toLowerCase();
}

function assetsFor(item = {}) {
  return new Set([
    ...(item.intelligence?.assets || []),
    ...(item.affected || []),
    ...(item.intelligence?.effects || []).map(effect => effect?.asset),
  ].filter(Boolean).map(asset => String(asset).toUpperCase()));
}

const WAR_TERMS = /\b(war|conflict|attack|attacks|airstrike|airstrikes|strike|strikes|missile|missiles|drone|drones|fighting|clash|clashes|invasion|ceasefire|truce|blockade|bombing|bombardment|shelling|military|centcom|irgc)\b|red sea|strait of hormuz|هێرش|شەڕ|پێکدادان|مووشەک|فڕۆکەی بێفڕۆکەوان|ئاگربەست|هجوم|حرب|اشتباك|صاروخ|مسيّرة|وقف إطلاق النار/i;

export function matchesCategory(item, category) {
  if (category === 'all') return true;
  const itemCategory = String(item?.category || '').toLowerCase();
  const assets = assetsFor(item);
  if (category === 'iraq') return itemCategory === 'iraq' || Boolean(item?.intelligence?.iraqImpact || item?.iraqImpact) || assets.has('USD/IQD');
  if (category === 'forex') return itemCategory === 'forex' || assets.has('EUR/USD') || assets.has('GBP/USD');
  if (category === 'metals') return itemCategory === 'metals' || assets.has('XAU/USD') || assets.has('XAG/USD');
  if (category === 'indices') return itemCategory === 'indices' || assets.has('NASDAQ') || assets.has('DOW JONES');
  if (category === 'geopolitics') return itemCategory === 'geopolitics' || Boolean(item?.conflictRegion) || WAR_TERMS.test(articleText(item));
  return false;
}
