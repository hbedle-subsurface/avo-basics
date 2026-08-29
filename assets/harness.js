/* Headless harness. Opens a module in jsdom with a stubbed canvas, drives the
   controls, and prints the readouts. It is both the regression test and the
   instrument every number in the prose is measured with.

   Usage:
     node tools/harness.js                  structural checks + default readout
     node tools/harness.js sweep            the tables the exercises quote
*/

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const MODULE = path.join(__dirname, '..', 'modules', 'rock-to-trace.html');
const html = fs.readFileSync(MODULE, 'utf8');

/* ---------- stubbed 2D context: records nothing, throws on nothing ---------- */
/* The stub records the extent of everything drawn, so overflow past the canvas
   box can be caught arithmetically. This is the class of bug that produced a
   full-width canvas overrunning its padded parent by 52 px. */
const DRAWN = new Map();          // canvas element -> bounds of everything drawn on it
let CUR = null;                   // whichever canvas getContext was last called on
function bounds(c) {
  let b = DRAWN.get(c);
  if (!b) { b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }; DRAWN.set(c, b); }
  return b;
}
function resetDrawn() { DRAWN.clear(); }

/* Clipping and text alignment both have to be modeled or the check lies.
   Without clip, the grain pack drawn deliberately past the edge of its clipped
   box reads as overflow. Without textAlign, a centred tick label is recorded as
   starting at its centre and running full width to the right. */
let CLIP = null, PENDING = null;
const CLIPSTACK = [];
/* A real 2x3 transform, because rotated axis labels are drawn after a
   translate and without it every left axis looks like a 48 px overflow. */
let TX = [1, 0, 0, 1, 0, 0];
const TXSTACK = [];
const apply = (x, y) => [TX[0] * x + TX[2] * y + TX[4], TX[1] * x + TX[3] * y + TX[5]];
function note(px, py) {
  if (!CUR || !isFinite(px) || !isFinite(py)) return;
  let [x, y] = apply(px, py);
  if (CLIP) {
    if (x < CLIP.x) x = CLIP.x;
    if (x > CLIP.x + CLIP.w) x = CLIP.x + CLIP.w;
    if (y < CLIP.y) y = CLIP.y;
    if (y > CLIP.y + CLIP.h) y = CLIP.y + CLIP.h;
  }
  const b = bounds(CUR);
  if (x < b.minX) b.minX = x;
  if (x > b.maxX) b.maxX = x;
  if (y < b.minY) b.minY = y;
  if (y > b.maxY) b.maxY = y;
}
function mul(m, n) {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
          m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
          m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
function stubCanvas(win) {
  const noop = () => {};
  const rec = (x, y, w, h) => { note(x, y); if (w !== undefined) note(x + w, y + h); };
  const ctx = {
    canvas: null,
    beginPath: noop, closePath: noop,
    moveTo: note, lineTo: note,
    save: () => { CLIPSTACK.push(CLIP); TXSTACK.push(TX.slice()); },
    restore: () => {
      CLIP = CLIPSTACK.length ? CLIPSTACK.pop() : null;
      TX = TXSTACK.length ? TXSTACK.pop() : [1, 0, 0, 1, 0, 0];
    },
    clip: () => {
      if (!PENDING) return;
      const a = apply(PENDING.x, PENDING.y);
      const b = apply(PENDING.x + PENDING.w, PENDING.y + PENDING.h);
      CLIP = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]),
               w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
    },
    arc: (x, y, r) => { note(x - r, y - r); note(x + r, y + r); },
    rect: (x, y, w, h) => { PENDING = { x, y, w, h }; rec(x, y, w, h); },
    fillRect: rec, strokeRect: rec,
    fill: noop, stroke: noop, clearRect: noop,
    textAlign: 'left', textBaseline: 'alphabetic', font: '',
    fillText(t, x, y) {
      const w = String(t).length * 6;
      const x0 = this.textAlign === 'center' ? x - w / 2
               : this.textAlign === 'right' ? x - w : x;
      note(x0, y); note(x0 + w, y);
    },
    strokeText: noop,
    translate: (dx, dy) => { TX = mul(TX, [1, 0, 0, 1, dx, dy]); },
    rotate: (a) => { const c = Math.cos(a), s2 = Math.sin(a); TX = mul(TX, [c, s2, -s2, c, 0, 0]); },
    scale: (sx, sy) => { TX = mul(TX, [sx, 0, 0, sy, 0, 0]); },
    setTransform: (a, b, c, d, e, f) => { TX = [a, b, c, d, e, f]; },
    setLineDash: noop, drawImage: noop, putImageData: noop,
    measureText: (t) => ({ width: String(t).length * 6 }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
  win.HTMLCanvasElement.prototype.getContext = function () {
    ctx.canvas = this; CUR = this; return ctx;
  };
  win.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
}

function open() {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (m) => errors.push(String(m)));

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: undefined,
    url: 'https://example.org/modules/rock-to-trace.html',
    virtualConsole: vc,
    beforeParse(win) {
      stubCanvas(win);
      win.devicePixelRatio = 1;
      Object.defineProperty(win.HTMLElement.prototype, 'clientWidth',
        { get() { return 900; }, configurable: true });
      win.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    },
  });

  // The page loads its libraries with <script src>, which jsdom will not fetch.
  // Inject them by hand, in order, before the inline module script runs.
  const win = dom.window;
  const doc = win.document;
  // `const SEIS = ...` at the top level of an eval does NOT become a property
  // of window, so each library is published by hand in the same eval.
  for (const [f, name] of [['seismic.js', 'SEIS'], ['rockphysics.js', 'ROCK']]) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', f), 'utf8');
    win.eval(src + '\n;globalThis.' + name + ' = ' + name + ';');
  }
  // Now run the module's own inline script.
  const inline = html.split('<script>').pop().split('</script>')[0];
  win.eval(inline);
  return { dom, win, doc, errors };
}

