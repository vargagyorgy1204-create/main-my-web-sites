/* hero-bg-pin.js — the hero background's extension below the hero (see .hero-bg / --hero-ext) while Rólam is pinned.
   Rólam is pinned (about-story.js: #about.is-pinned = 550svh tall, .about-pin is sticky; its story ScrollTrigger runs "top top" -> "bottom bottom", i.e. ~450svh of scroll).
   Without this, the extension (part of the hero) scrolls away with the page in the first ~50svh of the pin while Rólam stays fixed.
   Here: from the pin start (#about "top top") the background layer is held in place (counter-translated by the scroll distance, a transform) and fades out, scrubbed with the scroll,
   over the first ~38% of the pin distance (opacity 1 -> 0, power1.inOut); after that Rólam's own #170c26 is all that is shown. Scrolling back reverses it.
   When the fade reaches 0 the shader is told to pause ("hero:bgfade"). Below 900px Rólam is not pinned: the background simply scrolls away (it already ends in a long eased fade). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var G = VB.gsap;
  var hero = document.getElementById('hero');
  var about = document.getElementById('about');
  var bg = hero && hero.querySelector('.hero-bg');
  if (!G || !VB.hasST || !bg || !about) return;

  var FADE = 0.38;                                                  /* fraction of the pin distance over which the background fades out */
  var mode = 'abs', faded = false, active = false, D = 1, st = null;
  var ease = function (p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };      /* power1.inOut */

  function metrics() {
    active = window.innerWidth >= 900 && about.classList.contains('is-pinned');
    D = active ? Math.max(1, FADE * (about.offsetHeight - window.innerHeight)) : 1;
  }
  function setFaded(f) {
    if (f === faded) return; faded = f;
    bg.style.visibility = f ? 'hidden' : '';
    document.dispatchEvent(new CustomEvent('hero:bgfade', { detail: { faded: f } }));
  }
  function apply(s) {                                               /* held in place = translated down by exactly the scroll distance since the pin start (a transform: no layout shift, no mode switch, nothing to jump) */
    if (!st) return;
    var p = active ? (s - st.start) / D : 0;
    if (p <= 0) { if (mode !== 'abs') { mode = 'abs'; bg.style.transform = ''; } bg.style.opacity = ''; setFaded(false); }
    else { mode = 'held'; bg.style.transform = 'translate3d(0,' + (s - st.start).toFixed(2) + 'px,0)'; bg.style.opacity = String(1 - ease(Math.min(1, p))); setFaded(p >= 1); }
  }

  metrics();
  st = window.ScrollTrigger.create({
    trigger: about, start: 'top top', end: 'bottom bottom',                       /* = the story ScrollTrigger of about-story.js (the whole pin) */
    onUpdate: function (self) { apply(self.scroll()); },
    onToggle: function (self) { apply(self.scroll()); },
    onRefresh: function (self) { metrics(); apply(self.scroll()); }
  });
  if (window.MutationObserver) new MutationObserver(function () { metrics(); apply(window.scrollY || window.pageYOffset || 0); }).observe(about, { attributes: true, attributeFilter: ['class'] });   /* is-pinned is set once the story is built (and on resize) */
  window.__heroBgPin = { state: function () { return { mode: mode, faded: faded, active: active, start: st.start, end: st.end, D: D, aboutH: about.offsetHeight }; } };   /* test hook */
})();
