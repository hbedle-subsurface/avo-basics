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

const MODULE = path.join(__dirname, '..', 'modules', process.env.MOD || 'rock-to-trace.html');
const html = fs.readFileSync(MODULE, 'utf8');

/* ---------- stubbed 2D context: records nothing, throws on nothing ---------- */
/* The stub records the extent of everything drawn, so overflow past the canvas
   box can be caught arithmetically. This is the class of bug that produced a
   full-width canvas overrunning its padded parent by 52 px. */
const DRAWN = new Map();          // canvas element -> bounds of everything drawn on it
const TEXTS = new Map();          // canvas element -> every text box drawn on it
let CUR = null;                   // whichever canvas getContext was last called on
function bounds(c) {
  let b = DRAWN.get(c);
  if (!b) { b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }; DRAWN.set(c, b); }
  return b;
}
function resetDrawn() { DRAWN.clear(); TEXTS.clear(); }

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
/* Rough but font-aware advance widths. IBM Plex Sans averages about 0.52 em,
   IBM Plex Mono is fixed at 0.60 em, and semibold runs a little wider. */
function fontSize(f) {
  const m = /(\d+(?:\.\d+)?)px/.exec(f || '');
  return m ? parseFloat(m[1]) : 11;
}
function textWidth(t, f) {
  const px = fontSize(f);
  const mono = /Mono|monospace/i.test(f || '');
  const bold = /\b(600|700|800|bold)\b/i.test(f || '');
  const em = mono ? 0.60 : bold ? 0.55 : 0.52;
  return t.length * px * em;
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
      const w = textWidth(String(t), this.font);
      const x0 = this.textAlign === 'center' ? x - w / 2
               : this.textAlign === 'right' ? x - w : x;
      note(x0, y); note(x0 + w, y);
      if (!CUR || !String(t).trim()) return;
      // Approximate box, in device space, for the label-collision check. The
      // geometry check cannot see this: two labels can overlap each other
      // perfectly while both sit inside the canvas.
      const h = fontSize(this.font);
      const y0 = this.textBaseline === 'top' ? y
               : this.textBaseline === 'middle' ? y - h / 2
               : this.textBaseline === 'bottom' ? y - h : y - h * 0.8;
      const a = apply(x0, y0), b = apply(x0 + w, y0 + h);
      (TEXTS.get(CUR) || TEXTS.set(CUR, []).get(CUR)).push({
        t: String(t), align: this.textAlign,
        x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]),
        y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]),
      });
    },
    strokeText: noop,
    translate: (dx, dy) => { TX = mul(TX, [1, 0, 0, 1, dx, dy]); },
    rotate: (a) => { const c = Math.cos(a), s2 = Math.sin(a); TX = mul(TX, [c, s2, -s2, c, 0, 0]); },
    scale: (sx, sy) => { TX = mul(TX, [sx, 0, 0, sy, 0, 0]); },
    setTransform: (a, b, c, d, e, f) => { TX = [a, b, c, d, e, f]; },
    setLineDash: noop, drawImage: noop, putImageData: noop,
    /* Font-size aware, because the old flat 6 px per character measured a 13 px
       bold heading and a 9.5 px mono tick label as the same width. Both the
       collision check and the modules' own wrapping decisions depend on this. */
    measureText(t) { return { width: textWidth(String(t), this.font) }; },
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

  /* Vertical axes must agree with the data drawn against them. SEIS.axisLeft
     without flip puts the MINIMUM at the top, which is right for time and depth
     and wrong for everything else, because curve() and every other value plot
     here put the minimum at the bottom. Getting this backwards silently prints
     an upside-down axis, and nothing else in this suite can see it. */
  const DOWNWARD = /time|\bms\b|depth/i;
  const axisCalls = [];
  {
    const re4 = /SEIS\.axisLeft\(/g;
    let mm;
    while ((mm = re4.exec(html))) {
      let depth = 0, i = mm.index + 'SEIS.axisLeft'.length;
      for (; i < html.length; i++) {
        if (html[i] === '(') depth++;
        else if (html[i] === ')') { depth--; if (!depth) break; }
      }
      axisCalls.push(html.slice(mm.index, i + 1).replace(/\s+/g, ' '));
    }
  }
  const wrongAxis = axisCalls.filter((c) => {
    const label = (c.match(/'([^']{3,})'/g) || []).find((q) => /[a-z]{3}/i.test(q)) || '';
    const downward = DOWNWARD.test(label);
    const flipped = /flip:\s*true/.test(c);
    return downward ? flipped : !flipped;
  });
  say(wrongAxis.length === 0,
      'every vertical axis runs the same way as its data (' + axisCalls.length + ' checked)' +
      (wrongAxis.length ? '\n       ' + wrongAxis.map((c) => c.slice(0, 96)).join('\n       ') : ''));

  // Exactly one place may convert a two-way time into a y position. The rock
  // column once had its own thickness formula and disagreed with the three
  // panels drawn next to it.
  const maps = (html.match(/\(\(\w+ - TR?0\) \/ \(\(NT - 1\) \* DT\)\)/g) || []).length;
  say(maps === 1, 'one time-to-y mapping, shared by every panel (' + maps + ')');

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
  // captured at boot, before the sweep below moves every control
  const dflt = JSON.parse(JSON.stringify(win.__MOD.S));
  console.log('\n--- STRUCTURAL ---');
  const bad = structural();

  console.log('\n--- BOOT ---');
  console.log('  ' + (errors.length ? 'FAIL runtime errors: ' + errors.join('; ')
                                    : 'ok   page booted with no runtime errors'));

  console.log('\n--- EVERY CONTROL DRIVEN THROUGH ITS FULL RANGE ---');
  /* Ranges are read out of the page's own markup rather than hardcoded, so
     this works unchanged on every module and cannot drift from the sliders. */
  const ranges = {};
  for (const m2 of html.matchAll(/data-key="(\w+)"[^>]*min="([-\d.]+)"[^>]*max="([-\d.]+)"/g)) {
    ranges[m2[1]] = [parseFloat(m2[2]), parseFloat(m2[3])];
  }
  if (/data-nz=/.test(html)) ranges.nz = [0, 2];
  console.log('  controls found: ' + Object.keys(ranges).join(', '));
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
  const d = drive(win, doc, dflt);   // the page's own defaults, captured at boot
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

if (mode === 'axes') {
  /* Read the tick labels off the RENDERED page and check that the larger value
     sits higher up. The source-level lint checks that flip:true is present;
     this checks the picture the reader actually sees, which is the thing that
     was wrong. */
  const M = win.__MOD;
  let bad = 0;
  const DOWNWARD = /time|\bms\b|depth/i;
  console.log('\n canvas      vertical axis');
  for (const pane of ['p1', 'p2', 'p3', 'p4', 'p5']) {
    M.showTab(pane);
    resetDrawn(); CLIP = null; PENDING = null;
    CLIPSTACK.length = 0; TXSTACK.length = 0; TX = [1, 0, 0, 1, 0, 0];
    M.drawAll();
    for (const [canvas, list] of TEXTS) {
      // tick labels on a left axis: numeric, right-aligned, clustered in x
      /* SEIS.axisLeft right-aligns its tick labels, so anything else numeric —
         a column of module numbers, a table of values — is not an axis and must
         not be judged as one. */
      const numeric = list.filter((t) => t.align === 'right' &&
                                          /^-?[\u2212]?\d/.test(t.t.trim()) &&
                                          /^[-\u22120-9.,k]+$/.test(t.t.trim()));
      if (numeric.length < 3) continue;
      // group by x, take the leftmost column — that is the vertical axis
      const byX = {};
      numeric.forEach((t) => {
        const k = Math.round(t.x1 / 6) * 6;
        (byX[k] = byX[k] || []).push(t);
      });
      const cols = Object.keys(byX).map(Number).sort((a, b) => a - b);
      for (const c of cols.slice(0, 1)) {
        const col = byX[c];
        if (col.length < 3) continue;
        const vals = col.map((t) => ({
          v: parseFloat(t.t.replace(/\u2212/g, '-').replace(/,/g, '')),
          y: (t.y0 + t.y1) / 2, t: t.t,
        })).filter((q) => isFinite(q.v));
        if (vals.length < 3) continue;
        if (new Set(vals.map((q) => q.v)).size < 3) continue;
        vals.sort((a, b) => a.y - b.y);          // top to bottom
        const increasingDown = vals[vals.length - 1].v > vals[0].v;
        // is this a time or depth axis? find a rotated label near it
        const isDown = list.some((t) => DOWNWARD.test(t.t) && Math.abs(t.x1 - c) < 90);
        // Correct is: a value axis decreases downward (max at top), a time or
        // depth axis increases downward. Flag only the mismatch.
        if (increasingDown === isDown) continue;
        bad++;
        console.log('  ' + (canvas.id || '?').padEnd(11) +
          (increasingDown ? 'values INCREASE downward' : 'values DECREASE downward') +
          '  [' + vals.map((q) => q.t).join(' ') + ']' +
          (isDown ? '  but it is a time/depth axis' : '  but it is a value axis'));
      }
    }
  }
  console.log('  ' + (bad ? bad + ' axes drawn upside down'
    : 'ok   every rendered axis runs the right way'));
  console.log('');
  process.exit(bad ? 1 : 0);
}

if (mode === 'labels') {
  /* Do any two pieces of text land on top of each other? The geometry check
     cannot answer this — an axis label and a legend can overlap exactly while
     both sit comfortably inside the canvas, which is what happened when
     SEIS.axisBottom put its label 22 px below the box and legendRow put its
     first line at 26. */
  const M = win.__MOD;
  const widths = [1220, 1024, 900, 760, 520];
  let bad = 0;
  const seen = new Set();
  console.log('\n canvas      overlapping labels');
  for (const vw of widths) {
    Object.defineProperty(win.HTMLElement.prototype, 'clientWidth',
      { get() { return Math.min(vw - 48, 1220 - 48); }, configurable: true });
    Object.defineProperty(win, 'innerWidth', { get() { return vw; }, configurable: true });
    for (const pane of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      M.showTab(pane);
      resetDrawn(); CLIP = null; PENDING = null;
      CLIPSTACK.length = 0; TXSTACK.length = 0; TX = [1, 0, 0, 1, 0, 0];
      M.drawAll();
      for (const [canvas, list] of TEXTS) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
            const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
            if (ox > 3 && oy > 4) {
              const key = canvas.id + '|' + a.t + '|' + b.t;
              if (seen.has(key)) continue;
              seen.add(key);
              bad++;
              console.log('  ' + (canvas.id || '?').padEnd(11) +
                '"' + a.t + '"  over  "' + b.t + '"');
            }
          }
        }
      }
    }
  }
  console.log('  ' + (bad ? bad + ' label collisions' : 'ok   no two labels overlap'));
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

