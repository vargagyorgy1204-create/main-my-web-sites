/* gsap-setup.js — registers whichever GSAP plugins actually loaded and exposes
   a single guard (window.VB) so later scripts degrade instead of throwing when
   a CDN is blocked. Loaded (defer) after the GSAP plugin scripts. */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  var g = window.gsap || null;

  var plugins = [window.ScrollTrigger, window.Flip, window.SplitText].filter(Boolean);
  if (g && plugins.length) g.registerPlugin.apply(g, plugins);

  VB.gsap     = g;
  VB.hasST    = !!(g && window.ScrollTrigger);
  VB.hasFlip  = !!(g && window.Flip);
  VB.hasSplit = !!(g && window.SplitText);
  VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!VB.hasST) return;

  var raf = 0;
  function refresh() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { window.ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
})();
