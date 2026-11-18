/* hero-fx.js — the hero's "living text":
   1. the living word cycles tervez -> kódol -> épít -> életre kelt (~3.5s per word) as a calm vertical roll: the old word slides up, the new letters rise from below (stagger, blur -> sharp).
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
      var GRAD = 'linear-gradient(90deg, #7f7fff 0%, #b765f2 55%, #ee5fcf 100%)';
      var makeWord = function (word) {
        var w = document.createElement('span');
        w.className = 'hero-live__w';
        w.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < word.length; i++) {
          var l = document.createElement('span');
          l.className = 'hero-live__l';
          l.textContent = word.charAt(i);
          w.appendChild(l);
        }
        return w;
      };
      var paint = function (w) {                                   /* gradient flows across the whole word: each letter shows its own slice */
        var W = w.offsetWidth || 1, ls = w.children;
        for (var i = 0; i < ls.length; i++) { ls[i].style.backgroundSize = W + 'px 100%'; ls[i].style.backgroundPosition = (-ls[i].offsetLeft) + 'px 0'; }
      };
      var build = function () {
        if (built) return; built = true;
        var w = makeWord(words[0]);
        txt.textContent = '';
        txt.classList.add('is-roll');
        txt.appendChild(w);
        paint(w);
      };
      var next = function () {
        if (!busy && !document.hidden && built) {
          busy = true;
          var old = txt.querySelector('.hero-live__w');
          cur = (cur + 1) % words.length;
          var nw = makeWord(words[cur]);
          txt.appendChild(nw);
          paint(nw);
          var ls = nw.children;
          gsap.set(ls, { yPercent: 100, opacity: 0, filter: 'blur(6px)' });
          gsap.to(old, { yPercent: -100, opacity: 0, duration: 0.7, ease: 'power3.inOut', onComplete: function () { if (old.parentNode) old.parentNode.removeChild(old); } });
          gsap.to(ls, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out', stagger: 0.035, delay: 0.3,
            onComplete: function () { gsap.set(ls, { clearProps: 'transform,opacity,filter' }); busy = false; } });
        }
        gsap.delayedCall(3.5, next);
      };
      var start = function () { build(); gsap.delayedCall(3.5 + 0.9, next); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
      window.addEventListener('resize', function () { var w = txt.querySelector('.hero-live__w:last-child'); if (w && !busy) paint(w); });
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
