# How AVO Actually Works

Interactive teaching modules on rock physics, fluid substitution and AVO.
Heather Bedle, School of Geosciences, University of Oklahoma, with AASPI.

Companion to [geometric-attributes](https://hbedle-subsurface.github.io/geometric-attributes/)
and [seismic_resolution](https://hbedle-subsurface.github.io/seismic_resolution/).

## Layout

    index.html                   landing page (generated — see below)
    assets/style.css             shared stylesheet, copied from the geometric-attributes repo
    assets/seismic.js            shared wavelets, traces, noise, plotting, URL state (copied, unchanged)
    assets/rockphysics.js        NEW: minerals, dry frames, Batzle-Wang fluids, Gassmann, Zoeppritz
    modules/rock-to-trace.html   Module 01 — build a rock, make a trace
    tools/                       verification; not deployed

`assets/style.css` and `assets/seismic.js` are **copies**, not links to the other
repo. Each site has to work from a local folder with the network off, so
cross-repo references are not an option. When either file changes upstream, copy
it across and re-run the checks.

## Deploying

Static files. Push to GitHub and enable Pages on the branch root. Nothing to
build, no dependencies at runtime. `tools/`, `package.json` and `node_modules/`
are development only and can be left out of the published branch.

## Verifying

    ./tools/verify-all.sh

which runs, in order:

| check | what it proves |
|---|---|
| `verify-physics.js` | 37 closed-form tests: Batzle-Wang against published water velocity, Gassmann round trips to 1e-15, Zoeppritz at 0° equal to (I₂−I₁)/(I₂+I₁), zero contrast returning exactly zero |
| `harness.js` | the page boots, every `$(id)` resolves, every readout is populated, and 297 states per control produce no NaN |
| `harness.js geometry` | nothing is drawn outside its canvas, at 7 viewport widths × 5 panes |
| `harness.js tuning` | the tuning thickness the page *measures* matches √6·Vp/(4πf) |
| `verify-prose.js` | every number quoted in the exercises, key points and Method tab still matches what the page computes |

`verify-prose.js` is the one to re-run after any physics change. It is what stops
the prose and the code drifting apart.

## Model choices worth knowing

- **Dry frame:** Dvorkin–Nur soft sand (Hertz–Mindlin at φc = 0.40, n = 9,
  P = 23 MPa, joined by the modified Hashin–Shtrikman lower bound). Nur's
  critical-porosity model is also implemented, for comparison only: it is an
  upper bound and runs ~1500 m/s fast at 20% porosity.
- **Shale:** empirical — Castagna mudrock for Vs, Gardner for density. A contact
  model does not apply to shale.
- **Conditions:** 2000 m, 23 MPa effective, 64 °C, fixed. Overburden two-way
  time pinned at 1.500 s so the time axis does not slide.

Each module's Method tab carries the full list of simplifications.