if (mode === 'm2') {
  /* The numbers module 02's exercises quote, measured off the running page. */
  const M = win.__MOD;
  const g = (id) => doc.getElementById(id).textContent;
  const base = { phi: 30, vcl: 0, th: 45, shvp: 2700, fl: 'gas', sat: 100, nz: 0,
                 kshale: false, kth: false, kclay: false };
  const go = (st, panes) => drive(win, doc, Object.assign({}, base, st), panes);

  console.log('\nTHE OBSERVATION');
  go({}, ['p1']);
  console.log('  measured amplitude ' + g('s1a') + '   your model ' + g('s1c') +
              '   ' + g('s1f'));

  console.log('\nEX 2 — the porosity/saturation contour');
  const a = go({}, ['p2']);
  console.log('  points ' + g('s2a') + '   porosity ' + g('s2b') +
              '   saturation ' + g('s2c') + '   Vp/Vs ' + g('s2d'));
  console.log('  ' + g('s2e'));

  console.log('\nEX 3 — what the shale costs');
  go({}, ['p3']);
  console.log('  shale known exactly : porosity ' + g('s3c'));
  console.log('  shale unknown +/-400: porosity ' + g('s3d'));
  console.log('  cost                : ' + g('s3e'));
  console.log('  implied reservoir impedance ' + g('s3f'));

  console.log('\nEX 4 — thickness');
  go({}, ['p4']);
  console.log('  tuning thickness ' + g('s4a'));
  console.log('  thinnest that fits ' + g('s4c'));
  console.log('  thickest that fits ' + g('s4d'));
  console.log('  porosity across it ' + g('s4e') + '   pore volume ratio ' + g('s4f'));

  console.log('\nEX 5 — the collapse');
  const stages = [['nothing known', {}],
                  ['+ shale', { kshale: true }],
                  ['+ thickness', { kshale: true, kth: true }],
                  ['+ clay', { kshale: true, kth: true, kclay: true }]];
  console.log('  what is known        models    porosity    saturation   Vp/Vs');
  for (const [label, st] of stages) {
    go(st, ['p5']);
    console.log('  ' + label.padEnd(20) + g('s5b').split(' ')[0].padStart(6) + '   ' +
      g('s5c').padStart(9) + '   ' + g('s5d').padStart(9) + '   ' + g('s5e'));
  }
  go({}, ['p5']);
  console.log('  models tried ' + g('s5a') + ';  ' + g('s5f'));

  console.log('\nTOLERANCE');
  for (const nz of [0, 1, 2]) {
    go({ nz }, ['p5']);
    console.log('  ' + ['clean', 'moderate', 'noisy'][nz].padEnd(9) + g('s5b') +
      '   saturation ' + g('s5d'));
  }

  console.log('\nBRINE MATCHES (models with no hydrocarbon at all)');
  go({}, ['p5']);
  const sw = M.sweep({});
  console.log('  survivors ' + sw.n.toLocaleString() +
    ';  gas ' + sw.byFluid.gas + ',  oil ' + sw.byFluid.oil + ',  brine ' + sw.byFluid.brine +
    '  (' + (100 * sw.byFluid.brine / sw.n).toFixed(1) + '% contain no hydrocarbon)');
  console.log('');
}

