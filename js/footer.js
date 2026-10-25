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
  var foot = div.closest('footer');
  if (!('IntersectionObserver' in window) || reduce) { div.classList.add('is-in'); }
  else {
    /* the social icons (the footer's first column, near its top: on phones far above the divider) emerge when THEIR row enters the viewport, one by one */
    var socials = foot.querySelector('.footer-section .social-links');
    if (socials) {
      foot.classList.add('fs-prep');
      new IntersectionObserver(function (es) {
        var s = es[es.length - 1];
        if (s.isIntersecting) foot.classList.add('fs-in');
        else if (s.boundingClientRect.top > 0) foot.classList.remove('fs-in');   /* below the viewport again: the icons leave in reverse order */
      }, { threshold: 0.6, rootMargin: '0px 0px -6% 0px' }).observe(socials);
    }
    var io = new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      if (e.isIntersecting) div.classList.add('is-in');
      else if (e.boundingClientRect.top > 0) div.classList.remove('is-in');     /* the footer is below the viewport again */
    }, { threshold: 0.6, rootMargin: '0px 0px -8% 0px' });
    io.observe(div.querySelector('.footer-divider__badge'));
  }
  var stamp = div.querySelector('.footer-stamp'), ring = stamp && stamp.querySelector('.stamp__ring');
  /* arrow hover: .is-hover (CSS loop) is set on pointerenter / removed on pointerleave of the badge ROOT only (no child pointerover restarts);
     on leave the current cycle is finished (the loop starts and ends centred, so removing the class at an iteration boundary is seamless) */
  var icon = stamp && stamp.querySelector('.stamp__icon'), endFn = null, endTimer = 0;
  function cancelEnd() { if (endFn) { icon.removeEventListener('animationiteration', endFn); endFn = null; } clearTimeout(endTimer); endTimer = 0; }
  if (stamp && icon && !reduce) {
    stamp.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch' || !document.documentElement.classList.contains('has-cursor') || !window.matchMedia('(min-width: 1024px)').matches) return;
      cancelEnd();
      stamp.classList.add('is-hover');
    });
    stamp.addEventListener('pointerleave', function () {
      if (!stamp.classList.contains('is-hover') || endFn) return;
      endFn = function () { cancelEnd(); stamp.classList.remove('is-hover'); };
      icon.addEventListener('animationiteration', endFn);
      endTimer = setTimeout(endFn, 1300);                                      /* failsafe */
    });
  }
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
  stamp.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch' && window.matchMedia('(min-width: 1024px)').matches) to(5); });
  stamp.addEventListener('pointerleave', function () { to(1); });
})();

/* ---- badge placement: it sits at the right end of the divider; if that would bring it closer than 12px to the footer text (the divider got closer to the
        columns), it slides ALONG the line - first as far right as the viewport allows, otherwise to the nearest free spot between the columns. The spacing never changes. ---- */
(function () {
  'use strict';
  var div = document.querySelector('.footer-divider');
  var badge = div && div.querySelector('.footer-divider__badge');
  if (!badge) return;
  var MIN = 12, EDGE = 6, timer = 0;
  function clearance(cx, cy, R, rects) {
    var best = 1e9;
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i], dx = Math.max(r.left - cx, 0, cx - r.right), dy = Math.max(r.top - cy, 0, cy - r.bottom);
      best = Math.min(best, Math.hypot(dx, dy) - R);
    }
    return best;
  }
  var wide = window.matchMedia('(min-width: 1024px)');                       /* below 1024px the badge is static at the line's right end */
  function place() {
    badge.style.removeProperty('--fs-shift');
    div.style.removeProperty('--fs-above');
    if (!wide.matches) {
      /* phones / tablets: the badge never moves sideways; if the text above reaches under it, the LINE moves down just enough for >= 12px clearance */
      var dr0 = div.getBoundingClientRect(), R0 = badge.offsetWidth / 2, wr = div.parentElement.getBoundingClientRect();
      var cx1 = wr.right - R0, cy1 = dr0.top + dr0.height / 2, extra = 0;
      var tw = document.createTreeWalker(document.querySelector('.footer-content'), NodeFilter.SHOW_TEXT, null), tn;
      while ((tn = tw.nextNode())) {
        if (!tn.nodeValue.trim()) continue;
        var rg0 = document.createRange(); rg0.selectNodeContents(tn);
        var l0 = rg0.getClientRects();
        for (var j = 0; j < l0.length; j++) {
          var r0 = l0[j]; if (!r0.width) continue;
          var sec = tn.parentElement.closest('.footer-section'), ty = 0;
          if (sec) { var tm = getComputedStyle(sec).transform; if (tm && tm !== 'none') ty = new DOMMatrix(tm).f; }     /* the column's entrance transform is not part of the layout */
          var bot = r0.bottom - ty; if (bot > cy1) continue;
          var dx = Math.max(r0.left - cx1, 0, cx1 - r0.right), need = Math.sqrt(Math.max(0, Math.pow(R0 + MIN, 2) - dx * dx));
          extra = Math.max(extra, need - (cy1 - bot));
        }
      }
      if (extra > 0) div.style.setProperty('--fs-above', Math.ceil(extra) + 'px');
      return;
    }
    var dr = div.getBoundingClientRect(), wrap = div.parentElement.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    var R = badge.offsetWidth / 2;                                         /* layout size: the reveal transform (scale / rotate) must not leak into the maths */
    var cy = dr.top + dr.height / 2, cx0 = wrap.right - R;                 /* default centre: the right end of the line */
    var rects = [];
    document.querySelectorAll('.footer-content .social-links a').forEach(function (a) { rects.push(a.getBoundingClientRect()); });
    var walker = document.createTreeWalker(document.querySelector('.footer-content'), NodeFilter.SHOW_TEXT, null), node;
    while ((node = walker.nextNode())) {                                    /* the glyph boxes only, not the (wider) boxes of their blocks */
      if (!node.nodeValue.trim()) continue;
      var rg = document.createRange(); rg.selectNodeContents(node);
      var list = rg.getClientRects();
      for (var i = 0; i < list.length; i++) if (list[i].width) rects.push(list[i]);
    }
    if (clearance(cx0, cy, R, rects) >= MIN) return;                       /* the default spot is fine */
    var maxS = vw - EDGE - R - cx0, minS = wrap.left + R - cx0, best = 0, bestC = -1e9, found = false;
    for (var s = 2; s <= Math.max(maxS, -minS) && !found; s += 2) {        /* the smallest shift that clears the text; right first, then left */
      var dirs = [s, -s];
      for (var k = 0; k < 2; k++) {
        var d = dirs[k];
        if (d > maxS || d < minS) continue;
        var c = clearance(cx0 + d, cy, R, rects);
        if (c >= MIN) { best = d; found = true; break; }
        if (c > bestC) { bestC = c; best = d; }
      }
    }
    badge.style.setProperty('--fs-shift', best.toFixed(1) + 'px');
  }
  function later() { clearTimeout(timer); timer = setTimeout(place, 120); }
  window.addEventListener('resize', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place); else place();
  window.addEventListener('load', place);
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.querySelector('.footer-content'));
})();
