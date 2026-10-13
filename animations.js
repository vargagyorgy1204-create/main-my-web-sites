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

    // About: handled by js/about-story.js

    // Skills
    var skillsHead = document.querySelector('#skills .skills-head');
    if (skillsHead) {
        Array.from(skillsHead.children).forEach(function (c, i) { add(c, null, i * 80); });
    }
    document.querySelectorAll('#skills .skills-list > li').forEach(function (c, i) { add(c, null, i * 70); });

    // Why
    var whyEl = document.querySelector('#why');
    if (whyEl) {
        var whyHead = whyEl.querySelector('.why-head');
        if (whyHead) Array.from(whyHead.children).forEach(function (c, i) { add(c, null, i * 80); });
        whyEl.querySelectorAll('.why-panel').forEach(function (c, i) { add(c, null, i * 80); });
    }

    // Steps
    var stepsHead = document.querySelector('#steps .steps-head');
    if (stepsHead) {
        Array.from(stepsHead.children).forEach(function (c, i) { add(c, null, i * 80); });
    }

    // Testimonial
    var showcaseEl = document.querySelector('#bento-showcase');
    if (showcaseEl) {
        add(showcaseEl.querySelector('h2'),         null,    0);
        add(showcaseEl.querySelector('.bento-card'),'scale', 100);
    }

    // Portfolio: reveals are handled by js/portfolio.js (no AOS / animations.js here)

    // Contact
    // Contact: entrance handled by js/contact-footer.js

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
})();
