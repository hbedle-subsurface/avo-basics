# How AVO Actually Works

Interactive teaching modules on rock physics, fluid substitution and AVO.
Heather Bedle, School of Geosciences, University of Oklahoma, with AASPI.

Live at <https://hbedle-subsurface.github.io/avo-basics/>.

Companion to [geometric-attributes](https://hbedle-subsurface.github.io/geometric-attributes/)
and [seismic_resolution](https://hbedle-subsurface.github.io/seismic_resolution/).

## Layout

    index.html                   landing page (generated — see below)
    assets/style.css             shared stylesheet, copied from the geometric-attributes repo
    assets/seismic.js            shared wavelets, traces, noise, plotting, URL state (copied, unchanged)
    assets/rockphysics.js        NEW: minerals, dry frames, Batzle-Wang fluids, Gassmann, Zoeppritz
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
| `harness.js labels` | no two pieces of text land on top of each other. The geometry check cannot see this: an axis label and a legend can overlap perfectly while both sit inside the canvas, which is exactly what happened when `SEIS.axisBottom` put its label 22 px below the plot and `legendRow` put its first line at 26. It found 38 collisions the first time it ran. |
| `harness.js tuning` | the tuning thickness the page *measures* matches √6·Vp/(4πf) |
| `verify-prose.js` | every number module 01 quotes still matches what the page computes |
| `verify-prose-m2.js` | the same for module 02, comparing values rather than strings |
| `verify-prose-m3.js` | the same for module 03 |
| `verify-prose-m4.js` | the same for module 04 |
| `verify-prose-m5.js` | the same for module 05 |
| `verify-prose-m6.js` | the same for module 06 |

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
