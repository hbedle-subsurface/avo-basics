/* Does module 02 still say true things?

   Every number quoted in its prose, exercises, key points and Method tab is
   re-derived from the running page. Two claims in the first draft did not
   survive this and were rewritten: the porosity trend in step 5, which is
   nearly flat in m/s and only meaningful relative to the brine velocity, and
   the saturation at which Vp bottoms out.

   Run: node tools/verify-prose-m02.js
*/

const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, 'harness.js');

function readAt(state) {
  const out = execFileSync(process.execPath, [HARNESS, 'json', JSON.stringify(state || {})], {
    env: Object.assign({}, process.env, { MOD: 'fluid-in-the-pores.html' }),
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

console.log('\nMODULE 02 - PROSE AGAINST THE RUNNING PAGE\n');

const DEF = { phi: 30, vcl: 0, pres: 23, temp: 64, sg: 100 };
const d = readAt(DEF);

/* ---- step 1: what the three fluids are ---- */
check('step 1: brine is roughly 2.7 GPa', d.D.fl.brine.K, 2.7, 0.05);
check('step 1: oil is about half of that', d.D.fl.oil.K, 1.44, 0.02);
check('step 1: gas is around 0.05 GPa', d.D.fl.gas.K, 0.051, 0.002);
check('step 1: gas is some fifty times softer than brine', d.D.softerBy, 53, 3);
check('step 1: brine density near 1.0', d.D.fl.brine.rho, 1.015, 0.01);
check('step 1: oil near 0.8', d.D.fl.oil.rho, 0.815, 0.01);
check('step 1: gas near 0.18', d.D.fl.gas.rho, 0.176, 0.01);
check('step 1: the grains are 37 GPa for comparison', d.D.fr.min.K, 37, 0.01);
assertTrue('step 1: every fluid is softer than the dry frame',
  d.D.fl.brine.K < d.D.dry.K);

/* ---- step 2: Gassmann raises K and leaves G exactly alone ---- */
assertTrue('step 2: G is identical in all four cases',
  d.D.dry.G === d.D.brine.G && d.D.brine.G === d.D.oil.G &&
  d.D.oil.G === d.D.gas.G);
check('step 2: G is 4.579 GPa', d.D.fr.G, 4.579, 0.002);
check('step 2: the dry frame K is 3.678 GPa', d.D.dry.K, 3.678, 0.002);
check('step 2: brine lifts it to 10.011', d.D.brine.K, 10.011, 0.005);
check('step 2: oil to 7.293', d.D.oil.K, 7.293, 0.005);
check('step 2: gas to 3.815', d.D.gas.K, 3.815, 0.005);
assertTrue('step 2: brine lifts K by more than the fluid modulus itself',
  (d.D.brine.K - d.D.dry.K) > d.D.fl.brine.K);
assertTrue('step 2: a stiffer fluid lifts K further',
  d.D.brine.K > d.D.oil.K && d.D.oil.K > d.D.gas.K);

/* ---- step 3 and exercises 1 and 2 ---- */
check('exercise 1: Vs is 1571 dry', d.D.dry.vs, 1571, 1);
check('exercise 1: 1456 with brine', d.D.brine.vs, 1456, 1);
check('exercise 1: 1477 with oil', d.D.oil.vs, 1477, 1);
check('exercise 1: 1549 with gas', d.D.gas.vs, 1549, 1);
assertTrue('step 3: the gas case has the highest Vs of the three saturated ones',
  d.D.gas.vs > d.D.oil.vs && d.D.oil.vs > d.D.brine.vs);
check('step 3: Vp is 2732 with brine', d.D.brine.vp, 2732, 1);
check('step 3: and 2280 with gas', d.D.gas.vp, 2280, 1);
check('exercise 2: the Vs ratio is 1.064', d.D.vsRatio, 1.064, 0.001);
check('exercise 2: the densities are 2.160 and 1.908', d.D.brine.rho, 2.160, 0.002);
check('exercise 2: gas case density', d.D.gas.rho, 1.908, 0.002);
assertTrue('exercise 2: the Vs ratio equals the square root of the density ratio',
  Math.abs(d.D.vsRatio - d.D.vsFromRho) < 1e-9);

/* ---- step 4 and exercises 3 and 4: the saturation curve ---- */
check('exercise 3: Vp with no gas is 2732', d.D.vp0, 2732, 1);
check('exercise 3: at 5% gas it is 2337', d.D.vp5, 2337, 1);
check('exercise 3: at 100% gas it is 2280', d.D.vp100, 2280, 1);
check('exercise 3: the first 5% covers about 87% of the drop', d.D.share5, 87, 1);
check('exercise 4: Vp bottoms out near 32% gas', d.D.vpMinAt, 32, 1);
check('exercise 4: at about 2214 m/s', d.D.vpMin, 2214, 2);
assertTrue('exercise 4: and rises again toward full gas saturation',
  d.D.vp100 > d.D.vpMin);
assertTrue('step 4: the fluid density falls in a straight line with saturation',
  (function () {
    const r = d.D.rhoFlSg, n = r.length;
    for (let i = 1; i < n - 1; i++) {
      const lin = r[0] + (r[n - 1] - r[0]) * (i / (n - 1));
      if (Math.abs(r[i] - lin) > 1e-9) return false;
    }
    return true;
  })());
assertTrue('step 4: while the fluid modulus does not',
  d.D.KflSg[10] < d.D.KflSg[0] * 0.5);

/* ---- step 5 and exercise 5: where the effect fades ---- */
check('step 5: the separation is 16.5% of the brine velocity here', d.D.pct, 16.5, 0.2);
check('exercise 5: 11.5% at 15% porosity', d.D.loPhi.pct, 11.5, 0.2);
check('exercise 5: 18.1% at 35% porosity', d.D.hiPhi.pct, 18.1, 0.2);
check('exercise 5: 408 m/s at 15% porosity', d.D.loPhi.abs, 408, 2);
check('exercise 5: 462 m/s at 35% porosity', d.D.hiPhi.abs, 462, 2);
assertTrue('step 5: so the absolute separation barely moves with porosity',
  Math.abs(d.D.hiPhi.abs - d.D.loPhi.abs) < 80);
check('exercise 5: 25.3% at 5 MPa', d.D.loP.pct, 25.3, 0.3);
check('exercise 5: down to 12.8% at 50 MPa', d.D.hiP.pct, 12.8, 0.3);
assertTrue('step 5: pressure is the stronger of the two trends',
  (d.D.loP.pct - d.D.hiP.pct) > (d.D.hiPhi.pct - d.D.loPhi.pct));

let monoPhi = true, monoP = true;
for (let i = 1; i < d.D.dPctPhi.length; i++) {
  if (d.D.dPctPhi[i] <= d.D.dPctPhi[i - 1]) monoPhi = false;
  if (d.D.dPctPres[i] >= d.D.dPctPres[i - 1]) monoP = false;
}
assertTrue('step 5: the relative separation rises with porosity throughout', monoPhi);
assertTrue('step 5: and falls with pressure throughout', monoP);

/* gas stiffening, which is the mechanism step 5 names */
const p5 = readAt(Object.assign({}, DEF, { pres: 5 }));
const p50 = readAt(Object.assign({}, DEF, { pres: 50 }));
assertTrue('step 5: gas K is under a hundredth of a GPa at 5 MPa',
  p5.D.fl.gas.K < 0.01);
check('step 5: and around twenty times that by 50 MPa',
  p50.D.fl.gas.K / p5.D.fl.gas.K, 20.8, 1.5);

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 02 matches the running page') + '\n');
process.exit(bad ? 1 : 0);
