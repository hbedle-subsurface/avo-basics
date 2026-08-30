# How AVO Actually Works

**Interactive teaching modules on rock physics, fluid substitution and amplitude
versus offset.**

Heather Bedle, School of Geosciences, University of Oklahoma, with the
[AASPI](https://www.ou.edu/mcee/labs/aaspi) consortium.

→ **[Open the modules](https://hbedle-subsurface.github.io/avo-basics/)**

---

## Why this exists

Seismic amplitude interpretation is taught, almost everywhere, as a set of rules.
Bright spots mean gas. Class III means gas. Low impedance means hydrocarbons. The
rules are useful — they are how the subject is usable at all — and every one of
them has a set of counterexamples that a student will not meet until a well comes
in dry.

The gap is not knowledge. It is *calibration*: knowing which questions an
amplitude can settle, which it cannot, and how to tell the two apart before
committing to a decision. That kind of judgement is normally acquired slowly, by
watching experienced people, and it is exactly what a newcomer to an
interpretation role does not have.

These modules are an attempt to teach it directly, and quickly, by letting people
build the counterexamples themselves.

## What makes them different

**Everything is computed, live, from the parameters on screen.** There are no
stored images and no curves drawn to look plausible. Move a slider and the rock
physics runs again. This matters more than it sounds: a drawing cannot disagree
with theory, but a calculation can — and during construction it repeatedly did.
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

**The limits are the subject, not a caveat at the end.** The modules count how
many different rocks are consistent with a measurement, and how many of those a
second measurement removes. The answer is a number, and it changes with the
noise, the mute and the fold.

## Who they are for

The set is a ladder, and each card on the landing page says what it assumes.

| | | Assumes |
|---|---|---|
| **00** | What all of this is for | **Velocity and density, and nothing else.** No equations beyond *impedance = velocity × density*. Introduces amplitude, reflection coefficient, polarity, wavelet, offset, incidence angle, gather and stacking, then states the AVO claim straight, in the confident form you would hear at work. |
| **01–04** | The main sequence | Module 00. Builds a rock, follows it to a trace, and takes the standard rules apart one at a time. |
| **05–06** | The advanced pair | Modules 01–04, and comfort with standard deviations and correlation. Written for people who already use these methods. |

**A student new to the subject** should read 00, then 01, 02 and 03, and stop.
That is a complete and useful short course.

**Someone who has used AVO before** can start at 01.

**A working interpreter** will find the new material in 05 and 06: the size of
the error bars, and a count of what the gradient actually buys.

## Using them in teaching

They are built to be handed out rather than presented. Nothing installs, nothing
needs an account, and each page works from a local copy with the network
switched off.

- **Set a specific configuration as an exercise.** Every control writes itself
  into the address bar, so a particular rock, a particular mute and a particular
  noise level can be sent as a link and will open exactly as you left it.
- **Use the exercises as lab work.** Each module has five, each with a hidden
  answer that gives the measured numbers and explains what they mean.
- **Use the Key points as a revision sheet**, and the Method tabs when a student
  asks why the model does not match something they have read.
- **Lift a panel into a lecture.** Everything on screen is generated from the
  physics, so a slide made from it will not disagree with the page.

## The companion sets

Part of a series on seismic interpretation, all built the same way:

- [How geometric attributes actually work](https://hbedle-subsurface.github.io/geometric-attributes/)
  — dip, coherence and curvature
- [Seismic resolution](https://hbedle-subsurface.github.io/seismic_resolution/)
  — what can and cannot be separated in time
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
read it. Adding `?nocount=1` is not needed — Do Not Track is honoured, and the
settings in your address bar are never sent.

## Using and citing

Free to use for teaching, demonstration and non-commercial study, provided the
source is credited. Please do not republish or redistribute it, modified or
otherwise, without permission. If you use it in a course or a talk, a credit line
and a link back are all that is asked.

> H. Bedle, *How AVO Actually Works*, University of Oklahoma.
> SSRN: *(article link to follow)*

Corrections are welcome and wanted. If a number here disagrees with something you
trust, that is worth knowing about — the whole point of computing everything live
is that the site can be wrong in a way a set of drawings cannot.

---

*Editing this repository? See [MAINTAINING.md](MAINTAINING.md) for the layout,
the verification suite and the model choices.*
