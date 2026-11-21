/* why-pin.js — #why ("Értékek & Garanciák"), EXPERIMENT variant B "horizontal strip".

   >= 1024px wide (and >= 520px tall, motion allowed, GSAP + ScrollTrigger present): the section becomes a tall block (100svh + --hs-run) whose inner stage is `position: sticky`
   (same technique as the Rólam / Együttműködés stages). One ScrollTrigger tracks the progress p (0..1); the track of six cards moves right -> left by p x travel, so card 01 starts
   on the left gutter line and card 06 ends on the right gutter line. A focus point glides from card 01's centre to card 06's centre with p; the card nearest to it is "active"
   (scale 1, opacity 1; the others scale .94, opacity .55, scrubbed, no jumps). Soft snap (Lenis scrollTo after the scroll stops) to the card centres p = i / 5.
   < 1024px: no pin, a native swipe carousel (CSS scroll-snap); the dots follow the scroll position and scroll to a card when pressed.
   Reduced motion / no GSAP / short windows: no pin, no scrub; on desktop a static 3 x 2 grid (CSS), the cards fade in once when they enter the view.
   No manual ScrollTrigger.refresh(). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('why');
  if (!section) return;
  var cards = [].slice.call(section.querySelectorAll('.hs__card'));
  var N = cards.length;
  if (!N) return;
  var track = section.querySelector('.hs__track'), view = section.querySelector('.hs__view'), glow = section.querySelector('.hs__glow');
  var cur = section.querySelector('.hs__cur'), bar = section.querySelector('.hs__bar');
  var dots = [].slice.call(section.querySelectorAll('.hs__dot'));
  var reduce = !!VB.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ST = window.ScrollTrigger;
  var canPin = !!(VB.gsap && VB.hasST && ST) && !reduce;
  var mq = window.matchMedia('(min-width: 1024px) and (min-height: 520px)');
  var small = window.matchMedia('(max-width: 1023px)');
  var st = null, snapT = 0, io = null, active = -1;
  var G = { w: 0, pitch: 0, travel: 0, g: 0, vw: 0, vx: 0 };

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function schedule() { if (VB.whyNoSnap) return; clearTimeout(snapT); snapT = setTimeout(snap, 180); }      /* VB.whyNoSnap: test hook (frames between the snap points) */

  /* ---------------------------------------------------------------- pinned */
  function measure() {
    var cs = getComputedStyle(section);
    G.g = parseFloat(cs.paddingLeft) || 0;
    G.vw = section.clientWidth;                                       /* the section's width = gutter + content + gutter */
    G.w = parseFloat(getComputedStyle(cards[0]).width) || cards[0].offsetWidth;                      /* fractional width (30vw) */
    var gap = parseFloat(getComputedStyle(track).columnGap) || 32;
    G.pitch = G.w + gap;
    G.vx = view.getBoundingClientRect().left - section.getBoundingClientRect().left;      /* the clipped view starts a little left of the gutter line */
    G.travel = Math.max(0, N * G.w + (N - 1) * gap - (G.vw - 2 * G.g));
  }

  function frame(p) {
    var x = -p * G.travel;
    track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    var c0 = G.g + G.w / 2, c1 = G.vw - G.g - G.w / 2, fx = c0 + p * (c1 - c0);       /* the focus point (view coordinates) */
    var best = 0, bd = 1e9;
    cards.forEach(function (card, i) {
      var cx = c0 + i * G.pitch + x, d = Math.abs(cx - fx), k = 1 - clamp(d / G.pitch);
      var sc = 0.94 + 0.06 * k, op = 0.55 + 0.45 * k;
      card.style.transform = 'scale(' + sc.toFixed(3) + ')';
      card.style.opacity = op.toFixed(3);
      if (d < bd) { bd = d; best = i; }
    });
    if (best !== active) {
      if (active >= 0) cards[active].classList.remove('is-active');
      cards[best].classList.add('is-active');
      active = best;
      if (cur) cur.textContent = ('0' + (best + 1)).slice(-2);
    }
    if (bar) bar.style.setProperty('--p', p.toFixed(3));
    if (glow) glow.style.setProperty('--gx', (fx - G.vx).toFixed(0) + 'px');
  }

  function snap() {
    if (!st) return;
    var lenis = VB.lenis;
    if (lenis && lenis.isScrolling) { schedule(); return; }
    var y = lenis ? lenis.scroll : window.pageYOffset;
    var rel = y - st.start, run = st.end - st.start;
    if (rel <= 1 || rel >= run - 1) return;
    var best = 0, bd = 1e9;
    for (var i = 0; i < N; i++) { var d = Math.abs(rel - (i / (N - 1)) * run); if (d < bd) { bd = d; best = i; } }
    var target = st.start + (best / (N - 1)) * run;
    if (Math.abs(target - y) <= 2) return;
    if (lenis) lenis.scrollTo(target, { duration: 0.5, easing: function (t) { return 1 - Math.pow(1 - t, 2); } });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  }

  function enable() {
    if (st) return;
    section.classList.add('is-pinned');
    cards.forEach(function (c) { c.classList.remove('is-in', 'is-pre'); });
    if (io) { io.disconnect(); io = null; }
    active = -1;
    measure();
    st = ST.create({
      trigger: section, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) { frame(self.progress); schedule(); },
      onRefresh: function (self) { measure(); frame(self.progress); }
    });
    frame(st.progress);
  }
  function unpin() {
    if (st) { clearTimeout(snapT); st.kill(); st = null; }
    section.classList.remove('is-pinned');
    track.style.transform = '';
    cards.forEach(function (c) { c.style.transform = ''; c.style.opacity = ''; c.classList.remove('is-active'); });
    active = -1;
  }

  /* ---------------------------------------------------------------- carousel dots (< 1024px) */
  function trackPad() { return parseFloat(getComputedStyle(track).paddingLeft) || 0; }
  function dotsUpdate() {
    if (!dots.length || !small.matches) return;
    var l = track.scrollLeft, best = 0, bd = 1e9;
    cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - trackPad() - l); if (d < bd) { bd = d; best = i; } });
    dots.forEach(function (d, i) { d.classList.toggle('is-on', i === best); });
  }
  dots.forEach(function (d, i) {
    d.addEventListener('click', function () { track.scrollTo({ left: cards[i].offsetLeft - trackPad(), behavior: reduce ? 'auto' : 'smooth' }); });
  });
  track.addEventListener('scroll', dotsUpdate, { passive: true });

  /* ---------------------------------------------------------------- reduced motion on desktop: the grid fades in once */
  function fadeOn() {
    if (!reduce || !('IntersectionObserver' in window) || io || small.matches) return;
    cards.forEach(function (c) { c.classList.add('is-pre'); });
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.2 });
    cards.forEach(function (c) { io.observe(c); });
  }

  function sync() {
    if (canPin && mq.matches) enable();
    else { unpin(); fadeOn(); dotsUpdate(); window.dispatchEvent(new Event('resize')); }
  }

  if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync); else sync();
})();
