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

/* ---- 00: a boundary and the echo it makes ------------------------------- */
function thumb00() {
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
function thumb01() {
  const ric = (t, f) => { const a = Math.PI * Math.PI * f * f * t * t; return (1 - 2 * a) * Math.exp(-a); };
  const trace = (r0, vp, x0) => {
    const tTop = 0, tBase = 2 * 30 / vp;
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const t = -0.045 + (i / 96) * 0.13;
      const v = r0 * ric(t - tTop, 30) - r0 * ric(t - tBase, 30);
      pts.push(f2(x0 + v * 150) + ',' + f2(4 + (i / 96) * 96));
    }
    return pts.join(' ');
  };
  const b = rock(0.30, 'brine', 0), g = rock(0.30, 'gas', 1);
  const rb = R.rcNormal(shale, b), rg = R.rcNormal(shale, g);
  return svg(
    '<line x1="60" y1="4" x2="60" y2="100" stroke="' + GRAY + '" stroke-width="1"/>' +
    '<line x1="140" y1="4" x2="140" y2="100" stroke="' + GRAY + '" stroke-width="1"/>' +
    '<polyline points="' + trace(rb, b.vp, 60) + '" fill="none" stroke="' + INK +
      '" stroke-width="2" stroke-linejoin="round"/>' +
    '<polyline points="' + trace(rg, g.vp, 140) + '" fill="none" stroke="' + CRIM +
      '" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<text x="60" y="100" font-family="monospace" font-size="9" fill="' + INK +
      '" text-anchor="middle">brine</text>' +
    '<text x="140" y="100" font-family="monospace" font-size="9" fill="' + CRIM +
      '" text-anchor="middle">gas</text>');
}

