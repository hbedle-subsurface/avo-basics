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

console.log('\nMODULE 00 - PROSE AGAINST THE RUNNING PAGE\n');

const DEF = { off: 2400, zb: 2000, phi: 30 };
const d = readAt(DEF);

/* ---- exercise 1: offset is not angle ---- */
check('exercise 1: 2400 m offset over 2000 m depth is about 31 degrees',
  d.D.angle, 31, 0.3);
check('exercise 1: the same offset at 3000 m depth is about 21.8 degrees',
  readAt({ off: 2400, zb: 3000, phi: 30 }).D.angle, 21.8, 0.15);

/* ---- exercise 3: the two curves at normal incidence ---- */
check('exercise 3: brine sand at 0 degrees is about -0.011', d.D.bAt0, -0.011, 0.001);
check('exercise 3: gas sand at 0 degrees is about -0.162', d.D.gAt0, -0.162, 0.001);
check('exercise 3: a gap of about 0.151', d.D.gap0, 0.151, 0.001);

/* ---- exercise 4: the widest angle the sliders reach ---- */
const wide = readAt({ off: 3000, zb: 1500, phi: 30 });
check('exercise 4: 1500 m half-offset over 1500 m depth is exactly 45 degrees',
  wide.D.angle, 45, 0.01);
check('exercise 4: brine sand there is about -0.099', wide.D.bAtA, -0.099, 0.001);
check('exercise 4: gas sand there is about -0.315', wide.D.gAtA, -0.315, 0.001);
check('exercise 4: a gap of about 0.216', wide.D.gapA, 0.216, 0.001);
check('exercise 4: about 1.4 times the gap at normal incidence',
  wide.D.gapA / wide.D.gap0, 1.4, 0.05);

/* ---- step 3 prose: what the fluid does to Vp, Vs and the ratio ---- */
check('step 3: brine sand Vp is about 2732 m/s', d.D.brine.vp, 2732, 2);
check('step 3: gas sand Vp is about 2280 m/s', d.D.gas.vp, 2280, 2);
assertTrue('step 3: gas lowers Vp', d.D.gas.vp < d.D.brine.vp);
assertTrue('step 3: gas raises Vs slightly', d.D.gas.vs > d.D.brine.vs);
assertTrue('step 3: and by much less than it lowers Vp',
  (d.D.gas.vs - d.D.brine.vs) < 0.3 * (d.D.brine.vp - d.D.gas.vp));
assertTrue('step 3: so Vp/Vs falls sharply', d.D.gas.vpvs < d.D.brine.vpvs - 0.3);

/* the shear modulus is untouched by the fluid swap, so the whole of the Vs
   change has to be the density drop. This is the claim the Method tab makes. */
const vsFromRho = d.D.brine.vs * Math.sqrt(d.D.brine.rho / d.D.gas.rho);
check('method: the rise in Vs is entirely the density drop',
  d.D.gas.vs, vsFromRho, 1);

/* ---- step 2 panel 3: the spread, and the range one shot records ---- */
const NODE_DX = 300, NODES = 10;
const spread = (zb) => {
  const a = (x) => Math.atan2(x / 2, zb) * 180 / Math.PI;
  return [a(NODE_DX), a(NODES * NODE_DX)];
};
const sh2000 = spread(2000), sh3000 = spread(3000);
check('step 2: at 2000 m the spread records from 4.3 degrees', sh2000[0], 4.3, 0.05);
check('step 2: out to 36.9 degrees', sh2000[1], 36.9, 0.05);
check('exercise 1: at 3000 m that narrows to 2.9 degrees', sh3000[0], 2.9, 0.05);
check('exercise 1: and 26.6 degrees', sh3000[1], 26.6, 0.05);

/* ---- step 3 panel 3: what the fluid swap does to each property ---- */
const pct = (b, g) => (g - b) / b * 100;
const dVp = pct(d.D.brine.vp, d.D.gas.vp);
const dVs = pct(d.D.brine.vs, d.D.gas.vs);
const dRho = pct(d.D.brine.rho, d.D.gas.rho);
const dRat = pct(d.D.brine.vpvs, d.D.gas.vpvs);
check('step 3: gas takes Vp down 16.5%', dVp, -16.5, 0.1);
check('step 3: puts Vs up 6.4%', dVs, 6.4, 0.1);
check('step 3: takes density down 11.7%', dRho, -11.7, 0.1);
check('step 3: and takes Vp/Vs down 21.5%', dRat, -21.5, 0.1);
assertTrue('step 3: Vp/Vs moves further than either velocity did',
  Math.abs(dRat) > Math.abs(dVp) && Math.abs(dRat) > Math.abs(dVs));
assertTrue('step 3: the shale sits above both sands in Vp/Vs, so there is a contrast to reflect',
  d.D.shale.vpvs > d.D.brine.vpvs && d.D.brine.vpvs > d.D.gas.vpvs);

/* ---- exercise 5: the porosity trend, over the slider's range only ---- */
const lo0 = readAt({ off: 0, zb: 2000, phi: 18 });
const hi0 = readAt({ off: 0, zb: 2000, phi: 35 });
const lo45 = readAt({ off: 3000, zb: 1500, phi: 18 });
const hi45 = readAt({ off: 3000, zb: 1500, phi: 35 });
assertTrue('exercise 5: the 0 degree gap shrinks as porosity falls', lo0.D.gap0 < hi0.D.gap0);
assertTrue('exercise 5: but the wide-angle gap does not shrink with it',
  Math.abs(lo45.D.gapA - hi45.D.gapA) < 0.02);

let mono0 = true, prev0 = null, cross = null, ratios = [];
let g45lo = Infinity, g45hi = 0;
for (let phi = 18; phi <= 35; phi++) {
  const a = readAt({ off: 3000, zb: 1500, phi: phi });
  if (prev0 !== null && a.D.gap0 <= prev0) mono0 = false;
  prev0 = a.D.gap0;
  g45lo = Math.min(g45lo, a.D.gapA); g45hi = Math.max(g45hi, a.D.gapA);
  ratios.push(a.D.gapA / a.D.gap0);
  if (cross === null && a.D.bAt0 <= 0) cross = phi;
}
assertTrue('exercise 5: the 0 degree gap grows steadily with porosity across the slider', mono0);

/* The wide-angle gap is NOT monotonic — it has a shallow minimum near 24% —
   so the answer says it barely moves rather than claiming a trend. Check the
   band it stays inside, which is what "stays near 0.21" has to mean. */
assertTrue('exercise 5: the 45 degree gap stays inside a narrow band (max/min < 1.10)',
  g45hi / g45lo < 1.10);
check('exercise 5: and that band sits near 0.21', (g45lo + g45hi) / 2, 0.21, 0.01);

let ratioFalls = true;
for (let i = 1; i < ratios.length; i++) if (ratios[i] >= ratios[i - 1]) ratioFalls = false;
assertTrue('exercise 5: so the wide-angle gain over normal incidence falls as porosity rises',
  ratioFalls);
check('exercise 5: about 2.2 times at 18% porosity', ratios[0], 2.2, 0.06);
check('exercise 5: and about 1.3 times at 35%', ratios[ratios.length - 1], 1.3, 0.06);

check('exercise 5: the brine sand crosses zero at 0 degrees just below 30% porosity',
  cross, 30, 0.5);

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 00 matches the running page') + '\n');
process.exit(bad ? 1 : 0);