if (mode === 'm3') {
  const M = win.__MOD;
  const g = (id) => doc.getElementById(id).textContent;
  const base = { phi: 30, vcl: 0, shvp: 2700, fl: 'gas', sat: 100, dep: 2000, xmax: 3000, nz: 0 };
  const go = (st, panes) => drive(win, doc, Object.assign({}, base, st), panes);

  console.log('\nEX 1 — the same offset at three depths (3000 m offset)');
  for (const dep of [1200, 2000, 3200]) {
    go({ dep }, ['p1']);
    console.log('  depth ' + String(dep).padStart(4) + ' m   angle ' + g('s1c').padStart(7) +
                '   straight ray ' + g('s1d').padStart(7) + '   t0 ' + g('s1a'));
  }

  console.log('\nEX 2 — straight-ray error against offset, at 2000 m');
  for (const xmax of [1500, 3000, 4500]) {
    go({ xmax }, ['p1']);
    console.log('  offset ' + String(xmax).padStart(4) + ' m   true ' + g('s1c').padStart(7) +
                '   straight ' + g('s1d').padStart(7) + '   ' + g('s1e'));
  }

  console.log('\nEX 3 — Vs alone (brine and gas)');
  for (const [fl, sat, phi] of [['gas', 100, 30], ['brine', 0, 30], ['brine', 0, 20]]) {
    go({ fl, sat, phi }, ['p2']);
    console.log('  ' + (fl + ' ' + phi + '%').padEnd(11) + 'Vp/Vs ' + g('s2b') +
                '   spread at 0째 ' + g('s2c').padStart(12) + '   at 30째 ' + g('s2d'));
  }

  console.log('\nEX 4 — approximation errors, gas sand 30%');
  go({ xmax: 4500 }, ['p4']);
  console.log('  two-term at 20째 ' + g('s4a') + '   at 40째 ' + g('s4b'));
  console.log('  three-term at 40째 ' + g('s4c') + '   closer at 40째: ' + g('s4d'));
  // the full table the prose quotes
  const R = win.ROCK, sh = win.ROCK.mudrock(2700);
  const rock = M.rockAt({});
  for (const t of [20, 30, 40]) {
    const ex = R.zoeppritz(sh, rock, t);
    console.log('   ' + String(t).padStart(3) + '째  exact ' + ex.toFixed(4) +
      '   two-term err ' + (R.shuey(sh, rock, t, 2) - ex).toFixed(4) +
      '   three-term err ' + (R.shuey(sh, rock, t, 3) - ex).toFixed(4));
  }

  console.log('\nEX 5 — the two pairs');
  for (const nz of [0, 1, 2]) {
    go({ nz }, ['p5']);
    console.log('  ' + ['clean', 'moderate', 'noisy'][nz].padEnd(9) +
      'oil/brine 0째 ' + g('s5a') + ' 30째 ' + g('s5b') +
      '  |  gas/fizz 0째 ' + g('s5c') + ' 30째 ' + g('s5d'));
    console.log('           ' + g('s5f'));
  }
  const P = M.pairs();
  console.log('  Vp/Vs:  oil ' + P.oil.vpvs.toFixed(2) + '  brine ' + P.brn.vpvs.toFixed(2) +
    '  (diff ' + Math.abs(P.oil.vpvs - P.brn.vpvs).toFixed(2) + ')');
  console.log('          gas ' + P.gas.vpvs.toFixed(2) + '  fizz ' + P.fizz.vpvs.toFixed(2) +
    '  (diff ' + Math.abs(P.gas.vpvs - P.fizz.vpvs).toFixed(2) + ')');
  console.log('');
}

