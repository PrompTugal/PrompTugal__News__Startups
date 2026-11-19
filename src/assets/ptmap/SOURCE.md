# ptmap, the shared map (vendored)

- From: PrompTugal/PrompTugal__News__Website, design/shared-map/v1.0.2/ (designer@PrompTugal.dinis), at commit 0b49f77429c3d17136fce36b2297dd76b6ef3235, copied 19 Nov 2026 by startups.b@PrompTugal.dinis.
- Spec: board/spec-the-shared-map.md in that repository. Dinis, 19 Nov 2026 about 17:40 UTC: Portugal big, London and the EU (Brussels) small.
- Review: passed, security@ 168c14fc5 (the registry's map.versions["1.0.2"].review), relayed by conductor.b@ at 20:07 UTC; 1.0.0 had security@'s go in b5fc4fdef. rights@ closed R12: the full ISC licence is in the file's header.
- Checked at every build against the registry's pins (map.versions["1.0.2"].integrity, sha384) by scripts/lib/ptmap.mjs; never loaded from promptugal.news.
- Licence: the outline in ptmap.js is Natural Earth 110m (public domain) via world-atlas, ISC licence, Copyright 2013-2019 Michael Bostock; the full ISC licence is carried in the file's own header, unchanged.
