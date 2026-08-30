/* Every number module 04's prose quotes, re-derived by driving the page.
   Values are compared, not strings. Run: node tools/verify-prose-m4.js */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.join(__dirname, '..', 'modules', 'intercept-gradient.html');
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

const BASE = { phi: 20, vcl: 0, shvp: 2700, fl: 'gas', sat: 100, amax: 30, nz: 0 };
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
function chk(label, fromPage, inProse, values) {
  const okProse = prose.includes(inProse.replace(/\s+/g, ' '));
  const got = nums(fromPage), said = nums(inProse);
  const has = (l, v) => l.some((q) => Math.abs(q - v) < 1e-9);
  const missPage = values.filter((v) => !has(got, v));
  const missProse = values.filter((v) => !has(said, v));
  const ok = okProse && !missPage.length && !missProse.length;
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(36) + String(fromPage).padEnd(30) +
    (!okProse ? 'NOT IN PROSE: "' + inProse.slice(0, 46) + '"'
     : missPage.length ? 'PROSE CLAIMS ' + missPage.join(', ') + ' — PAGE SAYS ' + got.join(', ')
     : missProse.length ? 'sentence is missing ' + missProse.join(', ') : ''));
}

console.log('\nMODULE 04 — prose against the running page\n');

const p1 = go({}, ['p1']);
chk('gradient fitted to 20 deg', p1.s1d, 'over 0–20° the gradient is −0.4107', [0.4107]);
chk('gradient fitted to 45 deg', p1.s1e, '0–45° it is −0.4310', [0.4310]);
chk('shift in gradient / intercept', p1.s1f,
    'shift of 0.0203 — about five percent of the gradient', [0.0203]);
chk('intercept shift and ratio', p1.s1f,
    'intercept moves by only 0.0014 over the same change, so the fit range moved the gradient fifteen times',
    [0.0014]);
chk('key point, five percent', p1.s1f, 'about five percent between a 20° and a 45° fit', []);

const p2 = go({ phi: 30 }, ['p2']);
chk('nearest wet rock', p2.s2b, 'brine sand at 33% porosity under a fast 3100 m/s shale', [33, 3100]);
chk('intercept match', p2.s2c, "intercept matches the gas sand's to 0.0002", [0.0002]);
chk('near-trace difference', p2.s2e, 'they differ by 0.0001', [0.0001]);
chk('gradient difference', p2.s2d, 'gradients differ by 0.3745', [0.3745]);
chk('far-trace difference', p2.s2f, 'pulled apart by 0.0935', [0.0935]);

const p3 = go({ phi: 30 }, ['p3']);
const p3oil = go({ phi: 30, fl: 'oil' }, ['p3']);
chk('brine off trend', p3.s3d, 'Brine sits −0.0461 from the trend', [0.0461]);
chk('oil off trend', p3oil.s3c, 'oil −0.1544', [0.1544]);
chk('gas off trend', p3.s3e, 'gas −0.3173', [0.3173]);
chk('wet scatter', p3.s3b, 'scatter about their own line by about 0.039', [0.039]);
chk('key point, the trend', p3.s3a + ' ' + p3.s3b,
    'G = −0.141 − 1.171·R₀ with a scatter of about 0.039', [0.141, 1.171, 0.039]);
chk('key point, three fluids', p3.s3d + ' ' + p3oil.s3c + ' ' + p3.s3e,
    'sits −0.0461 off the trend with brine, −0.1544 with oil and −0.3173 with gas',
    [0.0461, 0.1544, 0.3173]);

go({}, ['p4']);
/* The card readouts round to three decimals, so compare against the fit the
   page actually computed rather than against its display string. */
const sh27 = win.ROCK.mudrock(2700);
const f10 = M.fit(sh27, M.rockOf(10, 'gas', 100), 30);
const f30 = M.fit(sh27, M.rockOf(30, 'gas', 100), 30);
chk('10% gas sand', f10.R0.toFixed(4), 'intercept of +0.1814 and lands in Class I', [0.1814]);
chk('30% gas sand', f30.R0.toFixed(4), 'the 30% sand has −0.1610 and lands in Class III', [0.1610]);
chk('10% gas sand class', M.classOf(f10.R0, f10.G), 'lands in Class I', []);
chk('30% gas sand class', M.classOf(f30.R0, f30.G), 'lands in Class III', []);

const p5 = go({}, ['p5']);
chk('shale 2300', p5.s5a, 'At 2300 m/s the intercept is +0.096 and the response is Class I', [0.096]);
chk('shale 2700', p5.s5b, 'At 2700 m/s it is −0.004 and it is Class II', [0.004]);
chk('shale 3100', p5.s5c, 'At 3100 m/s it is −0.090 and it is Class III', [0.090]);
chk('off-trend across the shale range', p5.s5f,
    'only moves between −0.210 and −0.298 across that whole span', [0.210, 0.298]);
chk('key point, one sand three classes', p5.s5d,
    'Class I under a 2300 m/s shale, Class II at 2700 and Class III at 3100', []);

console.log('\n' + (bad ? bad + ' MISMATCHES' : 'every number in module 04 matches the page') + '\n');
process.exit(bad ? 1 : 0);
