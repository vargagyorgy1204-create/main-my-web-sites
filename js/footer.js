/* footer.js — the bottom-bleed VARBRO wordmark (all pages with the shared footer).
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
})();
