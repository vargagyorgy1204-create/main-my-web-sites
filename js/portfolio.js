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
    return '<button type="button" class="pf-win" data-cursor="view" data-cursor-label="Megnézem" aria-label="' + esc(p.name) + ' — esettanulmány megnyitása">' +
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

  /* the tags: always two rows of two (explicit rows, so the break never depends on the text length); each capsule keeps its natural width */
  function chipRows(chips) {
    var rows = '';
    for (var i = 0; i < chips.length; i += 2) {
      rows += '<ul class="pf-case__chiprow">' + chips.slice(i, i + 2).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>';
    }
    return rows;
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
              '<div class="pf-case__chips">' + chipRows(p.chips) + '</div>' +
              '<button type="button" class="pf-btn pf-case__btn">Esettanulmány</button>' +
            '</div>' +
          '</div>' +
          '<div class="pf-case__media">' + windowHTML(p) + '</div>' +
        '</div></div>' +
      '</div>' +
    '</article>';
  }

  /* ------------------------------------------------- the Instagram card (last card)
     Content: js/instagram-data.js (window.IG_DATA). Same card / grid / meta row as the project cards (.pf-case); the right column is a CSS phone mockup whose
     profile grid scrolls slowly in a loop (see "phone" below). */
  var IG = window.IG_DATA || null;
  function igHTML() {
    if (!IG || !IG.posts || !IG.posts.length) return '';
    var posts = IG.posts.slice(0, IG.posts.length - (IG.posts.length % 3 || 0) || IG.posts.length);
    function img(src, i) {
      var two = IG.retina ? src.replace(/(\.[a-z0-9]+)$/i, '@2x$1') : '';
      return '<img src="' + esc(src) + '"' + (two ? ' srcset="' + esc(src) + ' 360w, ' + esc(two) + ' 720w" sizes="120px"' : '') + ' width="360" height="360" alt="" loading="lazy" decoding="async">';
    }
    var set = '<span class="pf-phone__set">' + posts.map(img).join('') + '</span>';
    var url = esc(IG.profileUrl);
    return '<article class="pf-case pf-ig" id="pf-ig" style="--accent:#c850c0">' +
      '<div class="pf-case__bgname" aria-hidden="true"><span>Instagram</span></div>' +
      '<div class="pf-case__inner">' +
        '<div class="pf-case__meta">' +
          '<span class="pf-case__num">07</span>' +
          '<span class="pf-tag">Instagram</span>' +
        '</div>' +
        '<div class="pf-case__content"><div class="pf-case__stage">' +
          '<div class="pf-case__text">' +
            '<div class="pf-case__top"><h3 class="pf-case__name">@' + esc(IG.handle) + '</h3></div>' +
            '<div class="pf-case__mid"><div class="pf-case__block"><p>Az Instagramon megosztom az új projekteket, a munkafolyamat részleteit és a VarBro kreatív anyagait.</p></div></div>' +
            '<div class="pf-ig__bottom">' +
              '<a class="pf-btn pf-case__btn" href="' + url + '" target="_blank" rel="noopener">Megnyitom az Instagramon</a>' +
              (IG.qr ? '<figure class="pf-ig__qr"><img src="' + esc(IG.qr) + '" width="104" height="104" alt="QR-kód az Instagram-profilhoz" loading="lazy" decoding="async">' +
                '<figcaption>Vagy olvassa be a kódot a telefonjával.</figcaption></figure>' : '') +
            '</div>' +
          '</div>' +
          '<div class="pf-case__media"><div class="pf-phone-slot">' +
            '<a class="pf-phone" href="' + url + '" target="_blank" rel="noopener" data-cursor="view" data-cursor-label="Megnézem" aria-label="Instagram-profil megnyitása: @' + esc(IG.handle) + '">' +
              '<span class="pf-phone__body" aria-hidden="true"><span class="pf-phone__island"></span><span class="pf-phone__screen">' +
                '<span class="pf-phone__top">' + esc(IG.handle) + '</span>' +
                '<span class="pf-phone__head">' +
                  '<img class="pf-phone__avatar" src="' + esc(IG.avatar) + '" width="160" height="160" alt="" decoding="async">' +
                  '<span class="pf-phone__id"><b>' + esc(IG.name) + '</b>' + (IG.bio || []).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</span>' +
                '</span>' +
                '<span class="pf-phone__follow">Követés</span>' +
                '<span class="pf-phone__view"><span class="pf-phone__track">' + set + set + '</span></span>' +
              '</span></span>' +
            '</a>' +
          '</div></div>' +
        '</div></div>' +
      '</div>' +
    '</article>' +
    /* Empty space after the Instagram card: the card stays stuck while the
       reader scrolls through it (the hold). Zero height outside stacking. */
    '<div class="pf-hold" aria-hidden="true"></div>';
  }

  deck.innerHTML = data.map(caseHTML).join('') + igHTML();

  var cases = Array.prototype.slice.call(deck.querySelectorAll('.pf-case:not(.pf-ig)'));
  var igCard = document.getElementById('pf-ig');

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
    if (igCard) (function () {
      var parts = ['.pf-case__meta', '.pf-case__name', '.pf-case__block', '.pf-ig__bottom', '.pf-phone-slot']
        .map(function (s) { return igCard.querySelector(s); }).filter(Boolean);
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

    /* No extra ScrollTrigger.refresh() here on purpose: card sizes are fixed by
       CSS (explicit aspect ratios), so lazy images never move anything, and
       gsap-setup.js already refreshes after window.load and the fonts. A
       refresh in the middle of a smooth anchor scroll would cancel it. */
  }

  if (hasGsap) {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupReveals);
    else setupReveals();
  }

  /* ---- the section head: the shared .section-heading (letters rise from their masks + the dropping dot: the .fx-* rules in style.css, letters from js/heading-fx.js) and the
     lead's line-by-line reveal (.rv-*, shared with Szolgáltatások / Kapcsolat). Same trigger logic as js/services.js: they start together when the heading enters the
     viewport and play backwards when it is left downwards. No GSAP needed; not run with reduced motion (plain text there). */
  (function setupIntro() {
    var word = section.querySelector('.pf__head .section-heading'), sub = section.querySelector('.pf__sub');
    if (reduce || !('IntersectionObserver' in window)) return;
    var subOn = function () {};
    if (sub) {
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
    if (!word) return;
    var go = function () {
      var chars = Array.prototype.slice.call(word.querySelectorAll('.sh-char'));
      if (!chars.length) return;
      chars.forEach(function (ch, i) { ch.style.setProperty('--ci', i); });
      word.style.setProperty('--cn', chars.length);
      word.classList.add('fx-prep');
      var timer = 0, dot = word.querySelector('.sh-dot');
      if (dot) dot.addEventListener('animationend', function (ev) { if (ev.animationName === 'ctcDotDrop' && word.classList.contains('fx-in')) word.classList.add('fx-done'); });
      new IntersectionObserver(function (es) {
        var e = es[es.length - 1], on = e.isIntersecting;
        if (!on && !(e.boundingClientRect.top > 0)) return;
        if (on === word.classList.contains('fx-in')) return;
        if (!on) word.classList.remove('fx-done');
        word.classList.add('fx-moving');                                   /* the masks clip only while the letters travel */
        word.classList.toggle('fx-in', on);
        subOn(on);
        clearTimeout(timer);
        timer = setTimeout(function () { word.classList.remove('fx-moving'); }, 2000);
      }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' }).observe(word);
    };
    if (word.classList.contains('is-split')) go(); else word.addEventListener('vb:heading-split', go, { once: true });
  })();

  /* --------------------------------------------------- Instagram card: title fit + phone
     The handle is one long word: it shrinks (never wraps) until it fits its column. The phone's profile grid scrolls up slowly and loops seamlessly (the grid is rendered
     twice; one set height = one loop). It pauses on hover (real mouse), runs only while the card is in view and stays static with reduced motion / without GSAP. */
  if (igCard) (function () {
    var nameEl = igCard.querySelector('.pf-case__name');
    function fit() {
      nameEl.style.fontSize = '';
      var w = nameEl.clientWidth;
      if (w && nameEl.scrollWidth > w + 0.5) nameEl.style.fontSize = (parseFloat(getComputedStyle(nameEl).fontSize) * w / nameEl.scrollWidth * 0.985).toFixed(2) + 'px';
    }
    var ft = 0;
    window.addEventListener('resize', function () { clearTimeout(ft); ft = setTimeout(fit, 80); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); else fit();

    var av = igCard.querySelector('.pf-phone__avatar');
    if (av && IG.avatarFallback) av.addEventListener('error', function () { av.src = IG.avatarFallback; }, { once: true });

    var phone = igCard.querySelector('.pf-phone'), view = igCard.querySelector('.pf-phone__view'), track = igCard.querySelector('.pf-phone__track');
    if (!phone || !track || reduce || !hasGsap) return;
    var tween = null, hover = false, visible = false, rt = 0;
    function sync() { if (tween) tween.paused(hover || !visible || document.hidden); }
    function build() {
      var sets = track.querySelectorAll('.pf-phone__set');
      for (var k = sets.length - 1; k > 1; k--) sets[k].remove();                 /* back to the two rendered sets */
      if (tween) { tween.kill(); tween = null; }
      gsap.set(track, { y: 0 });
      var setH = track.querySelector('.pf-phone__set').getBoundingClientRect().height, vh = view.clientHeight;
      if (!setH || !vh) return;
      for (var n = 2; n * setH < vh + setH && n < 8; n++) track.appendChild(sets[0].cloneNode(true));   /* a short set: repeat it until the view is always covered */
      tween = gsap.to(track, { y: -setH, duration: 36, ease: 'none', repeat: -1 });
      sync();
    }
    phone.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = true; sync(); } });
    phone.addEventListener('pointerleave', function () { hover = false; sync(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; sync(); }).observe(igCard);
    else visible = true;
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build); else build();
    VB.instagram = { tween: function () { return tween; } };
  })();

  /* ----------------------------------------------------------- dialog */
  var modal = document.getElementById('pf-modal');
  if (modal) initDialog();

  function initDialog() {
    var panel   = document.getElementById('pf-panel');
    var inner   = document.getElementById('pf-inner');
    var scrim   = modal.querySelector('.pf-modal__scrim');
    var track   = document.getElementById('pf-track');
    var titleEl = document.getElementById('pf-modal-title');
    var titlesEl = modal.querySelector('.pf-modal__titles');
    var headEl  = modal.querySelector('.pf-modal__head');
    var storyEl = modal.querySelector('.pf-modal__story');
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

    /* --- header + arrow centring ---
       The title is centred on the screenshot window (the frame), the arrows on the gaps beside it: "<" between the panel's inner left edge and the frame, ">" between the frame
       and the text column. Positions come from layout (offsetLeft chains, so the Flip / entrance transforms never matter), are set as inline margin / translate and re-done on resize. */
    function relX(el) { var x = 0; while (el && el !== panel) { x += el.offsetLeft; el = el.offsetParent; } return x; }
    function layoutHead() {
      if (modal.hidden) return;
      var win = track.querySelector('.pf-win');
      if (!win) return;
      var fw = win.offsetWidth, tl = relX(track), cx = tl + track.offsetWidth / 2;
      var fl = cx - fw / 2, fr = cx + fw / 2;
      /* title: a box centred on cx, as wide as the room between the head padding and the close button allows (never under the X); the text is centred in it */
      var hs = getComputedStyle(headEl), padL = parseFloat(hs.paddingLeft) || 0;
      var xl = relX(closeB) + 6;                                     /* the visible 44px button: the 56px hit area has a -6px margin */
      var half = Math.min(cx - padL, xl - 16 - cx);                   /* 16 = the head gap: the box never pushes the X */
      titlesEl.style.width = Math.max(80, 2 * half) + 'px';
      titlesEl.style.marginInlineStart = (cx - Math.max(40, half) - padL) + 'px';
      /* a single long word (phones: "Kitakarítunk") that is wider than the room beside the X cannot wrap: its size shrinks just enough to fit */
      titleEl.style.fontSize = '';
      if (titleEl.scrollWidth > titlesEl.clientWidth + 0.5) titleEl.style.fontSize = (parseFloat(getComputedStyle(titleEl).fontSize) * titlesEl.clientWidth / titleEl.scrollWidth * 0.97).toFixed(2) + 'px';
      /* arrows (two-column dialog only: they are hidden below 1024px) */
      [[prevB, 0, fl], [nextB, fr, relX(storyEl)]].forEach(function (a) {
        var b = a[0];
        b.style.translate = '';
        if (!b.offsetWidth) return;
        var want = (a[1] + a[2]) / 2, have = relX(b) + b.offsetWidth / 2;
        b.style.translate = (want - have).toFixed(2) + 'px 0';
      });
    }
    window.addEventListener('resize', layoutHead);

    /* --- open --- */
    function open(i, from) {
      if (isOpen || busy) return;
      isOpen = true; opener = from;
      fill(i);
      lock();
      modal.hidden = false;

      if (!fancy) {
        layoutHead();
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
      layoutHead();
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
