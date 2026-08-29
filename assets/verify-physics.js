/* Closed-form checks on rockphysics.js.
   Run: node tools/verify-physics.js
   Every test here has a known right answer that does not depend on the
   implementation. A test that only compares the code to itself is worthless. */

const R = require('../assets/rockphysics.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '   ' + detail : '')); }
}
function near(name, got, want, tol, unit) {
  const d = Math.abs(got - want);
  ok(name, d <= tol,
     'got ' + fmt(got) + (unit || '') + ', want ' + fmt(want) + (unit || '') +
     ' (|d| ' + d.toExponential(2) + ')');
}
function fmt(x) { return Math.abs(x) < 1e-4 && x !== 0 ? x.toExponential(3) : (Math.round(x * 1e6) / 1e6); }

console.log('\n--- FLUIDS: Batzle & Wang against published values ---');
// Pure water at 20 C, atmospheric: the textbook number is 1482-1483 m/s.
const w = R.waterProps(20, 0.1);
near('water velocity at 20C, 0.1 MPa', w.V, 1482.9, 1.5, ' m/s');
near('water density at 20C, 0.1 MPa', w.rho, 0.9982, 0.002, ' g/cc');
near('water K at 20C, 0.1 MPa', w.K, 2.195, 0.02, ' GPa');

// Water velocity peaks near 74 C at low pressure. That maximum is a real
// property of water and a good test that the polynomial is wired correctly.
let best = -1, bestT = 0;
for (let T = 0; T <= 120; T += 0.5) { const v = R.waterProps(T, 0.1).V; if (v > best) { best = v; bestT = T; } }
near('water velocity maximum is near 74 C', bestT, 74, 3, ' C');

const br = R.brineProps(64, 23, 0.035);
ok('brine is denser than pure water', br.rho > R.waterProps(64, 23).rho,
   'brine ' + fmt(br.rho) + ' vs water ' + fmt(R.waterProps(64, 23).rho));
ok('brine K in the expected 2.5-3.5 GPa band at reservoir conditions',
   br.K > 2.5 && br.K < 3.5, 'K = ' + fmt(br.K) + ' GPa');

const g = R.gasProps(64, 23, 0.65);
ok('gas K is two orders of magnitude below brine',
   g.K > 0.01 && g.K < 0.12, 'K = ' + fmt(g.K) + ' GPa');
ok('gas density is light', g.rho > 0.05 && g.rho < 0.35, 'rho = ' + fmt(g.rho) + ' g/cc');
ok('gas stiffens with depth',
   R.gasProps(90, 45, 0.65).K > R.gasProps(40, 10, 0.65).K,
   'deep ' + fmt(R.gasProps(90, 45, 0.65).K) + ' > shallow ' + fmt(R.gasProps(40, 10, 0.65).K));

const oil = R.oilProps(64, 23, 32, 0, 0.65);
ok('dead 32-API oil sits between gas and brine',
   oil.K > g.K && oil.K < br.K, 'K = ' + fmt(oil.K) + ' GPa');
ok('live oil is softer than dead oil',
   R.oilProps(64, 23, 32, 120, 0.65).K < oil.K,
   'live ' + fmt(R.oilProps(64, 23, 32, 120, 0.65).K) + ' < dead ' + fmt(oil.K));
ok('heavier oil (lower API) is stiffer',
   R.oilProps(64, 23, 15, 0, 0.65).K > R.oilProps(64, 23, 45, 0, 0.65).K);

console.log('\n--- MIXING ---');
const mix = R.mixReuss([{ K: g.K, rho: g.rho, s: 1 }, { K: br.K, rho: br.rho, s: 0 }]);
near('Reuss mix at 100% gas returns the gas modulus', mix.K, g.K, 1e-12, ' GPa');
const mix0 = R.mixReuss([{ K: g.K, rho: g.rho, s: 0 }, { K: br.K, rho: br.rho, s: 1 }]);
near('Reuss mix at 0% gas returns the brine modulus', mix0.K, br.K, 1e-12, ' GPa');
const m10 = R.mixReuss([{ K: g.K, rho: g.rho, s: 0.10 }, { K: br.K, rho: br.rho, s: 0.90 }]);
const m90 = R.mixReuss([{ K: g.K, rho: g.rho, s: 0.90 }, { K: br.K, rho: br.rho, s: 0.10 }]);
ok('Reuss: 10% gas is already most of the way to 100% gas',
   (br.K - m10.K) / (br.K - g.K) > 0.8,
   'fraction of the drop achieved by 10% gas = ' +
   fmt((br.K - m10.K) / (br.K - g.K)) + ', by 90% = ' + fmt((br.K - m90.K) / (br.K - g.K)));
