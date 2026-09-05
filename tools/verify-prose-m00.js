/* Does module 00 still say true things?

   Every number quoted in its prose, exercises and Method tab is re-derived
   from the running page here. Exercise 5 in particular claimed a monotonic
   trend that the code did not have, which is what this script exists to
   catch.

   Run: node tools/verify-prose-m00.js
*/

const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, 'harness.js');

function readAt(state) {
  const out = execFileSync(process.execPath, [HARNESS, 'json', JSON.stringify(state || {})], {
    env: Object.assign({}, process.env, { MOD: 'beyond-normal-incidence.html' }),
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

console.log('\nMODULE 00 — PROSE AGAINST THE RUNNING PAGE\n');

const d0 = readAt({ phi: 30, ang: 0 });
const d40 = readAt({ phi: 30, ang: 40 });

/* ---- exercise 3: the two curves at normal incidence ---- */
check('exercise 3: brine sand at 0° is about -0.011', d0.D.bAt0, -0.011, 0.001);
check('exercise 3: gas sand at 0° is about -0.162', d0.D.gAt0, -0.162, 0.001);
check('exercise 3: a gap of about 0.151', d0.D.gap0, 0.151, 0.001);

/* ---- exercise 4: the same two at the far end ---- */
check('exercise 4: brine sand at 40° is about -0.083', d40.D.bAtA, -0.083, 0.001);
check('exercise 4: gas sand at 40° is about -0.282', d40.D.gAtA, -0.282, 0.001);
check('exercise 4: a gap of about 0.199', d40.D.gapA, 0.199, 0.001);
check('exercise 4: the gap grew by about a third', d40.D.gapA / d40.D.gap0, 1.33, 0.05);

/* ---- exercise 5: the porosity trend, and the sign change ---- */
const lo0 = readAt({ phi: 18, ang: 0 });
const hi0 = readAt({ phi: 35, ang: 0 });
const lo40 = readAt({ phi: 18, ang: 40 });
const hi40 = readAt({ phi: 35, ang: 40 });
check('exercise 5: the 0° gap runs 0.172 at 35% porosity', hi0.D.gap0, 0.172, 0.001);
check('exercise 5: down to 0.100 at 18% porosity', lo0.D.gap0, 0.100, 0.001);
check('exercise 5: the 40° gap runs 0.212 at 35% porosity', hi40.D.gapA, 0.212, 0.001);
check('exercise 5: down to 0.176 at 18% porosity', lo40.D.gapA, 0.176, 0.001);

/* The trend is only claimed over the slider's range, so check it over that
   range rather than asserting it in general — it does not hold below 18%,
   which is why the slider stops there. */
let mono0 = true, mono40 = true, prev0 = null, prev40 = null;
for (let phi = 18; phi <= 35; phi++) {
  const a = readAt({ phi: phi, ang: 0 });
  const b = readAt({ phi: phi, ang: 40 });
  if (prev0 !== null && a.D.gap0 <= prev0) mono0 = false;
  if (prev40 !== null && b.D.gapA <= prev40) mono40 = false;
  prev0 = a.D.gap0; prev40 = b.D.gapA;
}
assertTrue('exercise 5: the 0° gap grows with porosity across the whole slider', mono0);
assertTrue('exercise 5: the 40° gap does too, across the whole slider', mono40);

/* the sign change the answer points at */
let cross = null;
for (let phi = 18; phi <= 35; phi++) {
  const a = readAt({ phi: phi, ang: 0 });
  if (a.D.bAt0 <= 0) { cross = phi; break; }
}
check('exercise 5: the brine sand crosses zero at 0° just below 30% porosity', cross, 30, 0.5);

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 00 matches the running page') + '\n');
process.exit(bad ? 1 : 0);
