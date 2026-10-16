/* contact-footer.js — motion layer for #contact and the footer.
   Entrances, the "ÜZENJEN." letter rise with pointer proximity, tilt/magnet
   interactions, glow pause/resume, and the VARBRO wordmark scrub.

   Everything is visible by default (CSS). Initial hidden states are applied here
   only after GSAP / ScrollTrigger / SplitText are confirmed. Reduced motion:
   nothing runs. Touch devices: no tilt, magnet or proximity (entrances stay).
   No manual ScrollTrigger.refresh() (it would cancel in-flight Lenis scrolls). */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('contact');
  var footer = document.querySelector('footer');
  var reduce = !!VB.reduceMotion;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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

  /* ---------------------------------------------------------- magnet / tilt helpers */
  function magnet(el, max) {
    if (!el || !fine) return;
    var qx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    var qy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      qx(Math.max(-1, Math.min(1, dx)) * max);
      qy(Math.max(-1, Math.min(1, dy)) * max);
    });
    el.addEventListener('pointerleave', function () { qx(0); qy(0); });
  }

  if (section) {
    magnet(section.querySelector('.btn-submit-message'), 6);
    magnet(section.querySelector('.btn-wa-cta'), 4);
    magnet(section.querySelector('.btn-email-cta'), 4);

    /* gentle pointer tilt of the whole photo circle */
    var card = section.querySelector('.contact-personal-panel');
    var photo = section.querySelector('.contact-photo-square');
    if (card && photo && fine) {
      var raf = 0, tx = 0, ty = 0;
      var apply = function () {
        raf = 0;
        photo.style.setProperty('--rx', tx.toFixed(2) + 'deg');
        photo.style.setProperty('--ry', ty.toFixed(2) + 'deg');
      };
      card.addEventListener('pointermove', function (e) {
        var r = photo.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width / 2)) / (card.clientWidth / 2);
        var ny = (e.clientY - (r.top + r.height / 2)) / (card.clientHeight / 2);
        tx = Math.max(-1, Math.min(1, nx)) * 4;
        ty = -Math.max(-1, Math.min(1, ny)) * 4;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
    }

    /* ---------------------------------------------------------- entrances */
    var formCard = section.querySelector('.contact-form-panel');
    if (formCard) {
      var items = arr(formCard, 'h3, .contact-field, .contact-consent, .btn-submit-message, .contact-form-note');
      gsap.set(items, { opacity: 0, y: 12 });
      var f1 = false;
      var playForm = function () {
        if (f1) return; f1 = true;
        gsap.to(items, { opacity: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.06, onComplete: function () { gsap.set(items, { clearProps: 'opacity,transform' }); } });
      };
      ST.create({ trigger: formCard, start: 'top 82%', once: true, onEnter: playForm, onLeave: playForm });
    }
    var personal = section.querySelector('.contact-personal-panel');
    if (personal) {
      var pItems = arr(personal, '.contact-profile-header, h4, .contact-actions > *');
      gsap.set(pItems, { opacity: 0, y: 16 });
      var f2 = false;
      var playP = function () {
        if (f2) return; f2 = true;
        gsap.to(pItems, { opacity: 1, y: 0, duration: 0.7, ease: EASE, stagger: 0.08, onComplete: function () { gsap.set(pItems, { clearProps: 'opacity,transform' }); } });
      };
      ST.create({ trigger: personal, start: 'top 82%', once: true, onEnter: playP, onLeave: playP });
    }
    var head = arr(section, '.ctc-eyebrow, .ctc-sub');
    gsap.set(head, { opacity: 0, y: 20 });
    var hd = false;
    var playHead = function () {
      if (hd) return; hd = true;
      gsap.to(head, { opacity: 1, y: 0, duration: 0.7, ease: EASE, delay: 0.5, stagger: 0.12, onComplete: function () { gsap.set(head, { clearProps: 'opacity,transform' }); } });
    };

    /* ---------------------------------------------------------- the giant word */
    var word = section.querySelector('.ctc-word');
    if (word && VB.hasSplit) {
      var setup = function () {
        var split = window.SplitText.create(word, { type: 'chars', aria: 'auto', mask: 'chars', charsClass: 'ctc-char', maskClass: 'ctc-mask' });
        var chars = split.chars;
        if (!chars || !chars.length) return;
        chars.forEach(function (c) { c.setAttribute('data-c', c.textContent.toUpperCase()); });
        var dot = chars[chars.length - 1];
        if (dot.textContent.trim() === '.') dot.classList.add('ctc-dot');
        var body = chars.slice(0, dot.classList.contains('ctc-dot') ? -1 : undefined);
        gsap.set(chars, { yPercent: 110, rotation: function (i) { return i % 2 ? 8 : -8; }, transformOrigin: '0% 100%' });
        var done = false, ready = false;
        var play = function () {
          if (done) return; done = true;
          playHead();
          var tl = gsap.timeline({ onComplete: function () { gsap.set(chars, { clearProps: 'transform' }); ready = true; cacheCentres(); } });
          tl.to(body, { yPercent: 0, rotation: 0, duration: 0.9, ease: 'power4.out', stagger: 0.05 });
          if (body.length !== chars.length) tl.to(dot, { yPercent: 0, rotation: 0, duration: 0.8, ease: 'back.out(2.4)' }, '>-0.3');
        };
        ST.create({ trigger: word, start: 'top 80%', once: true, onEnter: play, onLeave: play });

        /* proximity: letters near the pointer pick up the gradient, lift and grow */
        if (!fine) return;
        var centres = [], p = chars.map(function () { return 0; }), target = p.slice();
        var inside = false, px = 0, py = 0, loop = 0, RADIUS = 140;
        function cacheCentres() {
          centres = chars.map(function (c) { var r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        }
        var scrollT, resizeT;
        window.addEventListener('scroll', function () { clearTimeout(scrollT); scrollT = setTimeout(function () { if (ready) cacheCentres(); }, 140); }, { passive: true });
        /* the word is sized from the viewport height too, so letter centres move on every resize */
        window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(function () { if (ready) cacheCentres(); }, 150); });
        function tick() {
          loop = 0;
          var busy = false;
          for (var i = 0; i < chars.length; i++) {
            var t = 0;
            if (inside && centres[i]) {
              var d = Math.hypot(px - centres[i].x, py - centres[i].y);
              t = Math.max(0, 1 - d / RADIUS);
            }
            target[i] = t;
            p[i] += (t - p[i]) * 0.16;
            if (Math.abs(t - p[i]) > 0.004) busy = true; else p[i] = t;
            chars[i].style.setProperty('--p', p[i].toFixed(3));
          }
          if (busy || inside) loop = requestAnimationFrame(tick);
        }
        var zone = word.parentElement;
        zone.addEventListener('pointerenter', function () { if (!ready) return; cacheCentres(); inside = true; if (!loop) loop = requestAnimationFrame(tick); });
        zone.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (ready && !inside) { inside = true; cacheCentres(); } if (ready && !loop) loop = requestAnimationFrame(tick); });
        zone.addEventListener('pointerleave', function () { inside = false; if (!loop) loop = requestAnimationFrame(tick); });
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup); else setup();
    } else {
      playHead();
    }
  }

  /* ---------------------------------------------------------- footer */
  if (footer) {
    arr(footer, '.social-links a').forEach(function (a) { magnet(a, 4); });
    var wm = footer.querySelector('.footer-wordmark span');
    if (wm) {
      gsap.fromTo(wm, { yPercent: 45 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: 0.5 }
      });
    }
  }
})();
