/* footer.js — the bottom-bleed VARBRO wordmark and the back-to-top badge on the divider (all pages with the shared footer).
   Vanilla JS on purpose (adatvedelem.html has no GSAP): fits the wordmark to the container width once the
   fonts are ready (refit on resize, debounced), rises it in once when the footer scrolls into view, and on
   pointer devices lets a soft highlight follow the cursor horizontally. Everything is visible without it;
   reduced motion: fit only; touch: no highlight. */
(function () {
  'use strict';
  var floor = document.querySelector('.footer-floor');
  if (!floor) return;
  var wmBox = floor.querySelector('.footer-wordmark');
  var wm = wmBox && wmBox.querySelector('span');
  if (!wm) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- fit: exact container width, never wider, never taller than 30% of the viewport height ---- */
  function fit() {
    var w = floor.clientWidth;
    if (!w) return;
    floor.style.removeProperty('--wm');
    var size = parseFloat(getComputedStyle(wm).fontSize) || 100;
    wm.style.display = 'inline-block';                    /* measure the text, not the block */
    var tw = wm.getBoundingClientRect().width;
    wm.style.display = '';
    if (!tw) return;
    var fitted = size * (w / tw) * 0.995;
    var cap = window.innerHeight * 0.3;
    floor.style.setProperty('--wm', Math.min(fitted, Math.max(cap, 60)).toFixed(2) + 'px');
  }
  var rt;
  function refit() { clearTimeout(rt); rt = setTimeout(fit, 150); }
  window.addEventListener('resize', refit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();

  if (reduce) return;

  /* ---- entrance, once ---- */
  if ('IntersectionObserver' in window) {
    floor.classList.add('fw-prep');
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      requestAnimationFrame(function () { floor.classList.remove('fw-prep'); floor.classList.add('fw-in'); });
    }, { threshold: 0.15 });
    io.observe(floor);
    /* failsafe: never leave it hidden */
    setTimeout(function () { if (floor.classList.contains('fw-prep')) { floor.classList.remove('fw-prep'); floor.classList.add('fw-in'); } }, 6000);
  }

  /* ---- soft highlight following the cursor (x only), eased ---- */
  var target = 50, cur = 50, gi = 0, tgi = 0, raf = 0;
  function tick() {
    raf = 0;
    cur += (target - cur) * 0.12;
    gi += (tgi - gi) * 0.1;
    wm.style.setProperty('--gx', cur.toFixed(2) + '%');
    wm.style.setProperty('--gi', gi.toFixed(3));
    if (Math.abs(target - cur) > 0.05 || Math.abs(tgi - gi) > 0.005) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(tick); }
  floor.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;     /* real pointer input, not a media query (touch-screen laptops) */
    var r = wmBox.getBoundingClientRect();
    target = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    tgi = 1;
    kick();
  });
  floor.addEventListener('pointerleave', function () { tgi = 0; kick(); });
  /* Lenis / wheel scrolling moves content under a stationary mouse without pointer events: re-test on scroll */
  function resetOnScrollAway(el, reset) {
    var lx = -1, ly = -1, tk = false;
    document.addEventListener('pointermove', function (e) { lx = e.clientX; ly = e.clientY; }, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', function () {
      if (tk || lx < 0) return; tk = true;
      requestAnimationFrame(function () { tk = false; var u = document.elementFromPoint(lx, ly); if (!u || !el.contains(u)) reset(); });
    }, { passive: true });
  }
  resetOnScrollAway(floor, function () { tgi = 0; kick(); });
})();

/* ---- divider line + back-to-top badge: drawn / emerging when the footer enters the viewport, reversed when it is left downwards;
        the badge ring spins faster while a real mouse hovers it (playbackRate eased, no restart of the animation) ---- */
(function () {
  'use strict';
  var div = document.querySelector('.footer-divider');
  if (!div) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) { div.classList.add('is-in'); }
  else {
    var io = new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      if (e.isIntersecting) div.classList.add('is-in');
      else if (e.boundingClientRect.top > 0) div.classList.remove('is-in');     /* the footer is below the viewport again */
    }, { threshold: 0.6, rootMargin: '0px 0px -8% 0px' });
    io.observe(div.querySelector('.footer-divider__badge'));
  }
  var stamp = div.querySelector('.footer-stamp'), ring = stamp && stamp.querySelector('.stamp__ring');
  if (!ring || reduce || !ring.getAnimations) return;
  var anim = null, rate = 1, goal = 1, raf = 0;
  function step() {
    raf = 0;
    rate += (goal - rate) * 0.1;
    if (anim) anim.playbackRate = rate;
    if (Math.abs(goal - rate) > 0.01) raf = requestAnimationFrame(step);
  }
  function to(g) {
    anim = anim || ring.getAnimations()[0];
    if (!anim) return;
    goal = g;
    if (!raf) raf = requestAnimationFrame(step);
  }
  stamp.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') to(5); });
  stamp.addEventListener('pointerleave', function () { to(1); });
})();
