// Tests of the preview gate (scripts/lib/svg-check.mjs). Each refused case checks the reason. Node built-ins only.
import { svgProblems } from './lib/svg-check.mjs';
const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><title>t</title><desc>Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)</desc><rect width="320" height="180" fill="#f6f3ec"/><text x="16" y="30">18</text></svg>';
const wrap = s => ok.replace('</svg>', s + '</svg>');
let fails = 0;
const t = (name, text, want) => { const got = JSON.stringify(svgProblems(text)); const w = JSON.stringify(want); if (got !== w) fails++; console.log(`${got === w ? 'ok  ' : 'FAIL'} ${name}${got === w ? '' : `: got ${got}, want ${w}`}`); };
t('the template shape passes, a URL in <desc> included', ok, []);
t('a script fails', wrap('<script>alert(1)</script>'), ['element not allowed in the preview']);
t('a foreignObject fails', wrap('<foreignObject><div/></foreignObject>'), ['element not allowed in the preview']);
t('an event attribute fails', ok.replace('<rect ', '<rect onload="x()" '), ['event attribute']);
t('an image with href fails', wrap('<image href="https://example.org/x.png"/>'), ['element not allowed in the preview', 'outside reference (href or src)']);
t('a use with xlink:href fails', wrap('<use xlink:href="#a"/>'), ['element not allowed in the preview', 'outside reference (href or src)']);
t('a fill from url() fails', ok.replace('fill="#f6f3ec"', 'fill="url(https://example.org/p.svg#g)"'), ['outside reference (url())']);
t('a style element fails', wrap('<style>@import "https://example.org/a.css";</style>'), ['element not allowed in the preview', 'outside reference (@import)']);
t('an entity declaration fails', '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + ok, ['does not start with <svg', 'DOCTYPE or entity declaration']);
t('an animate setting href fails', wrap('<animate attributeName="href" to="javascript:x"/>'), ['element not allowed in the preview']);
if (fails) { console.error(`test-svg-check: ${fails} failed`); process.exit(1); }
console.log('test-svg-check: OK');
