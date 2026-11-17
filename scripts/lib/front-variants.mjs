// Three front pages from the same data (design pass 1, for Dinis to choose at /design/).
// Each takes the generator's context and returns { name, idea, html, md }.
// Written by startups@PrompTugal.dinis, 2026-11-17.
const SITE = 'https://startups.promptugal.news';

const statsHtml = (c, esc) => `<div class="stats"><div><b>${c.support}</b><span>incubators, programmes and desks</span></div><div><b>${c.funding}</b><span>rounds, grants and public money</span></div><div><b>${c.companies}</b><span>companies</span></div><div><b>${c.investors}</b><span>investors</span></div><div><b>${c.places}</b><span>places</span></div></div><p class="meta">Counts of facts on this site today, each with its source (generated from data/ on every push).</p>`;
const statsMd = c => `${c.support} incubators, programmes and desks; ${c.funding} rounds, grants and public money; ${c.companies} companies; ${c.investors} investors; ${c.places} places (counts of facts on this site, generated from data/).`;
const isOpen = e => /open|ongoing/i.test(e.status || '') || /\bopen\b|applications? (?:are )?open|closes? (?:on|in)/i.test(e.what || '');

export const variants = {
  a(ctx) {
    const { entries, counts, esc, itemHtml, itemMd, placeName, algarveIds, byDate } = ctx;
    const money = entries.filter(e => e.section === 'funding' && e.date).sort(byDate).slice(0, 8);
    const alg = entries.filter(e => algarveIds.has(e.place) && e.section === 'support').slice(0, 8);
    const html = `<p class="kicker">Portugal's startups and their funding, place by place</p>
<h1>Who backs founders in Portugal, and with what money</h1>
<p class="lede">Incubators, accelerators, public programmes, rounds and grants, town by town, starting with the Algarve. Every fact links to the page it came from, with the date we read it.</p>
${statsHtml(counts, esc)}
<div class="cols"><section><h2>Latest money</h2><ul class="list">${money.map(e => itemHtml(e, placeName[e.place])).join('')}</ul><p><a href="/funding/">All rounds and grants</a></p></section>
<section><h2>Start with the Algarve</h2><ul class="list">${alg.map(e => itemHtml(e, placeName[e.place])).join('')}</ul><p><a href="/places/algarve/">The Algarve</a> · <a href="/support/">all incubators and programmes</a></p></section></div>
<h2>Investors</h2><p>A section for now: the funds and angel networks seen in Portuguese rounds. <a href="/investors/">${counts.investors} investors so far</a>.</p>`;
    const md = `## Who backs founders in Portugal, and with what money\n\n${statsMd(counts)}\n\n## Latest money\n\n${money.map(e => itemMd(e, placeName[e.place])).join('\n')}\n\n## Start with the Algarve\n\n${alg.map(e => itemMd(e, placeName[e.place])).join('\n')}\n\nMore: ${SITE}/funding/ · ${SITE}/support/ · ${SITE}/investors/`;
    return { name: 'The ledger', idea: 'Leads with numbers and the latest money, then the Algarve. For readers who want news first.', html, md };
  },

  b(ctx) {
    const { entries, groups, counts, esc } = ctx;
    const n = (id, s) => entries.filter(e => e.place === id && (!s || e.section === s)).length;
    const card = (p, hot) => `<div class="card${hot ? ' hot' : ''}"><h3><a href="/places/${p.id}/">${esc(p.name)}</a></h3><p class="meta">${n(p.id, 'support')} support · ${n(p.id, 'funding')} money · ${n(p.id, 'companies')} companies</p></div>`;
    const html = `<p class="kicker">Place by place</p>
<h1>Pick a place. See who helps founders there, and what money has arrived.</h1>
<p class="lede">The Algarve first, then Lisbon and Porto. A place with nothing yet is a gap in our research, not a place with no startups.</p>
${groups.map((g, i) => `<h2>${esc(g.group)}</h2><div class="grid">${g.places.filter(p => i < 2 || n(p.id)).map(p => card(p, i === 0 && p.id === 'algarve')).join('')}</div>`).join('')}
${statsHtml(counts, esc)}`;
    const md = groups.map(g => `## ${g.group}\n\n${g.places.map(p => `- ${p.name} (${SITE}/places/${p.id}/): ${n(p.id, 'support')} support, ${n(p.id, 'funding')} money, ${n(p.id, 'companies')} companies`).join('\n')}`).join('\n\n') + `\n\n${statsMd(counts)}`;
    return { name: 'The map of places', idea: 'Opens on the places themselves, as cards with counts, the Algarve first. For readers who start from where they live.', html, md };
  },

  c(ctx) {
    const { entries, counts, esc, itemHtml, itemMd, placeName, byDate } = ctx;
    const open = entries.filter(e => e.section === 'support' && isOpen(e)).slice(0, 6);
    const support = open.length ? open : entries.filter(e => e.section === 'support' && /incubator|accelerator/.test(e.kind)).slice(0, 6);
    const grants = entries.filter(e => e.section === 'funding' && /grant|programme|call/.test(e.kind)).sort(byDate).slice(0, 5);
    const inv = entries.filter(e => e.section === 'investors').slice(0, 5);
    const step = (no, title, intro, list, more, href) => `<section><p class="kicker">Step ${no}</p><h2>${title}</h2><p>${intro}</p><ul class="list">${list.map(e => itemHtml(e, placeName[e.place])).join('')}</ul><p><a href="${href}">${more}</a></p></section>`;
    const html = `<p class="kicker">For founders</p>
<h1>Starting a company in Portugal: where to go first</h1>
<p class="lede">Three steps, with real places and programmes: find support near you, find public money, then meet the investors who have backed Portuguese startups. Every entry links to its source.</p>
${step(1, 'Find support near you', open.length ? 'Programmes with an open or recent call.' : 'Incubators and accelerators.', support, 'All incubators and programmes', '/support/')}
${step(2, 'Find public money', 'Grants and public programmes, newest first.', grants, 'All rounds and grants', '/funding/')}
${step(3, 'Meet the investors', 'Funds and networks seen in Portuguese rounds. A section for now.', inv, 'All investors', '/investors/')}
${statsHtml(counts, esc)}`;
    const md = `## Step 1: find support near you\n\n${support.map(e => itemMd(e, placeName[e.place])).join('\n')}\n\n## Step 2: find public money\n\n${grants.map(e => itemMd(e, placeName[e.place])).join('\n')}\n\n## Step 3: meet the investors\n\n${inv.map(e => itemMd(e, placeName[e.place])).join('\n')}\n\n${statsMd(counts)}`;
    return { name: 'The founder\'s path', idea: 'Organised as three steps a founder takes: support, public money, investors. For readers who want to act.', html, md };
  },
};
