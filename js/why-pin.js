/* why-pin.js — #why ("Értékek & Garanciák"), EXPERIMENT variant A "big words".

   >= 1024px wide (and >= 520px tall, motion allowed, GSAP + ScrollTrigger present): the section becomes a tall block (100svh + --vw-run) whose inner stage is `position: sticky`
   (same technique as the Rólam / Együttműködés stages). One ScrollTrigger tracks the progress; every value owns 100svh of scrolling (L):
     t = rel / L - i     (rel = scroll since the pin began, i = the value's index)
     t -0.12 .. 0        the word rises from below (masked)            (not for the first value)
     t 0 .. 0.5          the outline fills with the brand gradient, left to right (scrubbed, eased)
     t > fill 60%        the description fades / slides in
     t 0.88 .. 1         the filled word slides up and out, the next one rises
   After the scroll stops a short Lenis scrollTo settles on the nearest value (word filled + description shown); ScrollTrigger's own snap would fight Lenis.
   Below 1024px / short windows: no pin, the six values stacked, each word fills once when it scrolls into view (IntersectionObserver).
   Reduced motion / no GSAP: no pin, every word filled, a simple fade. No manual ScrollTrigger.refresh(). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('why');
  if (!section) return;
  var items = [].slice.call(section.querySelectorAll('.vw__item'));
  var N = items.length;
  if (!N) return;
  var cur = section.querySelector('.vw__cur'), bar = section.querySelector('.vw__bar u'), vw = section.querySelector('.vw');
  var reduce = !!VB.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ST = window.ScrollTrigger;
  var canPin = !!(VB.gsap && VB.hasST && ST) && !reduce;
  var mq = window.matchMedia('(min-width: 1024px) and (min-height: 520px)');
  var st = null, snapT = 0, io = null, last = [];

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function L() { return window.innerHeight; }
  var HOLD = 0.7;                                                      /* the settled point of a value: word filled, description shown */

  /* ---------------------------------------------------------------- pinned: one frame from the scroll position */
  function frame(rel) {
    var pos = rel / L(), idx = Math.max(0, Math.min(N - 1, Math.floor(pos + 0.06)));
    items.forEach(function (it, i) {
      var t = pos - i, f = ease(clamp(t / 0.5)), a = clamp((f - 0.6) / 0.25);
      var enter = i > 0 ? clamp((t + 0.12) / 0.12) : 1, exit = i < N - 1 ? clamp((t - 0.88) / 0.12) : 0;
      var y = t < 0 ? 100 * (1 - enter) : -100 * exit;
      var on = i === 0 ? t < 1 : (t > -0.125 && t < 1);
      var key = ' ' + i;
      var vis = on ? 'visible' : 'hidden';
      if (last['v' + key] !== vis) { last['v' + key] = vis; it.style.visibility = vis; }
      if (!on) return;
      it.style.setProperty('--f', f.toFixed(3));
      it.style.setProperty('--t', (a * (i < N - 1 ? 1 - clamp((t - 0.78) / 0.1) : 1)).toFixed(3));
      it.style.setProperty('--y', y.toFixed(2) + '%');
      it.style.setProperty('--n', (1 - Math.max(i > 0 ? 1 - enter : 0, exit)).toFixed(3));
    });
    if (cur) { var c = ('0' + (idx + 1)).slice(-2); if (cur.textContent !== c) cur.textContent = c; }
    if (bar) bar.parentNode.style.setProperty('--p', clamp(pos / (N - 1 + HOLD)).toFixed(3));
    var gx = 0.5 + 0.26 * Math.sin(pos * 1.25), gy = 0.48 + 0.16 * Math.cos(pos * 0.9);       /* the glow drifts with transform only (no layout) */
    vw.style.setProperty('--gx', (gx * vw.clientWidth).toFixed(0) + 'px'); vw.style.setProperty('--gy', (gy * vw.clientHeight).toFixed(0) + 'px');
  }

  function run() { return st ? st.end - st.start : 0; }

  /* ---------------------------------------------------------------- settle on the nearest value */
  function snap() {
    if (!st) return;
    var lenis = VB.lenis;
    if (lenis && lenis.isScrolling) { schedule(); return; }
    var y = lenis ? lenis.scroll : window.pageYOffset;
    var rel = y - st.start;
    if (rel <= 1 || rel >= run() - 1) return;
    var pts = [];
    for (var k = 0; k < N; k++) pts.push((k + HOLD) * L());
    var best = pts.reduce(function (a, b) { return Math.abs(b - rel) < Math.abs(a - rel) ? b : a; });
    if (Math.abs(best - rel) <= 2) return;
    if (lenis) lenis.scrollTo(st.start + best, { duration: 0.45, easing: function (t) { return 1 - Math.pow(1 - t, 2); } });
    else window.scrollTo({ top: st.start + best, behavior: 'smooth' });
  }
  function schedule() { if (VB.whyNoSnap) return; clearTimeout(snapT); snapT = setTimeout(snap, 160); }      /* VB.whyNoSnap: test hook (frames between the settle points) */

  /* ---------------------------------------------------------------- stacked: each word fills once when it enters the view */
  function stackOn() {
    items.forEach(function (it) { it.style.visibility = ''; ['--f', '--t', '--y', '--n'].forEach(function (k) { it.style.removeProperty(k); }); });
    if (reduce || !('IntersectionObserver' in window)) { items.forEach(function (it) { it.classList.add('is-in'); }); return; }
    if (io) return;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.4 });
    items.forEach(function (it) { if (!it.classList.contains('is-in')) io.observe(it); });
  }

  /* ---------------------------------------------------------------- on / off with the viewport */
  function enable() {
    if (st) return;
    if (io) { io.disconnect(); io = null; }
    section.classList.add('is-pinned');
    items.forEach(function (it) { it.classList.remove('is-in'); });
    last = [];
    st = ST.create({
      trigger: section, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) { frame(self.scroll() - self.start); schedule(); },
      onRefresh: function (self) { frame(self.scroll() - self.start); }
    });
    frame(Math.max(0, st.scroll() - st.start));
  }
  function disable() {
    if (st) { clearTimeout(snapT); st.kill(); st = null; }
    section.classList.remove('is-pinned');
    last = [];
    vw.style.removeProperty('--gx'); vw.style.removeProperty('--gy');
    stackOn();
    window.dispatchEvent(new Event('resize'));
  }
  function sync() { if (canPin && mq.matches) enable(); else if (st || !io) disable(); }

  if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync); else sync();
})();
