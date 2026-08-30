/* Every number module 06's prose quotes, re-derived by driving the page.
   Run: node tools/verify-prose-m6.js */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.join(__dirname, '..', 'modules', 'what-survives.html');
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

const BASE = { amax: 30, ntr: 16, nz: 1, sc: 0, trap: 0 };
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
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(38) + String(fromPage).padEnd(30) +
    (!okProse ? 'NOT IN PROSE: "' + inProse.slice(0, 46) + '"'
     : missPage.length ? 'PROSE CLAIMS ' + missPage.join(', ') + ' — PAGE SAYS ' + got.join(', ')
     : missProse.length ? 'sentence is missing ' + missProse.join(', ') : ''));
}

console.log('\nMODULE 06 — prose against the running page\n');
const mod = go({}, ['p3']), noisy = go({ nz: 2 }, ['p3']);
chk('moderate noise counts', mod.s3a + ' ' + mod.s3b + ' ' + mod.s3c,
    '441 models match the intercept and 198 match both, so the gradient removes 55% of them',
    [441, 198, 55]);
chk('high noise counts', noisy.s3a + ' ' + noisy.s3b + ' ' + noisy.s3c,
    '1,156 match the intercept and 870 match both — the gradient removes only 25%',
    [1156, 870, 25]);
chk('gradient removes, moderate', mod.s3c, 'the gradient removes 55% of what the intercept left',
    [55]);
chk('gradient removes, noisy', noisy.s3c, 'At high noise it removes 25%', [25]);
chk('Vp/Vs collapse', mod.s3d, 'Vp/Vs goes from 1.46–2.08 to 1.46–1.60', [1.46, 2.08, 1.60]);
chk('saturation range', mod.s3e, 'Saturation goes from 0–100% to 10–100%', [0, 100, 10]);
chk('hydrocarbon fraction', mod.s3f, 'goes from 98% to 100%', [98, 100]);

const m15 = go({ amax: 15 }, ['p3']), m45 = go({ amax: 45 }, ['p3']);
chk('mute at 15 degrees', m15.s3c, 'At a 15° mute the gradient removes 4% of the models', [4]);
chk('mute at 45 degrees', m45.s3c, 'At 45° it removes 75%', [75]);

const p2 = go({}, ['p2']);
chk('models searched and matching', p2.s2a + ' ' + p2.s2b,
    '441 rocks out of the 13,020 searched match the measured intercept', [441, 13020]);
chk('porosity admitted', p2.s2d, 'spanning porosities from 19% to 35%', [19, 35]);

chk('key point, counts', mod.s3a + ' ' + mod.s3b + ' ' + noisy.s3a + ' ' + noisy.s3b,
    'The gradient cuts 441 to 198 at moderate noise and 1,156 to 870 when noisy — 55% against 25%.'
      .replace('— 55% against 25%.', ''),
    [441, 198, 1156, 870]);
chk('key point, mute', m45.s3c + ' ' + m15.s3c,
    'Widen the mute instead and it cuts 75%; narrow it to 15° and it cuts 4%.', [75, 4]);
chk('key point, Vp/Vs', mod.s3d + ' ' + mod.s3f,
    'narrows from 1.46–2.08 to 1.46–1.60, and the hydrocarbon-bearing fraction goes from 98% to 100%',
    [1.46, 2.08, 1.60, 98, 100]);

console.log('\n' + (bad ? bad + ' MISMATCHES' : 'every number in module 06 matches the page') + '\n');
process.exit(bad ? 1 : 0);
