/* Does module 01 still say true things?

   Every number quoted in the prose, the exercises and the Method tab is
   re-derived here from the running page and compared with the claim. If the
   physics or the defaults change, this fails rather than letting the text
   quietly become wrong.

   Run: node tools/verify-prose-m01.js
*/

const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, 'harness.js');

/* The harness owns the jsdom boot and the canvas stub. Reuse it by asking it
   for a readout at a given state rather than duplicating any of that here. */
function readAt(state) {
  const out = execFileSync(process.execPath, [HARNESS, 'json', JSON.stringify(state)], {
    env: Object.assign({}, process.env, { MOD: 'the-echo.html' }),
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

let bad = 0;
function check(claim, got, want, tol) {
  const ok = Math.abs(got - want) <= (tol === undefined ? 0.5 : tol);
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + claim +
    (ok ? '' : '\n         prose says ' + want + ', the page computes ' + got));
}

console.log('\nMODULE 01 — PROSE AGAINST THE RUNNING PAGE\n');

const DEFAULTS = { ztop: 1200, thk: 60, v2: 3200, v1: 2400 };
const d = readAt(DEFAULTS);

/* ---- step 1 ---- */
check('step 1: 1200 m at 2400 m/s is 500 ms down',
  d.D.tTop / 2 * 1000, 500, 0.5);
check('step 1: and 1.000 s for the round trip',
  d.D.tTop, 1.0, 0.001);

/* ---- step 4 ---- */
check('step 4: a 40 ms gap spans about 32 m between 2900 and 4500 m/s',
  (4500 - 2900) * 0.040 / 2, 32, 0.5);

/* ---- method ---- */
check('method: the Ricker peak-to-trough separation is 13.0 ms at 30 Hz',
  Math.sqrt(6) / (2 * Math.PI * 30) * 1000, 13.0, 0.05);

/* ---- exercise 1: one arrival time fixes only the depth/velocity ratio ---- */
check('exercise 1: 1200 m at 2400 m/s gives 1.000 s',
  d.D.tTop, 1.0, 0.001);
check('exercise 1: 1000 m at 2000 m/s gives the same time',
  readAt(Object.assign({}, DEFAULTS, { ztop: 1000, v1: 2000 })).D.tTop, 1.0, 0.001);
check('exercise 1: 1400 m at 2800 m/s gives the same time',
  readAt(Object.assign({}, DEFAULTS, { ztop: 1400, v1: 2800 })).D.tTop, 1.0, 0.001);

/* ---- exercise 2: which velocity moves what ---- */
const slowOver = readAt(Object.assign({}, DEFAULTS, { v1: 1800 }));
check('exercise 2: the overburden velocity leaves the gap between the echoes alone',
  slowOver.D.dtLayer * 1000, d.D.dtLayer * 1000, 0.001);
const fastLayer = readAt(Object.assign({}, DEFAULTS, { v2: 4500 }));
check('exercise 2: the layer velocity leaves the first arrival alone',
  fastLayer.D.tTop, d.D.tTop, 0.001);

/* ---- exercise 3: one gap, three velocities ---- */
check('exercise 3: 60 m at 3200 m/s gives a 37.5 ms gap',
  d.D.dtLayer * 1000, 37.5, 0.05);
check('exercise 3: that gap implies 54 m at 2900 m/s',
  2900 * d.D.dtLayer / 2, 54, 0.5);
check('exercise 3: that gap implies 84 m at 4500 m/s',
  4500 * d.D.dtLayer / 2, 84, 0.5);

/* ---- exercises 4 and 5: the lens, and where it stops being resolved ---- */
check('exercise 4: the thinnest resolved part of the lens is about 21 m',
  d.D.thinnest, 21, 0.5);
check('exercise 4: against a maximum lens thickness of 60 m',
  Math.max.apply(null, d.D.lens), 60, 0.5);
check('exercise 4: ten of the sixty traces record a merged event',
  d.D.merged, 10, 0);
check('exercise 5: raising the layer velocity to 4500 m/s widens the merged zone',
  fastLayer.D.merged > d.D.merged ? 1 : 0, 1, 0);

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 01 matches the running page') + '\n');
process.exit(bad ? 1 : 0);
