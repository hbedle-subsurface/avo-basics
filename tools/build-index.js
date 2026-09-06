/* Generates index.html. The card thumbnails are computed from rockphysics.js
   and seismic.js rather than drawn, for the same reason the module panels are:
   a picture that cannot disagree with the theory is not telling you anything.
   Run: node tools/build-index.js */

const fs = require('fs');
const path = require('path');
const R = require('../assets/rockphysics.js');

const P = 23, T = 64, BG = '#F6F4EE';
const INK = '#16191C', CRIM = '#841617', TEAL = '#0B7285', GRAY = '#C7C9C0';
const W = 200, H = 104;

const shale = R.mudrock(2700);
const rock = (phi, fluid, s, extra) => R.rockModel(Object.assign(
  { vClay: 0, phi, fluid, sHc: s, api: 32, gor: 0, P, T }, extra));

function svg(inner) {
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
    'aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
    '<rect width="' + W + '" height="' + H + '" fill="' + BG + '"/>' + inner + '</svg>';
}
const f2 = (x) => (Math.round(x * 10) / 10).toString();

/* ---- 03: a boundary and the echo it makes ------------------------------- */
function thumbEcho() {
  const ric = (t, f) => { const a = Math.PI * Math.PI * f * f * t * t; return (1 - 2 * a) * Math.exp(-a); };
  const up = R.mudrock(2700);
  const lo = rock(0.30, 'gas', 1);
  const r0 = R.rcNormal(up, lo);
  const dt = 2 * 40 / lo.vp;
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const t = -0.05 + (i / 96) * 0.14;
    const v = r0 * ric(t, 30) - r0 * ric(t - dt, 30);
    pts.push(f2(140 + v * 150) + ',' + f2(6 + (i / 96) * 92));
  }
  const yT = 6 + ((0.05) / 0.14) * 92;
  const yB = 6 + ((0.05 + dt) / 0.14) * 92;
  return svg(
    '<rect x="10" y="6" width="96" height="' + f2(yT - 6) + '" fill="#E4E0D6"/>' +
    '<rect x="10" y="' + f2(yT) + '" width="96" height="' + f2(yB - yT) +
      '" fill="rgba(181,69,27,0.25)"/>' +
    '<rect x="10" y="' + f2(yB) + '" width="96" height="' + f2(98 - yB) + '" fill="#E4E0D6"/>' +
    '<line x1="10" y1="' + f2(yT) + '" x2="106" y2="' + f2(yT) + '" stroke="' + INK + '" stroke-width="1.6"/>' +
    '<line x1="10" y1="' + f2(yB) + '" x2="106" y2="' + f2(yB) + '" stroke="' + INK + '" stroke-width="1.6"/>' +
    '<line x1="140" y1="6" x2="140" y2="98" stroke="' + GRAY + '" stroke-width="1"/>' +
    '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + CRIM +
      '" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<text x="58" y="103" font-family="monospace" font-size="8" fill="' + INK +
      '" text-anchor="middle">two rocks</text>' +
    '<text x="150" y="103" font-family="monospace" font-size="8" fill="' + CRIM +
      '">the echo</text>');
}

/* ---- 01: two real synthetics, brine and gas, from the real physics -------- */
/* ---- 07: the iso-impedance curve, with real rocks sitting on it ---------- */
function thumbIso() {
  const target = rock(0.30, 'gas', 1).ip;
  const vpR = [1800, 3600], rhR = [1.7, 2.5];
  const X = (v) => 14 + ((v - vpR[0]) / (vpR[1] - vpR[0])) * 172;
  const Y = (r) => 94 - ((r - rhR[0]) / (rhR[1] - rhR[0])) * 82;
  let d = '';
  for (let v = vpR[0]; v <= vpR[1]; v += 20) {
    const rh = target / v;
    if (rh < rhR[0] || rh > rhR[1]) continue;
    d += (d ? ' L' : 'M') + f2(X(v)) + ' ' + f2(Y(rh));
  }
  let dots = '';
  for (const [phi, fl, s] of [[0.30, 'gas', 1], [0.22, 'gas', 0.08], [0.35, 'oil', 1]]) {
    const r = rock(phi, fl, s);
    const rh = target / r.vp;
    if (rh > rhR[0] && rh < rhR[1]) {
      dots += '<circle cx="' + f2(X(r.vp)) + '" cy="' + f2(Y(rh)) +
        '" r="4" fill="' + CRIM + '"/>';
    }
  }
  return svg(
    '<path d="' + d + '" fill="none" stroke="' + CRIM + '" stroke-width="2.4"/>' + dots +
    '<line x1="14" y1="94" x2="186" y2="94" stroke="' + GRAY + '" stroke-width="1.4"/>' +
    '<line x1="14" y1="12" x2="14" y2="94" stroke="' + GRAY + '" stroke-width="1.4"/>' +
    '<text x="100" y="103" font-family="monospace" font-size="8" fill="' + INK +
      '" text-anchor="middle">one impedance, many rocks</text>');
}