/* ---- 02: the iso-impedance curve, with real rocks sitting on it ---------- */
function thumb02() {
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

function thumb03() {
  return svg(avoCurves([
    { b: rock(0.30, 'gas', 1), color: CRIM },
    { b: rock(0.30, 'brine', 0), color: TEAL },
  ]) + '<text x="100" y="103" font-family="monospace" font-size="8" fill="' + INK +
    '" text-anchor="middle">0°　→　40°</text>');
}

function thumb04() {
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

function thumb05() {
  const cases = [];
  const cols = [CRIM, '#B5451B', TEAL, '#2A7B9B', '#6B7A2E'];
  [[0.32, 'gas', 1], [0.20, 'gas', 1], [0.30, 'brine', 0],
   [0.35, 'brine', 0], [0.30, 'oil', 1]].forEach(([p, f, s], i) => {
    cases.push({ b: rock(p, f, s), color: cols[i], w: 2.1 });
  });
  return svg(avoCurves(cases) +
    '<text x="100" y="103" font-family="monospace" font-size="8" fill="' + INK +
    '" text-anchor="middle">five reservoirs, one gather</text>');
}

function thumb06() {
  const g = rock(0.30, 'gas', 1);
  let dots = '';
  const rnd = (() => { let a = 42; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; })();
  const X = (t) => 16 + (t / 40) * 168;
  const Y = (r) => 92 - ((r + 0.25) / 0.5) * 80;
  for (let t = 2; t <= 40; t += 3.5) {
    const v = R.zoeppritz(shale, g, t) + (rnd() - 0.5) * 0.075;
    dots += '<circle cx="' + f2(X(t)) + '" cy="' + f2(Y(v)) + '" r="3.4" fill="' + CRIM + '"/>';
  }
  return svg(avoCurves([{ b: g, color: GRAY, w: 2, dash: true }]) + dots +
    '<text x="100" y="103" font-family="monospace" font-size="8" fill="' + INK +
    '" text-anchor="middle">what would you fit through this?</text>');
}

/* ------------------------------------------------------------------------ */

const CARDS = [
  { no: '00', href: 'modules/beyond-normal-incidence.html', flag: 'Start here', ready: true,
    level: 'bridge',
    title: 'Beyond normal incidence',
    body: 'A recap of what the resolution modules established, the assumption every one of them shared, ' +
          'and the observation this set begins from: a reflection coefficient is not one number.',
    q: 'What does this set assume I already know?', thumb: thumb00() },

  { no: '01', flag: 'To build', ready: false, level: 'rock',
    title: 'Rocks, pores and stiffness',
    body: 'Grains and pore space, where bulk density comes from, and the two separate ways a rock ' +
          'resists deformation \u2014 against compression, and against shearing.',
    q: 'What makes one rock faster than another?', thumb: thumb01() },
  { no: '02', flag: 'To build', ready: false, level: 'rock',
    title: 'Fluid in the pores',
    body: 'Why a pore fluid stiffens a rock against compression and not against shear, what that does ' +
          'to Vp, Vs and density, and where gas saturation stops mattering.',
    q: 'What does replacing brine with gas actually change?', thumb: thumb02() },
  { no: '03', href: 'modules/rock-to-trace.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'From a rock to a trace',
    body: 'Porosity, clay and pore fluid to a dry frame, Gassmann to a saturated rock, impedance, ' +
          'reflectivity, a wavelet, and noise. Every step from the rock to the trace, on one page.',
    q: 'How does a change in the rock reach the seismic trace?', thumb: thumb01() },

  { no: '04', flag: 'To build', ready: false, level: 'avo',
    title: 'Offset, angle and the gather',
    body: 'Where offset comes from, why offset is not the same thing as angle, moveout, the gather, ' +
          'and what stacking keeps and discards.',
    q: 'What is a gather?', thumb: thumb03() },
  { no: '05', href: 'modules/add-offset.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Amplitude against angle',
    body: 'The ray stops arriving straight down, shear velocity becomes visible, and one measurement ' +
          'becomes a curve.',
    q: 'Why does the amplitude change with angle at all?', thumb: thumb03() },
  { no: '06', href: 'modules/intercept-gradient.html', flag: 'Being re-leveled', ready: true,
    level: 'legacy',
    title: 'Intercept, gradient and the classes',
    body: 'Two numbers instead of a curve, the crossplot they live in, the wet trend that makes an ' +
          'anomaly anomalous, and why Classes I to IV are regions somebody drew.',
    q: 'What is a Class III response actually telling me?', thumb: thumb04() },
  { no: '07', href: 'modules/same-amplitude.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Several rocks, one amplitude',
    body: 'Fix the amplitude and search for every rock that could have produced it. Porosity against ' +
          'saturation, the shale nobody measured, tuning, and a full count of what survives.',
    q: 'How many rocks fit the amplitude I measured?', thumb: thumb02() },
  { no: '08', href: 'modules/reading-a-gather.html', flag: 'Being re-leveled', ready: true,
    level: 'legacy',
    title: 'Noise, error bars and what you can conclude',
    body: 'Noise, a limited angle range, and a gradient much less certain than the intercept. Where the ' +
          'error bars come from, how big they are, and what a defensible statement looks like.',
    q: 'How much do I trust this gradient?', thumb: thumb05() },
  { no: '—', href: 'modules/what-survives.html', flag: 'To merge into 08', ready: true,
    level: 'legacy',
    title: 'What survives',
    body: 'Every loss added up, a count of what the second measurement removes, four rules of thumb ' +
          'with computed counterexamples. Being merged with the module above.',
    q: 'What can I actually say from this?', thumb: thumb06() },

  { no: '\u2014', href: 'modules/start-here.html', flag: 'Superseded', ready: true, level: 'legacy',
    title: 'What all of this is for (the old module 00)',
    body: 'The original single foundation module. Its material is covered by the resolution modules ' +
          'and by the new module 00. Kept while the rebuild is in progress.',
    q: 'Where do I start?', thumb: thumb00() },
  { no: '\u2014', href: 'modules/the-echo.html', flag: 'Moving out', ready: true, level: 'legacy',
    title: 'A pulse, a boundary, an echo',
    body: 'Written before the resolution modules were taken as a prerequisite, and largely duplicated ' +
          'by them. Its two original pieces are being folded into the resolution set.',
    q: 'What is a seismic trace a record of?', thumb: thumb00() },
];

const LEVEL_NOTE = {
  bridge: 'assumes the seismic resolution modules',
  rock: 'assumes module 00',
  avo: 'assumes modules 00\u201303',
  legacy: 'written before the re-leveling \u00b7 pitched higher',
};
const cardHtml = (c) => `      <${c.ready ? 'a' : 'div'} class="card${c.ready ? '' : ' planned'}"${c.ready ? ` href="${c.href}"` : ''}>
        <div class="thumb">${c.thumb}</div>
        <div class="card-body">
          <div class="card-no">${c.no}<span class="lvl">${LEVEL_NOTE[c.level] || ''}</span></div>
          <h3>${c.title}</h3>
          <p>${c.body}</p>
          <div class="q">${c.q}</div>
        </div>
        <span class="flag${c.ready ? ' next' : ''}">${c.flag}</span>
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
    <div class="hero-panel"><div class="thumb" style="border:0">${thumb05()}</div>
      <div class="hero-cap"><span>five different reservoirs</span><b>computed, not drawn</b></div></div>
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
      <p>In the order they build on each other, from the rock outward. Each card says what it assumes.
        The set is being re-leveled for undergraduate geology students: the cards marked
        <em>being re-leveled</em> work correctly and are pitched higher than the rest, and the ones
        marked <em>to build</em> are not written yet.</p>
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
          see which simplifications the rest of the set is going to come back for.</p>
      </div>
      <div>
        <h3>You do this for a living</h3>
        <p><b>07</b> and <b>08</b> are the ones with something new in them: how many rocks share an
          amplitude, the size of the error bars, and a count of what the gradient actually buys you.</p>
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
      weeks. <b>The set assumes the <a href="https://hbedle-subsurface.github.io/seismic_resolution/">seismic resolution modules</a></b> and
      first-year geology, and nothing else. Module 00 restates what those modules established. Modules 01
      to 03 build the rock. Module 04 introduces offset and the gather, and 05 to 08 work on what the
      angles add and what they cost.</p>
    <p>The title is a promise about the later modules rather than the early ones. "Actually" means that
      each rule of thumb gets tested until it breaks, and that where it breaks is measured rather than
      asserted. The early modules build the forward calculation without qualifying it, because running
      that calculation confidently is what the later ones take apart.</p>
    <p>Everything runs in the browser. No installation and no account. Nothing you do inside a module —
      no slider, no click, no trace you generate — is transmitted anywhere, and the modules make no
      network requests at all. Each one works from a local copy with the network switched off, and the
      state of every control is written into the address bar, so a specific configuration can be handed
      out as a link.</p>
    <p>The one thing recorded is that a page was opened. No cookie, no account, nothing about you. We keep
      that count for two reasons: so the modules people actually use are the ones that get improved, and
      so we can show the university that these are being used, which is how they keep getting built.</p>

    <p>Every panel is <b>computed</b> from the parameters on screen. There are no stored images and no
      curves drawn to look plausible, which means the tool can be wrong — and during construction it
      repeatedly was. A drawing cannot disagree with theory; a calculation can, and the disagreements are
      where the corrections came from. Every module carries a Method tab listing what has been left out and
      where the implementation departs from production software, and every number quoted in the exercises
      is read off the running page rather than estimated.</p>
    <p><a href="https://hbedle-subsurface.github.io/seismic_resolution/">Seismic resolution</a> is the prerequisite for this set and covers what
      can and cannot be separated in time. A further companion set on
      <a href="https://hbedle-subsurface.github.io/geometric-attributes/">geometric attributes</a> covers
      dip, coherence and curvature, and is independent of both.</p>
  </section>

  <footer>
    <div class="foot-grid">
      <p>Built for teaching by Dr. Heather Bedle and Dr. April Moreno-Ward, School of Geosciences,
        University of Oklahoma, with the <a href="https://www.ou.edu/mcee/labs/aaspi">AASPI</a>
        consortium.</p>
      <p class="lic">Licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
        Free to use, adapt and share, including in teaching and including commercially, provided the
        source is credited and any adaptation is released under the same license. The full legal text is
        in <code>LICENSE</code> at the repository root.</p>
      <p class="lic">Nothing you do in these modules leaves your browser. The only thing recorded is that
        a page was opened, so that we can show the university these are being used — no cookie, no
        account, nothing about you.</p>
      <p class="lic">To cite: H. Bedle and A. Moreno-Ward, <i>How AVO Actually Works</i>, University of
        Oklahoma. <span class="k">SSRN: [article link to follow]</span></p>
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
