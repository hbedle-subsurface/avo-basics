/* ===========================================================================
   rockphysics.js — mineral mixing, dry frames, fluids, Gassmann, reflectivity
   "How AVO Actually Works"
   Heather Bedle / AASPI / University of Oklahoma
   Vanilla JS, no dependencies, no build step.

   Units, fixed everywhere in this file:
     moduli   GPa
     density  g/cm3
     velocity m/s
     pressure MPa
     temp     degrees C
     porosity fraction (0..1), NOT percent

   Every function is pure. Nothing here touches the DOM, so the same file
   loads in a browser and in node for the test harness.
   =========================================================================== */

const ROCK = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
     MINERALS
     Bulk and shear moduli from Mavko, Mukerji & Dvorkin, The Rock Physics
     Handbook, 2nd ed., Table A.4.1. Clay is the awkward one: it is not a
     single mineral and published values scatter badly. The pair used here
     is the one most commonly quoted for teaching, and the Method tab of any
     module using it should say so.
     --------------------------------------------------------------------- */

  const MINERAL = {
    quartz:  { K: 37.0, G: 44.0, rho: 2.65, name: 'quartz' },
    clay:    { K: 21.0, G:  7.0, rho: 2.58, name: 'clay' },
    calcite: { K: 76.8, G: 32.0, rho: 2.71, name: 'calcite' },
    dolomite:{ K: 94.9, G: 45.0, rho: 2.87, name: 'dolomite' },
  };

  /* Voigt-Reuss-Hill average of a mineral mixture.
     comp = [{K, G, rho, f}, ...] with fractions f summing to 1. */
  function vrh(comp) {
    let voigtK = 0, voigtG = 0, reussK = 0, reussG = 0, rho = 0, fsum = 0;
    for (const c of comp) {
      if (c.f <= 0) continue;
      voigtK += c.f * c.K; voigtG += c.f * c.G;
      reussK += c.f / c.K; reussG += c.f / c.G;
      rho    += c.f * c.rho;
      fsum   += c.f;
    }
    if (fsum <= 0) return { K: 0, G: 0, rho: 0 };
    voigtK /= fsum; voigtG /= fsum; rho /= fsum;
    reussK = fsum / reussK; reussG = fsum / reussG;
    return { K: 0.5 * (voigtK + reussK), G: 0.5 * (voigtG + reussG), rho };
  }

  /* Mineral mix for a clastic rock described by a single clay fraction. */
  function mineralMix(vClay) {
    const v = clamp(vClay, 0, 1);
    return vrh([
      { ...MINERAL.quartz, f: 1 - v },
      { ...MINERAL.clay,   f: v },
    ]);
  }

  /* ---------------------------------------------------------------------
     DRY FRAME

     Two models, because they disagree and the disagreement is teachable.

     softSand (Dvorkin & Nur 1996, the friable-sand or unconsolidated model)
       Hertz-Mindlin at the critical porosity, then the modified Hashin-
       Shtrikman LOWER bound down to zero porosity. This is the one used by
       default: it is pressure-dependent, it reproduces the low velocities of
       young clastic sections, and those are exactly the rocks where bright
       spots and AVO are used.

     criticalPorosity (Nur's modified Voigt)
       K_dry = K_min (1 - phi/phi_c). Three lines, no pressure, and an UPPER
       bound, so it returns rocks several hundred m/s too fast at moderate
       porosity. Kept because the comparison is worth showing, not because it
       is a better model.
     --------------------------------------------------------------------- */

  function hertzMindlin(min, phiC, P, n) {
    // P in MPa, converted to GPa so it matches the mineral moduli.
    const Pg = Math.max(1e-4, P) / 1000;
    const nu = poisson(min.K, min.G);
    const a = (n * n * (1 - phiC) * (1 - phiC) * min.G * min.G) /
              (18 * Math.PI * Math.PI * (1 - nu) * (1 - nu));
    const K = Math.cbrt(a * Pg);
    const b = (3 * n * n * (1 - phiC) * (1 - phiC) * min.G * min.G) /
              (2 * Math.PI * Math.PI * (1 - nu) * (1 - nu));
    const G = ((5 - 4 * nu) / (5 * (2 - nu))) * Math.cbrt(b * Pg);
    return { K, G };
  }

  function softSand(min, phi, opts) {
    const o = opts || {};
    const phiC = o.phiC === undefined ? 0.40 : o.phiC;
    const n    = o.n    === undefined ? 9    : o.n;
    const P    = o.P    === undefined ? 20   : o.P;
    const hm = hertzMindlin(min, phiC, P, n);

    if (phi >= phiC) {
      // Above critical porosity the grains are no longer load bearing. The
      // model has nothing to say there, so it is held at the suspension end.
      return { K: hm.K, G: hm.G, hm };
    }
    const u = phi / phiC;
    const K = 1 / (u / (hm.K + (4 / 3) * hm.G) +
                   (1 - u) / (min.K + (4 / 3) * hm.G)) - (4 / 3) * hm.G;
    const Z = (hm.G / 6) * ((9 * hm.K + 8 * hm.G) / (hm.K + 2 * hm.G));
    const G = 1 / (u / (hm.G + Z) + (1 - u) / (min.G + Z)) - Z;
    return { K: Math.max(0, K), G: Math.max(0, G), hm };
  }

  function criticalPorosity(min, phi, phiC) {
    const pc = phiC === undefined ? 0.40 : phiC;
    const f = Math.max(0, 1 - phi / pc);
    return { K: min.K * f, G: min.G * f };
  }

  /* ---------------------------------------------------------------------
     FLUIDS — Batzle & Wang (1992), Geophysics 57, 1396-1408

     These are the standard equations and they are worth having in full
     rather than as three constants, because the whole point of the fluid
     modules is that the fluid properties MOVE. Gas in particular is not one
     number: its bulk modulus changes by an order of magnitude between
     shallow and deep.
     --------------------------------------------------------------------- */

  // Gas. G = specific gravity relative to air (0.56 dry methane, ~0.8 wet).
  function gasProps(T, P, G) {
    const Ta = T + 273.15;
    const Ppr = 4.892 - 0.4048 * G;
    const Tpr = 94.72 + 170.75 * G;
    const Pr = P / Ppr;
    const Tr = Ta / Tpr;

    const c = 0.45 + 8 * Math.pow(0.56 - 1 / Tr, 2);
    const E = 0.109 * Math.pow(3.85 - Tr, 2) *
              Math.exp(-c * Math.pow(Pr, 1.2) / Tr);
    const d = 0.03 + 0.00527 * Math.pow(3.5 - Tr, 3);
    const Z = d * Pr + 0.642 * Tr - 0.007 * Math.pow(Tr, 4) - 0.52 + E;

    const rho = 28.8 * G * P / (Z * 8.314 * Ta);          // g/cm3

    const gamma0 = 0.85 + 5.6 / (Pr + 2) + 27.1 / Math.pow(Pr + 3.5, 2) -
                   8.7 * Math.exp(-0.65 * (Pr + 1));
    const dEdPr = -1.2 * c * Math.pow(Pr, 0.2) / Tr * E;
    const dZdPr = d + dEdPr;
    const Kmpa = P * gamma0 / (1 - (Pr / Z) * dZdPr);
    return { K: Kmpa / 1000, rho, Z };                    // K in GPa
  }

  // Pure water velocity, Batzle & Wang Table 1.
  const WCOEF = [
    [1402.85,   1.524,     3.437e-3,  -1.197e-5],
    [4.871,    -0.0111,    1.739e-4,  -1.628e-6],
    [-0.04783,  2.747e-4, -2.135e-6,   1.237e-8],
    [1.487e-4, -6.503e-7, -1.455e-8,   1.327e-10],
    [-2.197e-7, 7.987e-10, 5.230e-11, -4.614e-13],
  ];

  function waterProps(T, P) {
    let V = 0;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) V += WCOEF[i][j] * Math.pow(T, i) * Math.pow(P, j);
    }
    const rho = 1 + 1e-6 * (
      -80 * T - 3.3 * T * T + 0.00175 * T * T * T +
      489 * P - 2 * T * P + 0.016 * T * T * P - 1.3e-5 * T * T * T * P -
      0.333 * P * P - 0.002 * T * P * P);
    return { V, rho, K: rho * V * V * 1e-6 };              // GPa
  }

  // Brine. S = NaCl weight fraction (0.035 is roughly seawater).
  function brineProps(T, P, S) {
    const w = waterProps(T, P);
    const rho = w.rho + S * (0.668 + 0.44 * S + 1e-6 * (
      300 * P - 2400 * P * S +
      T * (80 + 3 * T - 3300 * S - 13 * P + 47 * P * S)));
    const V = w.V +
      S * (1170 - 9.6 * T + 0.055 * T * T - 8.5e-5 * T * T * T +
           2.6 * P - 0.0029 * T * P - 0.0476 * P * P) +
      Math.pow(S, 1.5) * (780 - 10 * P + 0.16 * P * P) -
      1820 * S * S;
    return { V, rho, K: rho * V * V * 1e-6 };
  }

  /* Oil. api = API gravity, Rg = gas-oil ratio in L/L, Gg = gas gravity.
     Rg = 0 is a dead oil. Live oil is markedly softer, which is why the
     gas-oil ratio gets its own control wherever oil is on screen. */
  function oilProps(T, P, api, Rg, Gg) {
    const rho0 = 141.5 / (api + 131.5);
    const g = Gg === undefined ? 0.7 : Gg;
    const R = Math.max(0, Rg || 0);

    const B0 = 0.972 + 0.00038 *
      Math.pow(2.4 * R * Math.sqrt(g / rho0) + T + 17.8, 1.175);

    // pseudo-density used by the velocity equation
    const rhoP = rho0 / (B0 * (1 + 0.001 * R));

    const V = 2096 * Math.sqrt(rhoP / (2.6 - rhoP)) - 3.7 * T + 4.64 * P +
              0.0115 * (4.12 * Math.sqrt(1.08 / rhoP - 1) - 1) * T * P;

    // true density at T and P
    const rhoG = (rho0 + 0.0012 * g * R) / B0;
    const rhoPP = rhoG + (0.00277 * P - 1.71e-7 * Math.pow(P, 3)) *
                  Math.pow(rhoG - 1.15, 2) + 3.49e-4 * P;
    const rho = rhoPP / (0.972 + 3.81e-4 * Math.pow(T + 17.78, 1.175));

    return { V, rho, K: rho * V * V * 1e-6 };
  }

  /* ---------------------------------------------------------------------
     FLUID MIXING

     Reuss (uniform / fine-scale mixing) is the standard choice and is what
     Gassmann assumes. It is also the reason a little gas behaves almost
     like a lot of gas: the harmonic average is dragged to the soft end by
     the smallest term.

     Voigt is the patchy end member. Real partial saturation lies between
     them, and the gap between the two curves IS the uncertainty.
     --------------------------------------------------------------------- */

  function mixReuss(fluids) {
    let inv = 0, rho = 0;
    for (const f of fluids) {
      if (f.s <= 0) continue;
      inv += f.s / f.K;
      rho += f.s * f.rho;
    }
    return { K: inv > 0 ? 1 / inv : 0, rho };
  }

  function mixVoigt(fluids) {
    let K = 0, rho = 0;
    for (const f of fluids) { K += f.s * f.K; rho += f.s * f.rho; }
    return { K, rho };
  }

  function mixBrie(fluids, e) {
    // Brie's empirical curve, a tunable path between patchy and uniform.
    // Included for the saturation module; e = 1 is Voigt, large e is Reuss-like.
    const gas = fluids.find((f) => f.isGas) || { s: 0, K: 0, rho: 0 };
    const liq = fluids.filter((f) => !f.isGas);
    const sl = liq.reduce((a, f) => a + f.s, 0);
    if (sl <= 0) return { K: gas.K, rho: gas.rho };
    const lm = mixReuss(liq.map((f) => ({ ...f, s: f.s / sl })));
    const K = (lm.K - gas.K) * Math.pow(sl, e === undefined ? 3 : e) + gas.K;
    const rho = sl * lm.rho + gas.s * gas.rho;
    return { K, rho };
  }

  /* ---------------------------------------------------------------------
     GASSMANN

     Forward: dry frame plus fluid gives the saturated bulk modulus. Shear
     modulus is unchanged, which is the assumption doing most of the work
     and the one most often violated in real rocks.

     Inverse: saturated modulus back to the dry frame. Needed whenever the
     starting point is a measured or empirical SATURATED rock rather than a
     modeled dry one, which is the usual situation with well logs.
     --------------------------------------------------------------------- */

  function gassmann(Kdry, Kmin, Kfl, phi) {
    if (phi <= 0) return Kdry;
    const a = 1 - Kdry / Kmin;
    const den = phi / Kfl + (1 - phi) / Kmin - Kdry / (Kmin * Kmin);
    if (!isFinite(den) || Math.abs(den) < 1e-12) return Kdry;
    return Kdry + (a * a) / den;
  }

  function gassmannInverse(Ksat, Kmin, Kfl, phi) {
    const num = Ksat * (phi * Kmin / Kfl + 1 - phi) - Kmin;
    const den = phi * Kmin / Kfl + Ksat / Kmin - 1 - phi;
    return num / den;
  }

  /* ---------------------------------------------------------------------
     ELASTIC BOOKKEEPING
     --------------------------------------------------------------------- */

  function poisson(K, G) { return (3 * K - 2 * G) / (2 * (3 * K + G)); }

  // moduli in GPa, rho in g/cm3, out in m/s
  function vp(K, G, rho) { return Math.sqrt((K + (4 / 3) * G) * 1e9 / (rho * 1000)); }
  function vs(G, rho)    { return Math.sqrt(G * 1e9 / (rho * 1000)); }

  function elastic(K, G, rho) {
    const a = vp(K, G, rho), b = vs(G, rho);
    return {
      K, G, rho, vp: a, vs: b,
      ip: a * rho, is: b * rho,
      vpvs: b > 0 ? a / b : Infinity,
      pr: poisson(K, G),
    };
  }

  /* Empirical shale. Castagna's mudrock line for Vs and Gardner for density,
     both of which are trends rather than physics, so a module using them has
     to say so. They are used here because a contact model is not appropriate
     for a shale: shales are not grain packs. */
  function mudrock(vpVal) {
    const v = vpVal;
    const vsVal = (v - 1360) / 1.16;
    const rho = 1.741 * Math.pow(v / 1000, 0.25);
    return elastic(
      (rho * v * v - (4 / 3) * rho * vsVal * vsVal) * 1e-6,
      rho * vsVal * vsVal * 1e-6,
      rho);
  }

  /* ---------------------------------------------------------------------
     THE WHOLE CHAIN, IN ONE CALL

     rockModel({vClay, phi, fluid, sw/sg, api, gor, P, T, S}) -> elastic()
     This is the function every module calls. Keeping it in one place means
     the physics can be corrected once rather than in five HTML files.
     --------------------------------------------------------------------- */

  function fluidProps(cfg) {
    const T = cfg.T === undefined ? 64 : cfg.T;
    const P = cfg.P === undefined ? 23 : cfg.P;
    const S = cfg.S === undefined ? 0.035 : cfg.S;
    const brine = brineProps(T, P, S);
    const gas   = gasProps(T, P, cfg.gasGrav === undefined ? 0.65 : cfg.gasGrav);
    const oil   = oilProps(T, P, cfg.api === undefined ? 32 : cfg.api,
                           cfg.gor === undefined ? 0 : cfg.gor,
                           cfg.gasGrav === undefined ? 0.65 : cfg.gasGrav);
    return { brine, gas, oil };
  }

  function poreFluid(cfg) {
    const f = fluidProps(cfg);
    const sh = clamp(cfg.sHc === undefined ? 0 : cfg.sHc, 0, 1);
    const hc = cfg.fluid === 'gas' ? f.gas : cfg.fluid === 'oil' ? f.oil : null;
    if (!hc || sh <= 0) return { ...f.brine, mixed: false, parts: f };
    const parts = [
      { K: hc.K, rho: hc.rho, s: sh, isGas: cfg.fluid === 'gas' },
      { K: f.brine.K, rho: f.brine.rho, s: 1 - sh, isGas: false },
    ];
    const m = cfg.patchy ? mixVoigt(parts) : mixReuss(parts);
    return { K: m.K, rho: m.rho, mixed: true, parts: f, hc };
  }

  function rockModel(cfg) {
    const min = mineralMix(cfg.vClay === undefined ? 0 : cfg.vClay);
    const phi = clamp(cfg.phi, 0, 0.5);
    const dry = cfg.frame === 'critical'
      ? criticalPorosity(min, phi, cfg.phiC)
      : softSand(min, phi, { phiC: cfg.phiC, n: cfg.n, P: cfg.P });
    const fl = poreFluid(cfg);
    const Ksat = gassmann(dry.K, min.K, fl.K, phi);
    const rho = (1 - phi) * min.rho + phi * fl.rho;
    const out = elastic(Ksat, dry.G, rho);
    out.dry = dry; out.min = min; out.fluid = fl; out.phi = phi;
    return out;
  }

  /* ---------------------------------------------------------------------
     REFLECTIVITY

     Normal incidence first, then the angle-dependent forms. The
     approximations are kept alongside exact Zoeppritz on purpose: showing
     where Shuey departs from the truth is a teaching object, not a bug.
     --------------------------------------------------------------------- */

  function rcNormal(a, b) {
    return (b.ip - a.ip) / (b.ip + a.ip);
  }

  /* Exact Zoeppritz PP reflection coefficient, Aki & Richards eq. 5.39.
     Real arithmetic only, so it returns NaN beyond a critical angle. That is
     deliberate: a silently wrong number past critical is worse than a gap. */
  function zoeppritz(a, b, thetaDeg) {
    const th1 = thetaDeg * Math.PI / 180;
    const p = Math.sin(th1) / a.vp;
    const s = (v) => { const x = p * v; return Math.abs(x) > 1 ? NaN : x; };
    const sf1 = s(a.vs), st2 = s(b.vp), sf2 = s(b.vs);
    if (!isFinite(sf1) || !isFinite(st2) || !isFinite(sf2)) return NaN;

    const ct1 = Math.cos(th1), cf1 = Math.sqrt(1 - sf1 * sf1);
    const ct2 = Math.sqrt(1 - st2 * st2), cf2 = Math.sqrt(1 - sf2 * sf2);
    const st1 = Math.sin(th1);
    const r1 = a.rho, r2 = b.rho;
    const a1 = a.vp, b1 = a.vs, a2 = b.vp, b2 = b.vs;

    const M = [
      [-st1, -cf1, st2, cf2],
      [ ct1, -sf1, ct2, -sf2],
      [ 2 * r1 * b1 * sf1 * ct1, r1 * b1 * (1 - 2 * sf1 * sf1),
        2 * r2 * b2 * sf2 * ct2, r2 * b2 * (1 - 2 * sf2 * sf2)],
      [-r1 * a1 * (1 - 2 * sf1 * sf1), r1 * b1 * 2 * sf1 * cf1,
        r2 * a2 * (1 - 2 * sf2 * sf2), -r2 * b2 * 2 * sf2 * cf2],
    ];
    const N = [
      [ st1, cf1, -st2, -cf2],
      [ ct1, -sf1, ct2, -sf2],
      [ 2 * r1 * b1 * sf1 * ct1, r1 * b1 * (1 - 2 * sf1 * sf1),
        2 * r2 * b2 * sf2 * ct2, r2 * b2 * (1 - 2 * sf2 * sf2)],
      [ r1 * a1 * (1 - 2 * sf1 * sf1), -r1 * b1 * 2 * sf1 * cf1,
       -r2 * a2 * (1 - 2 * sf2 * sf2), r2 * b2 * 2 * sf2 * cf2],
    ];
    const col = solve4(M, N.map((row) => row[0]));
    return col ? col[0] : NaN;
  }

  // Gaussian elimination with partial pivoting, 4x4.
  function solve4(A, rhs) {
    const m = A.map((r, i) => r.slice().concat([rhs[i]]));
    for (let c = 0; c < 4; c++) {
      let piv = c;
      for (let r = c + 1; r < 4; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
      if (Math.abs(m[piv][c]) < 1e-14) return null;
      const t = m[c]; m[c] = m[piv]; m[piv] = t;
      for (let r = 0; r < 4; r++) {
        if (r === c) continue;
        const f = m[r][c] / m[c][c];
        for (let k = c; k <= 4; k++) m[r][k] -= f * m[c][k];
      }
    }
    return [0, 1, 2, 3].map((i) => m[i][4] / m[i][i]);
  }

  // Aki & Richards three-term linearization.
  function akiRichards(a, b, thetaDeg) {
    const th = thetaDeg * Math.PI / 180;
    const vpA = 0.5 * (a.vp + b.vp), vsA = 0.5 * (a.vs + b.vs);
    const rhoA = 0.5 * (a.rho + b.rho);
    const dvp = b.vp - a.vp, dvs = b.vs - a.vs, drho = b.rho - a.rho;
    const k = vsA / vpA;
    return 0.5 * (1 - 4 * k * k * Math.pow(Math.sin(th), 2)) * (drho / rhoA) +
           (dvp / vpA) / (2 * Math.pow(Math.cos(th), 2)) -
           4 * k * k * Math.pow(Math.sin(th), 2) * (dvs / vsA);
  }

  // Shuey intercept, gradient and curvature terms.
  function shueyTerms(a, b) {
    const vpA = 0.5 * (a.vp + b.vp), vsA = 0.5 * (a.vs + b.vs);
    const rhoA = 0.5 * (a.rho + b.rho);
    const dvp = b.vp - a.vp, dvs = b.vs - a.vs, drho = b.rho - a.rho;
    const R0 = 0.5 * (dvp / vpA + drho / rhoA);
    const k = vsA / vpA;
    const G = 0.5 * (dvp / vpA) - 2 * k * k * (2 * (dvs / vsA) + drho / rhoA);
    const C = 0.5 * (dvp / vpA);
    return { R0, G, C };
  }

  function shuey(a, b, thetaDeg, terms) {
    const t = shueyTerms(a, b);
    const th = thetaDeg * Math.PI / 180;
    const s2 = Math.pow(Math.sin(th), 2);
    let r = t.R0 + t.G * s2;
    if (terms === 3) r += t.C * (Math.pow(Math.tan(th), 2) - s2);
    return r;
  }

  /* ---------------------------------------------------------------------
     OFFSET TO INCIDENCE ANGLE

     AVO is a function of ANGLE, but a gather is recorded against OFFSET, and
     the conversion is where a lot of quiet error enters. Two things go wrong
     with the usual shortcut:

       - The straight-ray estimate, tan(theta) = (x/2)/z, ignores refraction.
         Velocity rises with depth, so by Snell's law the ray is steadily bent
         away from vertical and arrives at the target FLATTER in the shallow
         section than a straight line suggests, which means the angle at the
         reflector is LARGER than the straight-ray value. Several degrees at
         short offset, and well over ten degrees at long offset.

       - The same offset is a completely different angle at a different depth.
         A 3 km offset is a wide angle on a shallow target and a narrow one on
         a deep target.

     For a linearly increasing velocity, V(z) = V0 + k z, rays are circular
     arcs and the geometry has a closed form, so this is solved exactly rather
     than approximated:

        X(p) = (cos(theta0) - cos(thetaZ)) / (p k)
        T(p) = (1/k) ln[ (Vz/V0) (1 + cos(theta0)) / (1 + cos(thetaZ)) ]

     with sin(theta) = p V at each depth. Given an offset, p is found by
     bisection. Returns null when no ray reaches the reflector at that offset,
     which is a real limit rather than an error.
     --------------------------------------------------------------------- */

  function rayLinearGradient(p, z, V0, k) {
    const Vz = V0 + k * z;
    if (p * Vz >= 1 || p * V0 >= 1) return null;      // ray turns before the target
    const c0 = Math.sqrt(1 - p * p * V0 * V0);
    const cz = Math.sqrt(1 - p * p * Vz * Vz);
    if (k < 1e-9) {
      const th = Math.asin(p * V0);
      return { x: 2 * z * Math.tan(th), t: 2 * z / (V0 * Math.cos(th)), theta: th };
    }
    return {
      x: 2 * (c0 - cz) / (p * k),
      t: 2 * (1 / k) * Math.log((Vz / V0) * ((1 + c0) / (1 + cz))),
      theta: Math.asin(p * Vz),
    };
  }

  /* Incidence angle at a horizontal reflector at depth z, for a given
     source-receiver offset, in a V(z) = V0 + k z overburden. Radians. */
  function angleFromOffset(offset, z, V0, k) {
    if (offset <= 0) return 0;
    const Vz = V0 + k * z;
    let lo = 0, hi = (1 / Vz) * (1 - 1e-9);
    // the arc length grows monotonically with p, so bisection is safe
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      const r = rayLinearGradient(mid, z, V0, k);
      if (!r || r.x > offset) hi = mid; else lo = mid;
    }
    const r = rayLinearGradient(lo, z, V0, k);
    return r ? r.theta : NaN;
  }

  // The shortcut this replaces, kept so a module can show the difference.
  function angleStraightRay(offset, z) {
    return Math.atan((offset / 2) / z);
  }

  // Vertical two-way time and RMS velocity through the same overburden.
  function overburden(z, V0, k) {
    const Vz = V0 + k * z;
    const t = k < 1e-9 ? z / V0 : Math.log(Vz / V0) / k;     // one-way
    // Vrms^2 = (1/t) * integral V^2 dt = (1/t) * integral V dz
    const intVdz = k < 1e-9 ? V0 * z : (Vz * Vz - V0 * V0) / (2 * k);
    return { t0: 2 * t, vrms: Math.sqrt(intVdz / t), vavg: z / t, vint: Vz };
  }

  /* ---------------------------------------------------------------------
     TUNING

     For a layer whose top and base reflections are equal and opposite, the
     peak amplitude of the composite is R times a factor that depends ONLY on
     the product of the wavelet's peak frequency and the two-way time across
     the layer. Not on frequency and thickness separately: a 15 m layer at
     40 Hz and a 20 m layer at 30 Hz tune identically.

     That is worth having as a table, because it turns a convolution inside
     every cell of a parameter sweep into one array lookup.

     tuningTable(wfn, f) samples the factor against x = f * dt on 0..4.
     For a Ricker the maximum is 1.4463 at x = sqrt(6)/2pi = 0.3898, which is
     where the wavelet's own peak-to-trough separation matches the layer.
     --------------------------------------------------------------------- */

  const TUNE_N = 400, TUNE_MAX = 4;

  function tuningTable(wfn, f) {
    const tab = new Float64Array(TUNE_N + 1);
    const span = 2.0 / f;
    const step = span / 900;
    for (let i = 0; i <= TUNE_N; i++) {
      const dt = (i * TUNE_MAX / TUNE_N) / f;
      let m = 0;
      for (let t = -span; t < span + dt; t += step) {
        const v = wfn(t) - wfn(t - dt);
        if (Math.abs(v) > Math.abs(m)) m = v;
      }
      tab[i] = Math.abs(m);
    }
    tab[0] = 0;
    return tab;
  }

  // Linear interpolation into a table from tuningTable(), x = f * dt.
  function tuningAt(tab, x) {
    if (!(x > 0)) return 0;
    if (x >= TUNE_MAX) return 1;
    const u = (x / TUNE_MAX) * TUNE_N;
    const i = Math.floor(u), g = u - i;
    return tab[i] + (tab[i + 1] - tab[i]) * g;
  }

  /* ---------------------------------------------------------------------
     UNCERTAINTY IN A STRAIGHT-LINE FIT

     An AVO intercept and gradient come from fitting a line to amplitudes
     against sin^2(theta). If each amplitude carries independent noise of
     standard deviation sigma, the uncertainty in the two fitted numbers has a
     closed form, and it is worth using rather than simulating: it is exact,
     it is instant, and it makes the structure obvious.

        sigma(G)  = sigma / sqrt(Sxx)
        sigma(R0) = sigma * sqrt(1/n + xbar^2 / Sxx)
        cov       = -sigma^2 * xbar / Sxx

     where Sxx is the spread of the x values about their own mean. Two things
     fall straight out. The gradient's error depends only on how SPREAD OUT the
     angles are, which is why a narrow angle range is so damaging. And the
     covariance is negative, so the two errors are anti-correlated: a fit that
     overestimates the intercept underestimates the gradient to compensate.
     --------------------------------------------------------------------- */

  function fitUncertainty(xs, sigma) {
    const n = xs.length;
    if (n < 3) return { sR0: NaN, sG: NaN, cov: NaN, rho: NaN };
    let sx = 0;
    for (const x of xs) sx += x;
    const xbar = sx / n;
    let Sxx = 0;
    for (const x of xs) Sxx += (x - xbar) * (x - xbar);
    const sG = sigma / Math.sqrt(Sxx);
    const sR0 = sigma * Math.sqrt(1 / n + (xbar * xbar) / Sxx);
    const cov = -sigma * sigma * xbar / Sxx;
    return { sR0, sG, cov, rho: cov / (sR0 * sG), xbar, Sxx, n };
  }

  /* Ordinary least squares through points, returning the same two numbers the
     modules fit. Separated out so the uncertainty above and the fit below
     cannot drift apart. */
  function fitLine(xs, ys) {
    const n = xs.length;
    if (n < 2) return { R0: NaN, G: NaN };
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-15) return { R0: NaN, G: NaN };
    const G = (n * sxy - sx * sy) / den;
    return { R0: (sy - G * sx) / n, G };
  }

  /* ---------------------------------------------------------------------
     SMALL UTILITIES
     --------------------------------------------------------------------- */

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  return {
    MINERAL, vrh, mineralMix,
    hertzMindlin, softSand, criticalPorosity,
    gasProps, waterProps, brineProps, oilProps,
    mixReuss, mixVoigt, mixBrie,
    gassmann, gassmannInverse,
    poisson, vp, vs, elastic, mudrock,
    fluidProps, poreFluid, rockModel,
    rcNormal, zoeppritz, akiRichards, shueyTerms, shuey,
    tuningTable, tuningAt, TUNE_MAX,
    rayLinearGradient, angleFromOffset, angleStraightRay, overburden,
    fitUncertainty, fitLine,
    clamp,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ROCK;
