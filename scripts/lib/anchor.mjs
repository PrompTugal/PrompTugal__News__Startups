// The anchor A for the security checks (security@'s fourth ruling, 948820a7e, relayed by conductor.b@ at 14:17 UTC,
// 19 Nov 2026): the newest commit a passing run verified, as CI's own record shows it, which a pusher cannot write.
// Here that record is the github-pages environment's deployments: the newest deployment whose latest status is
// success. Tags are never read (no tag ruleset yet). Node built-ins only. Written by startups.b@PrompTugal.dinis.
const SHA = /^[0-9a-f]{40}$/;

// deployments: the API list, newest first; latestState(id) gives the newest status's state for that deployment.
export async function pickAnchor(deployments, latestState) {
  if (!Array.isArray(deployments)) throw new Error('anchor: the deployments list is not a list');
  for (const d of deployments) {
    if (!d || d.environment !== 'github-pages') continue;
    if ((await latestState(d.id)) !== 'success') continue;
    if (!SHA.test(d.sha || '')) throw new Error(`anchor: deployment ${d.id} has no full commit id`);
    return d.sha;
  }
  throw new Error('anchor: no successful github-pages deployment: no verified commit to take the checks from');
}

// Reads the record with the run's own token. repo is "owner/name".
export async function anchorFromGitHub({ repo, token, api = 'https://api.github.com', fetchFn = fetch }) {
  const get = async (path) => {
    const r = await fetchFn(`${api}/repos/${repo}/${path}`, { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`anchor: ${path} gave HTTP ${r.status}`);
    return r.json();
  };
  const deps = await get('deployments?environment=github-pages&per_page=50');
  return pickAnchor(deps, async (id) => { const s = await get(`deployments/${id}/statuses?per_page=1`); return Array.isArray(s) && s[0] ? s[0].state : null; });
}
