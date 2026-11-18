// Provenance for every fact: where it came from, how it was read, when, by which agent, under which licence, and a link
// to the file that records it (Dinis, 18 Nov 2026: "every single piece of information on the website has to have a piece
// of provenance"). Only what is in the data files or the fixed maps below is ever stated. Node built-ins only.

const REPO_BLOB = 'https://github.com/PrompTugal/PrompTugal__News__Startups/blob/dev/';
const FILE_OK = /^(data\/research\/[a-z0-9-]+\.json|data\/from-website\.json)$/;
export const WEBSITE_FILE = 'data/from-website.json';
const IMPORT_BY = 'startups@PrompTugal.dinis (import script scripts/import-website.mjs)';
const MODELS = {
  'startups.research@PrompTugal.dinis': 'Claude Sonnet (per REALITY.md and the 17 November debrief)',
  'startups.b.research@PrompTugal.dinis': 'Claude Sonnet (per board/team/startups/status.json)',
};
const TOOL_SAID = "fetched and summarised by a fetch tool (WebFetch), as the file's notes say";

// meta: { file, by, notes } for a research file, or { file, importCommit } for the import.
export function fileMeta(file, d) {
  return file === WEBSITE_FILE
    ? { file, by: IMPORT_BY, importCommit: String(d?.source?.commit || '').slice(0, 7) }
    : { file, by: d?.by, notes: d?.notes };
}

// The provenance object of one entry or also item. e supplies source_url, read_on, license, source_license.
export function makeProvenance(e, meta) {
  const p = { source_url: e.source_url, read_on: e.read_on, file: meta.file };
  if (FILE_OK.test(meta.file)) p.file_url = REPO_BLOB + meta.file;
  if (meta.by) p.read_by = meta.by;
  if (MODELS[meta.by]) p.model = MODELS[meta.by];
  if (meta.file === WEBSITE_FILE) {
    p.how_read = meta.importCommit ? `imported from PrompTugal__News__Website at commit ${meta.importCommit}, where the fact was recorded with its source and read date` : 'imported from PrompTugal__News__Website, where the fact was recorded with its source and read date';
  } else {
    p.how_read = /WebFetch|fetch tool/i.test(String(meta.notes || '')) ? TOOL_SAID : 'reading method not recorded';
  }
  p.license = e.license; p.source_license = e.source_license;
  return p;
}

const shortModel = m => String(m || '').replace(/\s*\(per .*\)$/, '');
const agentShort = by => String(by || '').replace(/\s*\(.*\)$/, '');
const readByText = (p, nice) => `read by ${agentShort(p.read_by) || 'an agent not recorded'}${p.model ? ` (${shortModel(p.model)})` : ''}${p.read_on ? ` on ${nice(p.read_on)}` : ''}`;

// Pieces shared by the HTML and markdown forms. short: the version for an "also" source.
function pieces(p, nice, short) {
  const imp = p.file === WEBSITE_FILE;
  const lead = imp ? `imported by ${agentShort(p.read_by)}${p.read_on ? `, source page read on ${nice(p.read_on)}` : ''}` : readByText(p, nice);
  return { lead, how: short ? '' : p.how_read, file: p.file };
}

export function howHtml(p, esc, nice, safeUrl, short = false) {
  if (!p) return '';
  const { lead, how, file } = pieces(p, nice, short);
  const u = p.file_url && safeUrl(p.file_url);
  const rec = file ? `recorded in ${u ? `<a href="${esc(u)}" rel="nofollow">${esc(file)}</a>` : esc(file)}` : '';
  return `How we know: ${[esc(lead), how && esc(how), rec].filter(Boolean).join('; ')}`;
}
export function howMd(p, mdEsc, nice, safeUrl, short = false) {
  if (!p) return '';
  const { lead, how, file } = pieces(p, nice, short);
  const u = p.file_url && safeUrl(p.file_url);
  const rec = file ? `recorded in ${u ? `[${mdEsc(file)}](${u})` : mdEsc(file)}` : '';
  return ` How we know: ${[mdEsc(lead), how && mdEsc(how), rec].filter(Boolean).join('; ')}.`;
}
