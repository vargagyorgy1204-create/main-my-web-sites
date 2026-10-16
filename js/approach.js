/* approach.js — motion layer for myapproach.html ("Hogyan dolgozom").
   Same toolkit and feel as the About / Együttműködés sections: GSAP + ScrollTrigger + SplitText
   (window.VB from js/gsap-setup.js), Lenis from js/lenis-setup.js.

   Everything is visible by default (CSS). The initial hidden state is applied here, and only after
   GSAP / ScrollTrigger / SplitText are confirmed; the page's `ap-pre` class (set in <head>) hides the
   cards until then and has a CSS failsafe, so a blocked CDN never leaves an empty page.
   Reduced motion: nothing runs. Only transform / opacity / clip-path-like props are animated
   (the eyebrow's letter-spacing is the one intentional text-only exception).
   No manual ScrollTrigger.refresh() (it would cancel in-flight Lenis anchor scrolls). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var root = document.documentElement;
  var page = document.getElementById('approach-content');
  if (!page) { root.classList.remove('ap-pre'); return; }

  var reduce = !!VB.reduceMotion;
  var back = page.querySelector('.ap-back');
  var photo = page.querySelector('.ap-photo');
  var card = page.querySelector('.ap-card');

  /* ---- frame breathing: pause when the tab is hidden (CSS animation, paint only) ---- */
  if (photo) {
    document.addEventListener('visibilitychange', function () {
      photo.classList.toggle('is-paused', document.hidden);
    });
  }

  if (reduce || !VB.gsap || !VB.hasST || !VB.hasSplit) { root.classList.remove('ap-pre'); return; }

  var gsap = VB.gsap;
  var ST = window.ScrollTrigger;
  var SplitText = window.SplitText;
  var EASE = 'power4.out';

  function arr(sel, ctx) { return Array.prototype.slice.call((ctx || page).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var eyebrow = page.querySelector('.ap-eyebrow');
  var title = page.querySelector('.ap-title');
  var intro = page.querySelector('.ap-intro');
  var rows = arr('.ap-row');
  var revealed = [];            /* rows whose reveal already ran: kept on rebuild */

  /* ---------------------------------------------------------- initial hidden states */
  gsap.set([back, photo, card].filter(Boolean), { opacity: 0 });
  if (back) gsap.set(back, { y: 12 });
  gsap.set([photo, card].filter(Boolean), { y: 40, scale: 0.98 });
  root.classList.remove('ap-pre');

  /* ---------------------------------------------------------- 1) entrance (runs once) */
  var eSplit = null, tSplit = null;
  function entrance() {
    var tl = gsap.timeline({ defaults: { ease: EASE } });
    if (back) tl.to(back, { opacity: 1, y: 0, duration: 0.6 }, 0);
    tl.to([photo, card].filter(Boolean), { opacity: 1, y: 0, scale: 1, duration: 1, stagger: 0.12, clearProps: 'opacity,transform' }, 0.12);

    if (eyebrow) {
      eSplit = SplitText.create(eyebrow, { type: 'chars', aria: 'auto' });
      gsap.set(eSplit.chars, { opacity: 0 });
      gsap.set(eyebrow, { letterSpacing: '0.6em' });
      tl.to(eyebrow, { letterSpacing: '0.2em', duration: 0.6, ease: 'power3.out' }, 0.45);
      tl.to(eSplit.chars, { opacity: 1, duration: 0.2, ease: 'none', stagger: 0.03 }, 0.45);
    }
    if (title) {
      tSplit = SplitText.create(title, { type: 'lines,words', mask: 'lines', linesClass: 'ap-line', maskClass: 'ap-line-mask', wordsClass: 'ap-word', aria: 'auto' });
      gsap.set(tSplit.words, { yPercent: 110 });
      tl.to(tSplit.words, { yPercent: 0, duration: 0.9, ease: EASE, stagger: 0.04 }, 0.6);
    }
    tl.add(function () {
      /* give the text back to the browser: plain, selectable, re-wraps on resize */
      if (eSplit) { eSplit.revert(); eyebrow.style.letterSpacing = ''; }
      if (tSplit) tSplit.revert();
      /* the cards were offset (y / scale) while the triggers were measured: measure again, now at rest */
      rebuild();
    });
  }

  /* ---------------------------------------------------------- scroll parts (rebuilt on resize) */
  var ctx = null;
  function build() {
    ctx = gsap.context(function (self) {
      var grid = page.querySelector('.ap-grid');

      /* 2) photo: slow scrub parallax inside the frame (the img is taller than its clip box) */
      var img = photo && photo.querySelector('img');
      if (img && grid) {
        gsap.fromTo(img, { yPercent: -4, scale: 1.08 }, {
          yPercent: 4, scale: 1, ease: 'none', immediateRender: true,
          scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
        });
      }

      /* 4) intro: scroll-linked word highlight + gradient underlines on the key phrases */
      if (intro) {
        var text = intro.textContent.replace(/\s+/g, ' ').trim();
        var iSplit = SplitText.create(intro, { type: 'words', aria: 'none' });
        intro.setAttribute('aria-label', text);
        var words = iSplit.words, EACH = 0.1, DUR = 0.3;
        gsap.set(words, { opacity: 0.3 });
        var tl = gsap.timeline({
          defaults: { ease: 'none', immediateRender: false },
          scrollTrigger: { trigger: intro, start: 'top 80%', end: 'bottom 45%', scrub: 0.5 }
        });
        words.forEach(function (w, i) { tl.to(w, { opacity: 1, duration: DUR }, i * EACH); });
        arr('.hl', intro).forEach(function (hl) {
          var inside = words.filter(function (w) { return hl.contains(w); });
          if (!inside.length) return;
          var last = words.indexOf(inside[inside.length - 1]);
          tl.fromTo(hl, { '--u': 0 }, { '--u': 1, duration: 0.35 }, last * EACH + DUR);
        });
        /* total length of the timeline is what the scrub maps onto; pad it so the last underline finishes */
        tl.to({}, { duration: 0.05 });
      }

      /* 3) principles: each row reveals once, rows entering together are staggered */
      function rowParts(row) {
        return {
          num: row.querySelector('.ap-row__num'),
          box: row.querySelector('.ap-row__icon'),
          paths: arr('.ap-row__icon svg *', row).filter(function (n) { return typeof n.getTotalLength === 'function'; }),
          h3: row.querySelector('.ap-row__body h3'),
          p: row.querySelector('.ap-row__body p'),
          rule: row.querySelector('.ap-row__rule')
        };
      }
      function hideRow(row) {
        var r = rowParts(row);
        gsap.set(r.num, { opacity: 0 });
        gsap.set(r.box, { opacity: 0, scale: 0.8 });
        r.paths.forEach(function (n) { n.setAttribute('pathLength', '1'); });
        gsap.set(r.paths, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.set(r.h3, { opacity: 0 });
        gsap.set(r.p, { opacity: 0 });
        gsap.set(r.rule, { scaleX: 0 });
      }
      function showRow(row, delay) {
        var r = rowParts(row), n = rows.indexOf(row) + 1, counter = { v: 0 };
        var split = r.h3 ? SplitText.create(r.h3, { type: 'lines', mask: 'lines', linesClass: 'ap-hline', maskClass: 'ap-h-mask', aria: 'auto' }) : null;
        if (split) gsap.set(split.lines, { yPercent: 110 });
        if (r.h3) gsap.set(r.h3, { opacity: 1 });
        var tl = gsap.timeline({ delay: delay, defaults: { ease: 'power3.out' }, onComplete: function () {
          if (split) split.revert();
          gsap.set([r.num, r.box, r.p, r.rule, r.h3].filter(Boolean), { clearProps: 'all' });
          gsap.set(r.paths, { clearProps: 'strokeDasharray,strokeDashoffset' });
        } });
        tl.to(r.rule, { scaleX: 1, duration: 0.6, ease: 'power2.out' }, 0);
        tl.to(r.num, { opacity: 1, duration: 0.2, ease: 'none' }, 0.05);
        tl.to(counter, { v: n, duration: 0.6, ease: 'power1.out', onUpdate: function () { r.num.textContent = pad(Math.round(counter.v)); }, onComplete: function () { r.num.textContent = pad(n); } }, 0.05);
        tl.to(r.box, { opacity: 1, scale: 1, duration: 0.5 }, 0.1);
        tl.to(r.paths, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut', stagger: 0.05 }, 0.15);
        if (split) tl.to(split.lines, { yPercent: 0, duration: 0.7, ease: EASE }, 0.15);
        tl.to(r.p, { opacity: 1, duration: 0.6 }, 0.25);
      }

      rows.forEach(function (row) {
        if (revealed.indexOf(row) === -1) hideRow(row);
      });
      var pending = rows.filter(function (row) { return revealed.indexOf(row) === -1; });
      if (pending.length) {
        ST.batch(pending, {
          start: 'top 85%', once: true,
          onEnter: function (batch) {
            /* ignore(): the reveal is one-off and must survive a rebuild (resize) that reverts the context */
            self.ignore(function () {
              batch.forEach(function (row, i) { revealed.push(row); showRow(row, i * 0.08); });
            });
          }
        });
      }
    }, page);
  }

  /* ---------------------------------------------------------- tilt toward the pointer (<= 3deg) */
  if (photo) {
    var qx = gsap.quickTo(photo, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    var qy = gsap.quickTo(photo, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    var tiltOn = false;
    photo.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;     /* real pointer input, not a media query (touch-screen laptops) */
      var r = photo.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      var ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!tiltOn) { gsap.set(photo, { transformPerspective: 600 }); tiltOn = true; }
      qx(Math.max(-1, Math.min(1, nx)) * 3);
      qy(-Math.max(-1, Math.min(1, ny)) * 3);
    });
    photo.addEventListener('pointerleave', function () { qx(0); qy(0); });
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
    resetOnScrollAway(photo, function () { qx(0); qy(0); });
  }

  /* ---------------------------------------------------------- boot + debounced rebuild */
  function start() {
    entrance();
    build();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();

  function rebuild() {
    if (!ctx) return;
    ctx.revert();          /* kills the scroll triggers and restores the split intro */
    build();
  }
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(rebuild, 250);
  });
})();
