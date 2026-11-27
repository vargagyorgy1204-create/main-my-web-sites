/* skills-tap.js — Készségek on touch (pointer: coarse): tapping a row (or Enter / Space on the focused row) gives it the same gradient fill / odometer / wave the row gets on hover
   with a mouse (the hover CSS is also keyed on .is-active). The control is a real <button> laid over the row (keyboard / screen readers). One row at a time: another row moves it, the active row or a tap outside the list removes it.
   Mouse devices are not touched (the hover stays keyed on html.has-cursor). Reduced motion: instant (CSS). */
(function () {
  'use strict';
  var list = document.querySelector('#skills .skills-list');
  if (!list || !window.matchMedia('(pointer: coarse)').matches) return;
  var rows = Array.prototype.slice.call(list.querySelectorAll('.skill-row'));
  var active = null;
  function press(row, on) { var b = row.querySelector('.skill-row__tap'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function set(row) {
    if (active) { active.classList.remove('is-active'); press(active, false); }
    active = row;
    if (active) { active.classList.add('is-active'); press(active, true); }
  }
  rows.forEach(function (row) {
    var b = document.createElement('button'), name = row.querySelector('.skill-row__name');
    b.type = 'button'; b.className = 'skill-row__tap'; b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', name ? name.textContent.trim() : 'Készség');
    row.appendChild(b);
    row.addEventListener('click', function () { set(active === row ? null : row); });          /* the button's clicks (and Enter / Space) arrive here */
  });
  document.addEventListener('click', function (e) { if (active && !list.contains(e.target)) set(null); });
})();