/* ---- 03/04/05/06: real Zoeppritz curves ---------------------------------- */
function avoCurves(cases, opts) {
  const o = opts || {};
  const yr = o.yr || [-0.25, 0.25];
  const X = (t) => 16 + (t / 40) * 168;
  const Y = (r) => 92 - ((r - yr[0]) / (yr[1] - yr[0])) * 80;
  let out = '<line x1="16" y1="' + f2(Y(0)) + '" x2="184" y2="' + f2(Y(0)) +
    '" stroke="' + GRAY + '" stroke-width="1.4"/>';
  for (const c of cases) {
    let d = '';
    for (let t = 0; t <= 40; t += 1) {
      const v = R.zoeppritz(c.a || shale, c.b, t);
      if (!isFinite(v)) break;
      d += (d ? ' L' : 'M') + f2(X(t)) + ' ' + f2(Y(v));
    }
    out += '<path d="' + d + '" fill="none" stroke="' + c.color +
      '" stroke-width="' + (c.w || 2.4) + '"' +
      (c.dash ? ' stroke-dasharray="5 4"' : '') + ' stroke-linecap="round"/>';
  }
  return out;
}

function thumbAVO() {
  return svg(avoCurves([
    { b: rock(0.30, 'gas', 1), color: CRIM },
    { b: rock(0.30, 'brine', 0), color: TEAL },
  ]) + '<text x="100" y="103" font-family="monospace" font-size="8" fill="' + INK +
    '" text-anchor="middle">0°　→　40°</text>');
}

function thumbCrossplot() {
  // intercept-gradient crossplot with the classes as regions, real points
  const X = (g) => 100 + g * 190;
  const Y = (r) => 54 - r * 190;
  let pts = '';
  const set = [
    [0.10, 'gas', 1, CRIM], [0.20, 'gas', 1, CRIM], [0.30, 'gas', 1, CRIM],
    [0.35, 'gas', 1, CRIM], [0.15, 'brine', 0, TEAL], [0.25, 'brine', 0, TEAL],
    [0.35, 'brine', 0, TEAL],
  ];
  for (const [phi, fl, s, c] of set) {
    const t = R.shueyTerms(shale, rock(phi, fl, s));
    const x = X(t.G), y = Y(t.R0);
    if (x > 8 && x < 192 && y > 6 && y < 98) {
      pts += '<circle cx="' + f2(x) + '" cy="' + f2(y) + '" r="4" fill="' + c + '"/>';
    }
  }
  return svg(
    '<line x1="10" y1="54" x2="190" y2="54" stroke="' + GRAY + '" stroke-width="1.4"/>' +
    '<line x1="100" y1="6" x2="100" y2="98" stroke="' + GRAY + '" stroke-width="1.4"/>' +
    '<line x1="26" y1="98" x2="174" y2="6" stroke="' + GRAY +
      '" stroke-width="1.6" stroke-dasharray="5 4"/>' + pts +
    '<text x="186" y="50" font-family="monospace" font-size="8" fill="' + INK +
      '" text-anchor="end">G</text>' +
    '<text x="104" y="14" font-family="monospace" font-size="8" fill="' + INK + '">R0</text>');
}
/* ================= one thumbnail per module, all computed ==================
   Every card has to be distinguishable at a glance, and seven pictures across
   thirteen cards did not manage it. Each of these is generated from the same
   rockphysics.js the modules use, so none of them can drift away from what the
   module actually shows.
   ------------------------------------------------------------------------ */

/* ---- 00: normal incidence, and the angle that is not it ----------------- */
function thumbAngleGeom() {
  const yB = 74, xs = 26, xm = 104;
  const th = 34 * Math.PI / 180;
  const dx = (yB - 16) * Math.tan(th);
  const arc = 'M ' + f2(xm) + ' ' + f2(yB - 26) + ' A 26 26 0 0 1 ' +
    f2(xm + 26 * Math.sin(th)) + ' ' + f2(yB - 26 * Math.cos(th));
  return svg(
    '<rect x="0" y="' + yB + '" width="200" height="' + (104 - yB) + '" fill="#E4DFD2"/>' +
    '<line x1="0" y1="' + yB + '" x2="200" y2="' + yB + '" stroke="' + INK +
      '" stroke-width="1.8"/>' +
    '<line x1="' + xs + '" y1="18" x2="' + xs + '" y2="' + yB + '" stroke="' + TEAL +
      '" stroke-width="2.6"/>' +
    '<circle cx="' + xs + '" cy="18" r="3.2" fill="' + TEAL + '"/>' +
    '<text x="' + xs + '" y="12" font-family="monospace" font-size="9" fill="' + TEAL +
      '" text-anchor="middle">0\u00b0</text>' +
    '<line x1="' + f2(xm - dx) + '" y1="18" x2="' + f2(xm) + '" y2="' + yB +
      '" stroke="' + CRIM + '" stroke-width="2.6"/>' +
    '<line x1="' + f2(xm) + '" y1="' + yB + '" x2="' + f2(xm + dx) + '" y2="18" stroke="' +
      CRIM + '" stroke-width="2.6"/>' +
    '<line x1="' + f2(xm) + '" y1="22" x2="' + f2(xm) + '" y2="' + yB + '" stroke="' +
      GRAY + '" stroke-width="1.2" stroke-dasharray="3 3"/>' +
    '<path d="' + arc + '" fill="none" stroke="' + CRIM + '" stroke-width="1.6"/>' +
    '<circle cx="' + f2(xm - dx) + '" cy="18" r="3.2" fill="' + CRIM + '"/>' +
    '<circle cx="' + f2(xm + dx) + '" cy="18" r="3.2" fill="' + CRIM + '"/>' +
    '<text x="' + f2(xm + 31) + '" y="' + f2(yB - 27) +
      '" font-family="monospace" font-size="9" fill="' + CRIM + '">34\u00b0</text>');
}