if (mode === 'm4') {
  const M = win.__MOD;
  const g = (id) => doc.getElementById(id).textContent;
  const base = { phi: 20, vcl: 0, shvp: 2700, fl: 'gas', sat: 100, amax: 30, nz: 0 };
  const go = (st, panes) => drive(win, doc, Object.assign({}, base, st), panes);

  console.log('\nEX 1 — the fit range moves the gradient, not the rock');
  go({}, ['p1']);
  console.log('  R0 ' + g('s1a') + '   G ' + g('s1b') + '   over ' + g('s1c'));
  console.log('  G at 0-20 ' + g('s1d') + '   G at 0-45 ' + g('s1e'));
  console.log('  ' + g('s1f'));
  const f20 = M.fit(win.ROCK.mudrock(2700), M.rockOf(20, 'gas', 100), 20);
  const f45 = M.fit(win.ROCK.mudrock(2700), M.rockOf(20, 'gas', 100), 45);
  console.log('  shift in G ' + Math.abs(f45.G - f20.G).toFixed(4) +
    ' = ' + (100 * Math.abs(f45.G - f20.G) / Math.abs(f20.G)).toFixed(1) + '% of G');
  console.log('  shift in R0 ' + Math.abs(f45.R0 - f20.R0).toFixed(4));

  console.log('\nEX 2 — your rock and the nearest wet rock (gas 30%)');
  go({ phi: 30 }, ['p2']);
  console.log('  ' + g('s2a') + '   nearest wet: ' + g('s2b'));
  console.log('  d intercept ' + g('s2c') + '   d gradient ' + g('s2d'));
  console.log('  near-trace difference ' + g('s2e') + '   far-trace ' + g('s2f'));

  console.log('\nEX 3 — distance off the wet trend, 30% porosity');
  go({ phi: 30 }, ['p3']);
  console.log('  trend: ' + g('s3a') + '   ' + g('s3b'));
  console.log('  brine ' + g('s3d') + '   gas ' + g('s3e'));
  for (const fl of ['oil']) {
    go({ phi: 30, fl, sat: 100 }, ['p3']);
    console.log('  ' + fl + '   ' + g('s3c'));
  }
  go({ phi: 30 }, ['p3']);
  console.log('  verdict for gas: ' + g('s3f'));

  console.log('\nEX 4 — two gas sands, two classes');
  go({}, ['p4']);
  console.log('  10% porosity: ' + g('s4c'));
  console.log('  30% porosity: ' + g('s4d'));
  console.log('  boundary: ' + g('s4e'));

  console.log('\nEX 5 — one sand, the shale slider');
  go({}, ['p5']);
  console.log('  2300 m/s: ' + g('s5a'));
  console.log('  2700 m/s: ' + g('s5b'));
  console.log('  3100 m/s: ' + g('s5c'));
  console.log('  classes:  ' + g('s5d'));
  console.log('  off-trend across the range: ' + g('s5f'));
  console.log('');
}

