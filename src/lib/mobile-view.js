export const MOBILE_VIEWS = ['home', 'markets', 'news', 'more'];

export function viewFromHash(hash = '') {
  const value = String(hash ?? '').replace(/^#/, '').toLowerCase();
  return MOBILE_VIEWS.includes(value) ? value : 'home';
}