/* ---- 01: the grain pack, and how little of the mineral survives --------- */
function thumbGrains() {
  const min = R.mineralMix(0);
  const fr = R.softSand(min, 0.28, { P: P });
  const rnd = (() => { let a = 7; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; })();
  let pack = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = 12 + col * 14.5 + (row % 2 ? 7 : 0) + (rnd() - 0.5) * 3;
      const cy = 14 + row * 18 + (rnd() - 0.5) * 3;
      if (cx > 104 || cy > 96) continue;
      pack += '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' +
        f2(6.4 + rnd() * 1.4) + '" fill="#D8C9A4" stroke="#A08C5E" stroke-width="1"/>';
    }
  }
  const top = 46, base = 90, hMax = 62;
  const bar = (x, v, col, alpha) => {
    const h = (v / top) * hMax;
    return '<rect x="' + f2(x) + '" y="' + f2(base - h) + '" width="13" height="' +
      f2(h) + '" fill="' + col + '" opacity="' + alpha + '"/>';
  };
  return svg(pack +
    '<line x1="115" y1="10" x2="115" y2="96" stroke="' + GRAY + '" stroke-width="1"/>' +
    bar(126, min.K, TEAL, '0.30') + bar(141, fr.K, TEAL, '1') +
    bar(162, min.G, CRIM, '0.30') + bar(177, fr.G, CRIM, '1') +
    '<text x="140" y="100" font-family="monospace" font-size="8.5" fill="' + TEAL +
      '" text-anchor="middle">K</text>' +
    '<text x="176" y="100" font-family="monospace" font-size="8.5" fill="' + CRIM +
      '" text-anchor="middle">G</text>');
}

/* ---- 02: the saturation cliff ------------------------------------------ */
function thumbSaturation() {
  const min = R.mineralMix(0);
  const fr = R.softSand(min, 0.30, { P: P });
  const fl = R.fluidProps({ T: T, P: P, S: 0.035 });
  const vpAt = (sg) => {
    const m = R.mixReuss([{ K: fl.brine.K, rho: fl.brine.rho, s: 1 - sg },
      { K: fl.gas.K, rho: fl.gas.rho, s: sg }]);
    return R.vp(R.gassmann(fr.K, min.K, m.K, 0.30), fr.G,
      0.70 * min.rho + 0.30 * m.rho);
  };
  const lo = 2150, hi = 2800;
  const X = (sg) => 16 + sg * 168;
  const Y = (v) => 88 - ((v - lo) / (hi - lo)) * 72;
  let d = '';
  for (let i = 0; i <= 100; i++) {
    const sg = i / 100;
    d += (i ? ' L ' : 'M ') + f2(X(sg)) + ' ' + f2(Y(vpAt(sg)));
  }
  return svg(
    '<rect x="16" y="' + f2(Y(vpAt(0))) + '" width="' + f2(X(0.05) - 16) +
      '" height="' + f2(Y(vpAt(0.05)) - Y(vpAt(0))) + '" fill="' + CRIM + '" opacity="0.16"/>' +
    '<path d="' + d + '" fill="none" stroke="' + CRIM +
      '" stroke-width="2.6" stroke-linejoin="round"/>' +
    '<circle cx="' + f2(X(0)) + '" cy="' + f2(Y(vpAt(0))) + '" r="3.6" fill="' + TEAL + '"/>' +
    '<circle cx="' + f2(X(0.05)) + '" cy="' + f2(Y(vpAt(0.05))) + '" r="3.6" fill="' + CRIM + '"/>' +
    '<text x="100" y="100" font-family="monospace" font-size="8.5" fill="' + INK +
      '" text-anchor="middle">Vp against gas saturation</text>');
}

