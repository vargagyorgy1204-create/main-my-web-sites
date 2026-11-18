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
      /* calm vertical roll: every word stays ~3.5s; the current word slides up (0.7s) while the next word's letters rise from below (0.035s stagger, 0.8s) with a blur + fade-in.
         The sizer span reserves the width of the longest word, so nothing around it ever moves (zero layout shift). */
      var gsap = VB.gsap;
      var words = ['tervez', 'kódol', 'épít', 'életre kelt'];
      var cur = 0, busy = false, built = false;
      var makeWord = function (word, idx) {                          /* each word has its own solid colour + outline (CSS, [data-wi]) */
        var w = document.createElement('span');
        w.className = 'hero-live__w';
        w.setAttribute('data-wi', idx);
        w.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < word.length; i++) {
          var l = document.createElement('span');
          l.className = 'hero-live__l';
          l.textContent = word.charAt(i);
          w.appendChild(l);
        }
        return w;
      };
      var build = function () {
        if (built) return; built = true;
        var w = makeWord(words[0], 0);
        txt.textContent = '';
        txt.appendChild(w);
      };
      var next = function () {
        if (!busy && !document.hidden && built) {
          busy = true;
          var old = txt.querySelector('.hero-live__w');
          cur = (cur + 1) % words.length;
          var nw = makeWord(words[cur], cur);
          txt.appendChild(nw);
          var ls = nw.children;
          gsap.set(ls, { yPercent: 70, opacity: 0, scale: 0.94, transformOrigin: '50% 100%', force3D: false });
          gsap.to(old, { yPercent: -70, opacity: 0, duration: 0.7, ease: 'power3.inOut', force3D: false, onComplete: function () { if (old.parentNode) old.parentNode.removeChild(old); } });
          gsap.to(ls, { yPercent: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.035, delay: 0.3, force3D: false,
            onComplete: function () { gsap.set(ls, { clearProps: 'transform,opacity' }); busy = false; } });
        }
        gsap.delayedCall(3.5, next);
      };
      var start = function () { build(); gsap.delayedCall(3.5 + 0.9, next); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
    }
  }

  /* ------------------------------------------------ magnetic letters: "Kreatív" / "Webfejlesztő," (html.has-cursor only, no reduced motion)
     Each letter reacts to its distance from the pointer (radius ~180px): lifts up to -8px and eases its weight 800 -> 500 (variable Syne), GSAP quickTo ~0.35s.
     Every letter box keeps its measured rest width (inline-block, text centred), so the weight change never moves the line. */
  var chars = hero.querySelectorAll('.hero-ch');
  if (chars.length && !reduce && VB.gsap) {
    var gs = VB.gsap, R = 180, LIFT = 8, W0 = 800, W1 = 500;
    var items = [].map.call(chars, function (el) {
      var st = { w: W0 };
      return { el: el, st: st,
        qy: gs.quickTo(el, 'y', { duration: 0.35, ease: 'power3' }),
        qw: gs.quickTo(st, 'w', { duration: 0.35, ease: 'power3', onUpdate: function () { el.style.setProperty('--w', st.w.toFixed(1)); } }) };
    });
    var lock = function () {                                       /* fix every letter box to its rest width (at weight 800) */
      items.forEach(function (it) { it.el.style.width = ''; });
      var ws = items.map(function (it) { return it.el.getBoundingClientRect().width; });
      items.forEach(function (it, i) { it.el.style.width = ws[i] + 'px'; });
    };
    var armed = false;
    var arm = function () { if (armed) return; armed = true; lock(); };
    var relock = function () { if (armed) { items.forEach(function (it) { it.el.style.setProperty('--w', W0); }); lock(); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(arm, 50); }); else arm();
    var rt = 0; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(relock, 150); });
    var rest = function () { items.forEach(function (it) { it.qy(0); it.qw(W0); }); };
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || !root.classList.contains('has-cursor') || !armed) return;
      items.forEach(function (it) {
        var b = it.el.getBoundingClientRect();
        var d = Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2));
        var f = Math.max(0, 1 - d / R); f = f * f * (3 - 2 * f);   /* smoothstep falloff */
        it.qy(-LIFT * f); it.qw(W0 - (W0 - W1) * f);
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', rest);
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
