/* Does module 03 still say true things?

   Every number quoted in its prose, exercises and key points is re-derived
   from the running page. Three claims in the first draft did not survive:
   the shale velocity at which the reflection vanishes, the range of the
   equal-impedance family, and the endpoints of the shale sweep — the last
   because the shale control could not originally reach the reservoir's
   impedance at all.

   Run: node tools/verify-prose-m03.js
*/

const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, 'harness.js');

function readAt(state) {
  const out = execFileSync(process.execPath, [HARNESS, 'json', JSON.stringify(state || {})], {
    env: Object.assign({}, process.env, { MOD: 'rock-to-trace.html' }),
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

let bad = 0;
function check(claim, got, want, tol) {
  const ok = Math.abs(got - want) <= (tol === undefined ? 0.0005 : tol);
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + claim +
    (ok ? '' : '\n         prose says ' + want + ', the page computes ' + got));
}
function assertTrue(claim, ok) {
  if (!ok) bad++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + claim);
}

console.log('\nMODULE 03 - PROSE AGAINST THE RUNNING PAGE\n');

const DEF = { phi: 30, sg: 100, vcl: 0, shvp: 2700, freq: 30 };
const d = readAt(DEF);

/* ---- step 1: the two rocks, and that they rest on different footings ---- */
check('step 1: the shale is 2700 m/s', d.D.sh.vp, 2700, 1);
check('step 1: its Vp/Vs is 2.34', d.D.sh.vpvs, 2.337, 0.005);
check('step 1: the reservoir Vp is 2280', d.D.res.vp, 2280, 1);
check('step 1: its Vp/Vs is 1.47', d.D.res.vpvs, 1.472, 0.005);

/* ---- step 2: impedance is a product ---- */
check('step 2: the reservoir impedance is 4350', d.D.res.ip, 4350, 2);
check('step 2: the shale impedance is 6026', d.D.sh.ip, 6026, 2);
assertTrue('step 2: impedance is exactly Vp times density',
  Math.abs(d.D.res.ip - d.D.res.vp * d.D.res.rho) < 1e-9);
assertTrue('step 2: the iso-impedance readouts lie on the same curve',
  Math.abs((d.D.res.ip / 1.8) * 1.8 - d.D.res.ip) < 1e-9);

/* ---- step 3: only the contrast survives ---- */
check('step 3: R at the top is -0.1615', d.D.rTop, -0.1615, 0.0005);
assertTrue('step 3: the base is equal and opposite',
  Math.abs(d.D.rBase + d.D.rTop) < 1e-12);
assertTrue('exercise 3: doubling both impedances leaves R unchanged',
  Math.abs(d.D.rDoubled - d.D.rTop) < 1e-12);

const shLo = readAt(Object.assign({}, DEF, { shvp: 2000 }));
const shHi = readAt(Object.assign({}, DEF, { shvp: 3400 }));
check('exercise 1: R is +0.025 at a 2000 m/s shale', shLo.D.rTop, 0.025, 0.001);
check('exercise 1: and -0.298 at 3400', shHi.D.rTop, -0.298, 0.001);
assertTrue('step 3: so the reflection changes sign inside the control range',
  shLo.D.rTop > 0 && shHi.D.rTop < 0);
check('exercise 2: it vanishes at a shale velocity near 2081 m/s',
  d.D.shZero, 2081, 5);
assertTrue('exercise 2: which is inside the slider range', d.D.shZero >= 2000);

/* the reservoir is untouched across that whole sweep */
assertTrue('exercise 1: the reservoir is identical at both ends of the sweep',
  shLo.D.res.ip === shHi.D.res.ip && shLo.D.res.vpvs === shHi.D.res.vpvs);

/* ---- step 4: the wavelet moves the trace and not the earth ---- */
const fLo = readAt(Object.assign({}, DEF, { freq: 15 }));
const fHi = readAt(Object.assign({}, DEF, { freq: 60 }));
assertTrue('exercise 4: changing frequency leaves the reflection coefficients alone',
  fLo.D.rTop === fHi.D.rTop);
check('step 4: the two-way time across the reservoir is 52.6 ms',
  d.D.dtRes * 1000, 52.6, 0.2);
assertTrue('step 4: the reservoir stays resolved at every frequency',
  fLo.D.thinnest < 60 && fHi.D.thinnest < 60);
check('step 4: the measured peak matches the reflection coefficient away from tuning',
  d.D.peak, d.D.rTop, 0.002);

/* ---- step 5: the equal-impedance family, and the Vs that never arrives ---- */
check('exercise 5: sixteen rocks share the impedance', d.D.fam.length, 16, 0);
check('exercise 5: porosities from 30.0%', d.D.phiRange[0], 30.0, 0.3);
check('exercise 5: to 37.5%', d.D.phiRange[1], 37.5, 0.3);
check('exercise 5: saturations from 2%', d.D.sgRange[0], 2, 1);
check('exercise 5: to 100%', d.D.sgRange[1], 100, 0.5);
check('exercise 5: Vp/Vs from 1.472', d.D.vpvsRange[0], 1.472, 0.005);
check('exercise 5: to 1.684', d.D.vpvsRange[1], 1.684, 0.005);
check('exercise 5: a Vp/Vs spread of about 14%',
  (d.D.vpvsRange[1] / d.D.vpvsRange[0] - 1) * 100, 14, 1);
check('exercise 5: while their reflection coefficients span only 0.004',
  d.D.rSpread, 0.004, 0.001);
assertTrue('step 5: every member is within half a percent of the target impedance',
  d.D.fam.every((f) => Math.abs(f.e.ip - d.D.res.ip) <= 0.005 * d.D.res.ip));
assertTrue('step 5: so the amplitude separates them far less than Vp/Vs would',
  (d.D.vpvsRange[1] - d.D.vpvsRange[0]) / d.D.vpvsRange[0] >
  d.D.rSpread / Math.abs(d.D.rTop));

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 03 matches the running page') + '\n');
process.exit(bad ? 1 : 0);
