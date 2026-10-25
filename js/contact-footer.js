/* contact-footer.js — motion layer for #contact and the footer.
   Entrances, the "ÜZENJEN." letter rise (hover lives in heading-fx.js), tilt/magnet
   interactions, glow pause/resume, and the VARBRO wordmark scrub.

   Everything is visible by default (CSS). Initial hidden states are applied here
   only after GSAP / ScrollTrigger / SplitText are confirmed. Reduced motion:
   nothing runs. Touch devices: no tilt or magnet (entrances stay).
   No manual ScrollTrigger.refresh() (it would cancel in-flight Lenis scrolls). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('contact');
  var footer = document.querySelector('footer');
  var reduce = !!VB.reduceMotion;
  /* hover behaviour follows REAL pointer input (pointerType), not hover/pointer media queries: they are false on touch-screen laptops */
  function notTouch(e) { return e.pointerType !== 'touch'; }

  /* ---------------------------------------------------------- glows: run only on screen */
  if (section && !reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      section.classList.toggle('is-live', es[0].isIntersecting);
    }, { rootMargin: '10% 0px' }).observe(section);
  }

  if (reduce || !VB.gsap || !VB.hasST) return;
  var gsap = VB.gsap;
  var ST = window.ScrollTrigger;
  var EASE = 'power2.out';

  function arr(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

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

  /* ---------------------------------------------------------- magnet / tilt helpers */
  function magnet(el, max) {
    if (!el) return;
    var qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    var qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', function (e) {
      if (!notTouch(e)) return;
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      qx(Math.max(-1, Math.min(1, dx)) * max);
      qy(Math.max(-1, Math.min(1, dy)) * max);
    });
    el.addEventListener('pointerleave', function () { qx(0); qy(0); });
    resetOnScrollAway(el, function () { qx(0); qy(0); });
  }

  if (section) {
    magnet(section.querySelector('.btn-submit-message'), 6);
    magnet(section.querySelector('.btn-wa-cta'), 4);
    magnet(section.querySelector('.btn-email-cta'), 4);

    /* gentle pointer tilt of the whole photo circle */
    var card = section.querySelector('.contact-personal-panel');
    var photo = section.querySelector('.contact-photo-square');
    if (card && photo) {
      var raf = 0, tx = 0, ty = 0;
      var apply = function () {
        raf = 0;
        photo.style.setProperty('--rx', tx.toFixed(2) + 'deg');
        photo.style.setProperty('--ry', ty.toFixed(2) + 'deg');
      };
      card.addEventListener('pointermove', function (e) {
        if (!notTouch(e)) return;
        var r = photo.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width / 2)) / (card.clientWidth / 2);
        var ny = (e.clientY - (r.top + r.height / 2)) / (card.clientHeight / 2);
        tx = Math.max(-1, Math.min(1, nx)) * 4;
        ty = -Math.max(-1, Math.min(1, ny)) * 4;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
      resetOnScrollAway(card, function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
    }

    /* ---------------------------------------------------------- entrances: "signal from the dot"
       One choreography per entry (details: DESIGN-SYSTEM.md, motion): the lead text rises line by line with the heading letters; at the dot's impact a gradient line
       grows down out of the dot, splits above the cards (desktop) or runs card to card (<1024px) and traces each card's outline; the glass surface fades in and
       the content plays. Everything is transform / opacity / stroke (no layout), the GSAP timelines are reversible (scroll back above the section = reverse, ~1s).
       Rest state = the plain CSS: every inline style / helper class is removed when the timelines complete. */
    var formCard = section.querySelector('.contact-form-panel');
    var personal = section.querySelector('.contact-personal-panel');
    var eyebrow = section.querySelector('.ctc-eyebrow');
    var sub = section.querySelector('.ctc-sub');
    var word = section.querySelector('.section-heading');
    var hd = false;
    var playHead = function () {
      if (hd) return; hd = true;
      if (eyebrow) gsap.to(eyebrow, { opacity: 1, y: 0, duration: 0.7, ease: EASE, delay: 0.5, onComplete: function () { gsap.set(eyebrow, { clearProps: 'opacity,transform' }); } });
    };
    if (eyebrow) gsap.set(eyebrow, { opacity: 0, y: 20 });

    /* ---- lead text: one mask per rendered line (like the footer text) ---- */
    var subOn = function () {};
    if (sub && 'IntersectionObserver' in window) {
      var subTimer = 0;
      var splitSub = function () {
        var full = sub.getAttribute('data-rv-text');
        if (full === null) { full = sub.textContent.replace(/\s+/g, ' ').trim(); sub.setAttribute('data-rv-text', full); }
        sub.textContent = '';
        var words = full.split(' '), spans = words.map(function (w, i) {
          var s = document.createElement('span'); s.textContent = w; sub.appendChild(s);
          if (i < words.length - 1) sub.appendChild(document.createTextNode(' '));
          return s;
        });
        var lines = [], top = null;
        spans.forEach(function (s, i) {
          var t = Math.round(s.getBoundingClientRect().top);
          if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
          lines[lines.length - 1].push(words[i]);
        });
        sub.textContent = '';
        lines.forEach(function (ws, k) {
          var l = document.createElement('span'), i = document.createElement('span');
          l.className = 'rv-line'; i.className = 'rv-i'; i.textContent = ws.join(' ');
          l.style.setProperty('--ri', k); l.appendChild(i); sub.appendChild(l);
        });
        sub.style.setProperty('--rn', lines.length);
      };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { splitSub(); sub.classList.add('rv-prep'); });
      subOn = function (on) {
        if (!sub.classList.contains('rv-prep')) return;
        sub.classList.add('rv-moving');
        sub.classList.toggle('rv-in', on);
        clearTimeout(subTimer);
        subTimer = setTimeout(function () { sub.classList.remove('rv-moving'); }, 2200);
      };
      var subRt;
      window.addEventListener('resize', function () { clearTimeout(subRt); subRt = setTimeout(function () { if (sub.classList.contains('rv-prep')) splitSub(); }, 150); });
    }

    /* ---- the signal ----
       Starts only when the dot has landed and settled (its last animationend + 0.1s). Two SVG overlays share the geometry: .ctc-signal--under (z-index 0, behind the
       lead text) carries the trunk, .ctc-signal (above the cards) the branches that run into the card outlines. Every path is drawn at one constant speed (SPEED px/s,
       stroke-dashoffset on pathLength 1) with a glowing head at its tip; the lead-text letters the trunk crosses light up (aria-hidden copies, the real text is untouched). */
    var desk = window.matchMedia('(min-width: 1024px)');
    var NS = 'http://www.w3.org/2000/svg';
    var SPEED = 1400;
    var sg = null, ring = null, units = [], entered = false, landed = false, pendingOff = 0;

    function el(name, attrs, parent) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }
    function makeSvg(cls, id, paths, heads) {
      var svg = el('svg', { 'class': 'ctc-signal ' + cls, 'aria-hidden': 'true', focusable: 'false' });
      var defs = el('defs', {}, svg);
      var g = el('linearGradient', { id: 'ctcSigGrad' + id, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 100, y2: 100 }, defs);
      el('stop', { offset: '0', 'stop-color': '#6c63ff' }, g);               /* = --card-primary */
      el('stop', { offset: '1', 'stop-color': '#c850c0' }, g);
      var hg = el('radialGradient', { id: 'ctcHead' + id }, defs);
      el('stop', { offset: '0', 'stop-color': '#f3e8ff', 'stop-opacity': '0.95' }, hg);
      el('stop', { offset: '0.35', 'stop-color': '#c850c0', 'stop-opacity': '0.55' }, hg);
      el('stop', { offset: '1', 'stop-color': '#6c63ff', 'stop-opacity': '0' }, hg);
      var P = {}, H = {};
      paths.forEach(function (k) { P[k] = el('path', { 'class': 'sg', d: 'M0 0', stroke: 'url(#ctcSigGrad' + id + ')' }, svg); });
      heads.forEach(function (k) { H[k] = el('circle', { 'class': 'sg-head', r: 11, fill: 'url(#ctcHead' + id + ')' }, svg); });
      section.appendChild(svg);
      return { svg: svg, grad: g, P: P, H: H };
    }
    function makeSignal() {
      var u = makeSvg('ctc-signal--under', 'U', ['trunk'], ['trunk']);
      var o = makeSvg('', 'O', ['brF', 'brP', 'br2'], ['brF', 'brP', 'br2']);
      return { u: u, o: o };
    }
    function makeRing() {
      var photo = personal && personal.querySelector('.contact-photo-square'); if (!photo) return null;
      var svg = el('svg', { 'class': 'ctc-ring', 'aria-hidden': 'true', focusable: 'false' });
      var defs = el('defs', {}, svg), g = el('linearGradient', { id: 'ctcRingGrad', x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
      el('stop', { offset: '0', 'stop-color': '#6c63ff' }, g); el('stop', { offset: '1', 'stop-color': '#c850c0' }, g);
      var c = el('circle', { 'class': 'sg', fill: 'none', stroke: 'url(#ctcRingGrad)' }, svg);
      photo.appendChild(svg);
      return { photo: photo, svg: svg, c: c };
    }
    var f2 = function (v) { return +v.toFixed(2); };
    /* the outline after its start point (sx, y + .5): clockwise or counter-clockwise, ending back at the start point */
    function rectBody(x, y, w, h, r, sx, cw) {
      x += 0.5; y += 0.5; w -= 1; h -= 1; r -= 0.5;
      sx = Math.max(x + r, Math.min(x + w - r, sx));
      var A = 'A' + f2(r) + ' ' + f2(r) + ' 0 0 ';
      if (cw) return 'H' + f2(x + w - r) + A + '1 ' + f2(x + w) + ' ' + f2(y + r) + 'V' + f2(y + h - r) + A + '1 ' + f2(x + w - r) + ' ' + f2(y + h) + 'H' + f2(x + r) + A + '1 ' + f2(x) + ' ' + f2(y + h - r) + 'V' + f2(y + r) + A + '1 ' + f2(x + r) + ' ' + f2(y) + 'H' + f2(sx);
      return 'H' + f2(x + r) + A + '0 ' + f2(x) + ' ' + f2(y + r) + 'V' + f2(y + h - r) + A + '0 ' + f2(x + r) + ' ' + f2(y + h) + 'H' + f2(x + w - r) + A + '0 ' + f2(x + w) + ' ' + f2(y + h - r) + 'V' + f2(y + r) + A + '0 ' + f2(x + w - r) + ' ' + f2(y) + 'H' + f2(sx);
    }
    function clampX(x, l, w, r) { return Math.max(l + r, Math.min(l + w - r, x)); }

    /* the letters of each lead-text line that the trunk crosses (+-1 char): gradient copies laid over them, lit when the tip passes */
    var glows = [];
    function layoutGlow(x0, y0, sr) {
      glows.forEach(function (g) { if (g.el.parentNode) g.el.parentNode.removeChild(g.el); });
      glows = [];
      if (!sub || !sub.classList.contains('rv-prep')) return;
      var sub0 = sub.getBoundingClientRect(), X = sr.left + x0;
      arr(sub, '.rv-line').forEach(function (line) {
        var i = line.firstChild, tn = i && i.firstChild;
        if (!tn || tn.nodeType !== 3) return;
        var rg = document.createRange(), n = tn.length, hit = -1, k, r;
        for (k = 0; k < n; k++) { rg.setStart(tn, k); rg.setEnd(tn, k + 1); r = rg.getBoundingClientRect(); if (r.width && r.left <= X && X <= r.right) { hit = k; break; } }
        if (hit < 0) return;
        var a = Math.max(0, hit - 1), b = Math.min(n - 1, hit + 1);
        rg.setStart(tn, a); rg.setEnd(tn, b + 1); r = rg.getBoundingClientRect();
        var lr = line.getBoundingClientRect(), g = document.createElement('span');
        g.className = 'sg-glow'; g.setAttribute('aria-hidden', 'true'); g.textContent = tn.data.slice(a, b + 1);
        g.style.left = (r.left - sub0.left) + 'px'; g.style.top = (lr.top - sub0.top) + 'px'; g.style.height = lr.height + 'px';
        sub.appendChild(g);
        glows.push({ el: g, t: Math.max(0, ((lr.top + lr.height / 2) - sr.top - y0) / SPEED) });
      });
    }

    /* paths from the real element positions (relative to the section) */
    function layoutSignal() {
      if (!sg || !formCard || !personal || !word) return;
      var sr = section.getBoundingClientRect();
      var rel = function (e) { var r = e.getBoundingClientRect(); return { l: r.left - sr.left, t: r.top - sr.top, w: r.width, h: r.height }; };
      var dm = word.querySelector('.sh-dot'); if (!dm) return; dm = dm.parentNode;
      var d = rel(dm), fs = parseFloat(getComputedStyle(word).fontSize) || 60;
      var x0 = d.l + d.w * 0.5, y0 = d.t + 0.14 * fs + 0.8 * (d.h - 0.28 * fs);     /* the dot glyph's centre x and bottom edge */
      var f = rel(formCard), p = rel(personal), r = parseFloat(getComputedStyle(formCard).borderTopLeftRadius) || 24;
      var cT = Math.min(f.t, p.t), sb = sub ? (rel(sub).t + rel(sub).h) : d.t + d.h;
      var jy = sb + (cT - sb) / 2;                                    /* the split point: midway between the lead text and the cards */
      var U = sg.u.P, O = sg.o.P, W = sr.width, H = sr.height;
      [sg.u, sg.o].forEach(function (s) {
        s.svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); s.svg.setAttribute('width', W); s.svg.setAttribute('height', H);
        s.grad.setAttribute('x2', W); s.grad.setAttribute('y2', H);
      });
      U.trunk.setAttribute('d', 'M' + f2(x0) + ' ' + f2(y0) + 'V' + f2(jy));
      if (desk.matches) {
        var fcx = f.l + f.w / 2, pcx = p.l + p.w / 2;
        O.brF.setAttribute('d', 'M' + f2(x0) + ' ' + f2(jy) + 'H' + f2(fcx) + 'V' + f2(f.t + 0.5) + rectBody(f.l, f.t, f.w, f.h, r, fcx, false));
        O.brP.setAttribute('d', 'M' + f2(x0) + ' ' + f2(jy) + 'H' + f2(pcx) + 'V' + f2(p.t + 0.5) + rectBody(p.l, p.t, p.w, p.h, r, pcx, true));
        O.br2.setAttribute('d', 'M0 0');
      } else {
        var sx1 = clampX(x0, f.l, f.w, r), sx2 = clampX(x0, p.l, p.w, r);
        O.brF.setAttribute('d', 'M' + f2(x0) + ' ' + f2(jy) + 'V' + f2(f.t + 0.5) + (sx1 !== x0 ? 'H' + f2(sx1) : '') + rectBody(f.l, f.t, f.w, f.h, r, sx1, true));
        O.brP.setAttribute('d', 'M0 0');
        O.br2.setAttribute('d', 'M' + f2(sx2) + ' ' + f2(f.t + f.h) + 'V' + f2(p.t + 0.5) + rectBody(p.l, p.t, p.w, p.h, r, sx2, true));
      }
      if (ring) {                                                    /* the photo ring: a circle in the same box as the CSS ring (stroke = its 4px) */
        var D = ring.photo.offsetWidth, sw = 4;
        ring.svg.setAttribute('viewBox', '0 0 ' + D + ' ' + D);
        ring.c.setAttribute('cx', D / 2); ring.c.setAttribute('cy', D / 2); ring.c.setAttribute('r', D / 2 - sw / 2); ring.c.setAttribute('stroke-width', sw);
      }
      layoutGlow(x0, y0, sr);
    }

    var VARS = ['--ul', '--uo', '--ro', '--sp'];
    var CLEAR = 'opacity,transform,filter,backgroundColor,borderColor,boxShadow,scale,y,yPercent';
    function allTargets() {
      var t = [formCard, personal];
      [formCard, personal].forEach(function (c) { t.push.apply(t, arr(c, 'h3 .rv-i, .contact-field, .contact-consent, .btn-submit-message, .contact-photo-square, .contact-photo-square img, .contact-tagline, .contact-role, .contact-actions > *')); });
      return t;
    }
    function settle() {                                              /* rest state = plain CSS */
      gsap.set(allTargets(), { clearProps: CLEAR });
      [formCard, personal].forEach(function (c) {
        [c].concat(arr(c, '.contact-field, .contact-photo-square, .status-dot')).forEach(function (e) { VARS.forEach(function (v) { e.style.removeProperty(v); }); });
      });
      arr(section, '.contact-field').forEach(function (f) { f.classList.remove('cf-sweep'); });
      if (ring) ring.photo.classList.remove('rv-ring');
      var h3 = formCard.querySelector('h3'); if (h3) h3.classList.remove('rv-clip');
      if (sg) { sg.u.svg.style.display = 'none'; sg.o.svg.style.display = 'none'; }
    }
    function unsettle() {                                            /* the helper state again (build / before a reverse) */
      if (sg) { sg.u.svg.style.display = ''; sg.o.svg.style.display = ''; }
      arr(section, '.contact-field').forEach(function (f) { f.classList.add('cf-sweep'); });
      if (ring) ring.photo.classList.add('rv-ring');
      var h3 = formCard.querySelector('h3'); if (h3) h3.classList.add('rv-clip');
    }

    function cardTween(tl, card, at) {
      tl.fromTo(card, { backgroundColor: 'rgba(255,255,255,0)', borderColor: 'rgba(255,255,255,0)', boxShadow: '0 24px 60px -24px rgba(0,0,0,0)' },
        { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 24px 60px -24px rgba(0,0,0,0.55)', duration: 0.4, ease: 'none' }, at);
    }
    /* one path drawn at the constant SPEED, its glowing head riding the tip (fading out as the path closes); returns the duration */
    function drawFlow(tl, p, head, at) {
      var len = p.getTotalLength(), dur = Math.max(0.05, len / SPEED);
      p.style.strokeDasharray = f2(len) + ' ' + f2(len * 2);              /* px units: GSAP rounds the offset to whole px, a normalised pathLength would step */
      tl.fromTo(p, { strokeDashoffset: len }, {
        strokeDashoffset: 0, duration: dur, ease: 'none',
        onUpdate: function () {
          if (!head) return;
          var pr = this.progress(), pt = p.getPointAtLength(pr * len);
          head.setAttribute('cx', f2(pt.x)); head.setAttribute('cy', f2(pt.y));
          head.style.opacity = pr <= 0 || pr >= 1 ? 0 : Math.min(1, pr / 0.03, (1 - pr) / 0.08);
        }
      }, at);
      return dur;
    }
    function formContent(tl, b) {
      var h3 = formCard.querySelector('h3'), inner = h3 && h3.querySelector('.rv-i');
      var fields = arr(formCard, '.contact-field'), consent = formCard.querySelector('.contact-consent'), btn = formCard.querySelector('.btn-submit-message');
      if (inner) tl.fromTo(inner, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, b);
      tl.fromTo(fields, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.07 }, b + 0.15);
      tl.fromTo(fields, { '--ul': 0, '--uo': 1 }, { '--ul': 1, duration: 0.4, ease: 'power2.inOut', stagger: 0.07 }, b + 0.2);
      tl.to(fields, { '--uo': 0, duration: 0.35, ease: 'none', stagger: 0.07 }, b + 0.7);
      var t = b + 0.15 + fields.length * 0.07;
      if (consent) tl.fromTo(consent, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE }, t);
      if (btn) tl.fromTo(btn, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5, ease: EASE }, t + 0.1);
    }
    function photoContent(tl, b) {
      var photo = personal.querySelector('.contact-photo-square'), img = photo && photo.querySelector('img');
      if (ring) {
        var cl = ring.c.getTotalLength();
        ring.c.style.strokeDasharray = f2(cl) + ' ' + f2(cl * 2);
        tl.fromTo(ring.c, { strokeDashoffset: cl }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, b);
        tl.fromTo(photo, { '--ro': 0 }, { '--ro': 1, duration: 0.25, ease: 'none' }, b + 0.55);
        tl.fromTo(ring.svg, { opacity: 1 }, { opacity: 0, duration: 0.25, ease: 'none' }, b + 0.55);
      }
      if (photo) tl.fromTo(photo, { boxShadow: '0 20px 40px rgba(0,0,0,0), 0 0 40px rgba(108,99,255,0)' }, { boxShadow: '0 20px 40px rgba(0,0,0,0.35), 0 0 40px rgba(108,99,255,0.25)', duration: 0.5, ease: 'none' }, b + 0.35);
      if (img) tl.fromTo(img, { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power1.out' }, b + 0.35);
      var tag = personal.querySelector('.contact-tagline'), roles = arr(personal, '.contact-role'), dot = personal.querySelector('.status-dot'), btns = arr(personal, '.contact-actions > *');
      if (tag) tl.fromTo(tag, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: EASE }, b + 0.6);
      tl.fromTo(roles, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.07 }, b + 0.68);
      if (dot) tl.fromTo(dot, { '--sp': 1 }, { '--sp': 1.7, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1 }, b + 0.85);
      tl.fromTo(btns, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE, stagger: 0.08 }, b + 0.9);
    }

    function killUnits() {
      units.forEach(function (u) { if (u.call) u.call.kill(); u.tl.kill(); });
      units = [];
    }
    function mkTl() {
      return gsap.timeline({ paused: true, onComplete: function () { if (units.every(function (u) { return u.tl.progress() === 1; })) settle(); } });
    }
    function build() {
      killUnits();
      if (!formCard || !personal || !sg) return;
      unsettle();
      layoutSignal();
      var U = sg.u, O = sg.o, A = mkTl(), B = null;
      A.fromTo([U.svg, O.svg], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0);      /* nothing is visible before the timeline starts */
      var tb = drawFlow(A, U.P.trunk, U.H.trunk, 0);
      glows.forEach(function (g) {
        A.fromTo(g.el, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'power1.out' }, g.t);
        A.to(g.el, { opacity: 0, duration: 1.2, ease: 'power1.in' }, g.t + 0.12);
      });
      if (desk.matches) {
        var d1 = drawFlow(A, O.P.brF, O.H.brF, tb), d2 = drawFlow(A, O.P.brP, O.H.brP, tb), te = tb + Math.max(d1, d2);
        A.fromTo([U.P.trunk, O.P.brF, O.P.brP], { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none' }, te);
        cardTween(A, formCard, te); cardTween(A, personal, te);
        formContent(A, te + 0.05); photoContent(A, te);
        units = [{ tl: A, gate: null }];
      } else {
        var d = drawFlow(A, O.P.brF, O.H.brF, tb), te1 = tb + d;
        A.fromTo([U.P.trunk, O.P.brF], { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none' }, te1);
        cardTween(A, formCard, te1);
        formContent(A, te1 + 0.05);
        B = mkTl();
        var d3 = drawFlow(B, O.P.br2, O.H.br2, 0);
        B.fromTo(O.P.br2, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none' }, d3);
        cardTween(B, personal, d3);
        photoContent(B, d3);
        units = [{ tl: A, gate: null }, { tl: B, gate: personal, vis: false, gateAt: te1 }];
      }
      units.forEach(function (u) { u.tl.progress(0); });
    }

    /* start / resume every unit that may run now; the first one only after the dot has landed */
    function tryStarts(delay) {
      if (!landed) return;
      units.forEach(function (u, i) {
        var pr = u.tl.progress();
        if (u.call) return;
        if (pr === 1) return;
        if (pr > 0) { u.tl.timeScale(1).play(); return; }            /* partly reversed: continue forward */
        var wait = i === 0 ? delay : 0;
        if (u.gate) {
          var prev = units[i - 1];
          if (!u.vis || prev.tl.progress() === 0) return;
          wait = Math.max(0, u.gateAt - prev.tl.time());             /* the second card's line leaves the first card's closing outline */
        }
        u.tl.timeScale(1);
        if (wait > 0) u.call = gsap.delayedCall(wait, function () { u.call = null; u.tl.play(); tryStarts(0); });
        else u.tl.play();
      });
    }
    /* reverse ~1s whatever was drawn; returns that duration (s), 0 when nothing had started */
    function reverseAll() {
      units.forEach(function (u) { if (u.call) { u.call.kill(); u.call = null; } });
      var dur = 0;
      units.forEach(function (u) { if (u.tl.progress() > 0) dur = Math.max(dur, u.tl.time() / Math.max(2.6, u.tl.time())); });
      if (!dur) return 0;
      unsettle();
      units.forEach(function (u) { if (u.tl.progress() > 0) u.tl.timeScale(Math.max(2.6, u.tl.time())).reverse(); });
      return dur;
    }
    function finishAll() {                                           /* the visitor interacts mid-animation: jump to the end state */
      if (!units.length) return;
      units.forEach(function (u) { if (u.call) { u.call.kill(); u.call = null; } u.tl.timeScale(1).progress(1); });
    }
    /* the dot's drop animation has ended (js below): the signal starts 0.1s later */
    function onLanded() {
      landed = true;
      if (!sg) return;
      if (units.length && units.every(function (u) { return u.tl.progress() === 0; })) build();     /* fresh geometry / durations */
      tryStarts(0.1);
    }
    [formCard, personal].forEach(function (c) {
      if (!c) return;
      c.addEventListener('focusin', finishAll);
      c.addEventListener('pointerdown', finishAll);
    });
    if (personal && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        var on = es[es.length - 1].isIntersecting;
        units.forEach(function (u) { if (u.gate === personal) u.vis = on; });
        if (!on) return;
        if (!entered && !landed && word && word.getBoundingClientRect().bottom < 0 && units.length && units[0].tl.progress() === 0) { entered = true; landed = true; subOn(true); }      /* the heading was flung past: the cards start the choreography */
        tryStarts(units.length && units[0].tl.progress() === 0 ? 0.3 : 0);
      }, { threshold: 0.12 }).observe(personal);
    }
    var sgRt;
    window.addEventListener('resize', function () {
      clearTimeout(sgRt);
      sgRt = setTimeout(function () {
        if (units.length && units.every(function (u) { return u.tl.progress() === 0; })) build(); else layoutSignal();
      }, 150);
    });
    if (desk.addEventListener) desk.addEventListener('change', function () {
      if (!sg || !units.length) return;
      var done = units.every(function (u) { return u.tl.progress() === 1; });
      var idle = units.every(function (u) { return u.tl.progress() === 0; });
      if (!done && !idle) return;
      build();
      if (done) { units.forEach(function (u) { u.tl.progress(1); }); settle(); }
    });

    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      if (!formCard || !personal) return;
      var h3 = formCard.querySelector('h3');
      if (h3 && !h3.querySelector('.rv-i')) { var i = document.createElement('span'); i.className = 'rv-i'; while (h3.firstChild) i.appendChild(h3.firstChild); h3.appendChild(i); }
      sg = makeSignal(); ring = makeRing();
      build();
      if (landed) tryStarts(0.1);
    });

    /* ---------------------------------------------------------- the giant word
       Letters, accent dot and the proximity hover come from js/heading-fx.js (the .sh-char letters inside their .sh-mask). The reveal is CSS (style.css, #contact
       .section-heading .fx-*): the letters rise out of their masks one by one, the dot pops in last; reversed (right -> left) when the heading is left downwards.
       Here: the letter indices, the trigger and the eyebrow / sub entrance. */
    if (word) {
      var setup = function () {
        var chars = arr(word, '.sh-char');
        if (!chars.length || !('IntersectionObserver' in window)) { playHead(); return; }
        chars.forEach(function (ch, i) { ch.style.setProperty('--ci', i); });
        word.style.setProperty('--cn', chars.length);
        word.classList.add('fx-prep');
        var timer = 0, landTimer = 0, first = true;
        var dot = word.querySelector('.sh-dot');
        /* the signal waits for the dot: its drop animation (drop, squash, bounce, settle) has ended */
        if (dot) dot.addEventListener('animationend', function (ev) { if (ev.animationName === 'ctcDotDrop' && word.classList.contains('fx-in')) { word.classList.add('fx-done'); clearTimeout(landTimer); onLanded(); } });
        var applyHeading = function (on) {
          if (!on) { word.classList.remove('fx-done'); landed = false; clearTimeout(landTimer); }
          word.classList.add('fx-moving');                                   /* the masks clip only while the letters travel */
          word.classList.toggle('fx-in', on);
          subOn(on);
          if (on) { clearTimeout(landTimer); landTimer = setTimeout(function () { if (!landed && entered) onLanded(); }, 5000); }     /* fail-safe only: the dot animation never reported */
          clearTimeout(timer);
          timer = setTimeout(function () { word.classList.remove('fx-moving'); }, 2000);
        };
        new IntersectionObserver(function (es) {
          var e = es[es.length - 1], on = e.isIntersecting;
          if (!on && !(e.boundingClientRect.top > 0)) return;
          if (pendingOff) {                                                  /* leaving: the signal is retracting, the dot stays until it is back */
            if (on) { clearTimeout(pendingOff); pendingOff = 0; entered = true; tryStarts(0); }
            return;
          }
          if (on === word.classList.contains('fx-in')) return;
          if (on) {
            entered = true;
            if (first) { first = false; playHead(); }
            applyHeading(true);
          } else {
            entered = false;
            var rd = sg ? reverseAll() : 0;
            if (rd > 0) pendingOff = setTimeout(function () { pendingOff = 0; applyHeading(false); }, rd * 1000 + 60);
            else applyHeading(false);
          }
        }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' }).observe(word);
      };
      if (word.classList.contains('is-split')) setup();
      else {
        var failSafe = setTimeout(playHead, 3000);
        word.addEventListener('vb:heading-split', function () { clearTimeout(failSafe); setup(); }, { once: true });
      }
    } else {
      playHead();
    }
  }

  /* ---------------------------------------------------------- footer */
  if (footer) {
    /* the social icons have a static circular cursor frame and their own reveal / lift (style.css): no magnet */
    /* the VARBRO wordmark (fit, entrance, highlight) lives in js/footer.js */
  }
})();
