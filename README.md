# How AVO Actually Works

**Interactive teaching modules on rock physics, fluid substitution and amplitude
versus offset.**

Dr. Heather Bedle and Dr. April Moreno-Ward, School of Geosciences, University of
Oklahoma, with the [AASPI](https://www.ou.edu/mcee/labs/aaspi) consortium.

→ **[Open the modules](https://hbedle-subsurface.github.io/avo-basics/)**

---

## Why this exists

Seismic amplitude interpretation is taught, almost everywhere, as a set of rules.
Bright spots mean gas. Class III means gas. Low impedance means hydrocarbons. The
rules are useful — they are how the subject is usable at all — and every one of
them has a set of counterexamples that a student will not meet until a well comes
in dry.

What is missing is calibration rather than facts: knowing which questions an
amplitude can settle, which it cannot, and how to tell the two apart before
committing to a decision. That kind of judgment is normally acquired slowly, by
watching experienced people, and it is exactly what a newcomer to an
interpretation role does not have.

These modules are an attempt to teach it directly, and quickly, by letting people
build the counterexamples themselves.

## What makes them different

**Everything is computed, live, from the parameters on screen.** There are no
stored images and no curves drawn to look plausible. Move a slider and the rock
physics runs again. A drawing cannot disagree with theory; a calculation can, and
during construction it did.
Several claims in the text were corrected because a measurement contradicted
them, including a resolution rule of thumb that turned out to be 28% off for the
geometry it was being applied to.

**Every number in the exercises is read off the running page.** Not estimated,
not remembered from a textbook. An automated check re-derives all of them and
fails if the prose and the code ever drift apart.

**Every module says what it leaves out.** Each has a Method tab listing its
simplifications and where it departs from production software. Where two
reasonable choices give different answers, both are shown with the difference
quantified, because the choice between them is usually a larger effect than the
one being studied.

**The limits are part of the subject rather than a closing caveat.** The modules count how
many different rocks are consistent with a measurement, and how many of those a
second measurement removes. The answer is a number, and it changes with the
noise, the mute and the fold.

## The modules

Ten modules, in the order they build on each other. The landing page carries the
same list with a thumbnail and a question for each.

| | | Assumes |
|---|---|---|
| **00** | Beyond normal incidence | The seismic resolution modules |
| **01** | Rocks, pores and stiffness | Module 00 |
| **02** | Fluid in the pores | Module 00 |
| **03** | From a rock to a trace | Module 00 |
| **04** | Offset, angle and the gather | Modules 00-03 |
| **05** | Amplitude against angle | Modules 00-03 |
| **06** | Intercept, gradient and the classes | Modules 00-03 |
| **07** | Several rocks, one amplitude | Modules 00-03 |
| **08** | Noise, error bars and what you can conclude | Everything before it |
| **09** | What survives | Everything before it |

## Who they are for

The set assumes first-year geology and the companion
[seismic resolution modules](https://hbedle-subsurface.github.io/seismic_resolution/),
where impedance, the reflection coefficient, the wavelet and tuning are built
from scratch. Module 00 restates those results and picks up where they stop.

**A student new to the subject** should do the resolution modules, then 00, 01,
02 and 03, and stop. That is a complete and useful short course.

**Someone who has used AVO before** can start at 04. Module 00 is still worth ten
minutes to see which simplifications the rest of the set comes back for.

**A working interpreter** will find the new material in 07, 08 and 09: how many
rocks share an amplitude, the size of the error bars, and a count of how much the
gradient adds. Those three are the heaviest in the set, and 08 uses
standard deviations and correlation.

## Using them in teaching

They are built to be handed out rather than presented. Nothing installs, nothing
needs an account, and each page works from a local copy with the network
switched off.

- **Set a specific configuration as an exercise.** Every control writes itself
  into the address bar, so a particular rock, a particular mute and a particular
  noise level can be sent as a link and will open exactly as you left it.
- **Use the exercises as lab work.** Each module has five, each with a hidden
  answer that gives the measured numbers and explains what they mean. Every
  module can pop its exercises into a separate window so a student can read them
  beside the controls.
- **Use the Key points as a revision sheet**, and the Method tabs when a student
  asks why the model does not match something they have read.
- **Lift a panel into a lecture.** Everything on screen is generated from the
  physics, so a slide made from it will not disagree with the page.

## The companion sets

Part of a series on seismic interpretation, all built the same way:

- [Seismic resolution](https://hbedle-subsurface.github.io/seismic_resolution/)
  — what can and cannot be separated in time; the prerequisite for this set
- [How geometric attributes actually work](https://hbedle-subsurface.github.io/geometric-attributes/)
  — dip, coherence and curvature; independent of this set
- **How AVO actually works** — this set

Each has an accompanying SSRN working paper. *(link to follow)*

## Privacy

Everything runs in the browser. No installation and no account. Nothing you do
inside a module — no slider, no click, no trace you generate — is transmitted
anywhere, and the modules make no network requests at all.

The one thing recorded is that a page was opened. No cookie, no account, nothing
about you. I keep that count for two reasons: so the modules people actually use
are the ones that get improved, and so I can show my university that these are
being used — which is how they keep getting built.

Counting is [GoatCounter](https://www.goatcounter.com), which is free for
non-commercial use, sets no cookies, stores no personal data and needs no
consent banner. The whole of it is `assets/count.js`, and you are welcome to
read it. Adding `?nocount=1` is not needed — Do Not Track is honored, and the
settings in your address bar are never sent.

## Using and citing

Licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Free to
use, adapt and redistribute, including in teaching and including commercially,
provided the source is credited and anything derived from it carries the same
license. The full legal text is in `LICENSE` at the repository root.

> H. Bedle and A. Moreno-Ward, *How AVO Actually Works*, University of Oklahoma.
> SSRN: *(article link to follow)*

Corrections are welcome and wanted. If a number here disagrees with something you
trust, that is useful to know. Computing everything live means the site can be
wrong in a way a set of drawings cannot.

---

*Editing this repository? See [MAINTAINING.md](MAINTAINING.md) for the layout,
the verification suite and the model choices.*
