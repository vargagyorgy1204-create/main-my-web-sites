/* hero-fx.js — the hero's "living text":
   1. the living word cycles tervez -> kódol -> épít -> életre kelt (~2.4s per word); on every change the letters scramble for ~0.55s and settle into the next word.
      The sizer span holds the width of the longest word and the visible text is absolutely placed, so nothing around it ever moves (zero layout shift).
   2. scrolling out of the hero: the two headline lines drift apart and fade (GSAP ScrollTrigger, scrubbed).
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
  var size = hero.querySelector('.hero-live__size');
  if (txt) {
    if (reduce) {
      root.classList.add('hero-static');
      txt.textContent = 'tervez, kódol, épít';
    } else {
      var words = ['tervez', 'kódol', 'épít', 'életre kelt'];
      var POOL = 'abcdefghijklmnopqrstuvwxyzáéíóöőúüű';
      var cur = 0, busy = false;
      var rnd = function () { return POOL.charAt(Math.floor(Math.random() * POOL.length)); };
      var scramble = function (from, to) {
        var n = Math.max(from.length, to.length);
        var st = { p: 0 };
        var draw = function (p) {
          var out = '';
          for (var i = 0; i < n; i++) {
            var settle = 0.35 + (i / n) * 0.55;                      /* left -> right: each letter settles a little later */
            if (p >= settle) out += to.charAt(i);
            else if (p < 0.12 && i < from.length) out += from.charAt(i);
            else { var c = to.charAt(i) === ' ' && p > 0.5 ? ' ' : rnd(); out += (i >= to.length && p > 0.5) ? '' : c; }
          }
          txt.textContent = out;
        };
        if (VB.gsap) {
          VB.gsap.to(st, { p: 1, duration: 0.55, ease: 'none', onUpdate: function () { draw(st.p); }, onComplete: function () { txt.textContent = to; busy = false; } });
        } else { txt.textContent = to; busy = false; }
      };
      var next = function () {
        if (!busy && !document.hidden) {
          busy = true;
          var from = words[cur]; cur = (cur + 1) % words.length;
          scramble(from, words[cur]);
        }
        setTimeout(next, 2400);
      };
      setTimeout(next, 2400 + 900);                                  /* the first word is shown for the intro + one beat */
    }
  }

  /* ------------------------------------------------ scroll out: the lines drift apart + fade */
  if (!reduce && VB.gsap && VB.hasST) {
    var lines = hero.querySelectorAll('.hero-line');
    if (lines.length === 2) {
      var st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      VB.gsap.to(lines[0], { y: -46, opacity: 0.1, ease: 'none', scrollTrigger: st });
      VB.gsap.to(lines[1], { y: 46, opacity: 0.1, ease: 'none', scrollTrigger: st });
    }
  }
})();
