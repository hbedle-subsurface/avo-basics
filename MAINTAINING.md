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
    assets/rockphysics.js        NEW: minerals, dry frames, Batzle-Wang fluids, Gassmann, Zoeppritz
    modules/start-here.html      Module 00 — what all of this is for (no equations)
    modules/rock-to-trace.html   Module 01 — build a rock, make a trace
    modules/same-amplitude.html  Module 02 — same bright spot, different rock
    modules/add-offset.html      Module 03 — add offset
    modules/intercept-gradient.html  Module 04 — intercept, gradient and the classes
    modules/reading-a-gather.html    Module 05 — reading a gather you did not make
    modules/what-survives.html       Module 06 — what survives
    tools/                       verification; not deployed

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
| `verify-physics.js` | 37 closed-form tests: Batzle-Wang against published water velocity, Gassmann round trips to 1e-15, Zoeppritz at 0° equal to (I₂−I₁)/(I₂+I₁), zero contrast returning exactly zero |
| `harness.js` | the page boots, every `$(id)` resolves, every readout is populated, and 297 states per control produce no NaN |
| `harness.js geometry` | nothing is drawn outside its canvas, at 7 viewport widths × 5 panes |
| `harness.js` (axis check) | every vertical axis runs the same way as the data drawn against it. `SEIS.axisLeft` without `flip` puts the MINIMUM at the top, which is right for time and depth and wrong for everything else, because `curve()` and the other value plots put the minimum at the bottom. It found eleven upside-down axes the first time it ran, across three modules. |
| `harness.js axes` | reads the tick labels off the RENDERED page and checks the larger value sits higher up, for value axes, and lower for time and depth. This is stronger than the source-level lint: it tests the picture rather than the code. It only considers right-aligned numeric columns, since that is what `SEIS.axisLeft` produces — a left-aligned column of numbers is a table, not an axis. |
| `harness.js labels` | no two pieces of text land on top of each other. The geometry check cannot see this: an axis label and a legend can overlap perfectly while both sit inside the canvas, which is exactly what happened when `SEIS.axisBottom` put its label 22 px below the plot and `legendRow` put its first line at 26. It found 38 collisions the first time it ran. |
| `harness.js tuning` | the tuning thickness the page *measures* matches √6·Vp/(4πf) |
| `verify-prose.js` | every number module 01 quotes still matches what the page computes |
| `verify-prose-m2.js` | the same for module 02, comparing values rather than strings |
| `verify-prose-m3.js` | the same for module 03 |
| `verify-prose-m4.js` | the same for module 04 |
| `verify-prose-m5.js` | the same for module 05 |
| `verify-prose-m6.js` | the same for module 06 |
| `verify-deploy.js` | every file a page references exists, with the right case and relative depth; every page loads the counter and its libraries in order; every module is linked from the index. This is the one that catches "works on my machine, 404s on Pages" |
| `verify-count.js` | the usage counter sends the module name and never the query string, honours Do Not Track, and skips local copies |

The `verify-prose` scripts are the ones to re-run after any physics change.
They extract the numbers from the prose and from the running page and compare
them, so the text cannot quietly drift away from the code. Both are wired into
`npm test`.

Module 02 sweeps 457,560 forward models on every update. That is only fast
enough because the dry frame, the pore fluid, the shale and the tuning factor
are each tabulated once rather than recomputed per cell, and because the
step 5 panel is memoized on the parameters that can actually change its answer.
If you add a parameter to the search, check `tools/harness.js m2` still returns
promptly before assuming it scales.

## Who each module is for

The set is a ladder and the index says so on every card.

- **00** assumes nothing — not rock physics, not mathematics, not the word
  impedance. No equations anywhere in it. It teaches the AVO claim straight,
  in the confident form, so that the later modules have something to test.
- **01–04** are the main sequence and assume 00.
- **05–06** assume 01–04 and are comfortable with standard deviations and
  correlation. They are written for people who already use these methods.

If you add a module, give it a `level` in `tools/build-index.js` so the card
carries the right note.

## A convention the modules follow

Every step pairs an abstract picture with a concrete one, always the same way
round: the **left** panel shows all the possibilities at once (a parameter-space
map in module 02, an amplitude-against-angle curve in module 03), and the
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

`assets/count.js`, loaded by all eight pages, **switched on**, account code
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
  the notice is present on all eight pages.

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
- **Conditions:** 23 MPa effective, 64 °C, fixed in every module. In module 03
  the depth slider changes the ray geometry only, deliberately not the effective
  pressure, so the angle lesson is not confounded by the rock also stiffening.
- **Fit uncertainty (modules 05 and 06):** closed form, not simulated. For a
  least-squares line, sigma(G) = sigma/sqrt(Sxx) and sigma(R0) =
  sigma*sqrt(1/n + xbar^2/Sxx). The test suite checks these against 30,000
  simulated fits (they agree to 0.5%) — the simulation is there to validate the
  formula, not the other way round.
- **Intercept and gradient (module 04):** fitted by least squares to the exact
  Zoeppritz coefficients against sin²θ over the chosen angle range, which is what
  a processor does. This is NOT Shuey's analytic G — that is the tangent at zero
  offset, and on the default rock the two differ by more than a fifth. The
  background trend and the class boundaries are both fitted or drawn live; the
  boundaries are a convention (±0.03 in intercept) and the module says so.
- **Ray geometry (module 03):** exact for a V(z) = 1600 + 0.6z overburden.
  Rays are circular arcs, so the incidence angle is found by solving for the
  ray parameter that lands on the requested offset, not by the straight-ray
  shortcut — which under-reads the angle by 11.6° at 3 km offset on a 2 km
  target.

Each module's Method tab carries the full list of simplifications.
