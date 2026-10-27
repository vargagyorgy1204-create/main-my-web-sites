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
  /* ---- the focus-row hover (>= 1024px): .is-hot on the <li> for a real pointer and for keyboard focus-visible; .has-hot on the list dims the others.
     No GSAP needed: style.css does every effect (band, odometer, wave, teaser, arrow). Here: the state, the title letters (split only while hot, so the
     rest state keeps its kerning) and the arrow's stroke setup. Touch: nothing. */
  var hotMq = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : { matches: false };
  function hotLists() { return Array.prototype.slice.call(document.querySelectorAll('#services .svt-list')); }
  function splitTitle(li) {
    var tt = li.querySelector('.svt-list__tt');
    if (!tt || tt.getAttribute('data-split')) return;
    var text = tt.textContent, ci = 0;
    tt.setAttribute('data-t', text); tt.setAttribute('data-split', '1'); tt.textContent = '';
    text.split(' ').forEach(function (w, wi) {
      if (wi) tt.appendChild(document.createTextNode(' '));
      var ws = document.createElement('span'); ws.className = 'wv-w';
      for (var k = 0; k < w.length; k++) {
        var c = document.createElement('span'); c.className = 'wv-c'; c.textContent = w.charAt(k); c.style.setProperty('--ci', ci++); ws.appendChild(c);
      }
      tt.appendChild(ws);
    });
  }
  function joinTitle(li) {
    var tt = li.querySelector('.svt-list__tt');
    if (!tt || !tt.getAttribute('data-split')) return;
    tt.textContent = tt.getAttribute('data-t'); tt.removeAttribute('data-split');
  }
  function heat(li, on) {
    var list = li.parentNode;
    clearTimeout(li._joinT);
    if (on) {
      if (!hotMq.matches) return;
      splitTitle(li);
      list.classList.add('has-hot'); li.classList.add('is-hot');
    } else {
      li.classList.remove('is-hot');
      if (!list.querySelector('li.is-hot')) list.classList.remove('has-hot');
      li._joinT = setTimeout(function () { if (!li.classList.contains('is-hot')) joinTitle(li); }, 900);
    }
  }
  function setupHot() {
    var lx = -1, ly = -1;
    hotLists().forEach(function (list) {
      Array.prototype.slice.call(list.querySelectorAll('li')).forEach(function (li) {
        var row = li.querySelector('.svt-list__row');
        if (!row) return;
        var go = li.querySelector('.svt-list__go');
        if (go && !go.getAttribute('data-draw')) {              /* the Lucide arrow: both strokes get pathLength 1 so the dash can draw them */
          var ps = go.querySelectorAll('path');
          if (ps.length) { Array.prototype.forEach.call(ps, function (p) { p.setAttribute('pathLength', '1'); }); go.setAttribute('data-draw', ''); }
        }
        row.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') heat(li, true); });
        row.addEventListener('pointerleave', function () { heat(li, false); });
        row.addEventListener('focus', function () { try { if (row.matches(':focus-visible')) heat(li, true); } catch (err) { /* ignore */ } });
        row.addEventListener('blur', function () { heat(li, false); });
      });
    });
    /* smooth / wheel scrolling moves rows under a resting mouse without pointer events: re-test on scroll */
    document.addEventListener('pointermove', function (e) { lx = e.clientX; ly = e.clientY; }, { passive: true });
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick || lx < 0) return; tick = true;
      requestAnimationFrame(function () {
        tick = false;
        var u = document.elementFromPoint(lx, ly);
        Array.prototype.slice.call(document.querySelectorAll('#services li.is-hot')).forEach(function (li) {
          if (!u || !li.contains(u)) { var r = li.querySelector('.svt-list__row'); if (!(r && r === document.activeElement && r.matches(':focus-visible'))) heat(li, false); }
        });
      });
    }, { passive: true });
    if (hotMq.addEventListener) hotMq.addEventListener('change', function () { if (!hotMq.matches) Array.prototype.slice.call(document.querySelectorAll('#services li.is-hot')).forEach(function (li) { heat(li, false); }); });
  }
  if (section) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupHot); else setupHot();
  }


  /* ---- the head sentence: the lines rise from masks, then the keywords fill (left -> right, 0.15s apart); the keywords scroll to their block (Lenis, header offset);
     a vertical mini-index in the corridor's left margin (>= 1024px) shows which block is in view. No GSAP needed. */
  function scrollToBlock(n) {
    var word = section.querySelector('.svt-row[data-row="' + n + '"] .svt-word');
    if (!word) return;
    var hdr = window.innerWidth < 768 ? 76 : 92;                  /* the giant word lands 24px under the header */
    if (window.VB && VB.lenis) VB.lenis.scrollTo(word, { offset: -(hdr + 24) });
    else window.scrollTo({ top: word.getBoundingClientRect().top + window.scrollY - hdr - 24, behavior: 'smooth' });
  }
  function setupSentence() {
    var reduceMo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var sub = section.querySelector('.svt-sub');
    section.addEventListener('click', function (e) {              /* delegated: the sentence is rebuilt when its lines are measured again */
      var b = e.target.closest ? e.target.closest('.svt-kw, .svt-index__i') : null;
      if (b) scrollToBlock(parseInt(b.getAttribute('data-kw'), 10));
    });
    /* ---- the mini-index ---- */
    var index = section.querySelector('.svt-index'), rowsEl = Array.prototype.slice.call(section.querySelectorAll('.svt-row'));
    if (index && sub && rowsEl.length) {
      var items = Array.prototype.slice.call(index.querySelectorAll('.svt-index__i')), tick = false, wide = window.matchMedia('(min-width: 1024px)');
      var update = function () {
        tick = false;
        if (!wide.matches) { index.classList.remove('is-show'); return; }
        var vh = window.innerHeight, hdr = 92;
        var subB = sub.getBoundingClientRect().bottom, lastB = rowsEl[rowsEl.length - 1].getBoundingClientRect().bottom;
        index.classList.toggle('is-show', subB < hdr + 24 && lastB > vh * 0.4);       /* in when the sentence has left, out after the last block */
        var on = -1;
        rowsEl.forEach(function (r, i) { var b = r.getBoundingClientRect(); if (b.top < vh * 0.5 && b.bottom > vh * 0.5) on = i; });
        if (on < 0 && rowsEl[0].getBoundingClientRect().top > vh * 0.5) on = 0;
        items.forEach(function (it, i) { it.classList.toggle('is-on', i === on); });
      };
      var req = function () { if (!tick) { tick = true; requestAnimationFrame(update); } };
      window.addEventListener('scroll', req, { passive: true }); window.addEventListener('resize', req); update();
    }
    if (!sub || reduceMo || !('IntersectionObserver' in window)) return;
    /* ---- the line reveal: the words and the keyword groups are the tokens; a line = a run of tokens, wrapped in a mask ---- */
    var orig = sub.innerHTML, subTimer = 0, kwTimer = 0;
    var splitSub = function () {
      sub.innerHTML = orig;
      Array.prototype.slice.call(sub.childNodes).forEach(function (n) {
        if (n.nodeType !== 3) return;
        var parts = n.data.split(/( +)/), frag = document.createDocumentFragment();
        parts.forEach(function (t) {
          if (!t) return;
          if (/^ +$/.test(t)) frag.appendChild(document.createTextNode(' '));
          else { var s = document.createElement('span'); s.className = 'svt-t'; s.textContent = t; frag.appendChild(s); }
        });
        sub.replaceChild(frag, n);
      });
      var toks = Array.prototype.slice.call(sub.children), lines = [], top = null;
      toks.forEach(function (t) {
        var y = Math.round(t.getBoundingClientRect().top);
        if (top === null || Math.abs(y - top) > 3) { lines.push([]); top = y; }
        lines[lines.length - 1].push(t);
      });
      var made = lines.map(function (ts, k) {
        var l = document.createElement('span'), i = document.createElement('span');
        l.className = 'rv-line'; i.className = 'rv-i'; l.style.setProperty('--ri', k); l.appendChild(i);
        ts.forEach(function (t, j) { if (j) i.appendChild(document.createTextNode(' ')); i.appendChild(t); });
        return l;
      });
      sub.textContent = '';
      made.forEach(function (l) { sub.appendChild(l); });
      sub.style.setProperty('--rn', made.length);
    };
    var setOn = function (on) {
      if (!sub.classList.contains('rv-prep')) return;
      sub.classList.add('rv-moving');
      clearTimeout(kwTimer); clearTimeout(subTimer);
      if (on) { sub.classList.add('rv-in'); kwTimer = setTimeout(function () { sub.classList.add('kw-in'); }, 650); }
      else { sub.classList.remove('kw-in'); sub.classList.remove('rv-in'); }
      subTimer = setTimeout(function () { sub.classList.remove('rv-moving'); }, 2600);
    };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () {
      splitSub(); sub.classList.add('rv-prep');
      new IntersectionObserver(function (es) {
        var e = es[es.length - 1], on = e.isIntersecting;
        if (!on && !(e.boundingClientRect.top > 0)) return;
        if (on === sub.classList.contains('rv-in')) return;
        setOn(on);
      }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' }).observe(sub);
      var rt;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { var was = sub.classList.contains('rv-in'); splitSub(); if (was) sub.classList.add('rv-in'); }, 150); });
    });
  }
  if (section) setupSentence();

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

  entrance(section.querySelector('.svt-intro'), q(section, '.svt-intro > .svt-eyebrow'), 'top 85%');           /* the sentence has its own reveal (setupSentence) */

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
