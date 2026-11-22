/* approach-faq.js - the FAQ of myapproach.html: native <details>/<summary> (keyboard accessible, works without JS), with a smooth height animation and
   one open item at a time. Reduced motion: no animation (instant). */
(function () {
  'use strict';
  var items = Array.prototype.slice.call(document.querySelectorAll('.ap-faq__item'));
  if (!items.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = 320, EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

  function panel(d) { return d.querySelector('.ap-faq__a'); }
  function run(d, from, to, done) {
    var p = panel(d);
    if (d._anim) d._anim.cancel();
    if (reduce || !p.animate) { done(); return; }
    var a = p.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: DUR, easing: EASE });
    d._anim = a;
    a.onfinish = a.oncancel = function () { if (d._anim === a) { d._anim = null; done(); } };
  }
  function open(d) {
    var p = panel(d), from = d.open ? p.offsetHeight : 0;
    d.open = true;
    run(d, from, p.scrollHeight, function () {});
  }
  function close(d) {
    var p = panel(d), from = p.offsetHeight;
    run(d, from, 0, function () { d.open = false; });
    if (!d._anim) d.open = false;
  }
  items.forEach(function (d) {
    d.querySelector('summary').addEventListener('click', function (e) {
      e.preventDefault();
      var isOpen = d.open && !d._closing;
      if (isOpen) { d._closing = true; close(d); setTimeout(function () { d._closing = false; }, reduce ? 0 : DUR + 20); return; }
      items.forEach(function (o) { if (o !== d && o.open) close(o); });
      open(d);
    });
  });
})();
