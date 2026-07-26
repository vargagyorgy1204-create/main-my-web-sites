(function () {
    if (!window.IntersectionObserver) return;

    var T = 'opacity 1s cubic-bezier(0.16,1,0.3,1),transform 1s cubic-bezier(0.16,1,0.3,1)';

    function prep(el, variant, delayMs) {
        if (!el) return null;
        el._origTransition = el.style.transition;
        el.style.transition = T;
        el.style.opacity = '0';
        if (delayMs) el.style.transitionDelay = delayMs + 'ms';
        if (variant === 'left')  el.style.transform = 'translateX(-36px)';
        else if (variant === 'right') el.style.transform = 'translateX(36px)';
        else if (variant === 'scale') el.style.transform = 'scale(0.92)';
        else el.style.transform = 'translateY(28px)';
        return el;
    }

    var toObserve = [];

    function add(el, variant, delayMs) {
        var e = prep(el, variant, delayMs);
        if (e) toObserve.push(e);
    }

    // Hero
    add(document.querySelector('.eyebrow'),    null,    0);
    add(document.querySelector('.headline'),   null,  100);
    add(document.querySelector('.subtitle'),   null,  200);
    add(document.querySelector('.hero-desc'),  null,  300);
    add(document.querySelector('.cta-button'), null,  400);
    add(document.querySelector('.tech-zone'),  'scale', 300);

    // About
    add(document.querySelector('.about-photo-card'), 'left', 0);
    var bioCard = document.querySelector('.about-bio-card');
    if (bioCard) {
        prep(bioCard, 'right', 100);
        toObserve.push(bioCard);
        bioCard.addEventListener('transitionend', function onDone(e) {
            if (e.propertyName !== 'opacity' || e.target !== bioCard) return;
            bioCard.removeEventListener('transitionend', onDone);
            countUp();
        });
    }

    // Skills
    var skillsWrap = document.querySelector('#skills > div');
    if (skillsWrap) {
        add(skillsWrap.querySelector('h2'), null, 0);
        add(skillsWrap.querySelector('p'),  null, 80);
        var skillGrid = skillsWrap.querySelector('div[style*="grid-template-columns"]');
        if (skillGrid) {
            Array.from(skillGrid.children).forEach(function (c, i) { add(c, null, i * 80); });
        }
    }

    // Why
    var whyEl = document.querySelector('#why');
    if (whyEl) {
        add(whyEl.querySelector('h2'), null, 0);
        whyEl.querySelectorAll('.bento-card').forEach(function (c, i) { add(c, null, i * 80); });
    }

    // Steps
    var stepsWrap = document.querySelector('#steps > div');
    if (stepsWrap) {
        add(stepsWrap.querySelector('h2'), null, 0);
        add(stepsWrap.querySelector('p'),  null, 80);
        var stepGrid = stepsWrap.querySelector('div[style*="grid-template-columns"]');
        if (stepGrid) {
            Array.from(stepGrid.children).forEach(function (c, i) { add(c, null, i * 90); });
        }
    }

    // Testimonial
    var showcaseEl = document.querySelector('#bento-showcase');
    if (showcaseEl) {
        add(showcaseEl.querySelector('h2'),         null,    0);
        add(showcaseEl.querySelector('.bento-card'),'scale', 100);
    }

    // Services
    var servicesWrap = document.querySelector('#services > div');
    if (servicesWrap) {
        add(servicesWrap.querySelector('h2'), null, 0);
        add(servicesWrap.querySelector('p'),  null, 80);
        var servGrid = servicesWrap.querySelector('div[style*="grid-template-columns"]');
        if (servGrid) {
            Array.from(servGrid.children).forEach(function (c, i) { add(c, null, i * 80); });
        }
    }

    // Portfolio
    add(document.querySelector('.portfolio-title'),       null,    0);
    add(document.querySelector('.portfolio-subtitle'),    null,   80);
    add(document.querySelector('.portfolio-qr-col'),      'left',  0);
    add(document.querySelector('.portfolio-content-col'), 'right', 100);

    // Contact
    add(document.querySelector('#contact h2'),             null,    0);
    add(document.querySelector('#contact .section-subtitle'), null, 80);
    add(document.querySelector('.contact-form-panel'),    'left',  0);
    add(document.querySelector('.contact-personal-panel'),'right', 100);

    // Footer
    document.querySelectorAll('.footer-section').forEach(function (s, i) { add(s, null, i * 100); });

    // Observer
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            var d = parseFloat(el.style.transitionDelay || '0');
            el.style.opacity = '1';
            el.style.transform = 'none';
            observer.unobserve(el);
            setTimeout(function () {
                el.style.opacity = '';
                el.style.transform = '';
                el.style.transitionDelay = '';
                el.style.transition = el._origTransition || '';
            }, d + 1100);
        });
    }, { threshold: 0.15 });

    // Double rAF ensures opacity:0 is painted before observing begins
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            toObserve.forEach(function (el) { if (el) observer.observe(el); });
        });
    });

    // Count-up for about stat numbers (triggered when bio card finishes animating in)
    function countUp() {
        document.querySelectorAll('.about-stat-num').forEach(function (el) {
            var raw = el.textContent.trim();
            var m = raw.match(/^(\d+)/);
            if (!m) return;
            var target = parseInt(m[1], 10);
            var suffix = raw.slice(m[1].length);
            var t0 = null;
            var dur = 1200;
            function step(ts) {
                if (!t0) t0 = ts;
                var p = Math.min((ts - t0) / dur, 1);
                var eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(eased * target) + suffix;
                if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        });
    }
})();
