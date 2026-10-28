/* heading-fx.js — shared look + hover effect of every `.section-heading` (reference: "ÜZENJEN.").

   1. Each heading is split into words > letters (words stay unbreakable, so wrapping is unchanged). The full text goes to
      aria-label on the heading, the visual words are aria-hidden. A trailing "." becomes the gradient accent dot (.sh-dot).
      This always runs (the dot is part of the look), also on touch devices and with reduced motion.
   2. Proximity hover: letters near the mouse pick up the brand gradient, lift and grow (--p 0..1 per letter, eased).
      Only with a real mouse: html.has-cursor (set by cursor.js) and pointerType !== 'touch'; never with reduced motion.
   3. Other scripts that animate a heading's letters wait for the `vb:heading-split` event (bubbles from the heading)
      or check the `is-split` class; the letters are `.sh-char` inside `.sh-mask` inside `.sh-word`.
   No layout work is done on scroll/resize: letter centres are read from the (untransformed) masks only while the pointer
   is near a heading. */
(function () {
  'use strict';

  var root = document.documentElement;
  var headings = Array.prototype.slice.call(document.querySelectorAll('.section-heading, .steps-title'));
  if (!headings.length) return;

  var VB = (window.VB = window.VB || {});
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RADIUS = 140;

  function split(h) {
    if (h.classList.contains('is-split')) return;
    var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    h.setAttribute('aria-label', text);
    var frag = document.createDocumentFragment();
    text.split(' ').forEach(function (w, wi, all) {
      var word = document.createElement('span');
      word.className = 'sh-word';
      word.setAttribute('aria-hidden', 'true');
      var chars = Array.from(w);
      chars.forEach(function (c, ci) {
        var mask = document.createElement('span');
        mask.className = 'sh-mask';
        var ch = document.createElement('span');
        ch.className = 'sh-char' + (c === '.' && wi === all.length - 1 && ci === chars.length - 1 ? ' sh-dot' : '');
        ch.setAttribute('data-c', c.toUpperCase());
        ch.textContent = c;
        mask.appendChild(ch);
        word.appendChild(mask);
      });
      frag.appendChild(word);
      if (wi < all.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    h.textContent = '';
    h.appendChild(frag);
    h._shChars = Array.prototype.slice.call(h.querySelectorAll('.sh-char'));
    h.classList.add('is-split');
    h.dispatchEvent(new CustomEvent('vb:heading-split', { bubbles: true }));
  }

  /* ---------------------------------------------------------- proximity hover */
  var px = 0, py = 0, haveMouse = false, loop = 0;
  var active = [];                                  /* headings the pointer is currently near */

  function isMouse(e) { return e.pointerType !== 'touch' && root.classList.contains('has-cursor'); }

  function near(h) {
    var r = h.getBoundingClientRect();
    return px > r.left - RADIUS && px < r.right + RADIUS && py > r.top - RADIUS && py < r.bottom + RADIUS;
  }

  function tick() {
    loop = 0;
    var busy = false;
    headings.forEach(function (h) {
      var chars = h._shChars;
      if (!chars) return;
      var on = haveMouse && h._shOn;
      if (!on && !h._shLive) return;
      var live = false;
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i], t = 0;
        if (on) {
          var m = c.parentNode.getBoundingClientRect();
          t = Math.max(0, 1 - Math.hypot(px - (m.left + m.width / 2), py - (m.top + m.height / 2)) / RADIUS);
        }
        var p = c._p || 0;
        p += (t - p) * 0.16;
        if (Math.abs(t - p) > 0.004) live = true; else p = t;
        if (p !== c._p) { c._p = p; c.style.setProperty('--p', p.toFixed(3)); }
      }
      h._shLive = live;
      if (live) busy = true;
    });
    if (busy || (haveMouse && headings.some(function (h) { return h._shOn; }))) loop = requestAnimationFrame(tick);
  }

  function refreshActive() {
    headings.forEach(function (h) { h._shOn = !!h._shChars && haveMouse && near(h); if (h._shOn) h._shLive = true; });
    if (!loop) loop = requestAnimationFrame(tick);
  }

  function enableHover() {
    if (reduce) return;
    document.addEventListener('pointermove', function (e) {
      if (!isMouse(e)) return;
      px = e.clientX; py = e.clientY; haveMouse = true;
      refreshActive();
    }, { passive: true });
    /* Lenis / wheel scrolling moves headings under a stationary mouse without pointer events */
    var tk = false;
    window.addEventListener('scroll', function () {
      if (!haveMouse || tk) return; tk = true;
      requestAnimationFrame(function () { tk = false; refreshActive(); });
    }, { passive: true });
    function leave() { haveMouse = false; refreshActive(); }
    root.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
  }

  function init() {
    headings.forEach(split);
    enableHover();
    VB.headingFx = { ready: true, headings: headings };
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
})();
