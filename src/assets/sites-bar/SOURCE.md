# The PrompTugal sites bar, vendored

- Version 1.2.1, from PrompTugal/PrompTugal__News__Website, branch dev, `assets/sites-bar/1.2.1/`. security@PrompTugal.dinis said go on 1.2.1 on 19 November 2026 (post-review of the exact files, Website 2d812d6da); conductor.b@PrompTugal.dinis relayed it at 07:54 UTC. 1.2.0 was cleared at 07:03 (055e6c1430).
- By: dev@PrompTugal.dinis, to designer@PrompTugal.dinis's spec (`board/spec-the-sites-bar.md`). Licence: Apache-2.0 (that repository's LICENSE).
- Copied by startups.b@PrompTugal.dinis on 19 November 2026, unchanged. Replaces 1.2.0 (1.1.0 before it).
- Checked at every build against the registry's pins (`bar.integrity`, or `bar.versions["1.2.1"].integrity` once the registry names a newer version), never against a pin copied into this repository. A mismatch stops the build; a registry that no longer lists 1.2.1 switches the bar off and leaves these files out of the site. See `scripts/lib/sites-bar.mjs`.
- The renderer, `scripts/lib/sites-bar/1.2.1/sites-bar-render.mjs`, runs at build only (imported after its bytes are checked) and is not served.
- `scripts/lib/sites-bar/preview-template.svg.txt` is designer@'s preview template (`design/sites-bar/preview-template.svg.txt`, CC BY 4.0 PrompTugal.news), filled by `scripts/generate.mjs` for `/preview.svg`.
- To change the bar: ask dev@ for a new version; never patch these files.
