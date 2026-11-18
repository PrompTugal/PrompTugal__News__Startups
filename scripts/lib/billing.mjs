// The reading meter's config for this site: api/v1/billing/meter.json, made from data/billing/prices.json and
// data/billing/topup.json the way PrompTugal__News__Website's newsroom/build/features/billing.mjs makes it
// (commit f261682c), so meter.js and sg-meter-core.js read the same shape. Node built-ins only.
// Links: this site has its own account page. It has no top-up or billing page yet, so those two links are
// absolute https links to promptugal.news's pages (assets/meter/meter.js resolves a link with new URL(link, root),
// which keeps an absolute one as it is). A top-up therefore returns to promptugal.news.
import { readFileSync } from 'node:fs';

const round = x => Math.floor(x + 0.5); // half up, as the reference's tables are

export function priceTable(P) {
  const out = {};
  for (const t of P.types) {
    out[t.type] = t.base;
    if (t.decays) for (const tr of P.tiers) out[`${t.type}_${tr.tier}`] = Math.max(P.floor, round(t.base * tr.multiplier));
  }
  return out;
}

export function payLink(T) {
  if (!T.link) return '';
  return T.client_reference_id ? `${T.link}?client_reference_id=${encodeURIComponent(T.client_reference_id)}` : T.link;
}

export function meterConfig(version) {
  const P = JSON.parse(readFileSync('data/billing/prices.json', 'utf8'));
  const T = JSON.parse(readFileSync('data/billing/topup.json', 'utf8'));
  return {
    about: "The reading meter's config for startups.promptugal.news, made by scripts/lib/billing.mjs from data/billing/prices.json and data/billing/topup.json. sg-meter-core (assets/components/sg-meter/v1/v1.5/v1.5.0/sg-meter-core.js) reads it as window.SG_METER_CONFIG; assets/meter/meter.js adds the page's kind (page-type).",
    meter: P.meter,
    version,
    storageKey: P.storage_key,
    start: P.start,
    symbol: P.symbol,
    currency: P.currency,
    newDays: P.new_days,
    depth: true,
    minDepth: P.min_share,
    floor: P.floor,
    prices: priceTable(P),
    types: Object.fromEntries(P.types.map(t => [t.type, { as: t.as, base: t.base, decays: t.decays }])),
    tiers: P.tiers.map(t => ({ tier: t.tier, max_days: t.max_days, multiplier: t.multiplier })),
    rating: P.rating,
    topup: { amount: T.amount, link: payLink(T) },
    returns_to: T.returns_to,
    our_return: T.our_return,
    verified: T.verified,
    links: { account: 'account/index.html', topup: 'https://promptugal.news/account/top-up.html', how: 'https://promptugal.news/account/billing.html' },
    links2: { newsroom: 'account/index.html', personas: 'account/index.html' },
    autoKeep: true,
  };
}
