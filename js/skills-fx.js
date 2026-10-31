/* skills-fx.js — Készségek & Technológia: heading reveal (the Szolgáltatások letter-rise + dropping dot, shared .fx-* CSS) and the scroll build of the list.
   Each row builds top -> bottom as it enters the viewport and un-builds when it is scrolled back below it: the divider draws (scaleX), the number rises from its mask,
   the logo tile pops, the name rises letter by letter, the description rises line by line. All motion is CSS (transform / opacity, zero layout shift): this script
   only prepares the DOM (masks, odometer copy, lines) and toggles .sk-in / .sk-done per row. The row hover (odometer, letter wave, description shift) is CSS keyed on
   html.has-cursor. Not run with reduced motion: the list stays as the plain, fully visible markup. */
(function () {
  'use strict';

  var section = document.getElementById('skills');
  var list = section && section.querySelector('.skills-list');
  if (!section || !list || !('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var rows = Array.prototype.slice.call(list.querySelectorAll('.skill-row'));

  /* ------------------------------------------------------------ heading: the shared reveal */
  (function () {
    var h = section.querySelector('.section-heading');
    if (!h) return;
    var go = function () {
      var chars = h._shChars || Array.prototype.slice.call(h.querySelectorAll('.sh-char'));
      if (!chars.length) return;
      chars.forEach(function (ch, i) { ch.style.setProperty('--ci', i); });
      h.style.setProperty('--cn', chars.length);
      h.classList.add('fx-prep');
      var timer = 0, dot = h.querySelector('.sh-dot');
      if (dot) dot.addEventListener('animationend', function (ev) { if (ev.animationName === 'ctcDotDrop' && h.classList.contains('fx-in')) h.classList.add('fx-done'); });
      new IntersectionObserver(function (es) {
        var e = es[es.length - 1], on = e.isIntersecting;
        if (!on && !(e.boundingClientRect.top > 0)) return;
        if (on === h.classList.contains('fx-in')) return;
        if (!on) h.classList.remove('fx-done');
        h.classList.add('fx-moving'); h.classList.toggle('fx-in', on);
        clearTimeout(timer); timer = setTimeout(function () { h.classList.remove('fx-moving'); }, 2000);
      }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' }).observe(h);
    };
    if (h.classList.contains('is-split')) go(); else h.addEventListener('vb:heading-split', go, { once: true });
  })();

  /* ------------------------------------------------------------ list: prepare the rows */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function prepNum(row) {
    var n = row.querySelector('.skill-row__num');
    if (!n || n.querySelector('.sk-n')) return;
    var t = n.textContent.trim();
    n.textContent = '';
    n.setAttribute('aria-label', t);
    var a = el('span', 'sk-n', t), b = el('span', 'sk-n sk-n2', t);
    a.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-hidden', 'true');
    n.appendChild(a); n.appendChild(b);                                 /* odometer: the second copy (white) rolls in on hover */
  }

  function prepName(row) {
    var h = row.querySelector('.skill-row__name');
    if (!h || h.querySelector('.sk-lm')) return;
    var t = h.textContent.trim(), i = 0;
    h.setAttribute('aria-label', t);
    h.textContent = '';
    t.split(' ').forEach(function (w, wi, all) {
      var word = el('span', 'sk-w');
      word.setAttribute('aria-hidden', 'true');
      Array.from(w).forEach(function (c) {
        var m = el('span', 'sk-lm'), c1 = el('span', 'sk-lc', c);
        c1.style.setProperty('--ci', i++);
        m.appendChild(c1); word.appendChild(m);
      });
      h.appendChild(word);
      if (wi < all.length - 1) h.appendChild(document.createTextNode(' '));
    });
  }

  function splitDesc(row) {
    var p = row.querySelector('.skill-row__desc');
    if (!p) return;
    var src = p.getAttribute('data-sk-html');
    if (src === null) { src = p.innerHTML; p.setAttribute('data-sk-html', src); p.setAttribute('aria-label', p.textContent.replace(/\s+/g, ' ').trim()); }
    p.textContent = '';
    var li = 0;
    src.split(/<br\s*\/?>/i).forEach(function (seg) {
      var words = seg.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().split(' ');
      var probe = el('span');                                            /* measure where the words wrap, then rebuild as one block per line */
      probe.style.display = 'block';
      p.appendChild(probe);
      var spans = words.map(function (w, i) { var s = el('span', null, w); probe.appendChild(s); if (i < words.length - 1) probe.appendChild(document.createTextNode(' ')); return s; });
      var lines = [], top = null;
      spans.forEach(function (s, i) {
        var t = Math.round(s.getBoundingClientRect().top);
        if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
        lines[lines.length - 1].push(words[i]);
      });
      p.removeChild(probe);
      lines.forEach(function (ws) {
        var l = el('span', 'sk-ln'), x = el('span', 'sk-li', ws.join(' '));
        l.setAttribute('aria-hidden', 'true');
        x.style.setProperty('--li', li++);
        l.appendChild(x); p.appendChild(l);
      });
    });
  }

  /* ------------------------------------------------------------ build / un-build */
  function observe() {
    var timers = new Map();
    var io = new IntersectionObserver(function (es) {
      var k = 0;
      es.sort(function (a, b) { return rows.indexOf(a.target) - rows.indexOf(b.target); }).forEach(function (e) {
        var row = e.target, on = e.isIntersecting || e.boundingClientRect.top < 0;
        if (!on && !(e.boundingClientRect.top > 0)) return;
        if (on === row.classList.contains('sk-in')) return;
        clearTimeout(timers.get(row));
        if (on) {
          row.style.setProperty('--rd', (k * 0.08).toFixed(2) + 's');         /* rows that enter together build 0.08s apart */
          row.classList.add('sk-in');
          timers.set(row, setTimeout(function () { row.classList.add('sk-done'); }, 1900 + k * 80));
          k++;
        } else {
          row.classList.remove('sk-done', 'sk-in');
          row.style.removeProperty('--rd');
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
    rows.forEach(function (r) { io.observe(r); });
  }

  function prep() {
    rows.forEach(function (row) { prepNum(row); prepName(row); splitDesc(row); });
    list.classList.add('sk-prep');
    var rt;
    window.addEventListener('resize', function () {                        /* the description lines depend on the width */
      clearTimeout(rt);
      rt = setTimeout(function () { rows.forEach(splitDesc); }, 150);
    });
    observe();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(prep); else prep();
})();
