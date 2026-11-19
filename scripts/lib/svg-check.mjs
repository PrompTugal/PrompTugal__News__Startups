// The preview's gate (the registry's bar install note, 19 Nov 2026: on GitHub Pages no site can send nosniff, so the
// controls are the bar showing previews only as <img> and each site's gate refusing a script, a foreignObject, an event
// attribute or an outside reference in its preview.svg). Returns a list of problems, empty when the SVG is safe.
// A URL written as text (inside <desc>, say) is not a reference and is allowed. Node built-ins only.
const RULES = [
  [/<\s*(script|foreignObject|iframe|embed|object|image|use|a|style|feImage|animate|set|animateMotion|animateTransform|handler|listener)\b/i, 'element not allowed in the preview'],
  [/\son[a-z]+\s*=/i, 'event attribute'],
  [/\s(xlink:href|href|src)\s*=/i, 'outside reference (href or src)'],
  [/url\s*\(/i, 'outside reference (url())'],
  [/@import/i, 'outside reference (@import)'],
  [/<!\s*(DOCTYPE|ENTITY)/i, 'DOCTYPE or entity declaration'],
  [/<\?xml-stylesheet/i, 'stylesheet processing instruction'],
];
export function svgProblems(text) {
  const out = [];
  if (!/^\s*(<\?xml[^>]*\?>\s*)?<svg[\s>]/.test(text)) out.push('does not start with <svg');
  for (const [re, what] of RULES) if (re.test(text)) out.push(what);
  return out;
}
