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

    entrance(row, q(row, '.svt-label, .svt-tagline, .svt-actions, .svt-list li'), 'top 70%');
  });

  var close = section.querySelector('.svt-close');
  if (close) entrance(close, q(close, '.svt-close__title, .svt-close__text, .svt-btn'), 'top 80%');

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
