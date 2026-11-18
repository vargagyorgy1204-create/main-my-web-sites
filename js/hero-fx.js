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
    var tick = function () {
      var d = new Date();
      time.textContent = fmt ? fmt.format(d) : ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      time.setAttribute('datetime', d.toISOString());
      setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 50);          /* aligned to the next full minute */
    };
    tick();
  }

  /* ------------------------------------------------ the living word */
  var txt = hero.querySelector('.hero-live__txt');
  if (txt) {
    root.classList.add('hero-wait');
    var go = function () { root.classList.remove('hero-wait'); };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 2500); } else go();
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
        function (w, tl, inn, ls) {                                  /* kódol: code-symbol scramble, width reserved */
          var n = ls.length, fin = [], i;
          for (i = 0; i < n; i++) { fin.push(ls[i].textContent); }
          for (i = 0; i < n; i++) { var bw = ls[i].getBoundingClientRect().width; ls[i].style.width = bw + 'px'; ls[i].style.textAlign = 'center'; }
          gsap.set(ls, { opacity: 0 });
          var st = { p: 0 };
          tl.set(ls, { opacity: 1 }, 0).to(st, { p: 1, duration: 0.6, ease: 'none', onUpdate: function () {
            for (var j = 0; j < n; j++) {
              var lock = 0.18 + 0.82 * (n > 1 ? j / (n - 1) : 0);
              ls[j].textContent = st.p >= lock ? fin[j] : SYMS.charAt(Math.floor(st.p * 14 + j * 3) % SYMS.length);
            }
          }, onComplete: function () { for (var j = 0; j < n; j++) { ls[j].textContent = fin[j]; ls[j].style.width = ''; ls[j].style.textAlign = ''; } } }, 0);
        },
        function (w, tl, inn, ls) {                                  /* épít: blocks lock together */
          gsap.set(ls, { yPercent: function (i) { return i % 2 === 0 ? 60 : -60; }, opacity: 0, force3D: false });
          tl.to(ls, { yPercent: 0, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.06, force3D: false }, 0)
            .to(ls, { opacity: 1, duration: 0.2, stagger: 0.06 }, 0);
        },
        function (w, tl, inn, ls) {                                  /* életre kelt: elastic pop + neon flash, then a soft glow */
          gsap.set(ls, { scale: 0.4, opacity: 0, transformOrigin: '50% 70%', force3D: false });
          var g = { v: 0 }, setg = function () { w.style.setProperty('--gl', g.v.toFixed(3)); };
          tl.to(ls, { scale: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)', stagger: 0.04, force3D: false }, 0)
            .to(ls, { opacity: 1, duration: 0.15, stagger: 0.04 }, 0)
            .to(g, { v: 1, duration: 0.15, ease: 'power2.out', onUpdate: setg }, 0.1)
            .to(g, { v: 0.3, duration: 0.4, ease: 'power2.out', onUpdate: setg }, 0.25);
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
      var t = ln.querySelector('.hero-line__in').textContent;
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
