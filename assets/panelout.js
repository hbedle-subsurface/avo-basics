/* ===========================================================================
   panelout.js — open the module's control panel in a second, live window
   Heather Bedle and April Moreno-Ward / AASPI / University of Oklahoma

   The same file is used unchanged by every teaching repository.

   Why this exists: the controls sit at the top of the page and the result of
   moving them sits further down. On a laptop the two are rarely on screen at
   once, so a student drags a slider, scrolls down, forgets which way they
   dragged it, and scrolls back. Moving the panel into its own window puts the
   sliders beside the panels they drive.

   The companion file popout.js does the same for the exercises. That copy is
   static, because exercise text does not change. This one is live: the second
   window holds a working copy of the controls, and every move in it drives the
   module in the first window. The header canvases are mirrored back, so the
   second window also shows the thumbnail it is changing.

   WHAT IT DOES: clones markup that is already on the page into a second
   window and forwards events between the two. Nothing is fetched, nothing is
   sent, nothing is stored. It works from a file:// copy with no network.

   HOW IT WORKS, and why it needs no change to any module:

     · The clone's inputs are not the module's inputs. When one of them moves,
       the matching element in the first window is found by its position in
       the panel, its value is copied across, and an ordinary `input` event is
       fired there. Every module already listens for that event, so the module
       cannot tell the difference between a slider moved in its own window and
       one moved in this one.
     · Buttons in the clone call click() on their counterpart.
     · A pointer press on a cloned canvas is forwarded to the real canvas at
       the same fractional position, so a module that lets a line be dragged
       across a map still works from the second window.
     · A timer copies text, inline style, classes, the hidden state and canvas
       bitmaps back from the real panel to the clone, so the clone shows
       whatever the module drew.

   TWO PANEL TEMPLATES: repositories built on the sticky header use
   `<div class="labhead">`; the earlier module sets put the sliders in
   `<section class="controls">`. Both are recognized. In the first the button
   goes on the last caption line; in the second a row is added along the
   bottom of the panel to hold it.

   PANELS THAT REBUILD THEMSELVES: a module that writes a table of layers into
   its own panel replaces those elements every time a number is edited. The
   real element is therefore looked up at the moment an event arrives rather
   than held from the time the window opened. If the number of elements
   changes — a layer added or removed — the clone is rebuilt, and that rebuild
   waits while a field in the second window has the cursor in it so that
   typing is not interrupted.

   HOW TO INSTALL: one script tag per module, after the module's own scripts.
   No markup change and no stylesheet change. If this file is missing the
   button does not appear and the panel behaves exactly as it always did.

   License: CC BY-SA 4.0. Free to use, adapt and share with credit; any
   adaptation must be released under the same license.
   =========================================================================== */

