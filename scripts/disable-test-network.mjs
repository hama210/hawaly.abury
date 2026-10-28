// Unit tests must install their own fetch mock. An omitted mock must never
// contact a real news/market provider or spend inference quota.
globalThis.fetch = async () => { throw new Error('Network disabled in unit tests: install a fetch mock'); };
