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
  { no: '01', href: 'modules/the-echo.html', flag: 'Start here', ready: true, level: 'foundation',
    title: 'A pulse, a boundary, an echo',
    body: 'What a seismic survey physically does. The trace, two-way time, one echo per boundary, ' +
          'thickness from a time gap, and how single traces line up into a section.',
    q: 'What is a seismic trace a record of?', thumb: thumb00() },

  { no: '02', flag: 'To build', ready: false, level: 'foundation',
    title: 'Impedance and the reflection coefficient',
    body: 'Velocity and density combined into one number, why a reflection responds to a change ' +
          'rather than to a value, and what sets the sign.',
    q: 'What decides how strong an echo is?', thumb: thumb01() },
  { no: '03', flag: 'To build', ready: false, level: 'foundation',
    title: 'The wavelet, tuning and resolution',
    body: 'Why an echo is a wiggle and not a spike, what convolution means, and what happens to two ' +
          'echoes as a layer thins.',
    q: 'How thin a layer can seismic data separate?', thumb: thumb02() },
  { no: '04', flag: 'To build', ready: false, level: 'rock',
    title: 'Rocks, pores and stiffness',
    body: 'Grains and pore space, bulk density from volume fractions, and the two moduli that ' +
          'describe resistance to squeezing and to shearing.',
    q: 'What makes one rock faster than another?', thumb: thumb01() },
  { no: '05', flag: 'To build', ready: false, level: 'rock',
    title: 'Fluid in the pores',
    body: 'Why a pore fluid stiffens a rock against compression and not against shear, what that does ' +
          'to Vp, Vs and density, and where gas saturation stops mattering.',
    q: 'What does replacing brine with gas actually change?', thumb: thumb02() },

  { no: '06', href: 'modules/rock-to-trace.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Build a rock, make a trace',
    body: 'Porosity, clay and pore fluid to a dry frame, Gassmann to a saturated rock, impedance, ' +
          'reflectivity, a wavelet, and noise. Every step from the rock to the trace, on one page.',
    q: 'How does a change in the rock reach the seismic trace?', thumb: thumb01() },
  { no: '07', flag: 'To build', ready: false, level: 'avo',
    title: 'Offset, angle and the gather',
    body: 'Where offset comes from, why offset is not the same thing as angle, moveout, the gather, ' +
          'and what stacking keeps and discards.',
    q: 'What is a gather?', thumb: thumb03() },
  { no: '08', href: 'modules/add-offset.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Amplitude against angle',
    body: 'The ray stops arriving straight down, shear velocity becomes visible, and one measurement ' +
          'becomes a curve.',
    q: 'Why does the amplitude change with offset at all?', thumb: thumb03() },
  { no: '09', href: 'modules/intercept-gradient.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Intercept, gradient and the classes',
    body: 'Two numbers instead of a curve, the crossplot they live in, the wet trend that makes an ' +
          'anomaly anomalous, and why Classes I to IV are regions somebody drew.',
    q: 'What is a Class III response actually telling me?', thumb: thumb04() },
  { no: '10', href: 'modules/same-amplitude.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Several rocks, one amplitude',
    body: 'Fix the amplitude and search for every rock that could have produced it. Porosity against ' +
          'saturation, the shale nobody measured, tuning, and a full count of what survives.',
    q: 'How many rocks fit the amplitude I measured?', thumb: thumb02() },
  { no: '11', href: 'modules/reading-a-gather.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'Reading a gather you did not make',
    body: 'Noise, a limited angle range, and a gradient much less certain than the intercept. ' +
          'Where the error bars come from, and how big they really are.',
    q: 'How much do I trust this gradient?', thumb: thumb05() },
  { no: '12', href: 'modules/what-survives.html', flag: 'Being re-leveled', ready: true, level: 'legacy',
    title: 'What survives',
    body: 'Every loss added up, a count of what the second measurement removes, four rules of thumb ' +
          'with computed counterexamples, and a statement you could defend.',
    q: 'What can I actually say from this?', thumb: thumb06() },

  { no: '\u2014', href: 'modules/start-here.html', flag: 'Superseded', ready: true, level: 'legacy',
    title: 'What all of this is for (the old module 00)',
    body: 'The single foundation module the set used to open with. Its material is being spread across ' +
          'the new modules 01, 02, 03 and 07, at a slower pace. Kept while that is in progress.',
    q: 'Where do I start?', thumb: thumb00() },
];

