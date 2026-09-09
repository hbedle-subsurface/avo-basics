/* Harness: open a real module with its own scripts running, put the control
   panel into a second window, and drive the module from the clone. It checks
   the part that cannot be read off the source — that a slider moved in the
   second window reaches the module in the first, and that the panel comes back
   when the window closes.

   The second window is a second jsdom document, because the clone is built with
   importNode into that window and has to behave like a real one.

   Run: node tools/harness-panelout.js [modules/what-survives.html] */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { JSDOM, VirtualConsole } = require('jsdom');

const MOD = process.argv[2] || 'modules/rock-to-trace.html';

/* ---- a canvas context that records nothing and throws nothing ---- */
function stubCtx() {
  const noop = () => {};
  return {
    canvas: { width: 900, height: 400 },
    save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, arc: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, setLineDash: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop,
    drawImage: noop, putImageData: noop,
    measureText: (t) => ({ width: String(t).length * 6 }),
    fillText: noop, strokeText: noop,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
}

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (m) => errors.push('console.error: ' + m));

/* jsdom will not fetch ../assets, so the shared files are inlined. panelout.js
   goes in with them rather than being evaluated afterwards, so that it starts
   the same way it does in a browser. */
const html = fs.readFileSync(path.join(ROOT, MOD), 'utf8')
  .replace('<script src="../assets/seismic.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/seismic.js'), 'utf8') + '</script>')
  .replace('<script src="../assets/rockphysics.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/rockphysics.js'), 'utf8') + '</script>')
  .replace('<script src="../assets/count.js"></script>', '')
  .replace('<script src="../assets/panelout.js"></script>',
    '<script>' + fs.readFileSync(path.join(ROOT, 'assets/panelout.js'), 'utf8') + '</script>');

/* The second window. Nothing is drawn in it, but importNode, getElementById
   and the events fired on the clone all have to work. */
const sub = new JSDOM('<!doctype html><html><head></head><body></body></html>',
  { pretendToBeVisual: true });
const subWin = sub.window;
subWin.closed = false;
subWin.focus = () => {};
subWin.close = () => { subWin.closed = true; };
subWin.scrollTo = () => {};
subWin.HTMLCanvasElement.prototype.getContext = function () { return stubCtx(); };
subWin.Element.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, left: 0, top: 0, right: 900, bottom: 400, width: 900, height: 400 };
};

const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  url: 'https://example.org/' + MOD,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function () { return stubCtx(); };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 900; } });
    Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 400; } });
    const origCS = window.getComputedStyle;
    window.getComputedStyle = function (el) {
      const cs = origCS.call(window, el);
      return new Proxy(cs, {
        get(t, k) {
          if (k === 'paddingLeft' || k === 'paddingRight') return '26px';
          const v = t[k];
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
    };
    window.Element.prototype.getBoundingClientRect = function () {
      return { x: 0, y: 0, left: 0, top: 0, right: 900, bottom: 400, width: 900, height: 400 };
    };
    window.open = () => subWin;
  },
});
const win = dom.window;

module.exports = { win, subWin, errors };

if (require.main === module) {
  const results = [];
  const check = (name, cond) => results.push([name, !!cond]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  setTimeout(async () => {
    const doc = win.document;
    if (!doc.querySelector('.labhead')) {
      console.log('NO HEADER PANEL IN THIS MODULE');
      errors.forEach((e) => console.log('  ' + e));
      process.exit(1);
    }

    const openBtn = doc.querySelector('.po-panel-open');
    check('button on the header panel', openBtn && openBtn.closest('.labhead'));
    check('button on the last caption line', openBtn && openBtn.parentElement.classList.contains('cap'));
    if (!openBtn) return report();

    openBtn.click();
    const CR = () => subWin.document.querySelector('#poWrap .labhead');
    check('panel cloned into the second window', !!CR());
    check('panel parked in a zero-height wrapper',
      doc.querySelector('.labhead').parentElement.getAttribute('style') === 'height:0;overflow:hidden');
    check('bring-them-back bar left in its place', /Bring them back/.test(doc.body.textContent));
    check('button disabled while the window is open', openBtn.disabled === true);

    /* Every slider in the panel, driven from the clone. The module owns the
       readout beside each one, so a readout that changes is the module having
       seen the move. */
    const sliders = CR().querySelectorAll('input[type="range"]');
    let moved = 0, seen = 0;
    for (let i = 0; i < sliders.length; i++) {
      const c = sliders[i];
      const real = doc.getElementById(c.id);
      if (!real || !c.id) continue;
      const before = doc.body.textContent;
      const lo = Number(c.min), hi = Number(c.max);
      const target = String(Number(c.value) === hi ? lo : hi);
      c.value = target;
      c.dispatchEvent(new subWin.Event('input', { bubbles: true }));
      moved++;
      if (real.value === target) seen++;
      if (doc.body.textContent === before) {
        results.push(['slider ' + c.id + ' changed something in the module', false]);
      }
    }
    check('every slider in the clone reached its counterpart (' + seen + ' of ' + moved + ')',
      moved > 0 && seen === moved);

    /* Segmented buttons, where the panel has any. */
    const btn = CR().querySelector('button:not(.po-panel-open)');
    if (btn) {
      /* Whether the module changes anything is its own business — several of
         these buttons are already the selected one. What has to be true is
         that the click arrives on the button in the first window. */
      const all = CR().querySelectorAll('*');
      const idx = Array.prototype.indexOf.call(all, btn);
      const realBtn = doc.querySelector('.labhead').querySelectorAll('*')[idx];
      let clicked = false;
      realBtn.addEventListener('click', () => { clicked = true; });
      btn.dispatchEvent(new subWin.Event('click', { bubbles: true }));
      check('a button in the clone clicked its counterpart', clicked);
    } else {
      results.push(['no buttons in this panel, nothing to forward', true]);
    }

    /* A press on the cloned map reaches the real one. The modules read the
       position out of the event, so the coordinates have to arrive with it. */
    const cCanvas = CR().querySelector('canvas');
    if (cCanvas && cCanvas.id) {
      const realCanvas = doc.getElementById(cCanvas.id);
      let got = null;
      realCanvas.addEventListener('mousedown', (e) => { got = e; });
      const ev = new subWin.MouseEvent('pointerdown',
        { bubbles: true, clientX: 300, clientY: 120, buttons: 1 });
      cCanvas.dispatchEvent(ev);
      check('a press on the cloned map reached the real one',
        got && got.clientX > 0 && got.clientY > 0);
    }

    await wait(300);
    const cv = CR().querySelector('.val');
    if (cv) {
      const rv = doc.getElementById(cv.id);
      check('readouts mirrored back into the clone', !rv || cv.textContent === rv.textContent);
    }

    /* Closing the window puts the panel back where it was. */
    doc.querySelectorAll('button').forEach((b) => {
      if (b.textContent === 'Bring them back') b.click();
    });
    check('panel back in the page', !doc.querySelector('.labhead').parentElement.getAttribute('style'));
    check('button enabled again', doc.querySelector('.po-panel-open').disabled === false);
    check('no page errors', errors.length === 0);

    report();

    function report() {
      console.log(MOD);
      let bad = 0;
      results.forEach(([n, c]) => { if (!c) bad++; console.log('  ' + (c ? 'ok   ' : 'FAIL ') + n); });
      if (errors.length) errors.forEach((e) => console.log('  ' + e));
      console.log(bad ? '  ' + bad + ' failed' : '  all checks passed');
      process.exit(bad ? 1 : 0);
    }
  }, 200);
}
