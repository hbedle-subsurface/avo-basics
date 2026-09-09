# Adding the control-panel pop-out to a repository

`assets/panelout.js` puts an **Open controls in a window** button on the header
panel of every module. The student gets the sliders in a second window and can
keep them beside the panels they drive, instead of scrolling the controls off
the top of the page each time they want to see what changed.

The exercise pop-out each module already carries copies text that does not
change. This one is connected: every slider moved in the second window changes
the module in the first, and any canvas in the header is mirrored back, so the
copy shows whatever the module drew.

The same file goes in every teaching repository, unchanged.

## 1. Copy the file

Copy `assets/panelout.js` from any repository that already has it. Do not edit
it. If it needs a change, change it everywhere.

## 2. Add one script tag per module

Next to the other shared scripts:

```html
<script src="../assets/count.js"></script>
<script src="../assets/panelout.js"></script>
<script src="../assets/seismic.js"></script>
<script src="../assets/rockphysics.js"></script>
```

Order does not matter to `panelout.js` itself — it waits for `DOMContentLoaded`
— but `verify-deploy.js` requires the module's own inline script to come after
the libraries, so the line goes above `seismic.js` with the other loaded files.

## 3. What the module has to provide

One thing, already true of every module built to the house template: the header
panel is `<div class="labhead">`, and each half opens with a `<p class="cap">`
line. The button goes at the right-hand end of the last of those. The earlier
module sets put their sliders in `<section class="controls">` with no caption;
the script takes that element where it finds it and adds a row along the foot of
the grid for the button. If neither is present the button does not appear and
the page is otherwise untouched.

**No module JavaScript has to change.** The clone's inputs are not the module's
inputs. When one of them moves, the matching element in the first window is
found by its position in the panel, its value is copied onto it, and an ordinary
`input` event is fired there. Every module already listens for that event, so it
cannot tell the difference between a slider moved in its own window and one
moved in the second. Buttons call `click()` on their counterpart, and a pointer
press on a cloned canvas is forwarded to the real canvas at the same fractional
position.

## 4. What it does to the page

While the pop-out is open the real panel is moved into a zero-height wrapper
rather than hidden with `display:none`. The modules measure canvas width from
the parent element, and an element that is `display:none` has no width to
measure, so hiding it that way would collapse every plot on the page — the same
failure the geometry check in `harness.js` exists to catch. A slim bar takes its
place with a **Bring them back** button. Closing either window restores the
panel.

## 5. Check it

`tools/harness-panelout.js` runs as part of `./tools/verify-all.sh`, and on its
own:

```
node tools/harness-panelout.js modules/intercept-gradient.html
```

It loads the module with `seismic.js` and `rockphysics.js` running, hands
`window.open` a second document, and then works the module only from the clone:
every slider in turn, a button, a press on a canvas, the readouts coming back,
and the panel returning to the page when the window closes.

Then open one module in a browser and confirm:

- moving a slider in the second window changes the panels in the first
- moving a slider in the first window moves the matching slider in the second
- a second module opens its own window rather than replacing the first
- closing the pop-out puts the panel back and the plots redraw at full width

## 6. What it does and does not do

**Does:** clone markup that is already on the page into a second window and
forward events between the two.

**Does not:** fetch anything, send anything, store anything, or set a cookie. It
works from a `file://` copy with no network, which is the case that matters when
a student is working from a downloaded folder.
