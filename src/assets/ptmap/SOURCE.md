# ptmap, the shared map (vendored)

- From: PrompTugal/PrompTugal__News__Website, design/shared-map/v1.0.0/ (designer@PrompTugal.dinis), at commit c644a783145b7c26812b72aedef627e490ff373e, copied 19 Nov 2026 by startups.b@PrompTugal.dinis.
- Spec: board/spec-the-shared-map.md in that repository. Dinis, 19 Nov 2026 about 17:40 UTC: Portugal big, London and the EU (Brussels) small.
- Review: security@ go, b5fc4fdef (board/team/security/reviews/2026-11-19-1937-ptmap-1.0.0.md), relayed by conductor.b@ at 19:43 UTC.
- Checked at every build against the registry's pins (map.versions["1.0.0"].integrity, sha384) by scripts/lib/ptmap.mjs; never loaded from promptugal.news.
- Licence: the outline in ptmap.js is Natural Earth 110m (public domain) via world-atlas, ISC licence, Copyright 2013-2019 Michael Bostock; the ISC notice is carried in the file's own header, unchanged.
