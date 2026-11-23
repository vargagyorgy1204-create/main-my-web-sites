/* skills-tap.js — Készségek on touch (pointer: coarse): tapping a row (or Enter / Space on the focused row) gives it the same gradient fill / odometer / wave the row gets on hover
   with a mouse (the hover CSS is also keyed on .is-active). One row at a time: another row moves it, the active row or a tap outside the list removes it.
   Mouse devices are not touched (the hover stays keyed on html.has-cursor). Reduced motion: instant (CSS). */
(function () {
  'use strict';
  var list = document.querySelector('#skills .skills-list');
  if (!list || !window.matchMedia('(pointer: coarse)').matches) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('.skill-row'));
  var active = null;
  function set(row) {
    if (active) { active.classList.remove('is-active'); active.setAttribute('aria-pressed', 'false'); }
    active = row;
    if (active) { active.classList.add('is-active'); active.setAttribute('aria-pressed', 'true'); }
  }
  rows.forEach(function (row) {
    row.setAttribute('tabindex', '0'); row.setAttribute('role', 'button'); row.setAttribute('aria-pressed', 'false');
    row.addEventListener('click', function () { set(active === row ? null : row); });
    row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(active === row ? null : row); } });
  });
  document.addEventListener('click', function (e) { if (active && !list.contains(e.target)) set(null); });
})();