if (mode === 'm5') {
  const M = win.__MOD;
  const g = (id) => doc.getElementById(id).textContent;
  const base = { phi: 30, shvp: 2700, fl: 'gas', sat: 100, amax: 30, ntr: 16, nz: 1 };
  const go = (st, panes) => drive(win, doc, Object.assign({}, base, st), panes);

  console.log('\nEX 2 — the ratio is geometry, not data quality');
  for (const nz of [1, 2]) {
    go({ nz }, ['p2']);
    console.log('  ' + ['clean', 'moderate', 'noisy'][nz].padEnd(9) +
      'sigma(R0) ' + g('s2a') + '   sigma(G) ' + g('s2b') + '   ratio ' + g('s2c'));
  }

  console.log('\nEX 3 — the mute, and the fold');
  go({}, ['p3']);
  for (const amax of [40, 30, 20, 15]) {
    go({ amax }, ['p3']);
    console.log('  0-' + String(amax).padStart(2) + ' deg   gradient ' + g('s3b'));
  }
  for (const ntr of [16, 48]) {
    go({ ntr }, ['p3']);
    console.log('  ' + String(ntr).padStart(2) + ' traces  gradient ' + g('s3b'));
  }
  go({}, ['p3']);
  console.log('  ' + g('s3f'));

  console.log('\nEX 4 — the ellipse');
  go({}, ['p4']);
  console.log('  correlation ' + g('s4a') + '   along ' + g('s4b') + '   across ' + g('s4c'));
  console.log('  off-trend ' + g('s4d') + '   gradient ' + g('s4e'));
  console.log('  ' + g('s4f'));

  console.log('\nEX 5 — can the pairs still be separated?');
  for (const nz of [1, 2]) {
    go({ nz }, ['p5']);
    console.log('  ' + ['clean', 'moderate', 'noisy'][nz].padEnd(9) +
      'oil/brine ' + g('s5a') + ' = ' + g('s5b') +
      '    gas/fizz ' + g('s5c') + ' = ' + g('s5d'));
  }
  go({}, ['p5']);
  console.log('  angle needed for 2 sigma: ' + g('s5e'));
  console.log('  ' + g('s5f'));
  console.log('');
}