const LEVEL_NOTE = {
  foundation: 'assumes first-year geology \u00b7 start here',
  rock: 'assumes modules 01\u201303',
  avo: 'assumes modules 01\u201306',
  closing: 'assumes everything before it',
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
      <h1 class="title">A seismic amplitude is <em>evidence</em>, not an answer.</h1>
      <p class="lede">Several things have to happen between a rock and a seismic amplitude. Grains and pores
        set a stiffness. The fluid changes it. Stiffness and density are multiplied together into one
        impedance. Two impedances are reduced to one contrast. A wavelet blurs the contrast in time, and
        noise puts an error bar around what is left. <strong>Every one of those steps throws information
        away</strong>, so working back from a bright spot to the rock does not have one answer.</p>
      <p class="lede">These modules build that calculation in front of you, one step at a time, and then
        go looking for the rocks that share an amplitude. Adding offset is what wins some of that information
        back — not all of it. Nothing to install, and nothing leaves your machine.</p>
      <div class="hero-cta">
        <a class="btn" href="modules/start-here.html">Start here — no equations →</a>
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
      <h3>It only works in one direction</h3>
      <p>A rock model predicts an amplitude exactly. An amplitude does not predict a rock at all, because
        several rocks arrive at the same number and nothing downstream can separate them.</p>
    </div>
    <div>
      <h3>The rules are shortcuts</h3>
      <p>Bright spot means gas. Class III means gas. Low impedance means hydrocarbons. Each is sometimes
        true, and each has a set of counterexamples you can build here in about thirty seconds.</p>
    </div>
    <div>
      <h3>AVO narrows, it does not solve</h3>
      <p>Offset adds a second measurement, so some ties get broken. Others do not. Knowing which ties break and which do not is the part that takes judgment.</p>
    </div>
   </div>
  </section>

  <!-- =============================== MODULES ============================== -->
  <section id="modules" class="modules">
    <div class="sec-head">
      <h2>The modules</h2>
      <p>In the order they build on each other. Each one adds a step, or takes one apart.
        Seven now, counting the foundation module. Each card says what it assumes.</p>
    </div>

    <div class="primer" style="margin:0 0 26px">
     <div class="primer-grid">
      <div>
        <h3>New to this</h3>
        <p>Read <b>00</b> first — it has no equations and assumes nothing. Then <b>01</b>, <b>02</b> and
          <b>03</b>, and stop there. That is a complete and useful course on its own.</p>
      </div>
      <div>
        <h3>You have used AVO before</h3>
        <p>Start at <b>01</b> and go straight through. Module 00 is still worth ten minutes if only to see
          which simplifications the rest of the set is going to come back for.</p>
      </div>
      <div>
        <h3>You do this for a living</h3>
        <p><b>05</b> and <b>06</b> are the ones with something new in them: the size of the error bars,
          and a count of what the gradient actually buys you.</p>
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
      weeks. <b>Module 00 assumes nothing at all</b> — not rock physics, not mathematics, not even that you
      know what impedance means. Modules 01 to 04 assume module 00. Modules 05 and 06 assume the four
      before them and are comfortable with standard deviations and correlation; they are written for
      people who already use these methods.</p>
    <p>The title is a promise about the later modules rather than the early ones. "Actually" means that
      each rule of thumb gets tested until it breaks, and that where it breaks is measured rather than
      asserted. If you have never met the rules, module 00 teaches them straight, in the confident form
      you would hear them at work, before anything comes back to qualify them.</p>
    <p>Everything runs in the browser. No installation and no account. Nothing you do inside a module —
      no slider, no click, no trace you generate — is transmitted anywhere, and the modules make no
      network requests at all. Each one works from a local copy with the network switched off, and the
      state of every control is written into the address bar, so a specific configuration can be handed
      out as a link.</p>
    <p>The one thing recorded is that a page was opened. No cookie, no account, nothing about you. I keep
      that count for two reasons: so the modules people actually use are the ones that get improved, and
      so I can show my university that you all are using these — which is how they keep getting built.</p>

    <p>Every panel is <b>computed</b> from the parameters on screen. There are no stored images and no
      curves drawn to look plausible, which means the tool can be wrong — and during construction it
      repeatedly was. A drawing cannot disagree with theory; a calculation can, and the disagreements are
      where the corrections came from. Every module carries a Method tab listing what has been left out and
      where the implementation departs from production software, and every number quoted in the exercises
      is read off the running page rather than estimated.</p>
    <p>A companion set on <a href="https://hbedle-subsurface.github.io/geometric-attributes/">geometric
      attributes</a> covers dip, coherence and curvature, and one on
      <a href="https://hbedle-subsurface.github.io/seismic_resolution/">seismic resolution</a> covers what
      you can and cannot separate in time.</p>
  </section>

  <footer>
    <div class="foot-grid">
      <p>Built for teaching by Heather Bedle, School of Geosciences, University of Oklahoma, with the
        <a href="https://www.ou.edu/mcee/labs/aaspi">AASPI</a> consortium.</p>
      <p class="lic">Free to use for teaching, demonstration, and non-commercial study, provided the source
        is credited. Please do not republish or redistribute it, modified or otherwise, without permission.
        If you use it in a course or a talk, a credit line and a link back are all that is asked.</p>
      <p class="lic">Nothing you do in these modules leaves your browser. The only thing recorded is that
        a page was opened, so that I can show the university these are being used — no cookie, no account,
        nothing about you.</p>
      <p class="lic">To cite: H. Bedle, <i>How AVO Actually Works</i>, University of
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
