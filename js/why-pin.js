/* why-pin.js — #why ("Értékek & Garanciák"), EXPERIMENT variant B "horizontal strip".

   >= 1024px wide (and >= 520px tall, motion allowed, GSAP + ScrollTrigger present): the section becomes a tall block (100svh + --hs-run) whose inner stage is `position: sticky`
   (CSS sticky, no JS pin: no pinSpacing / anticipatePin, so nothing can jump at the boundaries). One ScrollTrigger tracks the progress p (0..1); q = the progress of the strip,
   with a short dwell at both ends (4% at the start, 8% at the end, so the section releases calmly after card 06). The track of six cards moves right -> left by q x travel: card 01 starts on the
   left gutter line, card 06 ends on the right gutter line. A focus point glides from card 01's centre to card 06's centre with q; the card nearest to it is "active" (scale 1, opacity 1;
   the others scale .94, opacity .55, scrubbed, no jumps). Soft snap (Lenis scrollTo after the scroll stops) only to the four INNER card centres, and only when the scroll stopped close to one
   (never at the boundaries).
   Entrance: when the section top reaches 78% of the viewport (before the pin starts) the cards slide in from +60px with a stagger.
   Hover (html.has-cursor): a cursor-follow spotlight on the card border (--mx / --my). The decorative layers (blobs, icon float, turning border) are CSS and pause off-screen (#why.is-off).
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
  var mq = window.matchMedia(window.VB.desk(1024, '(min-height: 520px)'));
  var small = window.matchMedia('(max-width: 1023px), ' + window.VB.PT);
  var st = null, stIn = null, snapT = 0, io = null, active = -1, lastP = 0, off = null;
  var G = { w: 0, pitch: 0, travel: 0, g: 0, vw: 0, vx: 0 };
  var DWELL_A = 0.04, DWELL_B = 0.08;
  var E = cards.map(function () { return { v: 1 }; });                     /* entrance progress per card (0 -> 1) */

  function clamp(x) { return Math.max(0, Math.min(1, x)); }
  function qOf(p) { return clamp((p - DWELL_A) / (1 - DWELL_A - DWELL_B)); }
  function pOf(q) { return DWELL_A + q * (1 - DWELL_A - DWELL_B); }
  function schedule() { if (VB.whyNoSnap) return; clearTimeout(snapT); snapT = setTimeout(snap, 220); }      /* VB.whyNoSnap: test hook (frames between the snap points) */

  /* ---------------------------------------------------------------- pinned */
  function measure() {
    var cs = getComputedStyle(section);
    G.g = parseFloat(cs.paddingLeft) || 0;
    G.vw = section.clientWidth;                                       /* the section's width = gutter + content + gutter */
    G.w = parseFloat(getComputedStyle(cards[0]).width) || cards[0].offsetWidth;                      /* fractional width (30vw) */
    var gap = parseFloat(getComputedStyle(track).columnGap) || 32;
    G.pitch = G.w + gap;
    G.vx = view.getBoundingClientRect().left - section.getBoundingClientRect().left;
    G.travel = Math.max(0, N * G.w + (N - 1) * gap - (G.vw - 2 * G.g));
  }

  function frame(p) {
    lastP = p;
    var q = qOf(p);
    var x = -q * G.travel;
    track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    var c0 = G.g + G.w / 2, c1 = G.vw - G.g - G.w / 2, fx = c0 + q * (c1 - c0);       /* the focus point (view coordinates) */
    var best = 0, bd = 1e9;
    cards.forEach(function (card, i) {
      var cx = c0 + i * G.pitch + x, d = Math.abs(cx - fx), k = 1 - clamp(d / G.pitch), e = E[i].v;
      var sc = 0.94 + 0.06 * k, op = (0.55 + 0.45 * k) * e;
      card.style.transform = 'scale(' + sc.toFixed(3) + ')';
      card.style.opacity = op.toFixed(3);
      card.style.translate = e < 1 ? '0 ' + (60 * (1 - e)).toFixed(1) + 'px' : '';
      if (d < bd) { bd = d; best = i; }
    });
    if (best !== active) {
      if (active >= 0) cards[active].classList.remove('is-active');
      cards[best].classList.add('is-active');
      active = best;
      if (cur) cur.textContent = ('0' + (best + 1)).slice(-2);
    }
    if (bar) bar.style.setProperty('--p', q.toFixed(3));
    if (glow) glow.style.setProperty('--gx', (fx - G.vx).toFixed(0) + 'px');
  }

  /* soft snap: only to the inner card centres (q = 1/5 .. 4/5), only when the scroll stopped within ~7% of the run of one; the boundaries are never snapped */
  function snap() {
    if (!st) return;
    var lenis = VB.lenis;
    if (lenis && lenis.isScrolling) { schedule(); return; }
    var y = lenis ? lenis.scroll : window.pageYOffset;
    var run = st.end - st.start, p = (y - st.start) / run;
    var best = -1, bd = 1e9;
    for (var i = 1; i < N - 1; i++) { var d = Math.abs(p - pOf(i / (N - 1))); if (d < bd) { bd = d; best = i; } }
    if (best < 0 || bd > 0.07) return;
    var target = st.start + pOf(best / (N - 1)) * run;
    if (Math.abs(target - y) <= 2) return;
    if (lenis) lenis.scrollTo(target, { duration: 0.5, easing: function (t) { return 1 - Math.pow(1 - t, 2); } });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  }

  /* entrance: before the pin starts the cards slide in from +60px (stagger) */
  function enter(now) {
    if (now) { E.forEach(function (o) { o.v = 1; }); frame(lastP); return; }
    E.forEach(function (o) { o.v = 0; });
    frame(lastP);
    VB.gsap.to(E, { v: 1, duration: 0.95, ease: 'power3.out', stagger: 0.09, onUpdate: function () { frame(lastP); }, onComplete: function () { frame(lastP); } });
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
    var entered = st.progress > 0.001 || st.scroll() > st.start - window.innerHeight * 0.22;      /* already inside / past the entrance zone: no entrance */
    E.forEach(function (o) { o.v = entered ? 1 : 0; });
    frame(st.progress);
    if (!entered) {
      stIn = ST.create({ trigger: section, start: 'top 78%', once: true, onEnter: function () { if (st && st.progress > 0.001) enter(true); else enter(false); } });
    }
    if ('IntersectionObserver' in window && !off) {
      off = new IntersectionObserver(function (es) { section.classList.toggle('is-off', !es[es.length - 1].isIntersecting); }, { threshold: 0 });
      off.observe(section);
    }
  }
  function unpin() {
    if (st) { clearTimeout(snapT); st.kill(); st = null; }
    if (stIn) { stIn.kill(); stIn = null; }
    section.classList.remove('is-pinned');
    track.style.transform = '';
    cards.forEach(function (c) { c.style.transform = ''; c.style.opacity = ''; c.style.translate = ''; c.classList.remove('is-active'); });
    E.forEach(function (o) { o.v = 1; });
    active = -1;
  }

  /* ---------------------------------------------------------------- spotlight on the hovered card's border (real mouse only; CSS gates it with html.has-cursor) */
  var pend = null, raf = 0;
  function spot() {
    raf = 0;
    if (!pend) return;
    var card = pend.card, r = card.getBoundingClientRect(), k = card.offsetWidth ? r.width / card.offsetWidth : 1;
    card.style.setProperty('--mx', ((pend.x - r.left) / k).toFixed(0) + 'px');
    card.style.setProperty('--my', ((pend.y - r.top) / k).toFixed(0) + 'px');
    pend = null;
  }
  track.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || !st) return;
    var card = e.target.closest ? e.target.closest('.hs__card') : null;
    if (!card) return;
    pend = { card: card, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(spot);
  }, { passive: true });

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
