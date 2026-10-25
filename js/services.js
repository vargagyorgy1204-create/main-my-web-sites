/* services.js — #services "Type Reveal": giant outline words that fill with
   the brand gradient as the row scrolls through, a section background that
   shifts between rows, and one-off entrances. Plain scrolling, no pin.

   Everything is visible by default (CSS). Initial hidden states are applied
   here only after GSAP + ScrollTrigger are confirmed, and not at all under
   prefers-reduced-motion: the section then stays a complete static one.
   No manual ScrollTrigger.refresh(): a refresh mid-scroll would cancel an
   in-flight Lenis anchor scroll; ScrollTrigger refreshes itself. */
(function () {
  'use strict';

  var VB = window.VB || {};
  var section = document.getElementById('services');
  if (!section || !VB.gsap || !VB.hasST || VB.reduceMotion) return;

  var gsap = VB.gsap;
  var EASE = 'power2.out';
  var rows = Array.prototype.slice.call(section.querySelectorAll('.svt-row'));

  function q(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }

  /* One-off staggered entrance (opacity + y <= 24px). */
  function entrance(trigger, targets, start) {
    gsap.set(targets, { opacity: 0, y: 24 });
    var done = false;
    function play() {
      if (done) return;
      done = true;
      gsap.to(targets, {
        opacity: 1, y: 0, duration: 0.7, ease: EASE, stagger: 0.08,
        onComplete: function () { gsap.set(targets, { clearProps: 'opacity,transform' }); }
      });
    }
    window.ScrollTrigger.create({
      trigger: trigger, start: start || 'top 78%', once: true,
      onEnter: play,
      /* a reload restored below the block lands past the start: still reveal */
      onLeave: play
    });
  }

  entrance(section.querySelector('.svt-intro'), q(section, '.svt-intro > *'), 'top 85%');

  rows.forEach(function (row) {
    /* Outline word -> gradient fill, left to right, scrubbed. The negative
       block insets keep accents (Á) and descenders from being clipped. */
    var fill = row.querySelector('.svt-word__fill');
    gsap.fromTo(fill,
      { clipPath: 'inset(-25% 100% -25% 0)' },
      {
        clipPath: 'inset(-25% 0% -25% 0)', ease: 'none',
        scrollTrigger: { trigger: row, start: 'top 75%', end: 'top 30%', scrub: 0.6 }
      });

  });

  /* ---- "lines that build the page": per block, the description rises line by line, then the buttons; the list's dividers draw left -> right, each row's
     number and title rise from their masks. >= 1024px it starts when the word's fill is ~30% (the fill runs 'top 75%' -> 'top 30%': 30% = 'top 61.5%'); below it
     starts when the block enters the viewport. Leaving upwards plays it in the opposite order. CSS (style.css, .svt-row.rv-prep / .rv-in) does the motion;
     here: the line masks, the per-element delays (--d-in / --d-out) and the trigger. */
  function splitLines(p) {
    var full = p.getAttribute('data-rv-text');
    if (full === null) { full = p.textContent.replace(/\s+/g, function (m) { return m === ' ' ? m : ' '; }).trim(); p.setAttribute('data-rv-text', full); }   /* only plain spaces break: a no-break space stays inside its word */
    p.textContent = '';
    var words = full.split(' '), spans = words.map(function (w, i) {
      var s = document.createElement('span'); s.textContent = w; p.appendChild(s);
      if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
      return s;
    });
    var lines = [], top = null;
    spans.forEach(function (s, i) {
      var t = Math.round(s.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
      lines[lines.length - 1].push(words[i]);
    });
    p.textContent = '';
    lines.forEach(function (ws) {
      var l = document.createElement('span'), i = document.createElement('span');
      l.className = 'rv-line'; i.className = 'rv-i'; i.textContent = ws.join(' ');
      l.appendChild(i); p.appendChild(l);
    });
    return q(p, '.rv-i');
  }
  function delays(row) {
    var items = [];                                              /* [element, in-delay] */
    var lines = q(row, '.svt-tagline .rv-i');
    lines.forEach(function (e, i) { items.push([e, i * 0.07]); });
    var a0 = lines.length * 0.07 + 0.25;
    q(row, '.svt-actions > *').forEach(function (e, j) { items.push([e, a0 + j * 0.08]); });
    items.push([row.querySelector('.svt-list'), 0.1]);
    q(row, '.svt-list li').forEach(function (li, k) {
      var line = 0.1 + 0.12 * (k + 1);
      items.push([li, line]);
      items.push([li.querySelector('.svt-list__ni'), line + 0.3]);
      items.push([li.querySelector('.svt-list__ti'), line + 0.38]);
    });
    var max = 0;
    items.forEach(function (it) { max = Math.max(max, it[1]); });
    items.forEach(function (it) {                                /* leaving: what came last goes first, a little faster */
      it[0].style.setProperty('--d-in', it[1].toFixed(2) + 's');
      it[0].style.setProperty('--d-out', ((max - it[1]) * 0.5).toFixed(2) + 's');
    });
  }
  function prepRow(row) {
    var tag = row.querySelector('.svt-tagline');
    if (tag) splitLines(tag);
    delays(row);
    row.classList.add('rv-prep');
  }
  var rvTimers = [];
  function setIn(row, i, on) {
    row.classList.add('rv-moving');                              /* the masks clip only while things travel */
    row.classList.toggle('rv-in', on);
    clearTimeout(rvTimers[i]);
    rvTimers[i] = setTimeout(function () { row.classList.remove('rv-moving'); }, 2600);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
    rows.forEach(function (row, i) {
      prepRow(row);
      window.ScrollTrigger.create({
        trigger: row, end: 'max',
        start: function () { return window.innerWidth >= 1024 ? 'top 61.5%' : 'top 85%'; },
        onEnter: function () { setIn(row, i, true); },
        onLeaveBack: function () { setIn(row, i, false); }
      });
    });
    var rt;
    window.addEventListener('resize', function () {              /* the lines depend on the width */
      clearTimeout(rt);
      rt = setTimeout(function () {
        rows.forEach(function (row) { var tag = row.querySelector('.svt-tagline'); if (tag) splitLines(tag); delays(row); });
      }, 150);
    });
  });

  /* closing row (the shared .cta-row): divider, line 1, line 2, button in order; reversed when scrolling back up */
  var cta = section.querySelector('.cta-row');
  if (cta) {
    cta.classList.add('cta-row--armed');
    window.ScrollTrigger.create({
      trigger: cta, start: 'top 90%',
      onEnter: function () { cta.classList.add('is-in'); },
      onLeaveBack: function () { cta.classList.remove('is-in'); }
    });
  }

  /* Background: graphite -> deep violet -> deep teal, one step per row. */
  var BG = { graphite: 'rgb(15, 22, 41)', violet: 'rgb(42, 15, 51)', teal: 'rgb(11, 58, 68)' };
  if (rows[1]) {
    gsap.fromTo(section, { '--svt-bg': BG.graphite }, {
      '--svt-bg': BG.violet, ease: 'none',
      scrollTrigger: { trigger: rows[1], start: 'top 85%', end: 'top 35%', scrub: true }
    });
  }
  if (rows[2]) {
    gsap.fromTo(section, { '--svt-bg': BG.violet }, {
      '--svt-bg': BG.teal, ease: 'none',
      scrollTrigger: { trigger: rows[2], start: 'top 85%', end: 'top 35%', scrub: true }
    });
  }
})();