ok('Voigt (patchy) is always stiffer than Reuss (uniform)',
   R.mixVoigt([{ K: g.K, rho: g.rho, s: 0.5 }, { K: br.K, rho: br.rho, s: 0.5 }]).K >
   R.mixReuss([{ K: g.K, rho: g.rho, s: 0.5 }, { K: br.K, rho: br.rho, s: 0.5 }]).K);

console.log('\n--- DRY FRAME ---');
const qz = R.MINERAL.quartz;
const ss0 = R.softSand(qz, 0, { P: 23 });
near('soft-sand frame at zero porosity returns the mineral K', ss0.K, qz.K, 1e-9, ' GPa');
near('soft-sand frame at zero porosity returns the mineral G', ss0.G, qz.G, 1e-9, ' GPa');
const cp0 = R.criticalPorosity(qz, 0);
near('critical-porosity frame at zero porosity returns the mineral K', cp0.K, qz.K, 1e-12, ' GPa');
ok('dry frame softens monotonically with porosity', (() => {
  let prev = Infinity;
  for (let p = 0; p <= 0.39; p += 0.01) {
    const k = R.softSand(qz, p, { P: 23 }).K;
    if (k > prev + 1e-9) return false;
    prev = k;
  }
  return true;
})());
ok('critical-porosity model is stiffer than soft-sand at 20% porosity',
   R.criticalPorosity(qz, 0.20).K > R.softSand(qz, 0.20, { P: 23 }).K,
   'critical ' + fmt(R.criticalPorosity(qz, 0.20).K) +
   ' vs soft ' + fmt(R.softSand(qz, 0.20, { P: 23 }).K) + ' GPa');
ok('Hertz-Mindlin stiffens with effective pressure',
   R.softSand(qz, 0.30, { P: 45 }).K > R.softSand(qz, 0.30, { P: 10 }).K);

console.log('\n--- GASSMANN ---');
const dry = R.softSand(qz, 0.25, { P: 23 });
const KsatB = R.gassmann(dry.K, qz.K, br.K, 0.25);
near('Gassmann with a vanishing fluid modulus returns the dry frame',
     R.gassmann(dry.K, qz.K, 1e-9, 0.25), dry.K, 1e-6, ' GPa');
ok('saturating with brine stiffens the rock', KsatB > dry.K,
   fmt(dry.K) + ' -> ' + fmt(KsatB) + ' GPa');
near('Gassmann inverse recovers the dry frame exactly',
     R.gassmannInverse(KsatB, qz.K, br.K, 0.25), dry.K, 1e-9, ' GPa');

// The decisive one: a full substitution round trip has to land back where it
// started, to machine precision, or every fluid comparison in the site is
// built on sand.
const KsatG = R.gassmann(R.gassmannInverse(KsatB, qz.K, br.K, 0.25), qz.K, g.K, 0.25);
const backB = R.gassmann(R.gassmannInverse(KsatG, qz.K, g.K, 0.25), qz.K, br.K, 0.25);
near('brine -> gas -> brine round trip', backB, KsatB, 1e-9, ' GPa');

ok('Gassmann leaves the shear modulus alone', (() => {
  const a = R.rockModel({ vClay: 0, phi: 0.25, fluid: 'brine', sHc: 0, P: 23 });
  const b = R.rockModel({ vClay: 0, phi: 0.25, fluid: 'gas', sHc: 1, P: 23 });
  return Math.abs(a.G - b.G) < 1e-12;
})());
ok('gas substitution lowers Vp but RAISES Vs', (() => {
  const a = R.rockModel({ vClay: 0, phi: 0.25, fluid: 'brine', sHc: 0, P: 23 });
  const b = R.rockModel({ vClay: 0, phi: 0.25, fluid: 'gas', sHc: 1, P: 23 });
  console.log('       brine Vp ' + Math.round(a.vp) + ' Vs ' + Math.round(a.vs) +
              '   gas Vp ' + Math.round(b.vp) + ' Vs ' + Math.round(b.vs));
  return b.vp < a.vp && b.vs > a.vs;
})());

