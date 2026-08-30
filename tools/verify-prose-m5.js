/* Every number module 05's prose quotes, re-derived by driving the page.
   Run: node tools/verify-prose-m5.js */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.join(__dirname, '..', 'modules', 'reading-a-gather.html');
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

const BASE = { phi: 30, shvp: 2700, fl: 'gas', sat: 100, amax: 30, ntr: 16, nz: 1 };
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
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label.padEnd(38) + String(fromPage).padEnd(26) +
    (!okProse ? 'NOT IN PROSE: "' + inProse.slice(0, 46) + '"'
     : missPage.length ? 'PROSE CLAIMS ' + missPage.join(', ') + ' — PAGE SAYS ' + got.join(', ')
     : missProse.length ? 'sentence is missing ' + missProse.join(', ') : ''));
}

console.log('\nMODULE 05 — prose against the running page\n');
const mod = go({}, ['p2']), noisy = go({ nz: 2 }, ['p2']);
chk('uncertainties at moderate noise', mod.s2a + ' ' + mod.s2b + ' ' + mod.s2c,
    'the uncertainties are 0.0056 and 0.0466, a ratio of 8.3', [0.0056, 0.0466, 8.3]);
chk('uncertainties at high noise', noisy.s2a + ' ' + noisy.s2b + ' ' + noisy.s2c,
    'At noisy they are 0.0149 and 0.1244', [0.0149, 0.1244]);
chk('key point, the ratio', mod.s2c, 'its scatter is 8.3 times the intercept’s'.replace('’', "'"), [8.3]);

const a40 = go({ amax: 40 }, ['p3']), a30 = go({ amax: 30 }, ['p3']);
const a20 = go({ amax: 20 }, ['p3']), a15 = go({ amax: 15 }, ['p3']);
chk('gradient uncertainty vs mute',
    a40.s3b + ' ' + a30.s3b + ' ' + a20.s3b + ' ' + a15.s3b,
    'runs 0.0280 at 40°, 0.0466 at 30°, 0.1002 at 20° and 0.1753 at 15°',
    [0.0280, 0.0466, 0.1002, 0.1753]);
chk('key point, the mute', a40.s3b + ' ' + a15.s3b,
    'runs 0.0280 at a 40° fit and 0.1753 at 15°, a factor of 6.3', [0.0280, 0.1753]);
const n48 = go({ ntr: 48 }, ['p3']);
chk('fold, square-root returns', a30.s3b + ' ' + n48.s3b,
    'Sixteen traces give 0.0466 and forty-eight give 0.0281, a factor of 1.66',
    [0.0466, 0.0281]);
go({}, ['p3']);
chk('mute worth', go({}, ['p3']).s3f, 'improves it by 3.6 and costs nothing to acquire', [3.6]);

const p4 = go({}, ['p4']);
chk('correlation', p4.s4a, 'the two errors is −0.742', [0.742]);
chk('key point, correlation', p4.s4a, 'The two errors are correlated at −0.742.', [0.742]);

const p5m = go({}, ['p5']), p5n = go({ nz: 2 }, ['p5']);
chk('oil pair, moderate', p5m.s5b, 'brine sands are 1.54 standard deviations apart', [1.54]);
chk('fizz pair, moderate', p5m.s5d, 'the gas and fizz sands 0.81', [0.81]);
chk('both pairs, noisy', p5n.s5b + ' ' + p5n.s5d, 'they fall to 0.58 and 0.31', [0.58, 0.31]);
chk('angle needed for two sigma', p5m.s5e, 'Widening the mute to 35° would bring the oil pair to two sigma',
    [35]);
chk('why-it-matters walkback', p5m.s5b,
    'the separation is 1.54 standard deviations', [1.54]);

console.log('\n' + (bad ? bad + ' MISMATCHES' : 'every number in module 05 matches the page') + '\n');
process.exit(bad ? 1 : 0);
