/* about-story.js — #about "chapters" story: Dizájn / Kód / Mozgás / Eredmény.

   >= 900px wide: the section is a sticky stage (width-only, any height). One scrubbed
   ScrollTrigger timeline drives everything that must be reversible (photo change, text swap,
   word dimming/colour, --about-accent, progress, the "→ eredmény." line). Each chapter's
   signature word animation is a short time-based timeline started by ScrollTrigger callbacks:
   restarted (never stacked) on entry, forced to its end state when leaving, reset when scrolling
   back past it, so fast flicking can never leave letters scrambled or offset.
   < 900px: a list; each chapter's animation plays once as it scrolls into view.

   Without JS, with reduced motion, or without GSAP/SplitText the CSS list layout stays as is.
   No manual ScrollTrigger.refresh() (it would cancel in-flight Lenis anchor scrolls). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('about');
  if (!section || !VB.gsap || !VB.hasST || !VB.hasSplit || VB.reduceMotion) return;

  var gsap = VB.gsap, ST = window.ScrollTrigger, Split = window.SplitText;
  var INK = 'rgb(26, 26, 46)';
  var COL = { design: 'rgb(192, 38, 163)', code: 'rgb(18, 130, 154)', motion: 'rgb(108, 99, 255)', result: 'rgb(200, 80, 192)' };
  var GLYPHS = '#/{}<>01=_'.split('');
  var q = function (sel, root) { return (root || section).querySelector(sel); };
  var qa = function (sel, root) { return Array.prototype.slice.call((root || section).querySelectorAll(sel)); };

  var ctx = null, splits = [], mode = '', anims = {}, warned = false, io = null, lastW = 0, lastH = 0;

  /* ------------------------------------------------------------ helpers */
  function split(el, opts) {
    var s = Split.create(el, opts);
    splits.push(s);
    return s;
  }
  function killAnim(k) { if (anims[k]) { anims[k].kill(); anims[k] = null; } }

  /* ------------------------------------------------------------ signature animations */
  function ensureFx(w, cls, html) {
    var el = w.querySelector('.' + cls);
    if (el) return el;
    el = document.createElement('span');
    el.className = 'abt-fx ' + cls;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html;
    w.appendChild(el);
    return el;
  }

  /* Dizájn: guide lines, displaced letters snapping in, a selection box with handles */
  function designTL(w, chars) {
    var fx = ensureFx(w, 'abt-fx--design', '<i class="g g--top"></i><i class="g g--base"></i><i class="box"><b></b><b></b><b></b><b></b></i>');
    var guides = fx.querySelectorAll('.g'), box = fx.querySelector('.box');
    var tl = gsap.timeline();
    tl.set(fx, { opacity: 1 })
      .fromTo(chars, { x: function () { return gsap.utils.random(-6, 6); }, y: function () { return gsap.utils.random(-6, 6); }, rotation: function () { return gsap.utils.random(-4, 4); } },
        { x: 0, y: 0, rotation: 0, duration: 0.55, ease: 'back.out(2)', stagger: 0.03 }, 0.1)
      .fromTo(guides, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
      .fromTo(box, { scale: 1.06, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' }, 0.25)
      .to(fx, { opacity: 0, duration: 0.3, ease: 'power1.in' }, 1.15);
    return tl;
  }
  function designNeutral(w, chars) {
    gsap.set(chars, { clearProps: 'transform' });
    var fx = w.querySelector('.abt-fx--design');
    if (fx) gsap.set(fx, { opacity: 0 });
  }

  /* Kód: letters decode left to right from code glyphs, then caret + angle brackets */
  function codeTL(w, chars) {
    var fx = ensureFx(w, 'abt-fx--code', '<b class="lt"></b><b class="gt"></b><i class="caret"></i>');
    var lt = fx.querySelector('.lt'), gt = fx.querySelector('.gt'), caret = fx.querySelector('.caret');
    var orig = chars.map(function (c) { return c.getAttribute('data-o') || c.textContent; });
    chars.forEach(function (c, i) {
      c.setAttribute('data-o', orig[i]);
      c.style.width = c.offsetWidth + 'px';          /* fixed width: no jitter while glyphs change */
      c.style.textAlign = 'center';
    });
    var st = { p: 0 }, last = 0;
    var tl = gsap.timeline();
    tl.to(st, {
      p: 1, duration: 0.6, ease: 'none',
      onUpdate: function () {
        var now = performance.now();
        if (now - last < 60 && st.p < 1) return;       /* ~16 updates/s */
        last = now;
        var n = chars.length;
        chars.forEach(function (c, i) {
          c.textContent = st.p >= (i + 1) / (n + 1) ? orig[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        });
      }
    }, 0)
      .fromTo([lt, gt], { opacity: 0, x: function (i) { return i ? 10 : -10; } }, { opacity: 0.4, x: 0, duration: 0.35, ease: 'power2.out' }, 0.5)
      .set(caret, { opacity: 1 }, 0.6)
      .to(caret, { opacity: 0, duration: 0.12, repeat: 3, yoyo: true, ease: 'steps(1)' }, 0.6)
      .to([lt, gt, caret], { opacity: 0, duration: 0.3 }, 1.25)
      .add(function () { codeNeutral(w, chars); });   /* release the fixed widths once decoded */
    return tl;
  }
  function codeNeutral(w, chars) {
    chars.forEach(function (c) {
      var o = c.getAttribute('data-o');
      if (o !== null) c.textContent = o;
      c.style.width = '';
      c.style.textAlign = '';
    });
    var fx = w.querySelector('.abt-fx--code');
    if (fx) gsap.set(fx.children, { opacity: 0 });
  }

  /* Mozgás: a wave runs through the letters, a ghost trails, the word drifts */
  function motionTL(w, chars) {
    var ghost = ensureFx(w, 'abt-fx--ghost', '');
    ghost.setAttribute('data-t', w.getAttribute('data-w') || '');
    var tl = gsap.timeline();
    chars.forEach(function (c, i) {
      tl.to(c, { yPercent: -25, duration: 0.22, ease: 'sine.out' }, i * 0.05)
        .to(c, { yPercent: 0, duration: 0.6, ease: 'elastic.out(1, 0.35)' }, i * 0.05 + 0.22);
    });
    tl.fromTo(ghost, { opacity: 0.25, x: -2 }, { opacity: 0, x: -8, duration: 0.9, ease: 'power1.out' }, 0)
      .to(w, { x: 6, duration: 0.45, ease: 'power2.out' }, 0)
      .to(w, { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' }, 0.45);
    return tl;
  }
  function motionNeutral(w, chars) {
    gsap.set(chars, { clearProps: 'transform' });
    gsap.set(w, { x: 0 });
    var g = w.querySelector('.abt-fx--ghost');
    if (g) gsap.set(g, { opacity: 0, x: 0 });
  }

  var KIND = { 1: [designTL, designNeutral], 2: [codeTL, codeNeutral], 3: [motionTL, motionNeutral] };

  /* ------------------------------------------------------------ Eredmény (shared by story + list) */
  function resultParts() {
    return {
      words: qa('.abt-w--design, .abt-w--code, .abt-w--motion'),
      arrow: q('.abt-result__arrow'),
      word: q('.abt-result__word'),
      line: q('.abt-result__line'),
      sign: q('.about-sign'),
      img5: q('.about-img--5'),
      card: q('.about-photo-card')
    };
  }
  function resultNeutral(p, storyMode) {
    gsap.set(p.arrow, { x: -16, opacity: 0 });
    gsap.set(p.word, { yPercent: 110 });
    gsap.set(p.line, { scaleX: 0, transformOrigin: 'left center' });
    if (storyMode) {
      gsap.set(p.words, { '--g': 0, scale: 1 });
      if (p.img5) gsap.set(p.img5, { '--z': 1.06 });
      gsap.set(p.card, { '--ring': 0 });
      if (p.sign) gsap.set(p.sign, { clipPath: 'inset(0 100% 0 0)' });
    }
  }
  function resultEnd(p, storyMode) {
    gsap.set(p.arrow, { x: 0, opacity: 1 });
    gsap.set(p.word, { yPercent: 0 });
    gsap.set(p.line, { scaleX: 1 });
    if (storyMode) {
      gsap.set(p.words, { '--g': 1, scale: 1 });
      if (p.img5) gsap.set(p.img5, { '--z': 1 });
      gsap.set(p.card, { '--ring': 1 });
      if (p.sign) gsap.set(p.sign, { clipPath: 'inset(0 0% 0 0)' });
    }
  }
  function resultTL(p, storyMode) {
    var tl = gsap.timeline();
    if (storyMode) {
      tl.to(p.words, { scale: 1.05, duration: 0.2, ease: 'power2.out' }, 0)
        .to(p.words, { scale: 1, duration: 0.3, ease: 'power2.inOut' }, 0.2)
        .to(p.words, { '--g': 1, duration: 0.7, ease: 'power2.inOut' }, 0.35)
        .to(p.img5, { '--z': 1, duration: 1.8, ease: 'power2.out' }, 0)
        .to(p.card, { '--ring': 1, duration: 0.9, ease: 'power2.out' }, 0);
      if (p.sign) tl.to(p.sign, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power2.inOut' }, 0.5);
    }
    tl.to(p.arrow, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.2)
      .to(p.word, { yPercent: 0, duration: 0.6, ease: 'power3.out' }, 0.3)
      .to(p.line, { scaleX: 1, duration: 0.6, ease: 'power2.out' }, 0.7);
    return tl;
  }

  /* ------------------------------------------------------------ photos (2-5 load only near the section) */
  function watchPhotos() {
    var imgs = qa('.about-img').slice(1);
    var load = function () {
      imgs.forEach(function (img) {
        if (img.getAttribute('src') || !img.getAttribute('data-src')) return;
        img.addEventListener('error', function () {
          if (warned) return; warned = true;
          console.warn('[VarBro] An About photo failed to load; the chapter will show the previous photo.');
        }, { once: true });
        img.src = img.getAttribute('data-src');
      });
    };
    if (!('IntersectionObserver' in window)) { load(); return; }
    io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); io = null; load(); }
    }, { rootMargin: '150% 0px 150% 0px' });
    io.observe(section);
  }

  /* ------------------------------------------------------------ story (>= 900px) */
  function buildStory() {
    mode = 'story';
    section.classList.add('is-pinned');
    var card = q('.about-bio-card');
    var imgs = [1, 2, 3, 4, 5].map(function (n) { return q('.about-img--' + n); });
    var W = { design: q('.abt-w--design'), code: q('.abt-w--code'), motion: q('.abt-w--motion'), and: q('.abt-w--and') };
    var h2 = q('.abt-heading');
    h2.setAttribute('aria-label', 'Dizájn, kód és mozgás');
    var chars = {};
    ['design', 'code', 'motion'].forEach(function (k) {
      W[k].setAttribute('data-w', W[k].textContent);
      chars[k] = split(W[k], { type: 'chars', charsClass: 'abt-c', aria: 'none' }).chars;
    });
    var chapters = qa('.abt-ch');                       /* intro + 4 */
    var lines = chapters.map(function (ch) {
      var els = qa('.abt-lead, .abt-body', ch);
      var out = [];
      els.forEach(function (el) {
        out = out.concat(split(el, { type: 'lines', mask: 'lines', linesClass: 'abt-line' }).lines);
      });
      return out;
    });
    var segs = qa('.abt-progress b');
    var result = q('.abt-result');
    var p = resultParts();

    /* initial (hidden) states, set from JS only */
    gsap.set(imgs.slice(1), { opacity: 1, clipPath: 'inset(100% 0% 0% 0%)', '--s': 1.08 });
    gsap.set(lines.slice(1).reduce(function (a, b) { return a.concat(b); }, []), { yPercent: 115 });
    gsap.set(segs, { scaleX: 0 });
    gsap.set(chapters.slice(1), { '--bar': 0 });
    gsap.set(result, { opacity: 0, y: 6 });
    gsap.set(card, { '--about-accent': COL.motion });
    resultNeutral(p, true);
    qa('.abt-fx').forEach(function (n) { n.remove(); });

    watchPhotos();

    /* one scrubbed timeline, durations in svh (intro 50, then 4 x 100: 30 transition + 70 hold) */
    var VH = [50, 150, 250, 350];
    var tl = gsap.timeline({
      defaults: { ease: 'none', immediateRender: false },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true }
    });
    var state = { design: [1, INK], code: [1, INK], motion: [1, INK], and: [1, INK] };
    function wordTo(key, op, color, at) {
      var s = state[key];
      tl.fromTo(W[key], { opacity: s[0], color: s[1] }, { opacity: op, color: color, duration: 30 }, at);
      state[key] = [op, color];
    }
    var prevAccent = COL.motion;
    var targets = [
      { k: 'design', accent: COL.design, ws: { design: [1, COL.design], code: [0.3, INK], and: [0.3, INK], motion: [0.3, INK] } },
      { k: 'code', accent: COL.code, ws: { design: [0.3, INK], code: [1, COL.code], and: [0.3, INK], motion: [0.3, INK] } },
      { k: 'motion', accent: COL.motion, ws: { design: [0.3, INK], code: [0.3, INK], and: [0.3, INK], motion: [1, COL.motion] } },
      { k: 'result', accent: COL.result, ws: { design: [1, COL.design], code: [1, COL.code], and: [1, INK], motion: [1, COL.motion] } }
    ];
    targets.forEach(function (t, i) {
      var S = VH[i];
      Object.keys(t.ws).forEach(function (key) { wordTo(key, t.ws[key][0], t.ws[key][1], S); });
      tl.fromTo(card, { '--about-accent': prevAccent }, { '--about-accent': t.accent, duration: 30 }, S);
      prevAccent = t.accent;
      /* photo: incoming rises bottom -> top while scaling 1.08 -> 1; outgoing dims */
      tl.fromTo(imgs[i + 1], { clipPath: 'inset(100% 0% 0% 0%)', '--s': 1.08 }, { clipPath: 'inset(0% 0% 0% 0%)', '--s': 1, duration: 30 }, S)
        .fromTo(imgs[i], { '--dim': 1 }, { '--dim': 0.7, duration: 30 }, S);
      /* text: outgoing lines up + fade, incoming lines rise from their masks */
      if (i > 0) tl.to(chapters[i], { '--bar': 0, duration: 14 }, S);
      tl.fromTo(chapters[i + 1], { '--bar': 0 }, { '--bar': 1, duration: 20 }, S + 9);
      tl.to(lines[i], { yPercent: -115, opacity: 0, duration: 14, stagger: 1.5 }, S)
        .fromTo(lines[i + 1], { yPercent: 115, opacity: 1 }, { yPercent: 0, duration: 20, stagger: 3 }, S + 9);
      tl.fromTo(segs[i], { scaleX: 0 }, { scaleX: 1, duration: 30 }, S);
    });
    tl.to(result, { opacity: 1, y: 0, duration: 30 }, VH[3]);
    tl.set({}, {}, 450);

    /* signature animations: one ScrollTrigger per chapter */
    function play(k) {
      killAnim(k);
      if (k === 4) { resultNeutral(p, true); anims[k] = resultTL(p, true); return; }
      var key = ['design', 'code', 'motion'][k - 1];
      KIND[k][1](W[key], chars[key]);
      anims[k] = KIND[k][0](W[key], chars[key]);
    }
    function finish(k) {
      killAnim(k);
      if (k === 4) { resultEnd(p, true); return; }
      var key = ['design', 'code', 'motion'][k - 1];
      KIND[k][1](W[key], chars[key]);
    }
    function reset(k) {
      killAnim(k);
      if (k === 4) { resultNeutral(p, true); return; }
      var key = ['design', 'code', 'motion'][k - 1];
      KIND[k][1](W[key], chars[key]);
    }
    VH.forEach(function (S, i) {
      var k = i + 1;
      ST.create({
        trigger: section,
        start: function () { return 'top+=' + Math.round((S + 8) * window.innerHeight / 100) + ' top'; },
        end: function () { return 'top+=' + Math.round((S + 100) * window.innerHeight / 100) + ' top'; },
        invalidateOnRefresh: true,
        onEnter: function () { play(k); },
        onEnterBack: function () { play(k); },
        onLeave: function () { finish(k); },
        onLeaveBack: function () { reset(k); }
      });
    });
  }

  /* ------------------------------------------------------------ list (< 900px) */
  function buildList() {
    mode = 'list';
    var h2 = q('.abt-heading');
    if (h2) h2.removeAttribute('aria-label');
    var p = resultParts();
    var resultEl = q('.abt-result');
    resultNeutral(p, false);
    var arts = qa('.abt-ch').slice(1);
    arts.forEach(function (art, i) {
      var k = i + 1;
      var title = q('.abt-ch__title', art);
      var textEls = qa('.abt-lead, .abt-body', art);
      gsap.set(textEls, { opacity: 0, y: 16 });
      if (k <= 3) {
        title.setAttribute('data-w', title.textContent);
        title.setAttribute('aria-label', title.textContent);
        var chars = split(title, { type: 'chars', charsClass: 'abt-c', aria: 'none' }).chars;
        ST.create({
          trigger: art, start: 'top 82%', once: true,
          onEnter: function () {
            gsap.to(textEls, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.1, delay: 0.1 });
            KIND[k][1](title, chars);
            anims[k] = KIND[k][0](title, chars);
          }
        });
      } else {
        ST.create({
          trigger: art, start: 'top 82%', once: true,
          onEnter: function () {
            gsap.to(textEls, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.1, delay: 0.1 });
          }
        });
        ST.create({
          trigger: resultEl, start: 'top 88%', once: true,
          onEnter: function () { anims[4] = resultTL(p, false); }
        });
      }
    });
  }

  /* ------------------------------------------------------------ mount / unmount / resize */
  function unmount() {
    Object.keys(anims).forEach(killAnim);
    if (ctx) { ctx.revert(); ctx = null; }
    splits.forEach(function (s) { try { s.revert(); } catch (e) {} });
    splits = [];
    qa('.abt-fx').forEach(function (n) { n.remove(); });
    qa('[data-o]').forEach(function (n) { n.removeAttribute('data-o'); });
    section.classList.remove('is-pinned');
    if (io) { io.disconnect(); io = null; }
    mode = '';
  }
  function mount() {
    lastW = window.innerWidth; lastH = window.innerHeight;
    ctx = gsap.context(function () {
      if (window.innerWidth >= 900) buildStory(); else buildList();
    }, section);
  }
  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (window.innerWidth === lastW && window.innerHeight === lastH) return;
      unmount();
      mount();
    }, 250);
  });

  function init() { mount(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(init); else init();
})();