if (mode === 'm6') {
  const M = win.__MOD;
  const g = (id) => doc.getElementById(id).textContent;
  const base = { amax: 30, ntr: 16, nz: 1, sc: 0, trap: 0 };
  const go = (st, panes) => drive(win, doc, Object.assign({}, base, st), panes);

  console.log('\nSTEP 3 — what the second number buys');
  for (const nz of [0, 1, 2]) {
    go({ nz }, ['p3']);
    console.log('  ' + ['clean', 'moderate', 'noisy'][nz].padEnd(9) +
      'intercept ' + g('s3a').padStart(6) + '  both ' + g('s3b').padStart(6) +
      '  removed ' + g('s3c'));
    console.log('           Vp/Vs ' + g('s3d') + '     Sg ' + g('s3e'));
  }
  console.log('\nSTEP 3 — the mute');
  for (const amax of [15, 30, 45]) {
    go({ amax }, ['p3']);
    console.log('  0-' + String(amax).padStart(2) + '  ' + g('s3a').padStart(6) + ' -> ' +
      g('s3b').padStart(6) + '   removed ' + g('s3c'));
  }

  console.log('\nSTEP 4 — the four traps');
  for (let t = 0; t < 4; t++) {
    Object.assign(M.S, base, { trap: t }); M.recompute(); M.showTab('p4');
    console.log('  ' + g('s4a'));
    console.log('     expects  ' + g('s4c'));
    console.log('     actual   ' + g('s4d'));
    console.log('     ' + g('s4e') + '   [' + g('s4f') + ']');
  }

  console.log('\nSTEP 5 — the generated statement');
  for (const [amax, nz] of [[30, 1], [15, 1], [45, 1], [30, 2]]) {
    go({ amax, nz }, ['p5']);
    console.log('  mute ' + amax + ', ' + ['clean', 'moderate', 'noisy'][nz]);
    console.log('     hydrocarbon: ' + g('s5a'));
    console.log('     how much:    ' + g('s5b'));
    console.log('     next:        ' + g('s5e'));
  }
  go({}, ['p5']);
  console.log('\n  one-line version: ' + g('s5f'));
  console.log('');
}
