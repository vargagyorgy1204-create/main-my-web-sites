// Custom cursor: dot + morphing ring (fine pointers only, respects reduced motion)
(function () {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var LINK = 'a, button, [role="button"], label, summary, select, .hero-chip, .skills-dot';
    var MAGNETIC = '.hbtn, .nav-cta, .modal-quote-btn, .stamp, nav ul li a, .service-modal-trigger, .btn-portfolio-ig, .btn-about';
    var VIEW = '.qr-card, .about-photo-card, .bento-showcase-card, [data-cursor="view"]';
    var TEXT = 'p, h1, h2, h3, h4, li, blockquote';
    var FIELD = 'input, textarea, [contenteditable="true"]';
    var DARK = '#skills, #steps, #services, #portfolio, footer, .hero-ticker, [data-cursor-theme="dark"]';

    var root = document.documentElement;
    root.classList.add('has-cursor');

    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    var label = document.createElement('span');
    label.className = 'cursor-label';
    ring.appendChild(label);
    [ring, dot].forEach(function (el) {
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
    });

    var mx = -100, my = -100, rx = -100, ry = -100;
    var running = false;
    var magnet = null;

    function loop() {
        var tx = mx, ty = my;
        if (magnet) {
            var r = magnet.getBoundingClientRect();
            tx = r.left + r.width / 2 + (mx - (r.left + r.width / 2)) * 0.25;
            ty = r.top + r.height / 2 + (my - (r.top + r.height / 2)) * 0.25;
        }
        rx += (tx - rx) * 0.2;
        ry += (ty - ry) * 0.2;
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        if (Math.abs(tx - rx) > 0.1 || Math.abs(ty - ry) > 0.1 || magnet) {
            requestAnimationFrame(loop);
        } else {
            running = false;
        }
    }

    function kick() {
        if (!running) {
            running = true;
            requestAnimationFrame(loop);
        }
    }

    function releaseMagnet() {
        if (magnet) {
            magnet.style.translate = '';
            magnet = null;
        }
    }

    document.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        root.classList.remove('cursor-hidden');
        if (magnet) {
            var r = magnet.getBoundingClientRect();
            var dx = (mx - (r.left + r.width / 2)) / (r.width / 2);
            var dy = (my - (r.top + r.height / 2)) / (r.height / 2);
            magnet.style.translate = (dx * 8).toFixed(2) + 'px ' + (dy * 6).toFixed(2) + 'px';
        }
        kick();
    }, { passive: true });

    function setState(target) {
        var t = target instanceof Element ? target : null;
        ring.classList.remove('is-link', 'is-view', 'is-text', 'is-magnetic');
        root.classList.remove('cursor-on-field');
        label.textContent = '';
        if (!t) return;

        root.classList.toggle('cursor-dark', !!t.closest(DARK));

        if (t.closest(FIELD)) {
            root.classList.add('cursor-on-field');
            return;
        }
        var view = t.closest(VIEW);
        var link = t.closest(LINK);
        if (view && (!link || view.contains(link) === false || link === view)) {
            ring.classList.add('is-view');
            label.textContent = view.getAttribute('data-cursor-label') || 'Nézd';
        }
        if (link) {
            ring.classList.remove('is-view');
            label.textContent = '';
            ring.classList.add('is-link');
            var mag = t.closest(MAGNETIC);
            if (mag !== magnet) {
                releaseMagnet();
                if (mag) {
                    magnet = mag;
                    ring.classList.add('is-magnetic');
                }
            } else if (mag) {
                ring.classList.add('is-magnetic');
            }
            return;
        }
        releaseMagnet();
        if (!view && t.closest(TEXT)) ring.classList.add('is-text');
    }

    document.addEventListener('pointerover', function (e) {
        setState(e.target);
        kick();
    });

    document.addEventListener('pointerdown', function () { root.classList.add('cursor-press'); });
    document.addEventListener('pointerup', function () { root.classList.remove('cursor-press'); });

    document.documentElement.addEventListener('pointerleave', function () {
        root.classList.add('cursor-hidden');
        releaseMagnet();
    });

    window.addEventListener('scroll', function () {
        var el = document.elementFromPoint(mx, my);
        if (el) setState(el);
    }, { passive: true });
})();
