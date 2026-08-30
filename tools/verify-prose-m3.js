/* Every number module 03's prose quotes, re-derived by driving the page.
   Values are compared, not strings. Run: node tools/verify-prose-m3.js */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.join(__dirname, '..', 'modules', 'add-offset.html');
const html = fs.readFileSync(FILE, 'utf8');
const prose = html.split('<script src=')[0].replace(/\s+/g, ' ');

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://e.org/m/m.html', virtualConsole: new VirtualConsole(),
  beforeParse(w) {
    const noop = () => {};
    const ctx = new Proxy({}, { get: (t, k) =>
      k === 'measureText' ? (x) => ({ width: String(x).length * 6 })
      : k === 'createImageData' ? (a, b) => ({ data: new Uint8ClampedArray(a * b * 4) })
      : k === 'canvas' ? {} : noop, set: () => true });
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

const BASE = { phi: 30, vcl: 0, shvp: 2700, fl: 'gas', sat: 100, dep: 2000, xmax: 3000, nz: 0 };
function go(st, panes) {
  Object.assign(M.S, BASE, st || {});
  M.recompute();
  for (const p of (panes || ['p1', 'p2', 'p3', 'p4', 'p5'])) M.showTab(p);
  const o = {};
  for (const el of doc.querySelectorAll('.stat b')) o[el.id] = el.textContent;
  return o;
}

let bad = 0;
const nums = (t) => (String(t).match(/\d[\d,]*(?:\.\d+)?/g) || [])
  .map((x) => parseFloat(x.replace(/,/g, '')));
/* `values` are the figures being asserted. Each must appear in what the page
   computed AND in the sentence. Parsing every digit out of the sentence would
   trip over incidental numbers like "at 30 degrees" or "a 2000 m target". */
function chk(label, fromPage, inProse, values) {
  const okProse = prose.includes(inProse.replace(/\s+/g, ' '));
  const got = nums(fromPage), said = nums(inProse);
  const has = (list, v) => list.some((q) => Math.abs(q - v) < 1e-9);
  const missPage = values.filter((v) => !has(got, v));
  const missProse = values.filter((v) => !has(said, v));
  const ok = okProse && !missPage.length && !missProse.length;
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(38) + String(fromPage).padEnd(24) +
    (!okProse ? 'NOT IN PROSE: "' + inProse.slice(0, 50) + '"'
     : missPage.length ? 'PROSE CLAIMS ' + missPage.join(', ') + ' — PAGE SAYS ' + got.join(', ')
     : missProse.length ? 'sentence is missing ' + missProse.join(', ') : ''));
}

console.log('\nMODULE 03 — prose against the running page\n');
const d12 = go({ dep: 1200 }, ['p1']), d20 = go({ dep: 2000 }, ['p1']), d32 = go({ dep: 3200 }, ['p1']);
chk('angle at 1200 m', d12.s1c, 'reaches 64.3°', [64.3]);
chk('angle at 2000 m', d20.s1c, 'at 2000 m it reaches 48.4°', [48.4]);
chk('angle at 3200 m', d32.s1c, 'at 3200 m it reaches 35.1°', [35.1]);
chk('shallow/deep contrast (prose)', Math.round(parseFloat(d12.s1c)) + ' ' + Math.round(parseFloat(d32.s1c)),
    'reaches 64° on a 1200 m target and 35°', [64, 35]);
chk('shallow/deep contrast (key pt)', d12.s1c + ' ' + d32.s1c,
    'reaches 64.3° on a 1200 m target and 35.1°', [64.3, 35.1]);

const x15 = go({ xmax: 1500 }, ['p1']), x45 = go({ xmax: 4500 }, ['p1']);
chk('true vs straight at 1500 m', x15.s1c + ' ' + x15.s1d, '26.4° against a straight-ray estimate of 20.6°', [26.4, 20.6]);
chk('true vs straight at 3000 m', d20.s1c + ' ' + d20.s1d, '48.4° against 36.9°', [48.4, 36.9]);
chk('true vs straight at 4500 m', x45.s1c + ' ' + x45.s1d, '65.4° against 48.4°', [65.4, 48.4]);
chk('key point, straight-ray error', d20.s1d + ' ' + d20.s1c,
    'gives 36.9° where the true angle at a 2000 m target with 3000 m offset is 48.4°', [36.9, 48.4]);

const p2gas = go({}, ['p2']), p2brn = go({ fl: 'brine', sat: 0 }, ['p2']);
chk('Vs spread at 30°, gas', p2gas.s2d, 'span 0.0671', [0.0671]);
chk('Vs spread at 30°, brine', p2brn.s2d, 'at the same porosity spans 0.0710', [0.0710]);
chk('Vs spread at 0°', p2gas.s2c, 'the spread is exactly zero', []);
chk('key point, Vs spread', p2gas.s2d, 'the amplitude at 30° spans 0.0671', [0.0671]);

go({}, ['p4']);          // rockAt reads live state, so reset it first
const R = win.ROCK, sh = R.mudrock(2700), rock = M.rockAt({});
const err = (t, n) => R.shuey(sh, rock, t, n) - R.zoeppritz(sh, rock, t);
chk('errors at 20°', err(20, 2).toFixed(4) + ' ' + err(20, 3).toFixed(4),
    'the two-term error is −0.0098 and the three-term is −0.0111', [0.0098, 0.0111]);
chk('errors at 30°', err(30, 2).toFixed(4) + ' ' + err(30, 3).toFixed(4),
    'At 30° they are −0.0167 and −0.0237', [0.0167, 0.0237]);
chk('errors at 40°', err(40, 2).toFixed(4) + ' ' + err(40, 3).toFixed(4),
    'At 40° they are −0.0189 and −0.0434', [0.0189, 0.0434]);

const p5 = go({}, ['p5']), P = M.pairs();
chk('oil/brine separation at 30°', p5.s5b, 'by thirty degrees the gap is 0.0256', [0.0256]);
chk('gas/fizz separation at 30°', p5.s5d, 'At thirty degrees the gap is 0.0123', [0.0123]);
chk('oil/brine Vp/Vs difference', Math.abs(P.oil.vpvs - P.brn.vpvs).toFixed(2),
    'Vp/Vs values differ by 0.21', [0.21]);
chk('gas/fizz Vp/Vs difference', Math.abs(P.gas.vpvs - P.fizz.vpvs).toFixed(2),
    'Vp/Vs differs by 0.07 rather than 0.21', [0.07]);
chk('key point, both separations',
    p5.s5b + ' ' + p5.s5d + ' ' + Math.abs(P.oil.vpvs - P.brn.vpvs).toFixed(2) + ' ' +
    Math.abs(P.gas.vpvs - P.fizz.vpvs).toFixed(2),
    'differ by 0.21 in Vp/Vs, separate by 0.0256 at 30° and can be told apart. Gas against fizz gas, differing by 0.07, separate by 0.0123',
    [0.21, 0.0256, 0.07, 0.0123]);

console.log('\n' + (bad ? bad + ' MISMATCHES' : 'every number in module 03 matches the page') + '\n');
process.exit(bad ? 1 : 0);
