/* hero-c.js — hero variant C "spotlight" (experiment, active only with ?hero=c → html.hero-c).
   A dark hero with an outlined headline. A soft circular "flashlight" follows the pointer (GSAP quickTo, ~0.35s) and reveals, inside the circle only,
   (a) the hidden colourful layer (brand blobs + dot grid) and (b) a filled copy of the headline (same mask, same position → perfectly aligned).
   The mask is a CSS radial-gradient driven by --hc-x/--hc-y (relative to the section) on #hero-c; no WebGL.
   No mouse (touch / no html.has-cursor): the light wanders along the headline on its own (looping path, ~8s). Reduced motion: no light, headline fully filled.
   Scroll out: the light shrinks + fades, the headline lines drift apart + fade. Delete this file + the "Hero variant C" CSS block + #hero-c to remove the variant. */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!root.classList.contains('hero-c')) return;
  var sec = document.getElementById('hero-c');
  if (!sec) return;
  var VB = window.VB || {};
  var gsap = VB.gsap;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var title = sec.querySelector('.hc-title');

  /* ------------------------------------------------ live time (Europe/Budapest) */
  var time = sec.querySelector('.hc-time');
  if (time) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { fmt = null; }
    var tick = function () {
      var d = new Date();
      time.textContent = fmt ? fmt.format(d) : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      time.setAttribute('datetime', d.toISOString());
      setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);
    };
    tick();
  }

  /* fonts first (the head script hides the content with html.hc-wait, so the font swap cannot shift anything), then the entrance animations start */
  var go = function () { root.classList.remove('hc-wait'); };
  if (document.fonts && document.fonts.load && document.fonts.ready) {
    Promise.all([document.fonts.load('800 40px Syne'), document.fonts.load('500 16px Montserrat'), document.fonts.load('600 14px Montserrat'), document.fonts.load('400 13px Inter')]).then(function () { return document.fonts.ready; }).then(go, go);
  } else go();

  /* reduced motion: the filled headline, no light */
  if (reduce || !gsap) { root.classList.add('hc-static'); return; }

  /* ------------------------------------------------ geometry: the headline box inside the section (for the aligned mask + the wander path) */
  var box = { ox: 0, oy: 0, w: 0, h: 0 };
  function measure() {
    var s = sec.getBoundingClientRect(), t = title.getBoundingClientRect();
    box.ox = t.left - s.left; box.oy = t.top - s.top; box.w = t.width; box.h = t.height;
    sec.style.setProperty('--hc-ox', box.ox + 'px');
    sec.style.setProperty('--hc-oy', box.oy + 'px');
  }
  measure();
  window.addEventListener('resize', function () { measure(); apply(); });
  window.addEventListener('load', function () { measure(); apply(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); apply(); });

  /* ------------------------------------------------ the light */
  var st = { x: 0, y: 0 };
  function apply() {
    sec.style.setProperty('--hc-x', st.x.toFixed(1) + 'px');
    sec.style.setProperty('--hc-y', st.y.toFixed(1) + 'px');
  }
  st.x = box.ox + box.w * 0.5; st.y = box.oy + box.h * 0.5;
  apply();
  var qx = gsap.quickTo(st, 'x', { duration: 0.35, ease: 'power3', onUpdate: apply });
  var qy = gsap.quickTo(st, 'y', { duration: 0.35, ease: 'power3', onUpdate: apply });

  var mouse = false, lx = 0, ly = 0;
  function toSection(cx, cy) { var r = sec.getBoundingClientRect(); return [cx - r.left, cy - r.top]; }
  function follow() { var p = toSection(lx, ly); qx(p[0]); qy(p[1]); }
  sec.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    mouse = true; lx = e.clientX; ly = e.clientY; follow();
  }, { passive: true });
  sec.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') mouse = false; });
  window.addEventListener('scroll', function () { if (mouse) follow(); }, { passive: true });

  /* wander: a looping Lissajous path over the headline (~8s) while there is no mouse */
  var ph = { t: 0 };
  var wander = gsap.to(ph, {
    t: 1, duration: 8, ease: 'none', repeat: -1, paused: true,
    onUpdate: function () {
      if (mouse) return;
      var a = ph.t * Math.PI * 2;
      qx(box.ox + box.w * (0.5 + 0.42 * Math.sin(a)));
      qy(box.oy + box.h * (0.5 + 0.34 * Math.sin(a * 2 + 0.6)));
    }
  });

  /* ------------------------------------------------ entrance: the outline draws in (CSS clip reveal), then the light fades in at the headline centre */
  gsap.to(sec, { '--hc-k': 1, duration: 1.2, ease: 'power2.out', delay: 1.2 });
  /* a real mouse takes over (pointermove pauses the path); when it leaves the section the wander resumes */
  var entered = false;
  gsap.delayedCall(2.6, function () { entered = true; if (!mouse) wander.play(); });
  sec.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && !wander.paused()) wander.pause(); }, { passive: true });
  sec.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && entered) wander.play(); });

  /* ------------------------------------------------ scroll out: the light shrinks + fades, the lines drift apart + fade */
  if (VB.hasST) {
    var trig = { trigger: sec, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to(sec, { '--hc-sk': 0, ease: 'none', scrollTrigger: trig });
    var o = sec.querySelectorAll('.hc-copy--out .hc-line'), f = sec.querySelectorAll('.hc-copy--fill .hc-line');
    if (o.length === 2 && f.length === 2) {
      gsap.to([o[0], f[0]], { y: -46, opacity: 0.1, ease: 'none', scrollTrigger: trig });
      gsap.to([o[1], f[1]], { y: 46, opacity: 0.1, ease: 'none', scrollTrigger: trig });
    }
  }
})();
