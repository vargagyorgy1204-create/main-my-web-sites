/* why-pin.js — #why ("Értékek & Garanciák"): pinned stage with scroll-driven accordion cards.

   >= 1024px wide (and >= 520px tall, motion allowed): the section becomes a tall block (100svh + --why-run = 6 x 70svh)
   whose inner stage is `position: sticky` (same technique as the About / Együttműködés stages). One ScrollTrigger tracks the
   progress; each 70svh of scrolling opens the next card (01 -> 06) with the EXISTING open/close animation of the cards
   (the same `is-active` toggle that hover uses). Scrolling back reverses the order. After the scroll stops, a short Lenis
   scrollTo settles on the nearest step so a card is never left half-open (ScrollTrigger's own snap fights Lenis).
   There is no hover effect: a click (or Enter / Space) on a card scrolls to that card's step and the scroll position opens it. Below 1024px, with reduced motion or without GSAP: untouched (stacked / hover as before).
   No manual ScrollTrigger.refresh(). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('why');
  var W = VB.why;
  if (!section || !W || !VB.gsap || !VB.hasST || VB.reduceMotion) return;

  var ST = window.ScrollTrigger;
  var panels = W.panels, N = panels.length;
  var mq = window.matchMedia('(min-width: 1024px) and (min-height: 520px)');
  var st = null, cur = -1, snapT = 0;

  function stepLen() { return window.innerHeight * 0.7; }
  function indexAt(rel) { return Math.max(0, Math.min(N - 1, Math.floor(rel / stepLen() + 0.004))); }      /* a card opens when the scroll REACHES its step (the number of the next card has filled up by then) */
  function run() { return st ? st.end - st.start : 0; }

  function setStep(i) {
    if (i === cur) return;
    cur = i;
    W.activate(panels[i]);
  }

  /* water as progress: a passed card has a calm water level just under its number (W.passed()), the NEXT card's water rises with the scroll progress from the open step to its
     own step (scrubbed, drains on the way back), the open card is full (1), the rest are dry. The level reaches 100% exactly when the card opens (indexAt). */
  var lv = [];
  function charge(rel) {
    var pos = Math.max(0, rel / stepLen()), open = indexAt(rel);
    panels.forEach(function (p, k) {
      var f = k < open ? W.passed() : k === open ? 1 : k === open + 1 ? Math.min(1, pos - open) : 0;
      f = Math.round(f * 1000) / 1000;
      if (f !== lv[k]) { lv[k] = f; W.setLv(p, f); }
    });
  }

  function update(self) { var rel = self.scroll() - self.start; setStep(indexAt(rel)); charge(rel); }

  /* ---------------------------------------------------------------- settle on the nearest step */
  function snap() {
    if (!st) return;
    var lenis = VB.lenis;
    if (lenis && lenis.isScrolling) { schedule(); return; }
    var y = lenis ? lenis.scroll : window.pageYOffset;
    var rel = y - st.start, L = stepLen();
    if (rel <= 1 || rel >= run() - 1) return;
    var pts = [];
    for (var k = 0; k < N; k++) pts.push(k * L);
    pts.push(run());                            /* the end of the hold also shows card 06 */
    var best = pts.reduce(function (a, b) { return Math.abs(b - rel) < Math.abs(a - rel) ? b : a; });
    if (Math.abs(best - rel) <= 2) return;
    if (lenis) lenis.scrollTo(st.start + best, { duration: 0.4, easing: function (t) { return 1 - Math.pow(1 - t, 2); } });
    else window.scrollTo({ top: st.start + best, behavior: 'smooth' });
  }
  function schedule() { clearTimeout(snapT); snapT = setTimeout(snap, 160); }

  function goTo(i) {
    if (!st) return;
    var y = st.start + i * stepLen();
    if (VB.lenis) VB.lenis.scrollTo(y, { duration: 0.8, easing: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; } });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }

  /* ---------------------------------------------------------------- on / off with the viewport */
  function enable() {
    if (st) return;
    section.classList.add('is-pinned');
    lv = [];
    W.pinned = true;
    W.onSelect = goTo;
    section.style.removeProperty('--fit');       /* the pinned layout fills the viewport itself: no scale-to-fit */
    section.style.removeProperty('--fit-h');
    st = ST.create({
      trigger: section, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) { update(self); schedule(); },
      onRefresh: update,
      onLeave: function () { setStep(N - 1); charge(run()); },
      onLeaveBack: function () { setStep(0); charge(0); }
    });
    update(st);
  }
  function disable() {
    if (!st) return;
    clearTimeout(snapT);
    st.kill(); st = null; cur = -1;
    section.classList.remove('is-pinned');
    W.pinned = false; W.onSelect = null;
    W.activate(panels[0]);
    lv = [];
    window.dispatchEvent(new Event('resize'));   /* script.js re-fits the (unpinned) section */
  }
  function sync() { if (mq.matches) enable(); else disable(); }

  if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync); else sync();
})();