/* ---- 04: a gather, with its moveout ------------------------------------ */
function thumbGather() {
  const ric = (t, f) => { const a = Math.PI * Math.PI * f * f * t * t; return (1 - 2 * a) * Math.exp(-a); };
  const ob = R.overburden(2000, 1600, 0.5);
  const n = 13, xmax = 3000;
  const t0 = ob.t0;
  const tFar = Math.sqrt(t0 * t0 + (xmax * xmax) / (ob.vrms * ob.vrms));
  const tLo = t0 - 0.10, tHi = tFar + 0.10;
  const Y = (t) => 8 + ((t - tLo) / (tHi - tLo)) * 88;
  let out = '', hyp = '';
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * xmax;
    const t = Math.sqrt(t0 * t0 + (x * x) / (ob.vrms * ob.vrms));
    const cx = 12 + (i / (n - 1)) * 176;
    let pts = '';
    for (let k = 0; k <= 44; k++) {
      const tt = tLo + (k / 44) * (tHi - tLo);
      pts += f2(cx + ric(tt - t, 26) * 11) + ',' + f2(Y(tt)) + ' ';
    }
    out += '<polyline points="' + pts + '" fill="none" stroke="' + INK +
      '" stroke-width="1.3"/>';
    hyp += (i ? ' L ' : 'M ') + f2(cx) + ' ' + f2(Y(t));
  }
  return svg(out + '<path d="' + hyp + '" fill="none" stroke="' + CRIM +
    '" stroke-width="2" stroke-dasharray="5 4"/>');
}

/* ---- 08: the same rock, recorded a great many times -------------------- */
function thumbCloud() {
  const g = rock(0.30, 'gas', 1), b = rock(0.32, 'brine', 0);
  const angs = []; for (let a = 4; a <= 34; a += 2) angs.push(a);
  const xs = angs.map((a) => Math.pow(Math.sin(a * Math.PI / 180), 2));
  const rnd = (() => { let a = 99; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; })();
  const gauss = () => (rnd() + rnd() + rnd() + rnd() + rnd() + rnd() - 3) / 1.2;
  const fitOf = (rk) => R.fitLine(xs, angs.map((a) => R.zoeppritz(shale, rk, a)));
  const fg = fitOf(g), fb = fitOf(b);
  const midR = (fg.R0 + fb.R0) / 2, midG = (fg.G + fb.G) / 2;
  const X = (v) => 100 + ((v - midR) / 0.17) * 84;
  const Y = (v) => 50 - ((v - midG) / 0.70) * 40;
  let dots = '';
  [[g, CRIM], [b, TEAL]].forEach(([rk, col]) => {
    const amps = angs.map((a) => R.zoeppritz(shale, rk, a));
    for (let k = 0; k < 110; k++) {
      const noisy = amps.map((v) => v + gauss() * 0.020);
      const f = R.fitLine(xs, noisy);
      if (!isFinite(f.R0)) return;
      dots += '<circle cx="' + f2(X(f.R0)) + '" cy="' + f2(Y(f.G)) +
        '" r="1.9" fill="' + col + '" opacity="0.5"/>';
    }
  });
  return svg(
    '<line x1="14" y1="50" x2="186" y2="50" stroke="' + GRAY + '" stroke-width="1.2"/>' +
    '<line x1="100" y1="6" x2="100" y2="94" stroke="' + GRAY + '" stroke-width="1.2"/>' +
    dots +
    '<text x="100" y="101" font-family="monospace" font-size="8.5" fill="' + INK +
      '" text-anchor="middle">one rock, a thousand recordings</text>');
}

/* ---- 09: the losses, added up ------------------------------------------ */
function thumbFunnel() {
  /* Widths are the count of independent numbers left at each stage: six rock
     properties across the pair, two impedances, one contrast, two AVO terms. */
  const stages = [['6 rock properties', 6], ['2 impedances', 2],
    ['1 contrast', 1], ['2 AVO terms', 2]];
  let out = '';
  stages.forEach(([label, nn], i) => {
    const y = 10 + i * 23;
    const w = (nn / 6) * 96;
    out += '<rect x="14" y="' + f2(y) + '" width="' + f2(w) + '" height="15" fill="' +
      (i === stages.length - 1 ? TEAL : CRIM) + '" opacity="' + (0.30 + 0.18 * i) + '"/>' +
      '<text x="' + f2(14 + w + 6) + '" y="' + f2(y + 12) +
      '" font-family="monospace" font-size="8.5" fill="' + INK + '">' + label + '</text>';
  });
  return svg(out);
}

/* ---- the hero panel: the chain the headline names ----------------------
   The previous hero was five Zoeppritz curves, which is the same KIND of
   picture as the module 05 card thumbnail one screen further down, so the
   lead graphic was restating a card instead of introducing the set. The
   headline promises a chain from a rock to an amplitude, and no single card
   draws that chain, so the hero draws it: grains, then the two stiffnesses,
   then what a fluid does to the two velocities, then the reflection against
   angle. Every stage is computed from rockphysics.js at the same 30% porosity
   sand under the same shale, so the four panels are one rock followed through
   rather than four illustrations.

   Vp and Vs share one vertical axis in stage 3, and the axis is fixed rather
   than fitted to the bars, so the eye compares the two velocities directly and
   the drop in Vp is read against the flatness of Vs. */
const HW = 500, HH = 156;

