/* Does module 01 still say true things?

   Every number quoted in its prose, exercises, key points and Method tab is
   re-derived from the running page and compared with the claim.

   Run: node tools/verify-prose-m01-rock.js
*/

const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS = path.join(__dirname, 'harness.js');

function readAt(state) {
  const out = execFileSync(process.execPath, [HARNESS, 'json', JSON.stringify(state || {})], {
    env: Object.assign({}, process.env, { MOD: 'rocks-and-stiffness.html' }),
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

console.log('\nMODULE 01 - PROSE AGAINST THE RUNNING PAGE\n');

const DEF = { phi: 25, vcl: 0, pres: 20, ks: 100, gs: 100 };
const d = readAt(DEF);

/* ---- step 1: the mineral constants named in the text ---- */
check('step 1: quartz density is 2.65 g/cm3', d.D.r.min.rho, 2.65, 0.001);
check('step 1: at 25% porosity the dry bulk density is 1.987', d.D.r.rho, 1.987, 0.001);
const clayOnly = readAt(Object.assign({}, DEF, { vcl: 100 }));
check('step 1: clay density is 2.58 g/cm3', clayOnly.D.r.min.rho, 2.58, 0.001);
assertTrue('step 1: clay moves the mineral density only slightly',
  Math.abs(clayOnly.D.r.min.rho - d.D.r.min.rho) < 0.08);

/* ---- step 2: the two moduli and the strains under the test stress ---- */
check('step 2: K of the default rock is 4.69 GPa', d.D.r.K, 4.69, 0.01);
check('step 2: G of the default rock is 5.52 GPa', d.D.r.G, 5.52, 0.01);
check('step 2: volume strain at 0.5 GPa is 10.7%', d.D.volStrain * 100, 10.7, 0.05);
check('step 2: shear strain at the same stress is 9.1%', d.D.shearStrain * 100, 9.1, 0.05);

/* ---- step 3 and exercise 2: the frame against the mineral ---- */
check('step 3: quartz K is 37 GPa', d.D.r.min.K, 37, 0.01);
check('step 3: quartz G is 44 GPa', d.D.r.min.G, 44, 0.01);
check('exercise 2: the frame keeps about an eighth of the mineral K',
  d.D.r.K / d.D.r.min.K, 1 / 8, 0.015);

/* ---- exercise 1: density and stiffness respond on different scales ---- */
const lo = readAt(Object.assign({}, DEF, { phi: 5 }));
const hi = readAt(Object.assign({}, DEF, { phi: 38 }));
check('exercise 1: density at 5% porosity is 2.52', lo.D.r.rho, 2.52, 0.005);
check('exercise 1: density at 38% porosity is 1.64', hi.D.r.rho, 1.64, 0.005);
check('exercise 1: K at 5% porosity is 19.4 GPa', lo.D.r.K, 19.4, 0.05);
check('exercise 1: K at 38% porosity is 2.2 GPa', hi.D.r.K, 2.2, 0.05);
check('exercise 1: density falls by about a third',
  (1 - hi.D.r.rho / lo.D.r.rho) * 100, 34.7, 1.5);
check('exercise 1: the bulk modulus falls by nearly ninety percent',
  (1 - hi.D.r.K / lo.D.r.K) * 100, 89, 2);

/* ---- exercise 3: pressure on the contacts ---- */
const p5 = readAt(Object.assign({}, DEF, { pres: 5 }));
const p50 = readAt(Object.assign({}, DEF, { pres: 50 }));
check('exercise 3: K at 5 MPa is 3.1 GPa', p5.D.r.K, 3.1, 0.02);
check('exercise 3: K at 50 MPa is 6.1 GPa', p50.D.r.K, 6.09, 0.02);
check('exercise 3: Vp at 5 MPa is 1994 m/s', p5.D.r.e.vp, 1994, 2);
check('exercise 3: Vp at 50 MPa is 2817 m/s', p50.D.r.e.vp, 2817, 2);
assertTrue('exercise 3: the bulk modulus roughly doubles across that range',
  p50.D.r.K / p5.D.r.K > 1.8 && p50.D.r.K / p5.D.r.K < 2.2);
assertTrue('exercise 3: with the density unchanged',
  Math.abs(p50.D.r.rho - p5.D.r.rho) < 1e-9);

/* ---- step 4: which modulus goes into which velocity ---- */
check('step 4: K + 4G/3 is 12.05 GPa', d.D.r.K + (4 / 3) * d.D.r.G, 12.05, 0.02);
check('step 4: Vp is 2462 m/s', d.D.r.e.vp, 2462, 2);
check('step 4: Vs is 1667 m/s', d.D.r.e.vs, 1667, 2);

/* ---- step 5 and exercise 4: Vs cannot see K ---- */
const kLo = readAt(Object.assign({}, DEF, { ks: 50 }));
const kHi = readAt(Object.assign({}, DEF, { ks: 200 }));
assertTrue('exercise 4: scaling K leaves Vs exactly unchanged at 0.5x',
  kLo.D.kOnly.vs === d.D.r.e.vs);
assertTrue('exercise 4: and exactly unchanged at 2.0x',
  kHi.D.kOnly.vs === d.D.r.e.vs);
check('exercise 4: Vp rises about 31% across the K multiplier range',
  (kHi.D.kOnly.vp / kLo.D.kOnly.vp - 1) * 100, 31, 1.0);
assertTrue('step 5: scaling G moves both velocities',
  readAt(Object.assign({}, DEF, { gs: 200 })).D.scaled.vs > d.D.r.e.vs);

/* ---- exercise 5 and the closing note: Vp/Vs of a dry rock ---- */
check('exercise 5: Vp/Vs is about 1.50 at 10% porosity',
  readAt(Object.assign({}, DEF, { phi: 10 })).D.r.e.vpvs, 1.50, 0.01);
check('exercise 5: and about 1.47 at 30% porosity',
  readAt(Object.assign({}, DEF, { phi: 30 })).D.r.e.vpvs, 1.47, 0.01);
let vpvsLo = Infinity, vpvsHi = 0;
for (let phi = 5; phi <= 38; phi += 1) {
  for (const vcl of [0, 30, 60]) {
    const r = readAt({ phi: phi, vcl: vcl, pres: 20, ks: 100, gs: 100 });
    vpvsLo = Math.min(vpvsLo, r.D.r.e.vpvs);
    vpvsHi = Math.max(vpvsHi, r.D.r.e.vpvs);
  }
}
check('exercise 5: the lowest Vp/Vs the sliders reach is about 1.43', vpvsLo, 1.43, 0.01);
check('exercise 5: the highest is about 1.63', vpvsHi, 1.63, 0.01);
check('exercise 5: 1.48 at 25% porosity with no clay', d.D.r.e.vpvs, 1.48, 0.01);
check('exercise 5: 1.51 at 25% porosity with 60% clay',
  readAt(Object.assign({}, DEF, { vcl: 60 })).D.r.e.vpvs, 1.51, 0.01);
assertTrue('exercise 5: clay raises the ratio rather than lowering it',
  readAt(Object.assign({}, DEF, { vcl: 60 })).D.r.e.vpvs > d.D.r.e.vpvs);
assertTrue('exercise 5: and well below the 1.8 of a real water-bearing sandstone',
  vpvsHi < 1.8);

console.log('\n' + (bad ? bad + ' PROSE CLAIMS NO LONGER HOLD' :
  'every number in module 01 (rocks and stiffness) matches the running page') + '\n');
process.exit(bad ? 1 : 0);
