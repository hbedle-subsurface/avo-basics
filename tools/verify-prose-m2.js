/* Every number quoted in module 02's prose, re-derived by driving the page and
   compared value-by-value rather than as text. Phrasing is free to change;
   the numbers are not.
   Run: node tools/verify-prose-m2.js */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = path.join(__dirname, '..', 'modules', 'same-amplitude.html');
const html = fs.readFileSync(FILE, 'utf8');
const prose = html.split('<script src=')[0].replace(/\s+/g, ' ');

const vc = new VirtualConsole();
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://e.org/modules/m.html', virtualConsole: vc,
  beforeParse(w) {
    const noop = () => {};
    const ctx = new Proxy({}, {
      get: (t, k) => k === 'measureText' ? (s) => ({ width: String(s).length * 6 })
        : k === 'createImageData' ? (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) })
        : k === 'canvas' ? {} : noop,
      set: () => true,
    });
    w.HTMLCanvasElement.prototype.getContext = () => ctx;
    w.devicePixelRatio = 1;
    Object.defineProperty(w.HTMLElement.prototype, 'clientWidth',
      { get() { return 900; }, configurable: true });
  },
});
const win = dom.window, doc = win.document;
for (const [f, n] of [['seismic.js', 'SEIS'], ['rockphysics.js', 'ROCK']]) {
  win.eval(fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8') +
           '\n;globalThis.' + n + ' = ' + n + ';');
}
win.eval(html.split('<script>').pop().split('</script>')[0]);
const M = win.__MOD;
if (!M) { console.log('module did not boot'); process.exit(1); }

const BASE = { phi: 30, vcl: 0, th: 45, shvp: 2700, fl: 'gas', sat: 100, nz: 0,
               kshale: false, kth: false, kclay: false };
function go(st, panes) {
  Object.assign(M.S, BASE, st || {});
  M.recompute();
  for (const p of (panes || ['p1', 'p2', 'p3', 'p4', 'p5'])) M.showTab(p);
  const o = {};
  for (const el of doc.querySelectorAll('.stat b')) o[el.id] = el.textContent;
  return o;
}

let bad = 0;
/* Both halves matter. The page has to still produce the value, and the prose
   has to still contain it. Checking prose against prose would let a stale
   number agree with itself forever. */
const nums = (t) => (String(t).match(/\d[\d,]*(?:\.\d+)?/g) || [])
  .map((x) => parseFloat(x.replace(/,/g, '')));
function chk(label, fromPage, inProse) {
  const okProse = prose.includes(inProse.replace(/\s+/g, ' '));
  // Every number the prose asserts must actually appear in what the page
  // computed. Checking only that both strings exist would let a stale figure
  // sit in the text agreeing with itself.
  const want = nums(inProse), got = nums(fromPage);
  const missing = want.filter((v) => !got.some((q) => Math.abs(q - v) < 1e-9));
  const ok = okProse && missing.length === 0;
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(38) +
    String(fromPage).padEnd(28) +
    (!okProse ? 'NOT IN PROSE: "' + inProse + '"'
              : missing.length ? 'PROSE CLAIMS ' + missing.join(', ') + ' — PAGE SAYS ' + got.join(', ')
              : ''));
}

console.log('\nMODULE 02 — prose against the running page\n');

const p2 = go({}, ['p2']);
chk('contour, high-saturation end', p2.s2e, '30% porosity at 100% gas saturation');
chk('contour, low-saturation end', p2.s2e, '34% porosity at 10% saturation');
chk('Vp/Vs along the contour', p2.s2d, 'from 1.47 to 1.54');

const p3 = go({}, ['p3']);
chk('porosity, shale pinned', p3.s3c, 'a single porosity, 30%');
chk('porosity, shale unknown', p3.s3d, '26–35%');
chk('cost in porosity units', p3.s3e, 'nine porosity units');

const p4 = go({}, ['p4']);
chk('tuning thickness', p4.s4a, 'tuning thickness of 14.8 m');
chk('thinnest that fits', p4.s4c, '10 m at 28% porosity');
chk('pore volume ratio', p4.s4f, 'at least 5.9 times');

const stages = [{}, { kshale: true }, { kshale: true, kth: true },
                { kshale: true, kth: true, kclay: true }];
const rows = stages.map((st) => go(st, ['p5']));
const counts = rows.map((r) => r.s5b.split(' ')[0]);
chk('survivors, nothing known', counts[0], '6,795 with nothing known');
chk('survivors, shale known', counts[1], '724 knowing the shale');
chk('survivors, shale + thickness', counts[2], '67 knowing the shale and the thickness');
chk('survivors, all three', counts[3], '15 knowing all three');
chk('collapse factor', Math.round(+counts[0].replace(/,/g, '') / +counts[3]), 'a factor of 453');
chk('porosity collapse', rows[0].s5c + ' to ' + rows[3].s5c, 'from 17–35% to 30–34%');
chk('Vp/Vs collapse', rows[0].s5e + ' to ' + rows[3].s5e, '1.45–2.08 to 1.47–1.54');
chk('saturation never collapses', rows.map((r) => r.s5d).join(' / '),
    '0–100%, then 5–100%, then 5–100%, then 10–100%');

const sw = M.sweep({});
chk('gas matches', sw.byFluid.gas, '4,273 with gas');
chk('oil matches', sw.byFluid.oil, '2,456 with oil');
chk('wet matches', sw.byFluid.brine, '66 with no hydrocarbon at all');
chk('total survivors', sw.n, '6,795 matching models');

console.log('\n' + (bad ? bad + ' MISMATCHES' : 'every number in module 02 matches the page') + '\n');
process.exit(bad ? 1 : 0);