function heroSvg(inner) {
  return '<svg viewBox="0 0 ' + HW + ' ' + HH + '" xmlns="http://www.w3.org/2000/svg" ' +
    'role="img" aria-label="The chain from a grain pack to a reflection that varies with angle: ' +
    'porosity, the two stiffnesses of the grain and of the pack, the two velocities before and ' +
    'after gas replaces brine, and the reflection coefficient against incidence angle for both ' +
    'fluids." preserveAspectRatio="xMidYMid meet">' +
    '<rect width="' + HW + '" height="' + HH + '" fill="' + BG + '"/>' + inner + '</svg>';
}

const hHead = (x, s) =>
  '<text x="' + f2(x) + '" y="18" font-family="monospace" font-size="8.5" fill="' + INK + '">' +
  s + '</text>';
const hFoot = (x, y, s, anchor) =>
  '<text x="' + f2(x) + '" y="' + f2(y) + '" font-family="monospace" font-size="7.5" ' +
  'fill="#6E7A83"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>';
const hArrow = (x, y) =>
  '<path d="M' + f2(x) + ' ' + f2(y - 4.5) + ' L' + f2(x + 5.5) + ' ' + f2(y) +
  ' L' + f2(x) + ' ' + f2(y + 4.5) + '" fill="none" stroke="#B9BDB4" ' +
  'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';

function thumbHero() {
  const PHI = 0.30;
  const brine = rock(PHI, 'brine', 0);
  const gas = rock(PHI, 'gas', 1);
  const min = R.mineralMix(0);
  const dry = R.softSand(min, PHI, { P });

  const TOP = 28, AXIS = 110, CAP = 138;   // one band shared by all four stages
  const SW = 96;                           // stage width
  const XS = [14, 136, 258, 380];          // stage left edges
  const mid = (TOP + AXIS) / 2;
  let o = '';

  /* ---------- 1. grains and the space between them ---------- */
  const x0 = XS[0];
  o += hHead(x0, 'the rock');
  /* Grains drawn with real gaps between them, because a pack with no visible
     pore space is a picture of a solid and the porosity caption would be doing
     all the work. */
  const gr = 5.2, pitch = 13.4, rows = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 8; c++) {
      const cx = x0 + 8 + c * pitch + (r % 2 ? pitch / 2 : 0);
      const cy = TOP + 9 + r * (pitch * 0.86);
      if (cx > x0 + SW - 6 || cy > AXIS - 6) continue;
      o += '<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' + f2(gr) +
        '" fill="#D9CDB0" stroke="#B8A87F" stroke-width="0.8"/>';
    }
  }
  o += hFoot(x0, CAP, Math.round(PHI * 100) + '% porosity');
  o += hArrow(x0 + SW + 10, mid);

  /* ---------- 2. the two stiffnesses ---------- */
  const x1 = XS[1];
  o += hHead(x1, 'two stiffnesses');
  /* K and G on ONE fixed axis, 0-50 GPa, which covers quartz. The pack bars
     come out tiny beside the grain bars, and that IS the lesson of module 01:
     the rock is far softer than the mineral it is made of. */
  const KMAX = 50, kh = AXIS - TOP - 2;
  const kY = (v) => AXIS - (v / KMAX) * kh;
  o += '<line x1="' + f2(x1) + '" y1="' + f2(AXIS) + '" x2="' + f2(x1 + SW) +
    '" y2="' + f2(AXIS) + '" stroke="' + GRAY + '" stroke-width="1.2"/>';
  [['K', min.K, dry.K, x1 + 14], ['G', min.G, dry.G, x1 + 56]].forEach(([nm, mv, fv, bx]) => {
    o += '<rect x="' + f2(bx) + '" y="' + f2(kY(mv)) + '" width="12" height="' +
      f2(AXIS - kY(mv)) + '" fill="#CBC9BE"/>';
    o += '<rect x="' + f2(bx + 14) + '" y="' + f2(kY(fv)) + '" width="12" height="' +
      f2(AXIS - kY(fv)) + '" fill="' + CRIM + '"/>';
    o += hFoot(bx + 13, AXIS + 9, nm, 'middle');
  });
  o += hFoot(x1, CAP, 'grain \u2192 pack');
  o += hArrow(x1 + SW + 10, mid);

  /* ---------- 3. what a fluid does to the velocities ---------- */
  const x2 = XS[2];
  o += hHead(x2, 'put gas in');
  /* Vp and Vs share one fixed axis so the fall in Vp is read against the
     flatness of Vs rather than against a neighbour that rescaled itself. */
  const VMAX = 3200, vh = AXIS - TOP - 2;
  const vY = (v) => AXIS - (v / VMAX) * vh;
  o += '<line x1="' + f2(x2) + '" y1="' + f2(AXIS) + '" x2="' + f2(x2 + SW) +
    '" y2="' + f2(AXIS) + '" stroke="' + GRAY + '" stroke-width="1.2"/>';
  [['Vp', brine.vp, gas.vp, x2 + 14], ['Vs', brine.vs, gas.vs, x2 + 56]].forEach(
    ([nm, bv, gv, bx]) => {
      o += '<rect x="' + f2(bx) + '" y="' + f2(vY(bv)) + '" width="12" height="' +
        f2(AXIS - vY(bv)) + '" fill="' + TEAL + '"/>';
      o += '<rect x="' + f2(bx + 14) + '" y="' + f2(vY(gv)) + '" width="12" height="' +
        f2(AXIS - vY(gv)) + '" fill="' + CRIM + '"/>';
      o += hFoot(bx + 13, AXIS + 9, nm, 'middle');
    });
  o += hFoot(x2, CAP, 'brine \u2192 gas');
  o += hArrow(x2 + SW + 10, mid);

  /* ---------- 4. the reflection, against angle ---------- */
  const x3 = XS[3];
  o += hHead(x3, 'the reflection');
  /* Fixed range, chosen to hold the whole of both curves out to 40 degrees with
     headroom: the gas sand reaches -0.282 there. Checked against the computed
     extremes below rather than fitted to them, so the picture cannot silently
     rescale if the default rock changes. */
  const RY = [-0.34, 0.08];
  const rX = (t) => x3 + (t / 40) * SW;
  const rY = (v) => AXIS - ((v - RY[0]) / (RY[1] - RY[0])) * (AXIS - TOP - 2);
  o += '<line x1="' + f2(x3) + '" y1="' + f2(rY(0)) + '" x2="' + f2(x3 + SW) +
    '" y2="' + f2(rY(0)) + '" stroke="' + GRAY + '" stroke-width="1.2"/>';
  [[brine, TEAL], [gas, CRIM]].forEach(([b, col]) => {
    let d = '';
    for (let t = 0; t <= 40; t += 1) {
      const v = R.zoeppritz(shale, b, t);
      if (!isFinite(v)) break;
      d += (d ? ' L' : 'M') + f2(rX(t)) + ' ' + f2(rY(v));
    }
    o += '<path d="' + d + '" fill="none" stroke="' + col +
      '" stroke-width="2.4" stroke-linecap="round"/>';
  });
  o += hFoot(x3, AXIS + 9, '0\u00b0');
  o += hFoot(x3 + SW, AXIS + 9, '40\u00b0', 'end');
  o += hFoot(x3, CAP, 'one number \u2192 a curve');

  /* A curve drawn outside its own box is the failure the module harness checks
     for and the index had no equivalent of, so the check lives here instead. */
  for (const b of [brine, gas]) {
    for (let t = 0; t <= 40; t += 1) {
      const v = R.zoeppritz(shale, b, t);
      if (isFinite(v) && (v < RY[0] || v > RY[1])) {
        throw new Error('hero: reflection coefficient ' + v.toFixed(4) + ' at ' + t +
          ' degrees falls outside the fixed axis [' + RY[0] + ', ' + RY[1] + ']');
      }
    }
  }

  return heroSvg(o);
}

