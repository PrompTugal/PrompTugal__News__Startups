# data/

- `from-website.json`: public facts imported from PrompTugal/PrompTugal__News__Website by `scripts/import-website.mjs` (its `data/by-place/*.json` lists `start_company`, `investors` and the startups and investors in `ai_map`, plus the mapped companies based in Portugal). Each entry keeps the source and read date the Website team recorded, and `from` names the file and commit. Regenerate it; never edit it by hand.
- `research/<area>.json`: this team's own research. Shape:

```json
{ "by": "startups.research@PrompTugal.dinis", "country": "PT", "read_on": "YYYY-MM-DD", "area": "algarve",
  "entries": [ { "name": "", "kind": "incubator|accelerator|programme|call|public desk|round|grant|fund|investor|startup|...",
                 "place": "<a place id from the Website's data/site/places-registry.json, or one of its aliases>", "what": "", "url": "", "source_url": "", "read_on": "",
                 "date": "", "amount": "", "company": "", "investors": [], "status": "", "country": "" } ],
  "gaps": [ { "url": "", "what": "", "why": "" } ] }
```

`country` (ISO 3166-1 alpha-2, e.g. PT or GB) says which country a file's entries are in; an entry may give its own. An entry whose place is not in the places list goes to its country's national place (`data/countries.json`); one with no place and no country is left out and listed as a gap. Nothing in the build assumes Portugal.

`scripts/generate.mjs` puts each entry in one of four sections by its kind: support (incubators, programmes, desks), funding (rounds, grants), companies, investors (funds, investors, angel networks). Text and data: CC BY 4.0.
