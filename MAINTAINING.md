# Maintaining these modules

Working notes for whoever edits this repository next. For what the site is
*for*, and who it is for, see [README.md](README.md).

Live at <https://hbedle-subsurface.github.io/avo-basics/>.
Companion to [geometric-attributes](https://hbedle-subsurface.github.io/geometric-attributes/)
and [seismic_resolution](https://hbedle-subsurface.github.io/seismic_resolution/).

## Layout

    index.html                   landing page (generated — see below)
    assets/style.css             shared stylesheet, copied from the geometric-attributes repo
    assets/seismic.js            shared wavelets, traces, noise, plotting, URL state (copied, unchanged)
    assets/rockphysics.js        minerals, dry frames, Batzle-Wang fluids, Gassmann, Zoeppritz
    assets/count.js              usage counter, shared verbatim with the other teaching repos
    assets/panelout.js           control-panel pop-out, shared verbatim with the other teaching repos
    modules/beyond-normal-incidence.html  Module 00 — recap of the resolution set, and the bridge
    modules/rocks-and-stiffness.html      Module 01 — grains, pore space, K and G
    modules/fluid-in-the-pores.html       Module 02 — fluids, Gassmann, the saturation curve
    modules/rock-to-trace.html            Module 03 — two rocks, one number, a trace
    modules/offset-and-the-gather.html    Module 04 — CMP gathers, offset vs angle, moveout, stack
    modules/add-offset.html               Module 05 — amplitude against angle
    modules/intercept-gradient.html       Module 06 — intercept, gradient and the classes
    modules/same-amplitude.html           Module 07 — several rocks, one amplitude
    modules/reading-a-gather.html         Module 08 — noise and error bars
    modules/what-survives.html            Module 09 — what survives
    tools/                                verification; not deployed

The filenames predate the re-levelling and no longer match the numbering. Do
not rename them: every module carries its own URL state and old links are worth
keeping. `tools/build-index.js` is the single place that maps a file to its
number and title, and `verify-deploy.js` treats the generated index as the
reference for both.

`assets/style.css` and `assets/seismic.js` are **copies**, not links to the other
repo. Each site has to work from a local folder with the network off, so
cross-repo references are not an option. When either file changes upstream, copy
it across and re-run the checks.

## Before you push

    npm test

The first thing it runs is `verify-deploy.js`, which prints a manifest of what
must be in the repository, what is documentation, and what `.gitignore` keeps
out. If that passes, everything the site needs is present and consistent.

## Deploying

Static files. Push to GitHub and enable Pages on the branch root. Nothing to
build, no dependencies at runtime. `tools/` and `package.json` are
development only, but weigh a few KB and are worth keeping in the repo so the
checks can be re-run later. `node_modules/` is gitignored.

## Verifying

    npm install        # once, pulls jsdom for the headless harness
    npm test           # or: ./tools/verify-all.sh

which runs, in order:

| check | what it proves |
|---|---|
| `verify-physics.js` | 58 closed-form tests: Batzle-Wang against published water velocity, Gassmann round trips to 1e-15, Zoeppritz at 0° equal to (I₂−I₁)/(I₂+I₁), zero contrast returning exactly zero |
| `harness.js` | the page boots, every `$(id)` resolves, every readout is populated, and 297 states per control produce no NaN |
| `harness.js geometry` | nothing is drawn outside its canvas, at 7 viewport widths × 5 panes |
| `harness.js` (axis check) | every vertical axis runs the same way as the data drawn against it. `SEIS.axisLeft` without `flip` puts the MINIMUM at the top, which is right for time and depth and wrong for everything else, because `curve()` and the other value plots put the minimum at the bottom. It found eleven upside-down axes the first time it ran, across three modules. |
| `harness.js axes` | reads the tick labels off the RENDERED page and checks the larger value sits higher up, for value axes, and lower for time and depth. This is stronger than the source-level lint: it tests the picture rather than the code. It only considers right-aligned numeric columns, since that is what `SEIS.axisLeft` produces — a left-aligned column of numbers is a table, not an axis. |
| `harness.js labels` | no two pieces of text land on top of each other. The geometry check cannot see this: an axis label and a legend can overlap perfectly while both sit inside the canvas, which is exactly what happened when `SEIS.axisBottom` put its label 22 px below the plot and `legendRow` put its first line at 26. It found 38 collisions the first time it ran. |
| `harness.js tuning` | the tuning thickness the page *measures* matches √6·Vp/(4πf) |
| `verify-prose-m00.js` … `verify-prose-m09.js` | one per module: every number the prose quotes still matches what the page computes, comparing values rather than strings |
| `verify-deploy.js` | every file a page references exists, with the right case and relative depth; every page loads the counter and its libraries in order; every module is linked from the index. This is the one that catches "works on my machine, 404s on Pages" |
| `verify-deploy.js` (numbering) | the index is the reference for what each module is called and what number it carries. Every page's `<title>` and `<h1>` must match its own card; every "module NN" in body prose must resolve to a module that exists and must not be the page making the mention; a nav bar must be the standard three items with no numbered module link in it. This is the check the re-levelling from seven modules to ten needed and did not have — the prose verifiers check numbers, not module numbers, so five wrong cross-references, two wrong page titles and two nav links pointing two modules further on all passed everything. |
| `verify-deploy.js` (house style) | every module can pop its exercises into a separate window (`popEx` + `exList`), and has five exercises each labelled Answer rather than Hint |
| `verify-count.js` | the usage counter sends the module name and never the query string, honours Do Not Track, and skips local copies |
| `harness-panelout.js` | the control panel, driven from its second window: every slider reaches its counterpart, a button click and a press on a canvas are forwarded, the readouts come back, and the panel returns to the page at full width when the window closes |

The `verify-prose` scripts are the ones to re-run after any physics change.
They extract the numbers from the prose and from the running page and compare
them, so the text cannot quietly drift away from the code. Both are wired into
`npm test`.

Module 07 (`same-amplitude.html`) sweeps 457,560 forward models on every update.
That is only fast enough because the dry frame, the pore fluid, the shale and
the tuning factor are each tabulated once rather than recomputed per cell, and
because the step 5 panel is memoized on the parameters that can actually change
its answer. If you add a parameter to the search, check `tools/harness.js m2`
still returns promptly before assuming it scales. (That mode is named `m2` from
the old numbering and drives module 07.)

## Who each module is for

The set is a ladder and the index says so on every card. The note on each card
comes from its `level` in `tools/build-index.js`, and the four levels are:

- **`bridge`** — module 00. Assumes the seismic resolution modules and nothing
  else from this set. It restates their four results, names the normal-incidence
  assumption all of them shared, and shows the reflection coefficient varying
  with angle. It introduces nothing new about rocks.
- **`rock`** — modules 01–03. Assume module 00. Grains and moduli, then fluids
  and Gassmann, then two rocks and a trace. A student who does the resolution
  set and stops after 03 has had a complete short course.
- **`avo`** — modules 04–07. Assume 00–03. Recording geometry, the angle-
  dependent amplitude, its reduction to two numbers, and the first count of the
  solution set.
- **`closing`** — modules 08 and 09. Assume everything before them and are the
  heaviest in the set. 08 uses standard deviations, covariance and correlation.
  Both are written for people who already use these methods.

The resolution set is a **prerequisite**, not a preamble. Nothing here re-derives
impedance, the reflection coefficient, the wavelet or tuning. If you find
yourself explaining one of those, it belongs in that repo instead.

Only the `bridge` card prints its note on screen. The other three levels are
kept as data because the three reading paths above the card grid are written
from them, but the cards themselves no longer say "assumes module 00" nine
times: the grid runs 00 to 09 down the page, so the order already carries that,
and the only assumption worth printing is the one pointing OUTSIDE this set.
If you add a module, give it a `level` so it lands in the right reading path.

## The lead graphic

`thumbHero()` in `build-index.js` draws the chain the headline names: a grain
pack, the two stiffnesses of the grain against the pack, what a fluid does to
the two velocities, and the reflection against angle. All four stages are one
30% porosity sand under one shale, computed from `rockphysics.js`, so it is the
same rock followed through rather than four illustrations.

It replaced five Zoeppritz curves, which were the same *kind* of picture as the
module 05 card thumbnail one screen further down — the lead graphic was
restating a card instead of introducing the set.

Two rules it follows, both worth keeping:

- **K and G share one axis, and so do Vp and Vs.** The point of stage 3 is that
  Vp falls a long way and Vs does not, and that is only readable if the two are
  measured against the same scale.
- **Every axis is fixed, not fitted.** The reflection panel asserts its range
  and then throws if either curve leaves it, because a curve drawn outside its
  box is what the module harness checks for and the index had no equivalent of.
  The first draft had a floor of −0.26 and the gas sand reaches −0.282 at 40°,
  so it drew below the plot. If you change the default rock, the build will
  fail rather than crop the picture.

## A convention the modules follow

Every step pairs an abstract picture with a concrete one, always the same way
round: the **left** panel shows all the possibilities at once (a parameter-space
map in module 07, an amplitude-against-angle curve in module 05), and the
**right** panel shows a few actual rocks written out — their parameters, their
numbers, and the trace or gather each one produces. Beginners get very little
from a contour on its own; they get the point immediately from two cards whose
traces are visibly the same.

Two things follow from that if you edit these pages:

- When an image is drawn with `ampMap`, row 0 is the TOP and holds the HIGHEST
  value on the vertical axis, so the matching `SEIS.axisLeft` call needs
  `flip: true`. Getting this wrong labels the picture upside down and nothing in
  the test suite will notice — the geometry checker only knows whether ink lands
  inside the canvas, not whether the axis agrees with the image.
- `gatherCard` and `matchCards` are the concrete-panel helpers. Reuse them
  rather than inventing a new layout, so the pattern stays learnable.
- Any panel that carries a legend should be sized with `fitLegend`, which
  measures how many lines the legend needs before the plot box is chosen. A
  legend that wraps to a second line will otherwise draw it off the canvas.
- `legendRow` draws at +46 below the plot, which clears the axis label at +22.
  Do not move it back up.
- Any `SEIS.axisLeft` for a value (not time or depth) needs `flip: true`. The
  structural check enforces this by reading the label, so a new axis called
  something with "time" or "depth" in it is treated as downward-increasing and
  everything else is not.

## Usage counting

`assets/count.js`, loaded by all eleven pages, **switched on**, account code
`hbedle`, counts at <https://hbedle.goatcounter.com>.

This file is shared verbatim with the other teaching repositories
(`single-trace`, `geometric-attributes`, `seismic_resolution`,
`attribute_quiz`). One GoatCounter account covers all of them because they are
served from one domain and the path tells them apart. **If you change it here,
change it in all of them** — see `ADD-COUNTING.md` for the canonical
instructions.

**One thing in it is not optional.** GoatCounter's stock behaviour reports the
path *and the query string*. Every module in every one of these repositories
writes the position of every control into the query string, so without
intervention each visit files under its own dashboard row — one module of this
site has about eleven billion reachable URLs, and five hundred visits would show
as five hundred rows of one view each with a module total of zero. The
`window.goatcounter.path` setting in `count.js` strips it. That is GoatCounter's
own supported mechanism, it must be set before their script loads, and every
repository needs it. Removing it breaks nothing visibly; it quietly makes the
dashboard useless.

`tools/verify-count.js` tests all of this, including that a URL carrying a full
set of slider positions reports as a bare module path.

### What not to do

- **No event tracking.** Page loads only. Counting what someone does inside a
  module is watching them work, and would contradict what the site says.
- **Do not modify the guards.** `file://`, `localhost`, `127.0.0.1` and Do Not
  Track are there on purpose.
- **Do not add a second analytics tool.**
- **Do not move the loader into the `<head>`** or make it blocking. It sits at
  the foot of the body, before the page's own scripts, and the page must work
  perfectly if it never loads.
- **If you change what is recorded, change the site copy** — the About section
  on the landing page and the notice in every footer. `verify-count.js` checks
  the notice is present on all eleven pages.

### Checking it after a push

1. Open the landing page and one module on a phone over cellular, not campus
   wifi, so the hit is not your own testing.
2. Reload <https://hbedle.goatcounter.com> after a minute or two.
3. Both should appear as separate rows with their titles beside the path.
4. In GoatCounter Settings, add the office IP under **Ignore IPs**, or your own
   editing will be a visible share of the early numbers.

If nothing appears: check the console for a 404 on `count.js` (wrong relative
path, or a case mismatch — Pages is case-sensitive where macOS is not), and
check that an ad blocker is not blocking `gc.zgo.at`. Ad-blocked visitors are
invisible, so treat totals as a floor; the comparison *between* modules stays
reliable, which is what matters for deciding what to build next.

## Model choices worth knowing

- **Dry frame:** Dvorkin–Nur soft sand (Hertz–Mindlin at φc = 0.40, n = 9,
  P = 23 MPa, joined by the modified Hashin–Shtrikman lower bound). Nur's
  critical-porosity model is also implemented, for comparison only: it is an
  upper bound and runs ~1500 m/s fast at 20% porosity.
- **Shale:** empirical — Castagna mudrock for Vs, Gardner for density. A contact
  model does not apply to shale.
- **Conditions:** 23 MPa effective, 64 °C, fixed in every module. In module 05
  the depth slider changes the ray geometry only, deliberately not the effective
  pressure, so the angle lesson is not confounded by the rock also stiffening.
- **Fit uncertainty (modules 08 and 09):** closed form, not simulated. For a
  least-squares line, sigma(G) = sigma/sqrt(Sxx) and sigma(R0) =
  sigma*sqrt(1/n + xbar^2/Sxx). The test suite checks these against 30,000
  simulated fits (they agree to 0.5%) — the simulation is there to validate the
  formula, not the other way round.
- **Intercept and gradient (module 06):** fitted by least squares to the exact
  Zoeppritz coefficients against sin²θ over the chosen angle range, which is what
  a processor does. This is NOT Shuey's analytic G — that is the tangent at zero
  offset, and on the default rock the two differ by more than a fifth
  (−0.4169 fitted against −0.5270 analytic). The background trend and the class
  boundaries are both fitted or drawn live; the boundaries are a convention
  (±0.03 in intercept) and the module says so.
- **Ray geometry:** rays are circular arcs in a linear gradient, so the
  incidence angle is found by solving for the ray parameter that lands on the
  requested offset, not by the straight-ray shortcut. **The two modules use
  different gradients on purpose.** Module 04 exposes it as a control and opens
  at 0.5/s, where the shortcut under-reads by 10.1° at 3 km offset on a 2 km
  target. Module 05 fixes it at 0.6/s, where the same geometry gives 48.4°
  against a straight-ray 36.9°, an 11.5° miss. Module 05's Method tab states the
  discrepancy and the reason; if you change either value, change that sentence
  too.

Each module's Method tab carries the full list of simplifications.