/* ------------------------------------------------------------------------ */

const CARDS = [
  { no: '00', href: 'modules/beyond-normal-incidence.html', flag: 'Start here', ready: true,
    level: 'bridge',
    title: 'Beyond normal incidence',
    body: 'A recap of what the resolution modules established, the assumption every one of them shared, ' +
          'and the observation this set begins from: a reflection coefficient is not one number.',
    q: 'What does this set assume I already know?', thumb: thumbAngleGeom() },

  { no: '01', href: 'modules/rocks-and-stiffness.html', flag: '', ready: true, level: 'rock',
    title: 'Rocks, pores and stiffness',
    body: 'Grains and pore space, where bulk density comes from, the two separate ways a rock resists ' +
          'deformation, and why a change in one of them moves Vp and leaves Vs exactly where it was.',
    q: 'What makes one rock faster than another?', thumb: thumbGrains() },
  { no: '02', href: 'modules/fluid-in-the-pores.html', flag: '', ready: true, level: 'rock',
    title: 'Fluid in the pores',
    body: 'Brine, oil and gas as elastic materials, Gassmann\'s relation putting one into the frame, ' +
          'and why the first few percent of gas does almost all of the work.',
    q: 'What does replacing brine with gas actually change?', thumb: thumbSaturation() },
  { no: '03', href: 'modules/rock-to-trace.html', flag: '', ready: true, level: 'rock',
    title: 'From a rock to a trace',
    body: 'A reflection needs two rocks. Velocity and density collapse into impedance, impedance into a ' +
          'contrast, and the shear velocity never arrives at all.',
    q: 'How does a change in the rock reach the seismic trace?', thumb: thumbEcho() },

  { no: '04', href: 'modules/offset-and-the-gather.html', flag: '', ready: true, level: 'avo',
    title: 'Offset, angle and the gather',
    body: 'Where offset comes from, why it is not the same thing as the incidence angle, what moveout ' +
          'costs to remove, and what stacking throws away.',
    q: 'What is a gather?', thumb: thumbGather() },
  { no: '05', href: 'modules/add-offset.html', flag: '', ready: true, level: 'avo',
    title: 'Amplitude against angle',
    body: 'The ray stops arriving straight down, the shear velocities become visible, and one ' +
          'measurement becomes a curve.',
    q: 'Why does the amplitude change with angle at all?', thumb: thumbAVO() },
  { no: '06', href: 'modules/intercept-gradient.html', flag: '', ready: true,
    level: 'avo',
    title: 'Intercept, gradient and the classes',
    body: 'Two numbers instead of a curve, the crossplot they live in, the wet trend that makes an ' +
          'anomaly anomalous, and why Classes I to IV are regions somebody drew.',
    q: 'What is a Class III response actually telling me?', thumb: thumbCrossplot() },
  { no: '07', href: 'modules/same-amplitude.html', flag: '', ready: true, level: 'avo',
    title: 'Several rocks, one amplitude',
    body: 'Run the chain backwards. Fix a stacked amplitude and search for every rock that could have ' +
          'produced it: porosity against saturation, the shale nobody measured, and tuning.',
    q: 'How many rocks fit the amplitude I measured?', thumb: thumbIso() },
  { no: '08', href: 'modules/reading-a-gather.html', flag: '', ready: true,
    level: 'closing',
    title: 'Noise, error bars and what you can conclude',
    body: 'Real gathers carry noise and a mute. How large the error bars are, why the gradient takes ' +
          'almost all the damage, and whether the rocks can still be told apart.',
    q: 'How much do I trust this gradient?', thumb: thumbCloud() },
  { no: '09', href: 'modules/what-survives.html', flag: '', ready: true,
    level: 'closing',
    title: 'What survives',
    body: 'Every loss added up and measured, a count of what the second measurement removes, four rules ' +
          'of thumb with computed counterexamples, and a statement you could defend.',
    q: 'What can I actually say from this?', thumb: thumbFunnel() },

];

