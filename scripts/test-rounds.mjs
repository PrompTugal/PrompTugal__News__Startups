// Tests of the round merge rules (scripts/lib/rounds.mjs). Node built-ins only.
import { sameDeal } from './lib/rounds.mjs';
const r = (o) => ({ section: 'funding', kind: 'round', ...o });
let fails = 0;
const t = (name, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
t('a: same company, same day', sameDeal(r({ name: 'Granter seed round', date: '2026-11-03' }), r({ name: 'X into Granter', date: '2026-11-03' })), true);
t('b: same amount within 30 days', sameDeal(r({ company: 'Neuraspace', amount: 'EUR 1.6 million', date: '2026-09-01' }), r({ company: 'Neuraspace', amount: '1.6 million euros', date: '2026-08-05' })), true);
t('c: same source page, month-only dates', sameDeal(r({ name: 'Beyond Vision round', date: '2026-10', source_url: 'https://a.example/x', amount: 'over 28 million euros' }), r({ name: 'Indico into Beyond Vision', date: '2026-10', source_url: 'https://a.example/x', amount: '' })), true);
t('d: same amount text, year and day', sameDeal(r({ name: 'Brainr seed round', date: '2025-09-11', amount: 'up to 11 million euros', source_url: 'https://a.example/1' }), r({ name: 'C2 Capital Partners into Brainr', date: '2025', amount: 'up to 11 million euros', source_url: 'https://b.example/2' })), true);
t('not merged: same company, another round (other amount, other year)', sameDeal(r({ name: 'Brainr seed round', date: '2025-09-11', amount: 'up to 11 million euros' }), r({ name: 'Portugal Ventures into Brainr', date: '2026-07-03', amount: '1.5 million euros' })), false);
t('not merged: same amount text, years differ', sameDeal(r({ company: 'Acme', date: '2024', amount: 'EUR 2 million' }), r({ company: 'Acme', date: '2025', amount: 'EUR 2 million' })), false);
t('not merged: other company, same page', sameDeal(r({ company: 'Acme', date: '2026-10', source_url: 'https://a.example/x' }), r({ company: 'Other', date: '2026-10', source_url: 'https://a.example/x' })), false);
t('not merged: two full days far apart, same page', sameDeal(r({ company: 'Acme', date: '2024-01-01', source_url: 'https://a.example/x' }), r({ company: 'Acme', date: '2025-06-01', source_url: 'https://a.example/x' })), false);
if (fails) { console.error(`test-rounds: ${fails} failed`); process.exit(1); }
console.log('test-rounds: OK');