(function () {
  'use strict';

  var TICK_MS = 120;

  var panel = null;      // the real panel, still in this document
  var holder = null;     // the zero-height wrapper it hides inside
  var bar = null;        // the line left behind in its place
  var win = null;        // the second window
  var wrap = null;       // the element in the second window holding the clone
  var clone = null;      // the working copy inside it
  var timer = null;
  var openBtn = null;
  var openRow = null;    // the row added to hold the button, where one is needed
  var recloneWanted = false;

  /* The sticky header of the newer template, or the control section of the
     earlier one. In the newer template the section is inside the header, and
     querySelector returns the outer element first, so the header wins. */
  function findPanel() {
    return document.querySelector('.labhead') || document.querySelector('.controls');
  }

  function windowName() {
    var p = (location.pathname || 'module').replace(/[^A-Za-z0-9]+/g, '_');
    return 'controls_' + p;
  }

  function moduleTitle() {
    var h1 = document.querySelector('.mod-head h1') || document.querySelector('h1');
    return h1 ? h1.textContent.trim() : (document.title || 'Controls');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Everything this page links in its head, by absolute URL so it resolves
     from about:blank and from file:// as well. */
  function headLinks() {
    var out = '';
    var links = document.querySelectorAll('head link[rel="stylesheet"], head link[rel="preconnect"]');
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      out += '<link rel="' + l.rel + '" href="' + l.href + '"' +
             (l.crossOrigin ? ' crossorigin' : '') + '>\n';
    }
    return out;
  }

  /* The second window's own layout. The site stylesheet does the rest, except
     that the panel is no longer sticky and no longer sits in a two-column
     grid: in a narrow window the thumbnail goes above the sliders. */
  var OWN_CSS = [
    'body { margin:0; padding:16px; background:var(--paper,#fff); }',
    '.po-head { display:flex; align-items:baseline; justify-content:space-between;',
    '  gap:14px; margin:0 0 14px; padding-bottom:10px;',
    '  border-bottom:1px solid var(--rule,#d8d8d8); }',
    '.po-head h1 { font-family:var(--display,Archivo,sans-serif); font-size:16px;',
    '  margin:0; color:var(--ink,#16191C); }',
    '.po-head .po-note { font-family:var(--mono,monospace); font-size:10.5px;',
    '  letter-spacing:.08em; text-transform:uppercase; color:var(--slate,#5C6670); }',
    '.labhead, .controls { position:static !important; margin:0 !important;',
    '  box-shadow:none !important; }',
    '.labhead .labgrid { grid-template-columns:minmax(0,1fr) !important; }',
    '.labhead canvas, .controls canvas { width:100% !important; height:auto !important; }',
    /* The button belongs on the page, not on the copy of the panel beside it.
       It is hidden rather than removed: the two element sequences are matched
       by position, so the copy has to hold the same elements as the original. */
    '.po-panel-open, .po-panel-openrow { display:none !important; }',
    '.po-foot { margin-top:16px; font-size:12px; line-height:1.6;',
    '  color:var(--slate,#5C6670); }',
    '.po-stale { display:none; font-size:12px; color:var(--crimson,#841617); }'
  ].join('\n');

  function buildDocument() {
    var title = moduleTitle();
    return '<!doctype html>\n<html lang="en">\n<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>Controls \u2014 ' + escapeHtml(title) + '</title>\n' +
      headLinks() +
      '<style>\n' + OWN_CSS + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<div class="po-head">' +
        '<h1>' + escapeHtml(title) + '</h1>' +
        '<span class="po-note">Controls</span>' +
      '</div>\n' +
      '<div id="poWrap"></div>\n' +
      '<p class="po-foot">Moving anything here changes the module in the other ' +
      'window, and the panel above follows what it draws. Closing this ' +
      'window puts the controls back where they were.</p>\n' +
      '<p class="po-stale" id="poStale">The module window has closed. These ' +
      'controls no longer drive anything.</p>\n' +
      '</body>\n</html>';
  }

  /* --------------------------------------------------------------- bridge */

  /* Every element in a panel, root first, in document order. Read fresh each
     time it is needed: a module that rewrites part of its own panel leaves
     the elements held from an earlier reading detached from the document, and
     a value written to a detached element changes nothing. */
  function listOf(root) {
    var out = [root];
    var all = root.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) out.push(all[i]);
    return out;
  }

  /* The element in the real panel holding the same position as this one in
     the clone. A difference in length means the two no longer correspond, so
     nothing is driven until the clone has been rebuilt. */
  function realFor(copyEl) {
    if (!clone || !panel) return null;
    var cl = listOf(clone), rl = listOf(panel);
    if (cl.length !== rl.length) { recloneWanted = true; return null; }
    var i = cl.indexOf(copyEl);
    return i < 0 ? null : rl[i];
  }

  function fire(el, type) {
    try { el.dispatchEvent(new Event(type, { bubbles: true })); }
    catch (e) { /* the module simply does not see this one */ }
  }

  /* A control moved in the second window. Copy the value across and let the
     module's own listener do the rest. */
  function pushValue(real, copy) {
    if (real.type === 'checkbox' || real.type === 'radio') real.checked = copy.checked;
    else real.value = copy.value;
    fire(real, 'input');
    fire(real, 'change');
  }

  /* A press on a cloned canvas. Modules that accept a drag on a map read
     offsetX and offsetY, so the press is reproduced at the same fraction of
     the real canvas however differently the two are scaled. */
  function forwardPointer(real, copy, ev) {
    var rc = copy.getBoundingClientRect();
    if (!rc.width || !rc.height) return;
    var fx = (ev.clientX - rc.left) / rc.width;
    var fy = (ev.clientY - rc.top) / rc.height;
    var rr = real.getBoundingClientRect();
    var type = ev.type === 'pointerdown' ? 'mousedown'
             : ev.type === 'pointerup' ? 'mouseup' : 'mousemove';
    var init = {
      bubbles: true, cancelable: true, buttons: ev.buttons,
      clientX: rr.left + fx * rr.width,
      clientY: rr.top + fy * rr.height
    };
    try { real.dispatchEvent(new MouseEvent(type, init)); }
    catch (e) { /* nothing further to do */ }
  }

  /* One set of listeners on the container rather than one per control, so a
     clone that is rebuilt needs no rewiring. */
  function wireWrap() {
    function onValue(ev) {
      var t = ev.target, tag = t && t.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
      var real = realFor(t);
      if (real) pushValue(real, t);
    }
    wrap.addEventListener('input', onValue);
    wrap.addEventListener('change', onValue);

    wrap.addEventListener('click', function (ev) {
      var t = ev.target;
      var b = t && t.closest ? t.closest('button') : null;
      if (!b || !clone.contains(b)) return;
      ev.preventDefault();
      var real = realFor(b);
      if (real) real.click();
    });

    ['pointerdown', 'pointermove', 'pointerup'].forEach(function (type) {
      wrap.addEventListener(type, function (ev) {
        var t = ev.target;
        if (!t || t.tagName !== 'CANVAS') return;
        var real = realFor(t);
        if (real) forwardPointer(real, t, ev);
      });
    });
  }

  /* --------------------------------------------------------------- mirror */

  function mirrorCanvas(real, copy) {
    if (!real.width || !real.height) return;
    if (copy.width !== real.width || copy.height !== real.height) {
      copy.width = real.width;
      copy.height = real.height;
    }
    var ctx = copy.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, copy.width, copy.height);
    try { ctx.drawImage(real, 0, 0); } catch (e) { /* nothing drawn yet */ }
  }

  /* True while the student has the cursor in a field in the second window.
     Rebuilding the clone under a cursor throws the typing away. */
  function typing() {
    if (!win || win.closed) return false;
    var a;
    try { a = win.document.activeElement; } catch (e) { return false; }
    if (!a || !clone.contains(a)) return false;
    return a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA';
  }

  function mirror() {
    if (!win || win.closed) { restore(); return; }

    var rl = listOf(panel), cl = listOf(clone);
    if (rl.length !== cl.length || recloneWanted) {
      /* The module has added or removed something in its own panel. Wait for
         the cursor to leave a field before replacing the copy. */
      if (typing()) return;
      recloneWanted = false;
      rebuildClone();
      return;
    }

    var focused = null;
    try { focused = win.document.activeElement; } catch (e) { /* none */ }

    for (var i = 0; i < rl.length; i++) {
      var r = rl[i], c = cl[i];
      if (c.tagName === 'CANVAS') { mirrorCanvas(r, c); continue; }
      if (c.className !== r.className) c.className = r.className;
      if (c.hidden !== r.hidden) c.hidden = r.hidden;
      /* Inline style carries the colors a module writes into its own panel:
         the layer chips and the sign of a reflection coefficient. The root is
         left alone because the opacity below is set on it. */
      if (i > 0) {
        var rs = r.getAttribute('style');
        if ((rs || '') !== (c.getAttribute('style') || '')) {
          if (rs === null) c.removeAttribute('style'); else c.setAttribute('style', rs);
        }
      }
      var ap = r.getAttribute('aria-pressed');
      if (ap !== null && c.getAttribute('aria-pressed') !== ap) c.setAttribute('aria-pressed', ap);
      if (c.tagName === 'INPUT') {
        if (c !== focused && c.value !== r.value) c.value = r.value;
        if (c.checked !== r.checked) c.checked = r.checked;
        if (c.disabled !== r.disabled) c.disabled = r.disabled;
        continue;
      }
      if (c.tagName === 'SELECT') {
        if (c !== focused && c.value !== r.value) c.value = r.value;
        continue;
      }
      /* Leaf text only: a readout, a label, a value. Anything with element
         children is a container and its own children are handled below it. */
      if (!c.firstElementChild && c.textContent !== r.textContent) {
        c.textContent = r.textContent;
      }
    }

    /* A step that does not use the panel hides it. Say so rather than leaving
       a stale copy that appears to be live. */
    var off = !!panel.hidden;
    if (clone.style.opacity !== (off ? '0.35' : '1')) {
      clone.style.opacity = off ? '0.35' : '1';
    }
  }

  /* ---------------------------------------------------------- open, close */

  function rebuildClone() {
    if (!win || win.closed) return;
    var top = 0;
    try { top = win.pageYOffset || 0; } catch (e) { /* leave at 0 */ }
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    clone = win.document.importNode(panel, true);
    wrap.appendChild(clone);
    mirror();
    try { win.scrollTo(0, top); } catch (e) { /* leave where it is */ }
  }

  function makeBar() {
    var d = document.createElement('div');
    d.setAttribute('style',
      'display:flex;align-items:center;justify-content:space-between;gap:14px;' +
      'margin:16px 0 0;padding:8px 14px;background:var(--panel,#F4F6F7);' +
      'border:1px solid var(--rule,#C9CDD2);font-size:12.5px;' +
      'color:var(--slate,#5C6670)');
    var msg = document.createElement('span');
    msg.textContent = 'The controls are open in a separate window. Everything below still follows them.';
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn ghost small';
    back.textContent = 'Bring them back';
    back.addEventListener('click', restore);
    d.appendChild(msg);
    d.appendChild(back);
    return d;
  }

  function open() {
    if (win && !win.closed) { win.focus(); return; }

    try {
      win = window.open('', windowName(),
        'width=560,height=720,scrollbars=yes,resizable=yes');
    } catch (e) { win = null; }

    if (!win) {
      openBtn.textContent = 'Pop-up blocked \u2014 allow pop-ups for this page';
      openBtn.disabled = true;
      setTimeout(function () {
        openBtn.textContent = 'Open controls in a window';
        openBtn.disabled = false;
      }, 4000);
      return;
    }

    try {
      win.document.open();
      win.document.write(buildDocument());
      win.document.close();
    } catch (e) {
      try { win.close(); } catch (e2) { /* nothing further */ }
      win = null;
      openBtn.textContent = 'Could not open \u2014 try again';
      setTimeout(function () { openBtn.textContent = 'Open controls in a window'; }, 4000);
      return;
    }

    wrap = win.document.getElementById('poWrap');
    clone = win.document.importNode(panel, true);
    wrap.appendChild(clone);

    wireWrap();
    mirror();

    /* Hide the real panel without taking it out of the layout: the module
       measures its canvases from their parent's width, and an element that is
       display:none has no width to measure. A zero-height wrapper keeps every
       measurement the module makes correct while freeing the screen. */
    holder = document.createElement('div');
    holder.setAttribute('style', 'height:0;overflow:hidden');
    panel.parentNode.insertBefore(holder, panel);
    holder.appendChild(panel);

    bar = makeBar();
    holder.parentNode.insertBefore(bar, holder);

    openBtn.textContent = 'Controls are in the other window';
    openBtn.disabled = true;

    timer = setInterval(mirror, TICK_MS);
    win.addEventListener('unload', function () { setTimeout(restore, 60); });
    win.focus();
  }

  function restore() {
    if (timer) { clearInterval(timer); timer = null; }
    clone = null;
    wrap = null;
    recloneWanted = false;
    if (win && !win.closed) { try { win.close(); } catch (e) { /* already gone */ } }
    win = null;
    if (holder && holder.parentNode) {
      holder.parentNode.insertBefore(panel, holder);
      holder.parentNode.removeChild(holder);
    }
    holder = null;
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    if (openBtn) {
      openBtn.textContent = 'Open controls in a window';
      openBtn.disabled = false;
    }
    /* The panel has just been moved back into the flow at whatever width the
       page now has. Ask the module to redraw at that width. */
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* no redraw */ }
  }

  /* ----------------------------------------------------------------- init */

  /* Where the button goes. The sticky header ends each half with a caption
     line, and the button sits at the right-hand end of the last one. The
     control section has no caption, so a row is added across the foot of the
     grid to hold it. */
  function buttonHost() {
    var caps = panel.querySelectorAll('.cap');
    if (caps.length) {
      var host = caps[caps.length - 1];
      host.style.display = 'flex';
      host.style.alignItems = 'baseline';
      host.style.justifyContent = 'space-between';
      host.style.gap = '10px';
      return host;
    }
    openRow = document.createElement('div');
    openRow.className = 'po-panel-openrow';
    openRow.setAttribute('style',
      'grid-column:1 / -1;display:flex;justify-content:flex-end;' +
      'margin-top:12px;padding-top:11px;border-top:1px solid var(--rule,#C9CDD2)');
    panel.appendChild(openRow);
    return openRow;
  }

  function init() {
    /* A page that loads this file twice would otherwise grow two buttons, and
       the second one would take over the module variables while the first sat
       there doing nothing. */
    if (document.querySelector('.po-panel-open')) return;

    panel = findPanel();
    if (!panel) return;

    var host = buttonHost();

    /* The panel's own stylesheet hides buttons inside it, because the long
       explanations and the save buttons belong in the step rather than the
       header. This one is set inline so it survives that rule without the
       stylesheet having to know about it. */
    openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn ghost small po-panel-open';
    openBtn.style.display = 'inline-flex';
    openBtn.style.flex = '0 0 auto';
    openBtn.style.width = 'auto';
    openBtn.style.marginTop = '0';
    openBtn.textContent = 'Open controls in a window';
    openBtn.title = 'Put these controls in a second window so they stay beside the panels they drive';
    openBtn.addEventListener('click', open);
    host.appendChild(openBtn);

    window.addEventListener('beforeunload', function () {
      if (win && !win.closed) {
        try { win.document.getElementById('poStale').style.display = 'block'; }
        catch (e) { /* nothing further */ }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
