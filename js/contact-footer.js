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

    /* ---------------------------------------------------------- entrances */
    var formCard = section.querySelector('.contact-form-panel');
    if (formCard) {
      var items = arr(formCard, 'h3, .contact-field, .contact-consent, .btn-submit-message');
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

    /* ---------------------------------------------------------- the giant word
       Letters, accent dot and the proximity hover come from js/heading-fx.js (the .sh-char letters inside their .sh-mask). The reveal is CSS (style.css, #contact
       .section-heading .fx-*): the letters rise out of their masks one by one, the dot pops in last; reversed (right -> left) when the heading is left downwards.
       Here: the letter indices, the trigger and the eyebrow / sub entrance. */
    var word = section.querySelector('.section-heading');
    if (word) {
      var setup = function () {
        var chars = arr(word, '.sh-char');
        if (!chars.length || !('IntersectionObserver' in window)) { playHead(); return; }
        chars.forEach(function (ch, i) { ch.style.setProperty('--ci', i); });
        word.style.setProperty('--cn', chars.length);
        word.classList.add('fx-prep');
        var timer = 0, first = true;
        new IntersectionObserver(function (es) {
          var e = es[es.length - 1], on = e.isIntersecting;
          if (!on && !(e.boundingClientRect.top > 0)) return;
          if (on === word.classList.contains('fx-in')) return;
          word.classList.add('fx-moving');                                   /* the masks clip only while the letters travel */
          word.classList.toggle('fx-in', on);
          if (on && first) { first = false; playHead(); }
          clearTimeout(timer);
          timer = setTimeout(function () { word.classList.remove('fx-moving'); }, 2000);
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