/* Only the bridge module carries a note, and the note names a prerequisite
   OUTSIDE this set. Inside the set the order is the assumption: the cards run
   00 to 09 down the page and each builds on the ones above it, so printing
   "assumes module 00" nine times restated the layout rather than adding to it.
   The `level` field is kept because the reading paths above the grid are
   written from it. */
const LEVEL_NOTE = {
  bridge: 'assumes the seismic resolution modules',
};
const cardHtml = (c) => `      <${c.ready ? 'a' : 'div'} class="card${c.ready ? '' : ' planned'}"${c.ready ? ` href="${c.href}"` : ''}>
        <div class="thumb">${c.thumb}</div>
        <div class="card-body">
          <div class="card-no">${c.no}${LEVEL_NOTE[c.level] ? `<span class="lvl">${LEVEL_NOTE[c.level]}</span>` : ''}</div>
          <h3>${c.title}</h3>
          <p>${c.body}</p>
          <div class="q">${c.q}</div>
        </div>
        ${c.flag ? `<span class="flag${c.ready ? ' next' : ''}">${c.flag}</span>` : ''}
      </${c.ready ? 'a' : 'div'}>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How AVO Actually Works</title>
<meta name="description" content="Interactive modules on rock physics, fluid substitution and AVO: build a rock, follow it to a seismic trace, and find out how many different rocks could have produced the same amplitude. Built for teaching by AASPI at the University of Oklahoma.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<style>
  /* the difficulty note on each card. Kept here rather than in the shared
     stylesheet, which is copied from the companion sites and stays untouched. */
  .card-no .lvl { display:block; margin-top:3px; font:400 10.5px/1.35 "IBM Plex Sans",sans-serif;
                  letter-spacing:0; text-transform:none; color:#5C6670; }
  .card.planned .card-no .lvl { color:#8A9299; }
</style>
</head>
<body>

<div class="wrap">
  <header class="masthead">
    <a class="brand" href="index.html"><span class="dot"></span>How AVO <b>actually</b> works</a>
    <nav>
      <a href="#modules">Modules</a>
      <a href="#about">About</a>
      <a href="https://www.ou.edu/mcee/labs/aaspi">AASPI</a>
    </nav>
  </header>

  <!-- ================================ HERO ================================ -->
  <section class="hero">
   <div class="hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">AASPI &nbsp;·&nbsp; University of Oklahoma</p>
      <h1 class="title">How a rock becomes a <em>seismic amplitude</em>.</h1>
      <p class="lede">Grains and pore space set how stiff a rock is. The fluid in the pores changes that
        stiffness, but not in every direction equally. Stiffness and density together set the velocities.
        Two rocks meeting at a boundary set a reflection. And once the sound arrives at an angle rather
        than straight down, that reflection stops being a single number and becomes a curve.</p>
      <p class="lede">These modules build that chain one step at a time, with every panel computed from
        the controls on screen. The later ones work the chain backwards, which is harder and does not
        have one answer. Nothing to install, and nothing leaves your machine.</p>
      <p class="lede prereq"><b>Start with the resolution modules.</b> This set assumes
        <a href="https://hbedle-subsurface.github.io/seismic_resolution/">What Can You REALLY See in Seismic?</a>, where impedance, the reflection
        coefficient, the wavelet and tuning are built from scratch. Module 00 here restates those results
        and picks up where they stop.</p>
      <div class="hero-cta">
        <a class="btn" href="modules/beyond-normal-incidence.html">Start at module 00 →</a>
        <a class="btn ghost" href="#modules">See all modules</a>
      </div>
    </div>
    <div class="hero-panel"><div class="thumb" style="border:0">${thumbHero()}</div>
      <div class="hero-cap"><span>one sand, followed all the way through</span><b>computed, not drawn</b></div></div>
   </div>
  </section>

  <!-- ============================== THE PREMISE ============================ -->
  <section class="primer">
   <div class="primer-grid">
    <div>
      <h3>Stiffness comes in two parts</h3>
      <p>A rock resists being squeezed and resists being sheared, and those are separate properties. A
        pore fluid changes the first and leaves the second almost alone, which is what makes a fluid
        visible to seismic data at all.</p>
    </div>
    <div>
      <h3>Angle turns one number into a curve</h3>
      <p>A wave arriving straight down only compresses the rock. One arriving at an angle also shears it,
        so the reflection changes across a recording — and changes differently depending on what is in
        the pores.</p>
    </div>
    <div>
      <h3>Then the chain runs backwards</h3>
      <p>Going from a rock to an amplitude is exact. Going the other way is not, because several rocks
        arrive at the same number. The last modules measure how many, and how much the second
        measurement removes.</p>
    </div>
   </div>
  </section>

  <!-- =============================== MODULES ============================== -->
  <section id="modules" class="modules">
    <div class="sec-head">
      <h2>The modules</h2>
      <p>Ten modules, in the order they build on each other, from the grains outward. Each card says what
        it assumes.</p>
    </div>

    <div class="primer" style="margin:0 0 26px">
     <div class="primer-grid">
      <div>
        <h3>New to this</h3>
        <p>Work through the <a href="https://hbedle-subsurface.github.io/seismic_resolution/">resolution modules</a> first. Then <b>00</b>,
          <b>01</b>, <b>02</b> and <b>03</b>, and stop there. That is a complete and useful course on
          its own.</p>
      </div>
      <div>
        <h3>You have used AVO before</h3>
        <p>Start at <b>04</b> and go straight through. Module 00 is still worth ten minutes if only to
          see which simplifications the rest of the set comes back for, and 01 to 03 are quick if the
          rock physics is already familiar.</p>
      </div>
      <div>
        <h3>You do this for a living</h3>
        <p><b>07</b>, <b>08</b> and <b>09</b> are the ones with something new in them: how many rocks
          share an amplitude, the size of the error bars, and a count of what the gradient actually buys
          you.</p>
      </div>
     </div>
    </div>

    <div class="card-grid">

${CARDS.map(cardHtml).join('\n\n')}

    </div>
  </section>

  <!-- ================================ ABOUT =============================== -->
  <section id="about" class="about">
    <h2>About these modules</h2>
    <p>They are built for students meeting seismic interpretation for the first time, and for anyone who
      arrived in an interpretation role from an adjacent discipline and is expected to be productive in
      weeks. Beyond the resolution modules named above, they assume first-year geology and nothing
      else.</p>
    <p>The title is a promise about the later modules rather than the early ones. "Actually" means that
      each rule of thumb gets tested until it breaks, and that where it breaks is measured rather than
      asserted. The early modules build the forward calculation without qualifying it, because running
      that calculation confidently is what the later ones take apart.</p>
    <p>Every panel is <b>computed</b> from the parameters on screen. There are no stored images and no
      curves drawn to look plausible, which means the tool can be wrong — and during construction it
      repeatedly was. A drawing cannot disagree with theory; a calculation can, and the disagreements are
      where the corrections came from. Every module carries a Method tab listing what has been left out
      and where the implementation departs from production software, and every number quoted in the
      exercises is read off the running page rather than estimated.</p>
    <p>No slider, no click and no trace you generate is transmitted anywhere, and the modules make no
      network requests at all. The state of every control is written into the address bar, so a
      configuration can be handed out as a link. The one thing recorded is that a page was opened, with
      no cookie and nothing about you.</p>
    <p>A further companion set on
      <a href="https://hbedle-subsurface.github.io/geometric-attributes/">geometric attributes</a> covers
      dip, coherence and curvature, and is independent of this one and of the resolution modules.</p>
  </section>

  <footer>
    <div class="foot-grid">
      <p>Built for teaching by Dr. Heather Bedle and Dr. April Moreno-Ward, School of Geosciences,
        University of Oklahoma, with the <a href="https://www.ou.edu/mcee/labs/aaspi">AASPI</a>
        consortium.</p>
      <p class="lic">To cite: H. Bedle and A. Moreno-Ward, <i>How AVO Actually Works</i>, University of
        Oklahoma. <span class="k">SSRN: [article link to follow]</span></p>
      <p class="lic">Licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
        — free to use, adapt and share, including commercially, provided the source is credited and
        adaptations carry the same license. Full text in <code>LICENSE</code>.</p>
    </div>
  </footer>
</div>

<script src="assets/count.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('index.html written, ' + html.length + ' bytes, ' + CARDS.length + ' cards');
console.log('thumbnails computed from: shale Vp ' + Math.round(shale.vp) +
  ', gas sand 30% R = ' + R.rcNormal(shale, rock(0.30, 'gas', 1)).toFixed(4));
