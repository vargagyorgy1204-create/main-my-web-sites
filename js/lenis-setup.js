/* lenis-setup.js — Lenis smooth scroll, driven by GSAP's ticker so scrubbed
   ScrollTriggers stay in sync (one rAF loop, no second one). Same wiring as
   the demovarbro test site. Not initialised at all under prefers-reduced-motion
   or when the CDN scripts are blocked: native scrolling then stays in charge. */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  VB.lenis = null;

  if (VB.reduceMotion) {
    console.info('[VarBro] Reduced motion: Lenis disabled, native scrolling in use.');
    return;
  }
  if (typeof window.Lenis === 'undefined' || !VB.gsap) return;

  var lenis = new window.Lenis({
    duration: 1.1,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
  });
  VB.lenis = lenis;

  if (VB.hasST) lenis.on('scroll', window.ScrollTrigger.update);
  VB.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });   /* ticker is in seconds */
  VB.gsap.ticker.lagSmoothing(0);

  /* In-page anchors animate through Lenis instead of jumping (the CSS
     scroll-behavior: smooth they relied on is gone). Links that already
     handled their own click (the nav menu) are left alone. */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (hash.length < 2) return;
    var target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0 });
    if (window.history && history.pushState) history.pushState(null, '', hash);
  });
})();
