/* hero-fx.js — the hero's "living text":
   1. the living word cycles tervez -> kódol -> épít -> életre kelt (~3.5s per word) as a calm vertical roll: the old word slides up, the new letters rise from below (stagger, fade-in + tiny scale). No clip box, no filter, no will-change on the word: those made a composited layer that showed as a hard-edged rectangle over the WebGL background.
      The sizer span holds the width of the longest word and the visible text is absolutely placed, so nothing around it ever moves (zero layout shift).
   2. scrolling out of the hero: the three headline lines drift apart and fade (GSAP ScrollTrigger, scrubbed).
   3. the status line's live Budapest time (updates every minute).
   The h1 keeps the full static sentence for screen readers (.hero-vh); the animated lines are aria-hidden. Reduced motion: no cycling, the word shows "tervez, kódol, épít". */
(function () {
  'use strict';

  var hero = document.getElementById('hero');
  if (!hero) return;
  var VB = window.VB || {};
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------ live time (Europe/Budapest) */
  var time = hero.querySelector('.hero-time');
  if (time) {
    var fmt;
    try { fmt = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { fmt = null; }
    var cells = null, first = true;
    var buildTime = function () {                                    /* HH : MM - tabular mono digits, the colon blinks (CSS), a changed digit flips */
      time.textContent = ''; cells = [];
      ['dg', 'dg', 'cl', 'dg', 'dg'].forEach(function (c) { var sp = document.createElement('span'); sp.className = c; if (c === 'cl') sp.textContent = ':'; time.appendChild(sp); cells.push(sp); });
    };
    var flip = function (cell, ch) {                                 /* 3D flip, 0.4s: the old digit folds away, the new one folds in */
      if (reduce || !VB.gsap) { cell.textContent = ch; return; }
      VB.gsap.to(cell, { rotationX: -90, transformPerspective: 220, duration: 0.2, ease: 'power1.in', overwrite: true, onComplete: function () { cell.textContent = ch; VB.gsap.fromTo(cell, { rotationX: 90 }, { rotationX: 0, transformPerspective: 220, duration: 0.2, ease: 'power1.out', onComplete: function () { VB.gsap.set(cell, { clearProps: 'transform' }); } }); } });
    };
    var tick = function () {
      var d = new Date();
      var str = fmt ? fmt.format(d) : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      if (!cells) buildTime();
      [0, 1, 3, 4].forEach(function (k) { var ch = str.charAt(k); if (cells[k].textContent !== ch) { if (first) cells[k].textContent = ch; else flip(cells[k], ch); } });
      first = false;
      time.setAttribute('datetime', d.toISOString());
      time.setAttribute('aria-label', str);
      setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);          /* aligned to the next full minute */
    };
    tick();
    time.__tick = tick;                                              /* test hook */
  }

  /* ------------------------------------------------ the living word */
  var txt = hero.querySelector('.hero-live__txt');
  if (txt) {
    root.classList.add('hero-wait');
    var go = function () { root.classList.remove('hero-wait'); };
    if (document.fonts && document.fonts.load && document.fonts.ready) {            /* wait for the headline faces themselves (fonts.ready alone can resolve before they were requested) */
      Promise.all([document.fonts.load('800 40px Syne'), document.fonts.load('500 16px Montserrat'), document.fonts.load('400 16px Montserrat')]).then(function () { return document.fonts.ready; }).then(go, go);
      setTimeout(go, 3000);
    } else go();
  }
  if (txt) {
    if (reduce) {
      root.classList.add('hero-static');
      txt.textContent = 'tervez, kódol, épít';
    } else if (VB.gsap) {
      /* contextual entrances, ~3.5s hold per word. Exit for all: 0.35s fade + 8px up. The sizer span reserves the width of the longest word (zero layout shift).
         tervez: a design-tool selection frame draws, a pointer drags the word into place · kódol: symbol scramble, letters lock in left -> right ·
         épít: letters arrive as blocks (odd from below, even from above) with a snap · életre kelt: elastic pop + one neon flash, then a soft glow.
         "hero:word" is dispatched at the start of each enter (the living window follows it). */
      var gsap = VB.gsap;
      var words = ['tervez', 'kódol', 'épít', 'életre kelt'];
      var cur = 0, busy = false, built = false;
      var SYMS = '{}/<>;#=';
      var makeWord = function (word, idx) {                          /* each word has its own solid colour + outline (CSS, [data-wi]) */
        var w = document.createElement('span');
        w.className = 'hero-live__w';
        w.setAttribute('data-wi', idx);
        w.setAttribute('aria-hidden', 'true');
        var inn = document.createElement('span');
        inn.className = 'hero-live__in';
        for (var i = 0; i < word.length; i++) {
          var l = document.createElement('span');
          l.className = 'hero-live__l';
          l.textContent = word.charAt(i);
          inn.appendChild(l);
        }
        w.appendChild(inn);
        return w;
      };
      var build = function () {
        if (built) return; built = true;
        var w = makeWord(words[0], 0);
        txt.textContent = '';
        txt.appendChild(w);
      };
      var NS = 'http://www.w3.org/2000/svg';
      var ENTER = [
        function (w, tl, inn, ls) {                                  /* tervez: selection frame + dragging pointer */
          var W = w.offsetWidth, H = w.offsetHeight, px = Math.round(H * 0.1), pt = Math.round(H * 0.16), pb = Math.round(H * 0.1);
          var x0 = -px, y0 = pt, x1 = W + px, y1 = H - pb;
          var fr = document.createElementNS(NS, 'svg');
          fr.setAttribute('class', 'hero-live__fr'); fr.setAttribute('width', W); fr.setAttribute('height', H); fr.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
          var path = document.createElementNS(NS, 'path');
          path.setAttribute('d', 'M' + x0 + ' ' + y0 + 'H' + x1 + 'V' + y1 + 'H' + x0 + 'Z'); path.setAttribute('pathLength', '1');
          fr.appendChild(path); w.appendChild(fr);
          var hs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(function (c) { var h = document.createElement('span'); h.className = 'hero-live__h'; h.style.left = c[0] + 'px'; h.style.top = c[1] + 'px'; w.appendChild(h); return h; });
          var ar = document.createElement('span'); ar.className = 'hero-live__ar'; ar.style.left = (x1 + 2) + 'px'; ar.style.top = (y1 + 2) + 'px';
          ar.innerHTML = '<i data-lucide="mouse-pointer-2"></i>'; w.appendChild(ar);
          if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) { /* ignore */ } }
          gsap.set(path, { strokeDashoffset: 1 }); gsap.set(hs, { scale: 0 }); gsap.set(ar, { x: 70, y: 46, opacity: 0 }); gsap.set(inn, { x: 12 });
          gsap.set(ls, { opacity: 0 });
          tl.set(ls, { opacity: 1 }, 0)
            .to(path, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, 0)
            .to(hs, { scale: 1, duration: 0.22, ease: 'back.out(2)', stagger: 0.04 }, 0.35)
            .to(ar, { x: 0, y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.3)
            .to(inn, { x: 0, duration: 0.6, ease: 'power3.out' }, 0.85)         /* the drag: the pointer and the word move 12px together */
            .to(ar, { x: -12, duration: 0.6, ease: 'power3.out' }, 0.85)
            .to(ar, { opacity: 0, duration: 0.3 }, 1.5);
        },
        function (w, tl, inn, ls) {                                  /* kódol: code-symbol scramble, width reserved; the word is then wrapped as code: < word /> */
          var n = ls.length, fin = [], i;
          for (i = 0; i < n; i++) { fin.push(ls[i].textContent); }
          for (i = 0; i < n; i++) { var bw = ls[i].getBoundingClientRect().width; ls[i].style.width = bw + 'px'; ls[i].style.textAlign = 'center'; }
          var lt = document.createElement('span'), rt = document.createElement('span');             /* absolutely placed beside the word: no layout width, never touches another line */
          lt.className = 'hero-live__code'; rt.className = 'hero-live__code'; lt.textContent = '<'; rt.textContent = '/>';
          lt.style.right = '100%'; rt.style.left = '100%';
          w.appendChild(lt); w.appendChild(rt);
          /* the word stays put; only the brackets move. "/>" gets a normal word space (0.28em) on the free right side; "<" is centred in the (only ~0.28em wide) space between "aki" and the word,
             so it clears both neighbours by its glyph side-bearings instead of touching "aki" */
          var fpx = parseFloat(getComputedStyle(w).fontSize) || 72, lineIn = w.closest('.hero-line__in'), akiNode = lineIn && lineIn.firstChild;
          rt.style.marginLeft = (0.28 * fpx) + 'px';
          var gapL = 0.04 * fpx;
          if (akiNode && akiNode.nodeType === 3) {
            var rg = document.createRange(); rg.setStart(akiNode, 0); rg.setEnd(akiNode, Math.max(0, akiNode.length - 1));
            var interval = w.getBoundingClientRect().left - rg.getBoundingClientRect().right;
            gapL = Math.max(0, (interval - lt.offsetWidth) / 2);
          }
          lt.style.marginRight = gapL + 'px';
          gsap.set(ls, { opacity: 0 }); gsap.set([lt, rt], { opacity: 0 });
          var st = { p: 0 };
          tl.set(ls, { opacity: 1 }, 0).to(st, { p: 1, duration: 0.6, ease: 'none', onUpdate: function () {
            for (var j = 0; j < n; j++) {
              var lock = 0.18 + 0.82 * (n > 1 ? j / (n - 1) : 0);
              ls[j].textContent = st.p >= lock ? fin[j] : SYMS.charAt(Math.floor(st.p * 14 + j * 3) % SYMS.length);
            }
          }, onComplete: function () { for (var j = 0; j < n; j++) { ls[j].textContent = fin[j]; ls[j].style.width = ''; ls[j].style.textAlign = ''; } } }, 0)
            .fromTo(lt, { x: -12, opacity: 0 }, { x: 0, opacity: 0.6, duration: 0.4, ease: 'power2.out' }, 0.6)
            .fromTo(rt, { x: 12, opacity: 0 }, { x: 0, opacity: 0.6, duration: 0.4, ease: 'power2.out' }, 0.6);
        },
        function (w, tl, inn, ls) {                                  /* épít: letters lock together; four brand blocks fall to the right of the word and stack into a stair */
          gsap.set(ls, { yPercent: function (i) { return i % 2 === 0 ? 60 : -60; }, opacity: 0, force3D: false });
          var W = w.offsetWidth, H = w.offsetHeight, fpx = parseFloat(getComputedStyle(w).fontSize) || 72;
          var sz = Math.round(fpx * 0.22), gp = 3, x0 = W + Math.round(fpx * 0.2), base = H * 0.83;
          var CELLS = [[0, 0, '#6366f1'], [1, 0, '#9b3fd8'], [0, 1, '#C026A3'], [2, 0, '#22c3d6']];
          var blks = CELLS.map(function (c) {
            var e = document.createElement('span'); e.className = 'hero-live__blk';
            e.style.width = sz + 'px'; e.style.height = sz + 'px'; e.style.left = (x0 + c[0] * (sz + gp)) + 'px'; e.style.top = Math.round(base - (c[1] + 1) * sz - c[1] * gp) + 'px'; e.style.background = c[2];
            w.appendChild(e); return e;
          });
          gsap.set(blks, { opacity: 0, transformOrigin: '50% 100%' });
          tl.to(ls, { yPercent: 0, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.06, force3D: false }, 0)
            .to(ls, { opacity: 1, duration: 0.2, stagger: 0.06 }, 0);
          blks.forEach(function (e, k) {                             /* gravity drop (ease-in), a tiny squash on landing */
            var t = 0.25 + k * 0.12;
            tl.fromTo(e, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.in' }, t)
              .to(e, { scaleY: 0.68, scaleX: 1.12, duration: 0.07, ease: 'power1.out' }, t + 0.3)
              .to(e, { scaleY: 1, scaleX: 1, duration: 0.22, ease: 'back.out(2.5)' }, t + 0.37);
          });
        },
        function (w, tl, inn, ls) {                                  /* életre kelt: elastic pop + neon flash, then a soft glow + three twinkling sparkles */
          gsap.set(ls, { scale: 0.4, opacity: 0, transformOrigin: '50% 70%', force3D: false });
          var W = w.offsetWidth, H = w.offsetHeight;
          var sp = [[W + 6, H * 0.1, 16], [W - 12, H * 0.9, 10], [W * 0.46, -7, 10]].map(function (c) {
            var e = document.createElement('span'); e.className = 'hero-live__sp'; e.style.left = Math.round(c[0]) + 'px'; e.style.top = Math.round(c[1]) + 'px'; e.style.inlineSize = c[2] + 'px'; e.style.blockSize = c[2] + 'px';
            e.innerHTML = '<i data-lucide="sparkle"></i>'; w.appendChild(e); return e;
          });
          if (window.lucide && lucide.createIcons) { try { lucide.createIcons(); } catch (e) { /* ignore */ } }
          gsap.set(sp, { scale: 0, opacity: 0 });
          var g = { v: 0 }, setg = function () { w.style.setProperty('--gl', g.v.toFixed(3)); };
          tl.to(ls, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)', stagger: 0.04, force3D: false }, 0)
            .to(ls, { opacity: 1, duration: 0.15, stagger: 0.04 }, 0)
            .to(g, { v: 1, duration: 0.15, ease: 'power2.out', onUpdate: setg }, 0.1)
            .to(g, { v: 0.3, duration: 0.4, ease: 'power2.out', onUpdate: setg }, 0.25);
          sp.forEach(function (e, k) {                                /* each sparkle twinkles twice during the hold */
            var t = 0.3 + k * 0.2;
            tl.fromTo(e, { scale: 0, rotation: -40, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, t)
              .to(e, { scale: 0.25, opacity: 0.2, rotation: 50, duration: 0.45, ease: 'sine.inOut' }, t + 0.5)
              .to(e, { scale: 1, opacity: 1, rotation: 90, duration: 0.4, ease: 'back.out(2)' }, t + 1.45)
              .to(e, { scale: 0, opacity: 0, rotation: 140, duration: 0.4, ease: 'power2.in' }, t + 2.0);
          });
        }
      ];
      var next = function () {
        if (!busy && !document.hidden && built) {
          busy = true;
          var old = txt.querySelector('.hero-live__w');
          cur = (cur + 1) % words.length;
          var idx = cur;
          var nw = makeWord(words[idx], idx);
          txt.appendChild(nw);
          var inn = nw.firstChild, ls = [].slice.call(inn.children);
          gsap.set(ls, { opacity: 0 });                              /* hidden until its enter starts */
          gsap.to(old, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.in', force3D: false, onComplete: function () { if (old.parentNode) old.parentNode.removeChild(old); } });
          var tl = gsap.timeline({ delay: 0.3,
            onStart: function () { document.dispatchEvent(new CustomEvent('hero:word', { detail: { index: idx, word: words[idx] } })); },     /* the living window (js/hero-window.js) follows this */
            onComplete: function () {
              gsap.set(ls, { clearProps: 'transform,opacity' }); gsap.set(inn, { clearProps: 'transform' });
              [].forEach.call(nw.querySelectorAll('.hero-live__ar'), function (a) { if (a.parentNode) a.parentNode.removeChild(a); });
              busy = false;
            } });
          ENTER[idx](nw, tl, inn, ls);
        }
        gsap.delayedCall(3.5, next);
      };
      var start = function () { build(); gsap.delayedCall(3.5 + 0.9, next); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
    }
  }

  /* ------------------------------------------------ "Kreatív Webfejlesztő,": idle shimmer (CSS, a soft diagonal light band every ~8s) + outline hover reveal
     (html.has-cursor only, desktop). Two absolute copies per line live inside the line (no layout impact): .fx-sh = the shimmer band, .fx-ol = outlined letters, masked by a radial
     gradient that follows the pointer (--hx/--hy, GSAP quickTo 0.25s); the white base letters fade out only under that circle (inverse mask on .hero-line__in, only while hovering).
     A soft violet glow follows the pointer. Reduced motion: none of this exists. */
  var hl = [].slice.call(hero.querySelectorAll('.hero-line')).slice(0, 2);
  if (!reduce && hl.length === 2) {
    hl.forEach(function (ln) {
      var t = ln.querySelector('.hero-line__in').innerHTML;                  /* with the comma markup, so the copies line up exactly */
      var fx = document.createElement('span'); fx.className = 'hero-line__fx'; fx.setAttribute('aria-hidden', 'true');
      fx.innerHTML = '<span class="fx-sh">' + t + '</span><span class="fx-ol">' + t + '</span>';
      ln.appendChild(fx);
      var fb = document.createElement('span'); fb.className = 'hero-line__fxb'; fb.setAttribute('aria-hidden', 'true');
      fb.innerHTML = '<span class="fx-halo">' + t + '</span>';
      ln.insertBefore(fb, ln.firstChild);
    });
    var armed = false;                                               /* the halo underlay takes over from the base letters' own shadow once the intro is done */
    var arm = function () { setTimeout(function () { hl.forEach(function (ln) { ln.classList.add('has-fx'); }); armed = true; }, 1400); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(arm); else arm();
    var gsx = VB.gsap;
    var titleEl = hero.querySelector('.hero-title');
    if (gsx && titleEl) {
      var glow = document.createElement('span'); glow.className = 'hero-glow'; glow.setAttribute('aria-hidden', 'true');
      titleEl.insertBefore(glow, titleEl.firstChild);
      var ps = { x: 0, y: 0, r: 0 }, hot = false;
      var draw = function () {
        var tr = titleEl.getBoundingClientRect();
        hl.forEach(function (ln) {
          var r = ln.getBoundingClientRect();
          ln.style.setProperty('--hx', (ps.x - r.left).toFixed(1) + 'px'); ln.style.setProperty('--hy', (ps.y - r.top).toFixed(1) + 'px'); ln.style.setProperty('--hr', ps.r.toFixed(1) + 'px');
        });
        gsx.set(glow, { x: ps.x - tr.left, y: ps.y - tr.top });
      };
      var qx = gsx.quickTo(ps, 'x', { duration: 0.25, ease: 'power3', onUpdate: draw }), qy = gsx.quickTo(ps, 'y', { duration: 0.25, ease: 'power3', onUpdate: draw });
      var over = function (e) {                                      /* inside the two lines' text (+24px) */
        for (var i = 0; i < 2; i++) {
          var rg = document.createRange(); rg.selectNodeContents(hl[i].querySelector('.hero-line__in'));
          var b = rg.getBoundingClientRect(), padd = 24;
          if (e.clientX >= b.left - padd && e.clientX <= b.right + padd && e.clientY >= b.top - padd && e.clientY <= b.bottom + padd) return true;
        }
        return false;
      };
      var setHot = function (on, e) {
        if (on === hot) return; hot = on;
        if (on) {
          ps.x = e.clientX; ps.y = e.clientY;
          hl.forEach(function (ln) { ln.classList.add('is-hov'); });
          draw();
          gsx.to(ps, { r: 110, duration: 0.3, ease: 'power2.out', overwrite: 'auto', onUpdate: draw });
          gsx.to(glow, { opacity: 1, duration: 0.3 });
        } else {
          gsx.to(ps, { r: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto', onUpdate: draw, onComplete: function () { if (!hot) hl.forEach(function (ln) { ln.classList.remove('is-hov'); }); } });
          gsx.to(glow, { opacity: 0, duration: 0.3 });
        }
      };
      hero.addEventListener('pointermove', function (e) {
        if (!armed || e.pointerType !== 'mouse' || !root.classList.contains('has-cursor') || window.innerWidth < 900) return;
        var on = over(e);
        if (on && !hot) setHot(true, e);
        else if (!on && hot) setHot(false, e);
        if (on) { qx(e.clientX); qy(e.clientY); }
      }, { passive: true });
      hero.addEventListener('pointerleave', function (e) { if (hot) setHot(false, e); });
    }
  }

  /* ------------------------------------------------ scroll out: the lines drift apart + fade */
  if (!reduce && VB.gsap && VB.hasST) {
    var lines = hero.querySelectorAll('.hero-line');
    if (lines.length === 3) {
      var st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      VB.gsap.to(lines[0], { y: -46, opacity: 0.1, ease: 'none', scrollTrigger: st });
      VB.gsap.to(lines[1], { opacity: 0.1, ease: 'none', scrollTrigger: st });
      VB.gsap.to(lines[2], { y: 46, opacity: 0.1, ease: 'none', scrollTrigger: st });
    }
  }
})();