console.log('\n--- REFLECTIVITY ---');
const sh = R.mudrock(2700);
const sand = R.rockModel({ vClay: 0, phi: 0.20, fluid: 'brine', sHc: 0, P: 23 });

// Zoeppritz at normal incidence must equal the acoustic coefficient exactly.
// If the 4x4 is wired wrong this is the test that says so.
near('Zoeppritz at 0 deg equals (I2-I1)/(I2+I1)',
     R.zoeppritz(sh, sand, 0), R.rcNormal(sh, sand), 1e-12);
near('Zoeppritz at 0 deg, reversed contrast',
     R.zoeppritz(sand, sh, 0), R.rcNormal(sand, sh), 1e-12);

// A contrast that is not a contrast must return exactly zero at every angle.
// This is the tilted-plane test of this module set.
let worst = 0;
for (let t = 0; t <= 45; t += 1) worst = Math.max(worst, Math.abs(R.zoeppritz(sh, sh, t)));
near('Zoeppritz across an identical interface is zero at all angles', worst, 0, 1e-12);
let worstAR = 0;
for (let t = 0; t <= 45; t += 1) worstAR = Math.max(worstAR, Math.abs(R.akiRichards(sh, sh, t)));
near('Aki-Richards across an identical interface is zero at all angles', worstAR, 0, 1e-14);
near('Shuey across an identical interface is zero', R.shuey(sh, sh, 30, 3), 0, 1e-14);

// Aki-Richards and Shuey are two arrangements of the same linearization, so
// they must agree with each other to machine precision, not merely closely.
let worstAS = 0;
for (let t = 0; t <= 40; t += 1) {
  worstAS = Math.max(worstAS, Math.abs(R.akiRichards(sh, sand, t) - R.shuey(sh, sand, t, 3)));
}
near('three-term Shuey equals Aki-Richards', worstAS, 0, 1e-12);
near('Shuey intercept equals Aki-Richards at 0 deg',
     R.shueyTerms(sh, sand).R0, R.akiRichards(sh, sand, 0), 1e-14);

// The approximations should track exact Zoeppritz at small angles and drift
// at large ones. Quantifying the drift is the point of saying so.
const d20 = Math.abs(R.shuey(sh, sand, 20, 2) - R.zoeppritz(sh, sand, 20));
const d40 = Math.abs(R.shuey(sh, sand, 40, 2) - R.zoeppritz(sh, sand, 40));
ok('two-term Shuey is close to Zoeppritz at 20 deg', d20 < 0.01, 'error ' + fmt(d20));
ok('two-term Shuey error grows by 40 deg', d40 > d20,
   '20 deg: ' + fmt(d20) + '   40 deg: ' + fmt(d40));

console.log('\n--- THE MODEL THE MODULE ACTUALLY USES ---');
const cases = [
  ['brine sand phi=0.20', { phi: 0.20, fluid: 'brine', sHc: 0 }],
  ['brine sand phi=0.30', { phi: 0.30, fluid: 'brine', sHc: 0 }],
  ['gas sand   phi=0.20', { phi: 0.20, fluid: 'gas', sHc: 1 }],
  ['gas sand   phi=0.30', { phi: 0.30, fluid: 'gas', sHc: 1 }],
  ['oil sand   phi=0.30', { phi: 0.30, fluid: 'oil', sHc: 1, api: 32 }],
  ['10% gas    phi=0.30', { phi: 0.30, fluid: 'gas', sHc: 0.10 }],
];
console.log('  shale (Vp 2700): Vp ' + Math.round(sh.vp) + '  Vs ' + Math.round(sh.vs) +
            '  rho ' + fmt(sh.rho) + '  I ' + Math.round(sh.ip));
for (const [name, cfg] of cases) {
  const r = R.rockModel({ vClay: 0, P: 23, ...cfg });
  console.log('  ' + name.padEnd(22) +
    'Vp ' + String(Math.round(r.vp)).padStart(5) +
    '  Vs ' + String(Math.round(r.vs)).padStart(5) +
    '  rho ' + r.rho.toFixed(3) +
    '  Vp/Vs ' + r.vpvs.toFixed(2) +
    '  I ' + String(Math.round(r.ip)).padStart(5) +
    '  Rtop ' + (R.rcNormal(sh, r) >= 0 ? '+' : '') + R.rcNormal(sh, r).toFixed(4));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