/* ---------- structural checks ---------- */
function structural() {
  let bad = 0;
  const say = (ok, msg) => { if (!ok) bad++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + msg); };

  // every $('id') in the script has a matching id in the markup
  const ids = new Set();
  const re = /\sid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  const refs = new Set();
  const re2 = /\$\('([^']+)'\)/g;
  while ((m = re2.exec(html))) refs.add(m[1]);
  const orphan = [...refs].filter((r) => !ids.has(r));
  say(orphan.length === 0, '$(id) references all resolve' +
      (orphan.length ? '  missing: ' + orphan.join(', ') : ''));

  // set('sNx', ...) targets exist too
  const sets = new Set();
  const re3 = /set\('([a-z0-9]+)'/gi;
  while ((m = re3.exec(html))) sets.add(m[1]);
  const orphanSets = [...sets].filter((r) => !ids.has(r) && !r.endsWith('V'));
  say(orphanSets.length === 0, 'set(id) targets all resolve' +
      (orphanSets.length ? '  missing: ' + orphanSets.join(', ') : ''));

  // every readout id in the markup is written by the script at least once
  const statIds = [...ids].filter((i) => /^s\d[a-z]$/.test(i));
  const unwritten = statIds.filter((i) => !sets.has(i));
  say(unwritten.length === 0, 'every stat readout is populated' +
      (unwritten.length ? '  never set: ' + unwritten.join(', ') : ''));

  // tab strip length
  const tabs = [...html.matchAll(/data-tab="[^"]+"[^>]*>([^<]+)</g)].map((x) => x[1].trim());
  const len = tabs.join('').length;
  say(len < 115, 'tab label length ' + len + ' chars (limit ~115)');

  // one pane per tab
  const panes = [...html.matchAll(/class="tabpane" id="(\w+)"/g)].map((x) => x[1]);
  const tabIds = [...html.matchAll(/data-tab="(\w+)"/g)].map((x) => x[1]);
  say(panes.length === tabIds.length && panes.every((p) => tabIds.includes(p)),
      'tabs and panes match (' + panes.length + ' of each)');

  // exercises: five, each with a hint
  const lis = (html.match(/<li><b>/g) || []).length;
  const hints = (html.match(/<details class="reveal"><summary>Hint<\/summary>/g) || []).length;
  say(hints === 5, 'five exercises, each with a hint (' + hints + ')');

  // key points: six
  const kp = html.split('<h3>Key points</h3>')[1];
  const kpn = kp ? (kp.split('</ul>')[0].match(/<li>/g) || []).length : 0;
  say(kpn === 6, 'six key points (' + kpn + ')');

  // SEIS.tag must never be handed white text
  say(!/SEIS\.tag\([^)]*#fff/i.test(html) && !/SEIS\.tag\([^)]*'white'/i.test(html),
      'SEIS.tag is never passed white');

  // canvas width must come from the content box, not clientWidth alone
  say(/paddingLeft/.test(html), 'canvas width uses the parent content box');

  return bad;
}

/* ---------- driving ---------- */
function readout(win, doc) {
  const g = (id) => { const e = doc.getElementById(id); return e ? e.textContent : '(missing)'; };
  const out = {};
  for (const el of doc.querySelectorAll('.stat b')) out[el.id] = el.textContent;
  return out;
}

function drive(win, doc, state, panes) {
  const M = win.__MOD;
  Object.assign(M.S, state);
  M.recompute();
  for (const p of (panes || ['p1', 'p2', 'p3', 'p4', 'p5'])) M.showTab(p);
  return readout(win, doc);
}

/* ---------- main ---------- */
const mode = process.argv[2] || 'check';
const { win, doc, errors } = open();

if (!win.__MOD) {
  console.log('\nThe module did not finish booting. Errors:\n  ' +
              (errors.join('\n  ') || '(none reported)'));
  process.exit(1);
}

if (mode === 'check') {
  console.log('\n--- STRUCTURAL ---');
  const bad = structural();

  console.log('\n--- BOOT ---');
  console.log('  ' + (errors.length ? 'FAIL runtime errors: ' + errors.join('; ')
                                    : 'ok   page booted with no runtime errors'));

  console.log('\n--- EVERY CONTROL DRIVEN THROUGH ITS FULL RANGE ---');
  const ranges = {
    phi: [5, 35], vcl: [0, 30], th: [5, 60], shvp: [2300, 3100],
    sat: [0, 100], api: [12, 50], gor: [0, 200], fr: [20, 40], nz: [0, 2],
  };
  let crashes = 0;
  for (const [k, [lo, hi]] of Object.entries(ranges)) {
    for (const fl of ['brine', 'oil', 'gas']) {
      for (let i = 0; i <= 10; i++) {
        let v = lo + (hi - lo) * i / 10;
        if (k === 'nz') v = Math.round(v);   // an index, not a continuum
        try {
          const r = drive(win, doc, { [k]: v, fl });
          for (const [id, txt] of Object.entries(r)) {
            if (/NaN|Infinity|undefined/.test(txt)) {
              console.log('  FAIL ' + k + '=' + v + ' fluid=' + fl + ' -> ' + id + ' = ' + txt);
              crashes++;
            }
          }
        } catch (e) {
          console.log('  FAIL ' + k + '=' + v + ' fluid=' + fl + ' threw: ' + e.message);
          crashes++;
        }
      }
    }
  }
  console.log('  ' + (crashes ? crashes + ' bad readouts' :
    'ok   297 states per control, no NaN, Infinity or undefined in any readout'));

  console.log('\n--- DEFAULT STATE READOUTS ---');
  const d = drive(win, doc, { phi: 20, vcl: 0, th: 45, shvp: 2700, fl: 'brine',
                              sat: 80, api: 32, gor: 0, fr: 30, nz: 0 });
  for (const [id, txt] of Object.entries(d)) console.log('  ' + id.padEnd(5) + txt);
  process.exit(bad + crashes ? 1 : 0);
}

if (mode === 'sweep') {
  const M = win.__MOD;
  const base = { vcl: 0, th: 45, shvp: 2700, api: 32, gor: 0, fr: 30, nz: 0 };
  const rd = (st) => drive(win, doc, Object.assign({}, base, st), ['p2', 'p3', 'p4']);

  console.log('\nEXERCISE 1 — brine sand, R at the top against porosity');
  for (let p = 5; p <= 35; p += 5) {
    const r = rd({ fl: 'brine', phi: p, sat: 0 });
    console.log('  phi ' + String(p).padStart(2) + '%   Rtop ' + r.s3c.padStart(8) +
                '   I ' + r.s3b.padStart(7) + '   Vp ' + r.s2e.padStart(9));
  }

  console.log('\nEXERCISE 2 — gas sand at 100% saturation');
  for (const p of [20, 30]) {
    const r = rd({ fl: 'gas', phi: p, sat: 100 });
    console.log('  phi ' + p + '%   Rtop ' + r.s3c + '   I ' + r.s3b + '   ' + r.s3e);
  }

  console.log('\nEXERCISE 3 — saturation, phi 30%');
  for (const s of [0, 2, 5, 10, 20, 100]) {
    const r = rd({ fl: 'gas', phi: 30, sat: s });
    console.log('  Sg ' + String(s).padStart(3) + '%   Rtop ' + r.s3c.padStart(8) +
                '   Vp ' + r.s2e.padStart(9) + '   ' + r.s2h);
  }

  console.log('\nEXERCISE 4 — gas sand 30%, shale velocity swept');
  for (const v of [2300, 2700, 3100]) {
    const r = rd({ fl: 'gas', phi: 30, sat: 100, shvp: v });
    console.log('  shale ' + v + ' m/s   Ish ' + r.s3a.padStart(7) +
                '   Rtop ' + r.s3c.padStart(8));
  }

  console.log('\nEXERCISE 5 — the two rocks');
  const a = rd({ fl: 'oil', phi: 30, sat: 100 });
  const b = rd({ fl: 'brine', phi: 35, sat: 0 });
  console.log('  oil   30%   Rtop ' + a.s3c + '   Vp/Vs ' + a.s2g);
  console.log('  brine 35%   Rtop ' + b.s3c + '   Vp/Vs ' + b.s2g);
  const amb = drive(win, doc, Object.assign({}, base, { fl: 'gas', phi: 30, sat: 100 }), ['p5']);
  console.log('  step 5 reads:  ' + amb.s5c + '  |  ' + amb.s5d + '  |  diff ' + amb.s5e);

  console.log('\nTUNING — thickness at 30 Hz, gas sand 30%');
  for (const t of [10, 15, 20, 25, 30, 45, 60]) {
    const r = rd({ fl: 'gas', phi: 30, sat: 100, th: t });
    console.log('  ' + String(t).padStart(2) + ' m   dt ' + r.s4a.padStart(9) +
                '   peak ' + r.s4c.padStart(8) + '   R ' + r.s4d.padStart(8) +
                '   ' + r.s4e.padStart(30) + '   ' + r.s4f);
  }

  console.log('\nNOISE — spread across five realizations');
  for (const nz of [0, 1, 2]) {
    const r = drive(win, doc, Object.assign({}, base, { fl: 'gas', phi: 30, sat: 100, nz }), ['p5']);
    console.log('  ' + ['clean', 'moderate', 'noisy'][nz].padEnd(9) +
                'noise ' + r.s5a.padStart(10) + '   spread ' + r.s5b);
  }
  console.log('');
}

if (mode === 'geometry') {
  /* Nothing may be drawn outside the box its canvas actually occupies, at any
     viewport width. Checked by arithmetic because there is no browser here to
     look at, and looking is not a reliable check anyway. */
  const M = win.__MOD;
  const widths = [1220, 1024, 900, 760, 680, 520, 380];
  let bad = 0;
  console.log('\n viewport  canvas     drawn x-range        box      verdict');
  for (const vw of widths) {
    Object.defineProperty(win.HTMLElement.prototype, 'clientWidth',
      { get() { return Math.min(vw - 48, 1220 - 48); }, configurable: true });
    Object.defineProperty(win, 'innerWidth', { get() { return vw; }, configurable: true });
    for (const pane of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      M.showTab(pane);
      resetDrawn(); CLIP = null; PENDING = null;
      CLIPSTACK.length = 0; TXSTACK.length = 0; TX = [1, 0, 0, 1, 0, 0];
      M.drawAll();
      for (const c of doc.querySelectorAll('#' + pane + ' canvas, .labhead canvas')) {
        const b = DRAWN.get(c);
        const cw = parseFloat(c.style.width || '0');
        const ch = parseFloat(c.style.height || '0');
        if (!b || !cw || !isFinite(b.maxX)) continue;
        // ticks and labels sit a few px outside the plot frame by design, but
        // must stay inside the canvas itself; 1 px of rounding slack.
        const over = b.maxX > cw + 1 || b.minX < -1 || b.maxY > ch + 1 || b.minY < -1;
        if (over) {
          bad++;
          console.log('  ' + String(vw).padStart(5) + '   ' + c.id.padEnd(9) +
            f(b.minX) + ' .. ' + f(b.maxX) + '   ' + f(cw) + 'x' + f(ch) +
            '   OVERFLOW by ' + f(Math.max(b.maxX - cw, -b.minX, b.maxY - ch, -b.minY)));
        }
      }
    }
  }
  function f(x) { return (Math.round(x * 10) / 10).toString().padStart(7); }
  console.log('  ' + (bad ? bad + ' canvases overflow their box'
    : 'ok   ' + widths.length + ' viewport widths x 5 panes: nothing drawn outside its canvas'));
  console.log('');
  process.exit(bad ? 1 : 0);
}

if (mode === 'tuning') {
  /* Does the page's MEASURED tuning thickness match Ricker theory?
     Peak-to-trough separation of a Ricker is sqrt(6)/(2*pi*f). An
     equal-and-opposite reflection pair tunes when the two wavelets are that
     far apart, so h_tune = Vp * sqrt(6)/(4*pi*f).  This is the closed form
     the measurement is checked against. */
  const M = win.__MOD;
  const base = { vcl: 0, shvp: 2700, api: 32, gor: 0, nz: 0, th: 45 };
  console.log('\n f(Hz)  fluid  phi    Vp     measured   theory    lambda/4   err');
  let worst = 0;
  for (const f of [20, 25, 30, 35, 40]) {
    for (const [fl, phi, sat] of [['gas', 30, 100], ['brine', 20, 0], ['oil', 30, 100]]) {
      drive(win, doc, Object.assign({}, base, { fr: f, fl, phi, sat }), ['p4']);
      const D = M.D;
      const meas = parseFloat(doc.getElementById('s4b').textContent);
      const theory = D.res.vp * Math.sqrt(6) / (4 * Math.PI * f);
      const quarter = D.res.vp / (4 * f);
      const err = Math.abs(meas - theory);
      worst = Math.max(worst, err);
      console.log('  ' + String(f).padStart(3) + '   ' + fl.padEnd(6) +
        String(phi).padStart(3) + '%  ' + String(Math.round(D.res.vp)).padStart(5) +
        '   ' + meas.toFixed(1).padStart(7) + ' m  ' + theory.toFixed(2).padStart(7) +
        ' m  ' + quarter.toFixed(1).padStart(7) + ' m   ' + err.toFixed(2));
    }
  }
  console.log('\n  worst departure from the closed form: ' + worst.toFixed(2) +
    ' m  (scan step is 0.5 m, so anything under 0.25 m is exact)\n');
  process.exit(worst > 0.3 ? 1 : 0);
}
