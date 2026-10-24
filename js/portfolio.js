/* ==========================================================================
   portfolio.js — #portfolio ("Munkáim"): the stacking case-card deck, the
                  Instagram card and the case-study dialog.

   Content comes from js/portfolio-data.js (window.PF_PROJECTS); this file
   renders it, so swapping a project means editing the data file only.

   Ported from demovarbro. Loaded (defer) after js/gsap-setup.js, which
   registers the GSAP plugins and exposes window.VB. The header flips to its
   light-on-dark look through nav.js: the deck carries data-theme="dark".

   Stacking = CSS position: sticky + a scrubbed scale/darken on the covered
   card. There is NO ScrollTrigger pin in this section. Everything degrades:
   no GSAP -> static blocks; no Flip -> the dialog fades in instead.
   ========================================================================== */
(function () {
  'use strict';

  var VB = (window.VB = window.VB || {});
  if (VB.reduceMotion === undefined) {
    VB.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var section = document.getElementById('portfolio');
  var deck    = document.getElementById('pf-deck');
  var data    = window.PF_PROJECTS;
  if (!section || !deck || !data || !data.length) return;

  /* gsap-setup.js has already registered whatever plugins loaded. */
  var hasGsap  = !!(VB.gsap && VB.hasST);
  var hasFlip  = hasGsap && !!VB.hasFlip;
  var hasSplit = hasGsap && !!VB.hasSplit;

  var reduce    = VB.reduceMotion;
  var EASE      = 'power2.out';
  var N         = data.length;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function typeLabel(p) { return p.type === 'client' ? 'Ügyfélprojekt' : 'Koncepció'; }

  /* ------------------------------------------------------------- render */
  /* The address pill: rendered only when the project has an addressLabel.
     With an addressHref too it is a link (dialog only, see portfolio-data.js). */
  function addrHTML(p, asLink) {
    var inner = '<i data-lucide="lock" class="icon pf-win__lock"></i><span class="pf-addr-text">' + esc(p.addressLabel) + '</span>';
    if (asLink && p.addressHref) {
      return '<a class="pf-win__addr pf-win__addr--link" href="' + esc(p.addressHref) + '" target="_blank" rel="noopener">' + inner + '</a>';
    }
    return '<span class="pf-win__addr" aria-hidden="true">' + inner + '</span>';
  }

  function windowHTML(p) {
    var m = p.media;
    return '<button type="button" class="pf-win" aria-label="' + esc(p.name) + ' — esettanulmány megnyitása">' +
      '<span class="pf-win__bar">' +
        '<span class="pf-win__dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        (p.addressLabel ? addrHTML(p, false) : '') +
      '</span>' +
      '<span class="pf-win__view">' +
        '<img src="' + esc(m.hero960) + '" srcset="' + esc(m.hero960) + ' 960w, ' + esc(m.hero) + ' 1440w" ' +
          'sizes="(max-width: 899px) 100vw, 60vw" width="960" height="600" alt="" loading="lazy" decoding="async">' +
        '<video class="pf-win__video" data-src="' + esc(m.loop) + '" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>' +
      '</span>' +
    '</button>';
  }

  function caseHTML(p, i) {
    var num = (i < 9 ? '0' : '') + (i + 1) + ' / ' + (N < 10 ? '0' : '') + N;
    /* Row 1: the meta bar. Row 2: the "stage" — text column on the left,
       browser window on the right; the window is the height reference. */
    return '<article class="pf-case" data-index="' + i + '" data-slug="' + esc(p.slug) + '" style="--accent:' + esc(p.accent) + '">' +
      '<div class="pf-case__bgname" aria-hidden="true"><span>' + esc(p.name) + '</span></div>' +
      '<div class="pf-case__inner">' +
        '<div class="pf-case__meta">' +
          '<span class="pf-case__num">' + num + '</span>' +
          '<span class="pf-tag">' + esc(p.category) + '</span>' +
          '<span class="pf-tag pf-tag--ghost">' + typeLabel(p) + '</span>' +
        '</div>' +
        '<div class="pf-case__content"><div class="pf-case__stage">' +
          '<div class="pf-case__text">' +
            '<div class="pf-case__top"><h3 class="pf-case__name">' + esc(p.name) + '</h3></div>' +
            '<div class="pf-case__mid">' +
              '<div class="pf-case__block"><h4 class="pf-case__label">A feladat</h4><p>' + esc(p.task) + '</p></div>' +
              '<div class="pf-case__block"><h4 class="pf-case__label">A megoldás</h4><p>' + esc(p.solution) + '</p></div>' +
            '</div>' +
            '<div class="pf-case__bottom">' +
              '<ul class="pf-case__chips">' + p.chips.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
              '<button type="button" class="pf-btn pf-case__btn">Esettanulmány</button>' +
            '</div>' +
          '</div>' +
          '<div class="pf-case__media">' + windowHTML(p) + '</div>' +
        '</div></div>' +
      '</div>' +
    '</article>';
  }

  var IG_URL = 'https://www.instagram.com/webdeveloper_varbro';
  function igHTML() {
    return '<article class="pf-ig" id="pf-ig">' +
      '<div class="pf-ig__inner">' +
        '<span class="pf-ig__float"><svg class="pf-ig__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
          '<rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle>' +
          '<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle></svg></span>' +
        '<p class="pf-ig__kicker">Ez csak egy kis ízelítő</p>' +
        '<h3 class="pf-ig__title">Még több munka az Instagramon</h3>' +
        '<p class="pf-ig__handle">@webdeveloper_varbro</p>' +
        '<div class="pf-ig__cta">' +
          '<figure class="pf-ig__qr"><img src="instaqr.png" width="132" height="132" alt="Instagram QR kód" loading="lazy" decoding="async">' +
            '<figcaption>Olvassa be a kódot</figcaption></figure>' +
          /* the same pill component as the closing CTA rows (.cta-row__btn > .hbtn--primary) */
          '<div class="cta-row__btn pf-ig__btnwrap"><a class="hbtn hbtn--primary" href="' + IG_URL + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="hbtn__glow" aria-hidden="true"></span><span class="hbtn__fill" aria-hidden="true"></span><span class="hbtn__rip" aria-hidden="true"></span>' +
            '<span class="hbtn__text"><span class="hbtn__roll" data-text="Megnézem az Instagramon">Megnézem az Instagramon</span></span>' +
            '<span class="hbtn__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"></path><path d="M8 7h9v9"></path></svg></span></a></div>' +
        '</div>' +
      '</div>' +
    '</article>' +
    /* Empty space after the Instagram card: the card stays stuck while the
       reader scrolls through it (the hold). Zero height outside stacking. */
    '<div class="pf-hold" aria-hidden="true"></div>';
  }

  deck.innerHTML = data.map(caseHTML).join('') + igHTML();

  var cases = Array.prototype.slice.call(deck.querySelectorAll('.pf-case'));
  var igCard = document.getElementById('pf-ig');
  var igBtn  = igCard.querySelector('.pf-ig__btnwrap');          /* the wrapper takes the magnetic pull (the pill keeps its own hover / press transforms) */
  /* the liquid fill origin + ripple of script.js for the pill that was just rendered */
  if (window.VB && VB.bindHbtn) igCard.querySelectorAll('.hbtn').forEach(VB.bindHbtn);

  /* -------------------------------------------------------------- videos
     One video at a time: the "active" card is the one on top of the deck
     (stacking) or the most visible one (flow layout). Never in
     reduced-motion. The src is attached lazily, within a viewport of the
     card. */
  var stackOn = false;
  var activeIdx = -1;

  var vids = cases.map(function (c) {
    var win = c.querySelector('.pf-win');
    var v = c.querySelector('.pf-win__video');
    v.addEventListener('playing', function () { win.classList.add('has-video'); });
    return v;
  });

  function ensureSrc(v) {
    if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.load(); }
  }

  function setActive(i) {
    if (i === activeIdx) return;
    activeIdx = i;
    vids.forEach(function (v, k) {
      var win = v.closest('.pf-win');
      if (k === i) {
        ensureSrc(v);
        v.muted = true;
        var p = v.play();
        if (p && p.catch) p.catch(function () { /* autoplay refused: the poster stays */ });
      } else if (!v.paused) {
        v.pause();
        win.classList.remove('has-video');
      }
    });
  }

  var tick = 0;
  function updateActive() {
    tick = 0;
    if (reduce) return;
    var vh = window.innerHeight, best = -1, bestFrac = 0.5;
    cases.forEach(function (c, i) {
      var r = c.getBoundingClientRect();
      /* lazy source: only once the card is within ~1 viewport */
      if (r.top < vh * 1.2 && r.bottom > -vh * 0.2) ensureSrc(vids[i]);
      if (stackOn) {
        if (r.top <= vh * 0.5 && r.bottom > vh * 0.3) best = i;
      } else {
        var vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        var frac = vis / Math.min(r.height, vh);
        if (frac >= bestFrac) { bestFrac = frac; best = i; }
      }
    });
    setActive(best);
  }
  function scheduleActive() { if (!tick) tick = requestAnimationFrame(updateActive); }
  if (!reduce) {
    window.addEventListener('scroll', scheduleActive, { passive: true });
    window.addEventListener('resize', scheduleActive);
    updateActive();
  }

  /* ------------------------------------------------------ magnetic button */
  if (hasGsap && !reduce) {
    var qx = gsap.quickTo(igBtn, 'x', { duration: 0.4, ease: 'power3.out' });
    var qy = gsap.quickTo(igBtn, 'y', { duration: 0.4, ease: 'power3.out' });
    igBtn.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;     /* real pointer input, not a media query (touch-screen laptops) */
      var r = igBtn.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var m = Math.min(8, d);                       /* max 8px pull */
      qx(dx / d * m); qy(dy / d * m);
    });
    igBtn.addEventListener('pointerleave', function () { qx(0); qy(0); });
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
    resetOnScrollAway(igBtn, function () { qx(0); qy(0); });
  }

  /* -------------------------------------------------------- stacking + parallax */
  if (hasGsap) {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', function () {
      stackOn = true;
      scheduleActive();

      var all = cases.concat(igCard ? [igCard] : []);
      all.forEach(function (card, i) {
        var next = all[i + 1];
        if (next) {
          /* covered card: scales down and darkens while the next one slides over it */
          gsap.fromTo(card,
            { scale: 1, filter: 'brightness(1)' },
            {
              scale: 0.92, filter: 'brightness(0.55)', ease: 'none', transformOrigin: '50% 0%',
              scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 16px', scrub: true }
            });
        }
        var bg = card.querySelector('.pf-case__bgname span');
        if (bg) {
          gsap.fromTo(bg, { xPercent: 8 }, {
            xPercent: -8, ease: 'none',
            scrollTrigger: {
              trigger: card, start: 'top bottom',
              endTrigger: next || deck, end: next ? 'top 16px' : 'bottom bottom',
              scrub: true
            }
          });
        }
      });

      return function () { stackOn = false; scheduleActive(); };
    });
  }

  /* ---------------------------------------------------- entrance per card */
  var reveals = [];

  /* Built once the web fonts are in: SplitText measures lines, and splitting
     before the fonts settle would split (and mis-measure) the fallback face. */
  function setupReveals() {
    var plain = reduce;                       /* opacity-only reveals */

    cases.forEach(function (c) {
      var r = {
        meta:  c.querySelector('.pf-case__meta'),
        name:  c.querySelector('.pf-case__name'),
        paras: Array.prototype.slice.call(c.querySelectorAll('.pf-case__block')),
        chips: Array.prototype.slice.call(c.querySelectorAll('.pf-case__chips li')),
        btn:   c.querySelector('.pf-case__btn'),
        win:   c.querySelector('.pf-win'),
        lines: []
      };
      var textBits = [r.name].concat(r.paras);
      /* Line splitting only where the card has a fixed height (stacking): in
         the flow layout the split/revert reflow would shift the cards below. */
      if (hasSplit && !plain && stackOn) {
        textBits.forEach(function (el) {
          var target = el.tagName === 'DIV' ? el.querySelector('p') : el;
          var sp = SplitText.create(target, { type: 'lines', linesClass: 'pf-line' });
          r.lines = r.lines.concat(sp.lines);
          el._split = sp;
        });
        r.labels = r.paras.map(function (b) { return b.querySelector('.pf-case__label'); });
      } else {
        r.lines = textBits;
      }
      r.fade = [r.meta].concat(r.labels || []);

      if (plain) {
        gsap.set([r.meta, r.btn, r.win].concat(r.lines, r.chips), { opacity: 0 });
      } else {
        gsap.set(r.lines, { y: 30, opacity: 0 });
        gsap.set(r.fade, { y: 14, opacity: 0 });
        gsap.set(r.chips, { scale: 0.8, opacity: 0 });
        gsap.set(r.btn, { y: 14, opacity: 0 });
        gsap.set(r.win, { y: 40, rotationX: 6, opacity: 0, transformPerspective: 1200, transformOrigin: '50% 100%' });
      }

      var done = false;
      function play() {
        if (done) return;
        done = true;
        var tl = gsap.timeline({ defaults: { ease: EASE } });
        if (plain) {
          tl.to([r.meta].concat(r.lines), { opacity: 1, duration: 0.5, stagger: 0.06 })
            .to([r.win, r.btn].concat(r.chips), { opacity: 1, duration: 0.5, stagger: 0.04 }, 0.1);
          return;
        }
        tl.to(r.fade, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05 })
          .to(r.lines, {
            y: 0, opacity: 1, duration: 0.75, stagger: 0.06,
            onComplete: function () { textBits.forEach(function (el) { if (el._split) el._split.revert(); }); }
          }, 0.05)
          .to(r.chips, { scale: 1, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'back.out(1.7)' }, 0.35)
          .to(r.btn, { y: 0, opacity: 1, duration: 0.5 }, 0.5)
          .to(r.win, { y: 0, rotationX: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
                       onComplete: function () { gsap.set(r.win, { clearProps: 'transform' }); } }, 0.1);
      }

      ScrollTrigger.create({
        trigger: c, once: true,
        /* stacking: when the card has (almost) settled at the top;
           flow layout: when it is well into view */
        start: function () { return stackOn ? 'top 18%' : 'top 85%'; },
        onEnter: play,
        /* a reload restored below the card lands past the start — still reveal */
        onLeave: play
      });
    });

    /* Instagram card: its content plays once when the card settles. */
    (function () {
      var parts = [
        igCard.querySelector('.pf-ig__float'),
        igCard.querySelector('.pf-ig__kicker'),
        igCard.querySelector('.pf-ig__title'),
        igCard.querySelector('.pf-ig__handle'),
        igCard.querySelector('.pf-ig__qr'),
        igBtn
      ];
      if (plain) gsap.set(parts, { opacity: 0 });
      else gsap.set(parts, { y: 28, opacity: 0 });
      var done = false;
      function playIg() {
        if (done) return;
        done = true;
        gsap.to(parts, plain
          ? { opacity: 1, duration: 0.5, stagger: 0.08 }
          : { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09,
              onComplete: function () { gsap.set(parts, { clearProps: 'transform' }); } });
      }
      ScrollTrigger.create({
        trigger: igCard, once: true,
        start: function () { return stackOn ? 'top 30%' : 'top 85%'; },
        onEnter: playIg, onLeave: playIg
      });
    })();

    /* Section header: headline words, then eyebrow and subtitle. */
    var eyebrow = section.querySelector('.pf__eyebrow');
    var title   = section.querySelector('.section-heading');
    var sub     = section.querySelector('.pf__sub');
    var headDone = false;
    var words = null;

    function setupHead() {
      if (hasSplit && !reduce) {
        /* the heading's letters belong to js/heading-fx.js (no second split): the whole heading rises */
        words = [title];
        gsap.set(words, { y: 40, opacity: 0 });
        gsap.set([eyebrow, sub], { y: 24, opacity: 0 });
      } else {
        words = [title];
        gsap.set([eyebrow, title, sub], { opacity: 0 });
      }
      function reveal() {
        if (headDone) return;
        headDone = true;
        var t = reduce ? { opacity: 1, duration: 0.5 } : { y: 0, opacity: 1, duration: 0.8, ease: EASE };
        gsap.to([eyebrow, sub], Object.assign({ stagger: 0.1 }, t));
        gsap.to(words, Object.assign({ stagger: 0.06 }, t));
      }
      ScrollTrigger.create({
        trigger: section.querySelector('.pf__head'), start: 'top 82%', once: true,
        onEnter: reveal, onLeave: reveal
      });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupHead); else setupHead();

    /* No extra ScrollTrigger.refresh() here on purpose: card sizes are fixed by
       CSS (explicit aspect ratios), so lazy images never move anything, and
       gsap-setup.js already refreshes after window.load and the fonts. A
       refresh in the middle of a smooth anchor scroll would cancel it. */
  }

  if (hasGsap) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupReveals);
    else setupReveals();
  }

  /* ----------------------------------------------------------- dialog */
  var modal = document.getElementById('pf-modal');
  if (modal) initDialog();

  function initDialog() {
    var panel   = document.getElementById('pf-panel');
    var inner   = document.getElementById('pf-inner');
    var scrim   = modal.querySelector('.pf-modal__scrim');
    var track   = document.getElementById('pf-track');
    var titleEl = document.getElementById('pf-modal-title');
    var catEl   = document.getElementById('pf-modal-cat');
    var typeEl  = document.getElementById('pf-modal-type');
    var closeB  = document.getElementById('pf-close');
    var prevB   = document.getElementById('pf-prev');
    var nextB   = document.getElementById('pf-next');
    var counter = document.getElementById('pf-counter');
    var dots    = Array.prototype.slice.call(modal.querySelectorAll('.pf-dot'));
    var imgs    = Array.prototype.slice.call(track.querySelectorAll('img'));
    var bars    = Array.prototype.slice.call(track.querySelectorAll('.pf-win__bar'));
    var stStart = document.getElementById('pf-story-start');
    var stSol   = document.getElementById('pf-story-solution');
    var stRes   = document.getElementById('pf-story-result');
    var COUNT   = imgs.length;

    var fancy = hasFlip && !reduce;          /* Flip + 3D entrance */
    var isOpen = false, opener = null, savedY = 0, index = 0, busy = false;

    if (!fancy) modal.classList.add('pf-modal--fade');

    function shotsOf(p) { return [p.media.hero].concat(p.media.shots); }

    /* Gallery images are fetched on the first hover/focus so it opens instantly. */
    var preloaded = {};
    function preload(i) {
      if (preloaded[i]) return;
      preloaded[i] = shotsOf(data[i]).map(function (src) { var im = new Image(); im.decoding = 'async'; im.src = src; return im; });
    }
    cases.forEach(function (c, i) {
      var go = function () { preload(i); };
      c.addEventListener('pointerenter', go, { once: true });
      c.addEventListener('focusin', go, { once: true });
      c.addEventListener('pointerdown', go, { once: true, passive: true });
    });

    /* --- slides --- */
    function currentIndex() {
      var w = track.clientWidth || 1;
      return Math.max(0, Math.min(COUNT - 1, Math.round(track.scrollLeft / w)));
    }
    function paint(i) {
      index = i;
      counter.textContent = (i + 1) + ' / ' + COUNT;
      dots.forEach(function (d, k) {
        d.classList.toggle('is-active', k === i);
        if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      prevB.disabled = i === 0;
      nextB.disabled = i === COUNT - 1;
    }
    function go(i, instant) {
      i = Math.max(0, Math.min(COUNT - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: (instant || reduce) ? 'auto' : 'smooth' });
      paint(i);
    }
    track.addEventListener('scroll', function () {
      var i = currentIndex();
      if (i !== index) paint(i);
    }, { passive: true });
    prevB.addEventListener('click', function () { go(index - 1); });
    nextB.addEventListener('click', function () { go(index + 1); });
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); }); });

    /* Mouse drag-to-scroll (touch and pen use native scrolling + snap). */
    var drag = null;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 4) return;
      drag.moved = true;
      track.classList.add('is-dragging');
      track.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      track.classList.remove('is-dragging');
      if (moved) go(currentIndex());
    });

    /* --- page lock ---
       html/body overflow hidden + scrollbar-width compensation (so nothing
       jumps sideways), the rest of the page inert, scrollY restored exactly.
       Lenis (when present) is paused instead of fighting the lock. */
    var restore = [];
    var root = document.documentElement;
    function lock() {
      savedY = window.scrollY;
      root.style.setProperty('--pf-sbw', Math.max(0, window.innerWidth - root.clientWidth) + 'px');
      if (VB.lenis) VB.lenis.stop();
      root.classList.add('pf-lock');
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === modal || el.tagName === 'SCRIPT' || el.inert) return;
        el.inert = true;
        restore.push(el);
      });
    }
    function unlock() {
      restore.forEach(function (el) { el.inert = false; });
      restore = [];
      root.classList.remove('pf-lock');
      root.style.removeProperty('--pf-sbw');
      window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
      if (VB.lenis) {
        VB.lenis.scrollTo(savedY, { immediate: true, force: true });
        VB.lenis.start();
      }
    }

    /* --- fill from the data file --- */
    function fill(i) {
      var p = data[i];
      modal.style.setProperty('--accent', p.accent);
      titleEl.textContent = p.name;
      catEl.textContent = p.category;
      typeEl.textContent = typeLabel(p);
      stStart.textContent = p.caseStudy.start;
      stSol.textContent = p.caseStudy.solution;
      stRes.textContent = p.caseStudy.result;
      shotsOf(p).forEach(function (src, k) {
        imgs[k].src = src;
        imgs[k].alt = p.name + ' — ' + (k + 1) + '. kép';
        var old = bars[k].querySelector('.pf-win__addr');
        if (old) old.remove();
        if (p.addressLabel) bars[k].insertAdjacentHTML('beforeend', addrHTML(p, true));
      });
      if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
      track.scrollLeft = 0;
      modal.querySelector('.pf-modal__body').scrollTop = 0;
      paint(0);
    }

    /* --- panel <-> opener rect (Flip works on the panel's own box) --- */
    function pinPanelTo(rect) {
      var s = panel.style;
      s.inset = 'auto';
      s.top = rect.top + 'px';
      s.left = rect.left + 'px';
      s.width = rect.width + 'px';
      s.height = rect.height + 'px';
      s.borderRadius = '14px';
    }
    function releasePanel() {
      var s = panel.style;
      s.inset = ''; s.top = ''; s.left = ''; s.width = ''; s.height = ''; s.borderRadius = '';
    }

    function focusables() {
      return Array.prototype.filter.call(
        modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])'),
        function (el) { return !el.disabled && el.offsetParent !== null; }
      );
    }

    /* --- open --- */
    function open(i, from) {
      if (isOpen || busy) return;
      isOpen = true; opener = from;
      fill(i);
      lock();
      modal.hidden = false;

      if (!fancy) {
        void modal.offsetWidth;                       /* commit the fade-in start state */
        modal.classList.add('is-open');
        closeB.focus({ preventScroll: true });
        return;
      }

      busy = true;
      gsap.set(scrim, { opacity: 0 });
      gsap.set(inner, { opacity: 0, rotationX: 8, y: 24, transformPerspective: 1400 });
      pinPanelTo(from.getBoundingClientRect());
      var state = Flip.getState(panel, { props: 'borderRadius' });
      releasePanel();
      Flip.from(state, {
        duration: 0.7, ease: 'power3.inOut', scale: false, props: 'borderRadius',
        onComplete: function () { busy = false; }
      });
      gsap.to(scrim, { opacity: 1, duration: 0.5, ease: 'power2.out' });
      gsap.to(inner, {
        opacity: 1, rotationX: 0, y: 0, duration: 0.65, delay: 0.3, ease: 'power3.out',
        onComplete: function () { gsap.set(inner, { clearProps: 'transform' }); }
      });
      closeB.focus({ preventScroll: true });
    }

    /* --- close --- */
    function finishClose() {
      modal.hidden = true;
      modal.classList.remove('is-open');
      releasePanel();
      if (hasGsap) gsap.set([scrim, inner], { clearProps: 'all' });
      unlock();
      busy = false;
      if (opener) opener.focus({ preventScroll: true });
      opener = null;
    }

    function close() {
      if (!isOpen || busy) return;
      isOpen = false;

      if (!fancy) {
        modal.classList.remove('is-open');
        setTimeout(finishClose, reduce ? 0 : 300);
        return;
      }

      busy = true;
      var rect = opener.getBoundingClientRect();
      gsap.to(inner, { opacity: 0, duration: 0.25, ease: 'power2.in' });
      var state = Flip.getState(panel, { props: 'borderRadius' });
      pinPanelTo(rect);
      Flip.from(state, {
        duration: 0.6, ease: 'power3.inOut', scale: false, props: 'borderRadius',
        onComplete: finishClose
      });
      gsap.to(scrim, { opacity: 0, duration: 0.45, delay: 0.15, ease: 'power2.in' });
    }

    cases.forEach(function (c, i) {
      c.querySelector('.pf-win').addEventListener('click', function (e) { open(i, e.currentTarget); });
      c.querySelector('.pf-case__btn').addEventListener('click', function (e) { open(i, e.currentTarget); });
    });
    closeB.addEventListener('click', close);
    modal.querySelector('[data-pf-close]').addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); go(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (!modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    VB.portfolio = { open: open, close: close, isOpen: function () { return isOpen; } };
  }
})();
