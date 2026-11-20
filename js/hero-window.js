/* hero-window.js — the hero's "living window" (EXPERIMENT, decoration only: an abstract brand-coloured mini website made of CSS shapes, no project content).
   A floating, tilted browser window in the bottom-right corner tells the same story as the living word: idea -> code -> build -> alive.
   SINGLE SOURCE OF TRUTH = the word roll in js/hero-fx.js: it dispatches document "hero:word" ({index, word}) at the start of every enter tween; this module has NO timer of its own.
   Scenes: 0 tervez (wireframe draws in) · 1 kódol (code is typed) · 2 épít (brand-coloured blocks drop onto the wireframe) · 3 életre kelt (the site comes alive: button pulse, chart grows, toggle, cards slide, a fake cursor clicks).
   Everything is built here after window 'load' (idle). Delete this file, its script tag, the CSS block and the mono font to remove it. */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  if (!hero) return;
  var VB = window.VB || {};
  var gsap = VB.gsap;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!gsap) return;

  /* everything is built after the window 'load' event (idle), so it can never delay first paint / LCP; a word event that arrives earlier is remembered */
  var bootLast = 0, booted = false;
  var bootListener = function (e) { if (!booted && e.detail && typeof e.detail.index === 'number') bootLast = e.detail.index; };
  document.addEventListener('hero:word', bootListener);
  function boot() {
  booted = true; document.removeEventListener('hero:word', bootListener);

  /* ------------------------------------------------ markup (built here) */
  var WIRE = [                                                      /* [path, penStart, penEnd] in a 1000 x 625 box, top -> bottom */
    ['M28 56H972', [28, 56], [972, 56]],
    ['M28 14h56v30h-56z', [28, 14], [84, 44]],
    ['M640 29H720', [640, 29], [720, 29]], ['M752 29H832', [752, 29], [832, 29]], ['M864 29H944', [864, 29], [944, 29]],
    ['M28 76h944v320H28z', [28, 76], [972, 396]],
    ['M76 170H540', [76, 170], [540, 170]], ['M76 208H430', [76, 208], [430, 208]], ['M76 252H360', [76, 252], [360, 252]],
    ['M76 296h170v44H76z', [76, 296], [246, 340]],
    ['M640 110h290v250H640zM640 110 930 360M930 110 640 360', [640, 110], [930, 360]],
    ['M28 424h296v170H28z', [28, 424], [324, 594]], ['M52 548H200', [52, 548], [200, 548]], ['M52 572H150', [52, 572], [150, 572]],
    ['M352 424h296v170H352z', [352, 424], [648, 594]], ['M376 548H524', [376, 548], [524, 548]], ['M376 572H474', [376, 572], [474, 572]],
    ['M676 424h296v170H676z', [676, 424], [972, 594]], ['M700 548H848', [700, 548], [848, 548]], ['M700 572H798', [700, 572], [798, 572]]
  ];
  var SNIPPET = [
    [['p', '<'], ['t', 'section'], ['x', ' '], ['a', 'class'], ['p', '='], ['s', '"hero"'], ['p', '>']],
    [['x', '  '], ['p', '<'], ['t', 'h1'], ['p', '>'], ['x', 'Az Ön vállalkozása'], ['p', '</'], ['t', 'h1'], ['p', '>']],
    [['x', '  '], ['p', '<'], ['t', 'p'], ['p', '>'], ['x', 'Online, ahol az ügyfelei keresik.'], ['p', '</'], ['t', 'p'], ['p', '>']],
    [['x', '  '], ['p', '<'], ['t', 'a'], ['x', ' '], ['a', 'class'], ['p', '='], ['s', '"btn"'], ['x', ' '], ['a', 'href'], ['p', '='], ['s', '"#kapcsolat"'], ['p', '>'], ['x', 'Ajánlatot kérek'], ['p', '</'], ['t', 'a'], ['p', '>']],
    [['p', '</'], ['t', 'section'], ['p', '>']]
  ];

  /* the abstract site: boxes in the 1000 x 625 box; children are given in the parent's own units */
  function box(cls, x, y, w, h, parent, pw, ph) {                    /* absolute element, % of the parent (the view by default) */
    var e = document.createElement('span');
    e.className = cls;
    var PW = pw || 1000, PH = ph || 625;
    e.style.left = (x / PW * 100) + '%'; e.style.top = (y / PH * 100) + '%'; e.style.width = (w / PW * 100) + '%'; e.style.height = (h / PH * 100) + '%';
    if (parent) parent.appendChild(e);
    return e;
  }
  var abEl = document.createElement('span');                       /* the build layer */
  abEl.className = 'hw__s hw__s--build';
  var blocks = [];
  var head = box('ab ab-head', 0, 0, 1000, 56); blocks.push(head);
  box('ab-bar', 28, 14, 56, 30, head, 1000, 56).style.background = 'var(--ab-logo, #6366f1)';
  [640, 752].forEach(function (x) { box('ab-soft', x, 22, 80, 12, head, 1000, 56); });
  var tgt = box('ab-tgt', 864, 17, 64, 22, head, 1000, 56);
  var tgk = box('ab-tgk', 4, 3, 16, 16, tgt, 64, 22);
  var hero_ = box('ab ab-hero', 28, 76, 944, 320); blocks.push(hero_);
  box('ab-bar', 48, 94, 464, 16, hero_, 944, 320); box('ab-bar', 48, 132, 354, 16, hero_, 944, 320).style.opacity = '0.65'; box('ab-soft', 48, 176, 284, 10, hero_, 944, 320);
  var btn = box('ab-btn', 48, 220, 170, 44, hero_, 944, 320);
  var chart = box('ab ab-chart', 640, 110, 290, 250); blocks.push(chart);
  var BAR_T = [0.55, 0.38, 0.7, 0.46, 0.82];
  var bars = BAR_T.map(function (t, i) { var b = box('ab-bar', 22 + i * 52, 0, 34, 100, chart, 290, 250); b.style.top = 'auto'; b.style.bottom = '8%'; b.style.height = '35%'; return b; });
  var cardsBox = box('ab ab-cards', 28, 424, 944, 170); blocks.push(cardsBox);
  var CC = ['#9b3fd8', '#C026A3', '#22c3d6', '#6366f1'], cards = [];
  for (var ci = 0; ci < 4; ci++) {
    var cd = box('ab-card', ci * 324, 0, 296, 170, cardsBox, 944, 170); cd.style.setProperty('--cc', CC[ci]);
    box('ab-bar', 24, 70, 148, 12, cd, 296, 170); box('ab-soft', 24, 98, 98, 10, cd, 296, 170); box('ab-soft', 24, 124, 120, 10, cd, 296, 170);
    cards.push(cd);
  }
  var ripple = document.createElement('span'); ripple.className = 'ab-ripple';
  ripple.style.left = ((28 + 48 + 85) / 10) + '%'; ripple.style.top = ((76 + 220 + 22) / 6.25) + '%'; ripple.style.width = '8cqw'; ripple.style.height = '8cqw'; ripple.style.margin = '-4cqw 0 0 -4cqw';
  var cur = document.createElement('span'); cur.className = 'ab-cur'; cur.innerHTML = '<i data-lucide="mouse-pointer-2"></i>';
  blocks.forEach(function (b) { abEl.appendChild(b); }); abEl.appendChild(ripple); abEl.appendChild(cur);

  var DOCK = [['music', 'Zene', 'music'], ['palette', 'Paletta', 'palette'], ['mood', 'Hangulat', 'sun-moon'], ['msg', 'Üzenet', 'message-square']];
  var w = document.createElement('div');
  w.className = 'hw';
  w.innerHTML =
    '<div class="hw__float"><div class="hw__tilt"><span class="hw__glow"></span>' +
    '<div class="hw__win" role="group" tabindex="0" data-cursor="try" data-cursor-label="Próbálja ki" aria-label="Interaktív mini rendszer: zene, paletta, hangulat, üzenet">' +
      '<span class="hw__bar"><span class="hw__dots" aria-hidden="true"><i></i><i></i><i></i></span><button type="button" class="hw__mini" aria-label="Zene megnyitása"><i></i><i></i><i></i></button></span>' +
      '<span class="hw__view" aria-hidden="true"><span class="hw__grid"></span>' +
        '<span class="hw__s hw__s--wire"><svg class="hw__svg" viewBox="0 0 1000 625" preserveAspectRatio="none">' + WIRE.map(function (e) { return '<path d="' + e[0] + '" pathLength="1"/>'; }).join('') + '<circle class="hw__pen" r="7" cx="0" cy="0"/></svg></span>' +
        '<span class="hw__s hw__s--code"><span class="hw__tabs"><span class="hw__tab is-on">index.html</span><span class="hw__tab">style.css</span></span>' +
          '<span class="hw__code"><span class="hw__ln">' + SNIPPET.map(function (l, i) { return '<span>' + (i + 1) + '</span>'; }).join('') + '</span><pre class="hw__pre"></pre></span></span>' +
      '</span>' +
      '<div class="hw__dock" role="toolbar" aria-label="Alkalmazások">' +
        DOCK.map(function (d) { return '<button type="button" class="hw__app hw__app--' + d[0] + '" data-app="' + d[0] + '" data-tip="' + d[1] + '" aria-label="' + d[1] + '"><i data-lucide="' + d[2] + '"></i></button>'; }).join('') +
      '</div>' +
    '</div></div>' +
    '<div class="hw__nudge" aria-hidden="true">Próbálja ki <i data-lucide="arrow-down"></i></div>' +
    '<div class="hw__pw" aria-live="polite"><div class="hw__panel" role="dialog" aria-modal="false" tabindex="-1"></div></div>';
  w.querySelector('.hw__view').appendChild(abEl);
  hero.appendChild(w);
  var icons = function () { if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) { /* ignore */ } } };
  icons(); setTimeout(icons, 600);                                  /* in case the CDN script was not ready yet */

  var $ = function (s) { return w.querySelector(s); };
  var float = $('.hw__float'), tilt = $('.hw__tilt'), view = $('.hw__view');
  var L = { wire: $('.hw__s--wire'), code: $('.hw__s--code'), build: abEl };
  var paths = [].slice.call(w.querySelectorAll('.hw__svg path')), pen = $('.hw__pen');
  var pre = $('.hw__pre'), lns = [].slice.call(w.querySelectorAll('.hw__ln span'));

  /* ------------------------------------------------ code: tokens + rAF typing */
  var toks = [];                                                    /* flat list of characters: {el, ch} */
  SNIPPET.forEach(function (line, li) {
    var lead = true;
    line.forEach(function (t) {
      var el = document.createElement('span'); el.className = 'k-' + t[0]; pre.appendChild(el);
      for (var i = 0; i < t[1].length; i++) {
        var free = lead && t[0] === 'x' && t[1].charAt(i) === ' ';
        if (!free) lead = false;
        toks.push({ el: el, ch: t[1].charAt(i), free: free, line: li });
      }
    });
    if (li < SNIPPET.length - 1) { var nl = document.createElement('span'); pre.appendChild(nl); toks.push({ el: nl, ch: '\n', free: false, line: li }); }
  });
  var caret = document.createElement('span'); caret.className = 'hw__caret'; caret.setAttribute('aria-hidden', 'true');
  var els = [].slice.call(pre.children);
  var MS = 17;                                                      /* ms per typed character (28ms would need ~4.3s; the word holds 3.5s) */
  var shown = 0;
  function paintTyped(n) {                                          /* show the first n characters */
    var per = new Map();
    for (var i = 0; i < toks.length; i++) { if (i < n) { var a = per.get(toks[i].el) || ''; per.set(toks[i].el, a + toks[i].ch); } }
    els.forEach(function (el) { var t = per.get(el) || ''; if (el.textContent !== t) el.textContent = t; });
    var last = n > 0 ? toks[Math.min(n, toks.length) - 1].el : els[0];
    pre.insertBefore(caret, last.nextSibling);
    var ln = n > 0 ? toks[Math.min(n, toks.length) - 1].line : 0;
    lns.forEach(function (s, i) { s.style.opacity = (n > 0 && i <= ln) ? '1' : '0'; });
    shown = n;
  }
  var typing = null;
  function typeStart() { typeStop(); paintTyped(0); typing = { acc: -250 }; gsap.ticker.add(typeTick); }
  function typeStop() { if (typing) { gsap.ticker.remove(typeTick); typing = null; } }
  function typeTick(time, dt) {
    if (!typing || !visible || held) return;
    typing.acc += dt;
    var cost = Math.max(0, Math.floor(typing.acc / MS)), n = 0, c = 0;                 /* leading indentation is free (auto-indent) */
    while (n < toks.length && (c < cost || toks[n].free)) { if (!toks[n].free) c++; n++; }
    if (n !== shown) paintTyped(n);
    if (n >= toks.length) typeStop();
  }

  /* ------------------------------------------------ colour of the glow follows the word */
  var COLS = [[99, 102, 241], [155, 63, 216], [192, 38, 163], [34, 195, 214]];
  try { var sm = window.sessionStorage.getItem('vb-hero-mood'); if (sm && window.HERO_THEMES && window.HERO_THEMES[sm]) COLS = window.HERO_THEMES[sm].glow; } catch (e0) { /* ignore */ }
  document.addEventListener('hero:theme', function (e) { var t = e.detail && window.HERO_THEMES && window.HERO_THEMES[e.detail.name]; if (t) { COLS = t.glow; if (scene >= 0) tintTo(scene); } });
  var col = { r: 99, g: 102, b: 241 };
  function tintTo(i) {
    var c = COLS[i] || COLS[0];
    gsap.to(col, { r: c[0], g: c[1], b: c[2], duration: 0.8, ease: 'power2.inOut', overwrite: true, onUpdate: function () { w.style.setProperty('--hw-c', Math.round(col.r) + ' ' + Math.round(col.g) + ' ' + Math.round(col.b)); } });
  }

  /* ------------------------------------------------ scenes */
  var tl = null, scene = -1;
  function layers(on, instant) {                                    /* on = the layer to show, the others fade out */
    Object.keys(L).forEach(function (k) {
      var show = (k === on);
      if (instant) gsap.set(L[k], { autoAlpha: show ? 1 : 0 });
      else gsap.to(L[k], { autoAlpha: show ? 1 : 0, duration: 0.4, ease: 'power1.out', overwrite: true });
    });
  }
  function wireReset(drawn) { gsap.set(paths, { strokeDashoffset: drawn ? 0 : 1 }); gsap.set(pen, { opacity: 0 }); }
  function siteReset() {                                            /* the finished site at rest (before it comes alive) */
    gsap.set(blocks, { opacity: 1, y: 0 });
    gsap.set(bars, { height: '35%' }); gsap.set(tgk, { x: 0 }); gsap.set(tgt, { backgroundColor: 'rgba(255,255,255,0.25)' });
    gsap.set(cards, { xPercent: 0 }); gsap.set(btn, { scale: 1, boxShadow: '0 0 0 0 rgba(192,38,163,0)' }); gsap.set(cur, { opacity: 0 }); gsap.set(ripple, { opacity: 0, scale: 0.2 });
  }
  function sceneWire() {
    wireReset(false); layers('wire');
    var n = WIRE.length, dur = 0.34, step = (1.2 - dur) / (n - 1);
    tl = gsap.timeline({ delay: 0.15 });
    tl.set(pen, { opacity: 1 }, 0);
    WIRE.forEach(function (e, i) {
      var t = i * step;
      tl.fromTo(pen, { attr: { cx: e[1][0], cy: e[1][1] } }, { attr: { cx: e[2][0], cy: e[2][1] }, duration: dur, ease: 'power2.inOut' }, t);
      tl.to(paths[i], { strokeDashoffset: 0, duration: dur, ease: 'power2.inOut' }, t);
    });
    tl.to(pen, { opacity: 0, duration: 0.3 }, '>');
  }
  function sceneCode() { layers('code'); typeStart(); }
  function sceneBuild() {
    wireReset(true); siteReset();
    gsap.set(blocks, { opacity: 0, y: -24 });
    gsap.set(L.wire, { autoAlpha: 1 }); gsap.set(L.build, { autoAlpha: 1 });
    gsap.to(L.code, { autoAlpha: 0, duration: 0.35, overwrite: true });
    tl = gsap.timeline({ delay: 0.3 });
    tl.to(blocks, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.2)', stagger: 0.12 }, 0)
      .to(L.wire, { autoAlpha: 0, duration: 0.4 }, '>-0.05');                 /* the blocks cover the wireframe: its lines fade out once they have landed */
  }
  function sceneAlive() {
    if (tl) { tl.progress(1); }
    siteReset();
    gsap.set(L.build, { autoAlpha: 1 }); gsap.set(L.wire, { autoAlpha: 0 }); gsap.set(L.code, { autoAlpha: 0 });
    var vw = view.clientWidth;
    gsap.set(cur, { left: ((28 + 48 + 108) / 10) + '%', top: ((76 + 220 + 30) / 6.25) + '%', x: vw * 0.2, y: vw * 0.16, opacity: 0, scale: 1 });
    tl = gsap.timeline({ delay: 0.15 });
    tl.to(bars, { height: function (i) { return (BAR_T[i] * 100 + 22) + '%'; }, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0)
      .to(tgk, { x: vw * 0.04, duration: 0.35, ease: 'power2.inOut' }, 0.35)
      .to(tgt, { backgroundColor: '#2dd4bf', duration: 0.35 }, 0.35)
      .to(btn, { scale: 1.07, boxShadow: '0 0 0 8px rgba(192,38,163,0.25)', duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0.25)
      .to(cards, { xPercent: -109.46, duration: 0.8, ease: 'power2.inOut' }, 0.7)
      .to(cur, { opacity: 1, duration: 0.2 }, 1.0)
      .to(cur, { x: 0, y: 0, duration: 0.55, ease: 'power3.out' }, 1.0)
      .to(cur, { scale: 0.82, duration: 0.1, yoyo: true, repeat: 1 }, 1.6)
      .fromTo(ripple, { opacity: 0.8, scale: 0.2 }, { opacity: 0, scale: 2.6, duration: 0.65, ease: 'power2.out' }, 1.62)
      .to(cur, { opacity: 0, duration: 0.3 }, 2.2);
  }
  function go(i) {
    if (tl) { tl.kill(); tl = null; }
    typeStop();
    scene = i;
    tintTo(i);
    if (i === 0) sceneWire(); else if (i === 1) sceneCode(); else if (i === 2) sceneBuild(); else sceneAlive();
  }

  /* ------------------------------------------------ the sync: one listener, no timer */
  var ready = false, visible = true, last = bootLast, log = window.__hwLog = [], held = false, pending = null;
  document.addEventListener('hero:word', function (e) {
    var i = e.detail && e.detail.index;
    if (typeof i !== 'number') return;
    last = i;
    if (held) { pending = i; return; }                              /* the story is paused: it catches up on leave */
    if (!ready || !visible || document.hidden || reduce) return;
    go(i);
    log.push({ word: i, scene: scene, t: Math.round(performance.now()) });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var v = es[es.length - 1].isIntersecting;
      if (v === visible) return; visible = v;
      if (tl) tl.paused(!v || held);
    }, { threshold: 0.05 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (tl) tl.pause(); } else if (visible && tl && !held) tl.resume(); });

  /* ------------------------------------------------ placement: compact, bottom-right (mobile: below the buttons if it fits) */
  var CL = 50;                                                      /* layout clearance; the tilt makes the near edge recede, so the visual clearance is >= 40px */
  var mode = 'off';
  function textRect(el) { var r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); }
  function obstacles(hr) {
    var out = [];
    var add = function (r, dy) { if (r && r.width > 1 && r.height > 1) out.push({ l: r.left - hr.left, t: r.top - hr.top - (dy || 0), r: r.right - hr.left, b: r.bottom - hr.top - (dy || 0) }); };
    var e = hero.querySelector('.hero-eyebrow'); if (e) add(textRect(e));
    [].forEach.call(hero.querySelectorAll('.hero-line'), function (ln) { add(textRect(ln.querySelector('.hero-line__in')), gsap.getProperty(ln, 'y') || 0); });
    var s = hero.querySelector('.hero-sub'); if (s) add(textRect(s));
    [].forEach.call(hero.querySelectorAll('.hero-ctas .cta-row__btn, .hero-ctas .text-link'), function (b) { add(b.getBoundingClientRect()); });
    var st = hero.querySelector('.hero-status'); if (st) add(st.getBoundingClientRect());
    return out;
  }
  var BAR = 30;
  function place() {
    var hr = hero.getBoundingClientRect(), inner = hero.querySelector('.hero-inner').getBoundingClientRect();
    var obs = obstacles(hr), Lft = inner.left - hr.left;
    var st = hero.querySelector('.hero-status').getBoundingClientRect();
    var res = null;
    if (window.innerWidth >= 900) {
      /* anchored bottom-right: right edge = the content container's right edge (the Rólam card), bottom = the status line's bottom (>= 32px above the hero bottom);
         width clamp(300px, 25vw, 470px), scaled down (min 220px) only if it would come within 40px of the headline / subheading / buttons / status line */
      var card = document.querySelector('#about .about-bio-card') || document.querySelector('#about .about-premium-grid');      /* the Rólam card: the content container's right edge */
      var rEdge = card ? card.getBoundingClientRect().right - hr.left : inner.right - hr.left;
      var bottom = Math.min(st.bottom - hr.top, hr.height - 32) - 20;      /* -20: the tilt + float push the visual bottom edge a few px lower than the layout box (visual gap stays >= 32px) */
      for (var W = Math.min(470, Math.max(300, 0.25 * window.innerWidth)); W >= 220 && !res; W -= 4) {
        var H = BAR + W * 0.625, left = rEdge - W, top = bottom - H;
        var hit = obs.some(function (o) { return o.r + CL > left && o.l - CL < left + W && o.b + CL > top && o.t - CL < top + H; });
        if (!hit) res = { left: left, top: top, W: W, H: H };
      }
    } else {
      /* mobile: a decorative "peek" in the free space between the buttons and the status line: ~82vw wide, right-aligned so ~15% of it goes past the screen edge
         (the hero crops it), vertically centred; hidden when the free space is < 200px (e.g. 360x640) */
      var stTop = st.top - hr.top, cb = 0;
      [].forEach.call(hero.querySelectorAll('.hero-ctas .cta-row__btn, .hero-ctas .text-link'), function (b) { cb = Math.max(cb, b.getBoundingClientRect().bottom - hr.top); });
      var free = stTop - cb;
      if (free >= 200) {
        var W2 = Math.min(0.82 * window.innerWidth, (free - 16 - BAR) / 0.625), H2 = BAR + W2 * 0.625;
        res = { left: window.innerWidth - 0.85 * W2, top: cb + (free - H2) / 2, W: W2, H: H2 };
      }
    }
    return res;
  }
  var fit = null;
  function layout() {
    fit = place();
    if (!fit) { mode = 'off'; w.classList.remove('is-on'); gsap.set(w, { opacity: 0 }); return false; }
    w.style.left = Math.round(fit.left) + 'px'; w.style.top = Math.round(fit.top) + 'px'; w.style.width = Math.round(fit.W) + 'px';
    var sw = 1.5 * 1000 / view.clientWidth; w.style.setProperty('--hw-sw', sw.toFixed(2));
    mode = window.innerWidth >= 900 ? 'desktop' : 'mobile';
    dock.style.left = mode === 'mobile' ? Math.round((window.innerWidth - fit.left) / 2 - 8) + 'px' : '';                       /* phones: the dock sits in the visible part of the peeking window */
    var rest = restTilt();
    gsap.set(tilt, { rotationY: rest.y, rotationX: rest.x, rotationZ: rest.z });
    return true;
  }
  function restTilt() { return window.innerWidth >= 900 ? { y: -14, x: 6, z: 1 } : { y: -12, x: 0, z: -3 }; }

  /* ------------------------------------------------ tilt with the pointer (html.has-cursor), idle float */
  var qy = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3' }), qx = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3' });
  hero.addEventListener('pointermove', function (e) {
    if (reduce || mode !== 'desktop' || e.pointerType !== 'mouse' || !root.classList.contains('has-cursor')) return;
    var r = hero.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    var rest = restTilt();
    qy(rest.y + 5 * nx); qx(rest.x - 5 * ny);
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { if (mode === 'desktop') { var rest = restTilt(); qy(rest.y); qx(rest.x); } });

  /* ------------------------------------------------ "mini OS": hover / focus-within (desktop) or tap (touch) pauses the story, blurs + dims the content and slides up a glass dock;
     a dock icon opens one glass panel at a time (js/hero-os.js, loaded on the first dock open). Leaving / tap outside / Esc hides everything and resumes the story where it was. */
  var win = $('.hw__win'), dock = $('.hw__dock'), pw = $('.hw__pw'), panel = $('.hw__panel'), apps = [].slice.call(w.querySelectorAll('.hw__app'));
  var osState = 0, osQueue = null, osApp = null;                    /* 0 not loaded, 1 loading, 2 ready */
  var api = { host: panel, wrap: pw, win: win, root: w, reduce: reduce, close: closePanel, isMobile: function () { return mode === 'mobile'; }, back: function () { var b = apps.filter(function (x) { return x.dataset.app === osApp; })[0]; if (b) b.focus(); } };
  window.HeroWin = api;
  gsap.set(dock, { autoAlpha: 0, y: 20 });
  function loadOS(cb) {
    if (osState === 2) { cb(); return; }
    osQueue = cb;
    if (osState === 1) return;
    osState = 1;
    var sc = document.createElement('script'); sc.src = 'js/hero-os.js?v=10'; sc.onload = function () { osState = 2; if (osQueue) { var f = osQueue; osQueue = null; f(); } }; sc.onerror = function () { osState = 0; };
    document.head.appendChild(sc);
  }
  function holdOn() {
    if (held || !ready || mode === 'off') return;
    held = true; w.classList.add('is-hold');
    if (tl) tl.pause();
    gsap.to(dock, { autoAlpha: 1, y: 0, duration: reduce ? 0 : 0.35, ease: 'back.out(1.7)', overwrite: true });
    loadOS(function () { /* panels are built on demand */ });
  }
  function holdOff() {
    if (!held) return;
    closePanel(true);
    held = false; w.classList.remove('is-hold');
    gsap.to(dock, { autoAlpha: 0, y: 20, duration: reduce ? 0 : 0.25, ease: 'power2.in', overwrite: true });
    if (pending !== null) { var i = pending; pending = null; if (ready && visible && !document.hidden && !reduce) { go(i); log.push({ word: i, scene: scene, t: Math.round(performance.now()), resync: true }); } }
    else if (tl && visible && !document.hidden) tl.resume();
  }
  function openPanel(name) {
    osApp = name;
    apps.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.app === name ? 'true' : 'false'); });
    loadOS(function () {
      if (osApp !== name || !window.HeroOS) return;
      window.HeroOS.open(name, api);
      var mob = mode === 'mobile';
      pw.classList.toggle('is-mobile', mob);
      if (mob) { var vwid = window.innerWidth, pwid = Math.min(320, vwid - 40); pw.style.left = (20 - fit.left) + 'px'; pw.style.width = pwid + 'px'; pw.style.right = 'auto'; pw.style.bottom = '64px'; }      /* above the dock */
      else { pw.style.left = ''; pw.style.width = ''; pw.style.right = ''; pw.style.bottom = ''; }
      pw.classList.add('is-open');
      placePanel();
      gsap.fromTo(panel, mob ? { y: 30, autoAlpha: 0 } : { x: 30, autoAlpha: 0 }, { x: 0, y: 0, autoAlpha: 1, duration: reduce ? 0 : 0.4, ease: 'power3.out', overwrite: true, clearProps: 'transform' });   /* no leftover identity transform layer on the panel */
    });
  }
  /* desktop: the panel sits to the left of the (tilted) window with >= 16px between its right edge and the window's visual left edge, bottom-aligned (lower half);
     if it would touch the headline / subheading / buttons / status line it goes above the window instead */
  function placePanel() {
    pw.classList.remove('is-above'); pw.style.paddingRight = ''; pw.style.inlineSize = '';
    if (mode !== 'desktop') return;
    var pwr = pw.getBoundingClientRect(), wl = win.getBoundingClientRect().left;
    var X = Math.max(14, Math.round(pwr.right - wl + 16 + 4));                       /* + float / tilt breathing room */
    var hr = hero.getBoundingClientRect(), hh = panel.offsetHeight, hwr = w.getBoundingClientRect(), PW = 260, hit = true, widths = osApp === 'palette' ? [300, 260] : osApp === 'mood' ? [264, 240] : [260];
    for (var k = 0; k < widths.length && hit; k++) {                                 /* the roomier palette (300px) shrinks to 260px only where it would touch the text */
      PW = widths[k];
      var pl = hwr.left - X - PW - hr.left, pr = hwr.left - X - hr.left, pb = hwr.bottom - hr.top, pt = pb - hh;
      hit = obstacles(hr).some(function (o) { return o.r + 12 > pl && o.l - 12 < pr && o.b + 12 > pt && o.t - 12 < pb; });
    }
    if (hit) PW = widths[0];
    pw.style.paddingRight = X + 'px'; pw.style.inlineSize = (PW + X) + 'px';
    if (hit) { pw.classList.add('is-above'); pw.style.paddingRight = ''; pw.style.inlineSize = PW + 'px'; }
  }
  function closePanel(silent) {
    if (!osApp) return;
    var name = osApp; osApp = null;
    apps.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    if (window.HeroOS) window.HeroOS.closed(name);
    gsap.to(panel, { autoAlpha: 0, x: 20, duration: reduce ? 0 : 0.25, ease: 'power2.in', overwrite: true, onComplete: function () { pw.classList.remove('is-open'); } });
    if (!silent) { var b = apps.filter(function (x) { return x.dataset.app === name; })[0]; if (b) b.focus(); }
  }
  gsap.set(panel, { autoAlpha: 0 });
  var mini = $('.hw__mini'), nudge = $('.hw__nudge'), everHovered = false;
  document.addEventListener('hero:music', function (e) { w.classList.toggle('is-music', !!(e.detail && e.detail.playing)); });
  mini.addEventListener('click', function () { if (!held) holdOn(); openPanel('music'); });
  function hideNudge() { gsap.killTweensOf(nudge); gsap.to(nudge, { autoAlpha: 0, duration: 0.2 }); }
  w.addEventListener('pointerenter', function () { everHovered = true; hideNudge(); });
  /* one-time nudge: ~7s on the hero with a mouse and no hover on the window yet -> "Próbálja ki" above the window for 3s (once per session; not on touch / reduced motion) */
  var nudged = false; try { nudged = !!window.sessionStorage.getItem('vb-hero-nudge'); } catch (e0) { /* ignore */ }
  if (!reduce && !nudged) setTimeout(function () {
    if (everHovered || held || mode !== 'desktop' || !visible || document.hidden || !root.classList.contains('has-cursor')) return;
    try { window.sessionStorage.setItem('vb-hero-nudge', '1'); } catch (e1) { /* ignore */ }
    gsap.timeline().fromTo(nudge, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }).to(nudge, { autoAlpha: 0, y: 4, duration: 0.4, ease: 'power2.in' }, '+=2.2');
  }, 7000);
  apps.forEach(function (b) { b.addEventListener('click', function () { var n = b.dataset.app; if (osApp === n) closePanel(); else openPanel(n); }); });
  var hovering = false, touchMode = false;
  w.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hovering = true; touchMode = false; holdOn(); } });
  w.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { hovering = false; if (document.activeElement && w.contains(document.activeElement)) document.activeElement.blur(); holdOff(); } });
  w.addEventListener('focusin', function () { holdOn(); });
  w.addEventListener('focusout', function () { if (touchMode) return; setTimeout(function () { if (!hovering && !w.contains(document.activeElement)) holdOff(); }, 0); });       /* keyboard: focus left the window */
  win.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { touchMode = true; if (!held) holdOn(); } });                       /* tap */
  document.addEventListener('pointerdown', function (e) { if (held && !w.contains(e.target)) holdOff(); });                           /* tap / click outside */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && held) { if (osApp) closePanel(); else { holdOff(); if (document.activeElement && w.contains(document.activeElement)) document.activeElement.blur(); } } });
  window.addEventListener('scroll', function () { if (held && mode === 'mobile') holdOff(); }, { passive: true });

  /* ------------------------------------------------ entrance: after load, after the headline lines */
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var was = mode !== 'off'; layout(); if (mode !== 'off') { if (!was) { w.classList.add('is-on'); gsap.to(w, { opacity: 1, duration: 0.4 }); } else gsap.set(w, { opacity: 1 }); } }, 150); });
  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(function () {
    var wait = Math.max(0.35, (1700 - performance.now()) / 1000);                      /* ~0.3s after the last headline line */
    gsap.delayedCall(wait, function () {
      if (!layout()) return;
      w.classList.add('is-on');
      ready = true;
      if (reduce) {                                                                  /* static window: the finished "épít" state */
        wireReset(true); siteReset(); layers('build', true); gsap.set(L.wire, { autoAlpha: 1 }); gsap.set(w, { opacity: 1 }); return;
      }
      gsap.fromTo(w, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' });
      var fa = window.innerWidth >= 900 ? 6 : 4;                                          /* a gentle float (smaller on phones) */
      gsap.fromTo(float, { y: -fa }, { y: fa, duration: 3.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      go(last || 0);                                                                  /* the first scene follows the word shown now */
      if (last) log.push({ word: last, scene: scene, t: Math.round(performance.now()), init: true });
    });
  });
  }
  var run = function () { if (window.requestIdleCallback) window.requestIdleCallback(boot, { timeout: 800 }); else setTimeout(boot, 60); };
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
