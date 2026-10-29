// Opt-in live inference smoke test. Never part of npm test / CI.
// Usage: node scripts/check-translation-preview.mjs https://PREVIEW.pages.dev
import { createNewsTranslator } from '../src/lib/news-translation.js';
import { TRANSLATION_VERSION, translationChunks } from '../src/lib/translation-format.js';

const origin = new URL(process.argv[2] || 'https://invalid.example');
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.pages.dev')) {
  throw new Error('Pass the explicit HTTPS Cloudflare preview URL');
}
const liveFetch = (path, options) => fetch(new URL(path, origin), options);
const status = await (await liveFetch('/api/translation-status')).json();
if (status.version !== TRANSLATION_VERSION) throw new Error(`Preview version ${status.version}; expected ${TRANSLATION_VERSION}`);
const reader = [
  'The US dollar closed Wednesday trading steady in Baghdad but edged higher in Erbil, hovering around 168,000 dinars per 100 dollars. Traders said the morning session was quiet and the afternoon session ended without a major change in demand.',
  'According to a market survey, the dollar traded at 167,800 dinars per 100 dollars, unchanged from the morning session. Exchange shops sold the dollar at 168,250 dinars and bought it at 167,250 dinars. In Erbil, selling prices stood at 167,700 dinars and buying prices at 167,600 dinars.',
  'Gold rose from $2,650.50 to $2,703.51, while oil fell 1.5%. The central bank did not change interest rates. Analysts said the figures described the market at the time of the survey and should not be treated as a promise about future prices.',
  'Saudi Arabia supplied 36.708 million barrels. Kuwait supplied 12.5 million barrels, and Oman supplied 8.25 million barrels. The report compared the monthly totals and said that the figures would be reviewed when the next official statement was published.',
  'Iraq paid $5 million on 28 October 2026. The agreement does not include Iran. USD/IQD remained at 151,000. Officials said the payment covered the existing agreement and did not announce a new contract or a change to the published exchange rate.',
  'Turkish exports increased in September. Iraq was the fourth-largest market. The report described trade in goods and did not include services. Businesses said that transport costs and delivery times remained important considerations for buyers and sellers.',
  'The bank said its next report would explain the difference between buying and selling prices. It asked readers to check the date and source of each quote. The statement did not promise lower interest rates or a guaranteed return on any investment.',
].join('\n\n');
if (translationChunks(reader).length < 2) throw new Error('Reader fixture must exercise multiple chunks');
const samples = [
  ['headline', 'Microsoft stock jumps 4% as cloud growth drives earnings and revenue beat'],
  ['month', 'Turkish exports: Iraq fourth-largest market in September'],
  ['summary', 'Gold rose from $2,650.50 to $2,703.51, while oil fell 1.5%. The central bank did not change interest rates.'],
  ['reader', reader],
];
let failures = 0;
for (const language of ['ku', 'ar']) {
  const client = createNewsTranslator({ storage: () => null, fetcher: liveFetch });
  for (const [field, source] of samples) {
    const result = await client.translate(source, language, { retry: false });
    console.log(JSON.stringify({ verification: 'live-preview; cache allowed; human semantic review required', version: status.version, language, field, chunks: translationChunks(source).length, ...result }));
    if (result.state !== 'translated') failures++;
    if (result.error === 'daily-limit') process.exit(1);
  }
}

// Controlled client failure, followed by the REAL preview response. This is
// deliberately labelled; it is not evidence of a real provider outage.
let calls = 0;
const retryClient = createNewsTranslator({ storage: () => null, retryDelay: 0, serviceCooldown: 1, fetcher: async (path, options) => {
  calls++;
  if (calls === 1) {
    const { language, texts } = JSON.parse(options.body);
    return Response.json({version:TRANSLATION_VERSION, language, error:'service-unavailable', results:texts.map(source=>({source,text:source,state:'failed',error:'service-unavailable'}))}, {status:503});
  }
  return liveFetch(path, options);
} });
const recovery = await retryClient.translate('Gold prices fell by 2% in Baghdad today.', 'ku');
console.log(JSON.stringify({verification:'injected-client-503-then-live-preview', calls, ...recovery}));
if (calls !== 2 || recovery.state !== 'translated') failures++;
process.exitCode = failures ? 1 : 0;
