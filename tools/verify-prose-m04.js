/* Does module 04 still say true things?

   Every number quoted in its prose, exercises and key points is re-derived
   from the running page. The first draft sampled the traces at 4 ms, which
   read the peak amplitude about 10% low and made the step 5 numbers wrong;
   the amplitude checks below would have caught that on their own.

   Run: node tools/verify-prose-m04.js
*/

const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, 'harness.js');

function readAt(state) {
  const out = execFileSync(process.execPath, [HARNESS, 'json', JSON.stringify(state || {})], {
    env: Object.assign({}, process.env, { MOD: 'offset-and-the-gather.html' }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
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

console.log('\nMODULE 04 - PROSE AGAINST THE RUNNING PAGE\n');

const DEF = { depth: 2000, maxoff: 3000, v0: 1600, grad: 50, freq: 30 };
const d = readAt(DEF);

/* ---- step 1: the gather ---- */
check('step 1: twenty-four traces', d.D.tr.length, 24, 0);
check('step 1: the zero-offset time is 1.942 s', d.D.t0, 1.942, 0.002);

/* ---- step 2 and exercise 1: offset is not angle ---- */
check('step 2: the straight-ray angle at 3000 m is 36.9 degrees', d.D.farStr, 36.9, 0.1);
check('step 2: the true angle there is 47.0', d.D.farTrue, 47.0, 0.1);
check('step 2: so the shortcut is 10.1 degrees low', d.D.angErr, 10.1, 0.15);
const at2000 = d.D.tr.reduce((best, q) =>
  Math.abs(q.x - 2000) < Math.abs(best.x - 2000) ? q : best, d.D.tr[0]);
check('step 2: and 6.6 degrees low near 2000 m offset',
  at2000.thTrue - at2000.thStr, 6.6, 0.2);

const flat = readAt(Object.assign({}, DEF, { grad: 0 }));
assertTrue('exercise 1: with no gradient the two angles agree exactly',
  Math.abs(flat.D.angErr) < 1e-6);
assertTrue('exercise 1: so the whole discrepancy is the gradient',
  Math.abs(d.D.angErr) > 5 && Math.abs(flat.D.angErr) < 1e-6);

/* ---- exercise 2: the offset needed for a given angle ---- */
check('exercise 2: 30 degrees is reached at about 1780 m at 2000 m depth',
  readAt(Object.assign({}, DEF, { maxoff: 4000 })).D.off30, 1780, 15);
check('exercise 2: and at about 2820 m at 3500 m depth',
  readAt(Object.assign({}, DEF, { depth: 3500, maxoff: 4000 })).D.off30, 2820, 20);

/* ---- step 3 and exercise 3: moveout ---- */
check('step 3: the moveout at the longest offset is 477 ms',
  d.D.moveoutFar * 1000, 477, 2);
check('step 3: the RMS velocity is 2080 m/s', d.D.vrms, 2080, 3);
assertTrue('step 3: the three velocities are all different',
  d.D.vrms !== d.D.ob.vavg && d.D.ob.vavg !== d.D.ob.vint);
assertTrue('step 3: RMS is the largest of the three below the interval velocity',
  d.D.vrms > d.D.ob.vavg && d.D.ob.vint > d.D.vrms);
check('exercise 3: about fourteen times the wavelet length',
  d.D.moveoutFar * 1000 / d.D.wavLen, 14.3, 0.5);

/* ---- step 4 and exercise 4: stretch ---- */
check('exercise 4: the far trace is stretched by 1.25', d.D.stretchFar, 1.25, 0.005);
check('exercise 4: so 30 Hz arrives looking like 24 Hz', d.D.freqFar, 24.1, 0.2);
check('exercise 4: a 1.20 mute cuts in at 2679 m', d.D.off125, 2679, 15);
check('exercise 4: where the angle is 42.9 degrees', d.D.ang125, 42.9, 0.3);
check('exercise 4: removing three of the twenty-four traces', d.D.mutedBy125, 3, 0);
assertTrue('step 4: the stretch grows with offset',
  d.D.tr[23].stretch > d.D.tr[12].stretch &&
  d.D.tr[12].stretch > d.D.tr[1].stretch);
assertTrue('step 4: and is smaller for a deeper target at the same offset',
  readAt(Object.assign({}, DEF, { depth: 3500 })).D.stretchFar < d.D.stretchFar);

/* ---- step 5 and exercise 5: what stacking costs ---- */
check('exercise 5: the near amplitude is -0.161', d.D.ampNear, -0.161, 0.002);
check('exercise 5: the far amplitude is -0.328', d.D.ampFar, -0.328, 0.003);
check('exercise 5: so it roughly doubles across the gather',
  Math.abs(d.D.ampFar / d.D.ampNear), 2.0, 0.1);
check('exercise 5: and the stack reports -0.223', d.D.stackAmp, -0.223, 0.003);
assertTrue('step 5: the stack sits between the near and far amplitudes',
  d.D.stackAmp < d.D.ampNear && d.D.stackAmp > d.D.ampFar);
check('step 5: the angle range stacked over runs to 47 degrees', d.D.angHi, 47.0, 0.2);

/* the near trace is zero offset, so its amplitude must be the normal-incidence
   coefficient — this is what caught the 4 ms sampling error */
assertTrue('step 5: the zero-offset trace measures the normal-incidence coefficient',
  Math.abs(d.D.ampNear - d.D.tr[0].r) < 0.002);

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 04 matches the running page') + '\n');
process.exit(bad ? 1 : 0);
