// Header: logo theme flip + fullscreen hamburger menu (vanilla JS, no libraries)
(function () {
    var nav = document.getElementById('nav');
    var burger = document.getElementById('burger');
    var menu = document.getElementById('menu');
    if (!nav || !burger || !menu) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var logo = nav.querySelector('.nav__logo');
    var menuLinks = Array.prototype.slice.call(menu.querySelectorAll('.menu__link, .menu__cta'));
    var root = document.documentElement;
    var menuOpen = false;
    var inerted = [];

    /* ---------- Logo guard: text "Vb" fallback if the PNGs fail to load ---------- */
    (function guardLogo() {
        if (!logo) return;
        var imgs = Array.prototype.slice.call(logo.querySelectorAll('.nav__logo-img'));
        var warned = false;
        function markMissing() {
            if (warned) return;
            warned = true;
            logo.classList.add('is-missing');
            if (window.console) console.warn('[VarBro] Logo image missing - falling back to a text "Vb" mark.');
        }
        imgs.forEach(function (img) {
            img.addEventListener('error', markMissing);
            if (img.complete && img.naturalWidth === 0) markMissing();
        });
    })();

    /* ---------- Theme flip: logo + burger follow the section under the header ---------- */
    var themed = Array.prototype.slice.call(document.querySelectorAll('[data-theme]'));
    var ticking = false;

    function applyTheme() {
        ticking = false;
        if (!themed.length) return;
        var lr = (logo || nav).getBoundingClientRect();
        var y = lr.top + lr.height / 2;
        var theme = null;
        for (var i = 0; i < themed.length; i++) {
            var r = themed[i].getBoundingClientRect();
            if (r.top <= y && r.bottom > y) theme = themed[i].getAttribute('data-theme');
        }
        if (theme === null) theme = themed[themed.length - 1].getBoundingClientRect().bottom <= y
            ? themed[themed.length - 1].getAttribute('data-theme')
            : themed[0].getAttribute('data-theme');
        nav.classList.toggle('nav--on-light', theme === 'light');
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(applyTheme);
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', function () { applyTheme(); setTimeout(applyTheme, 300); });
    window.addEventListener('pageshow', applyTheme);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyTheme);
    applyTheme();

    /* ---------- Fullscreen menu ---------- */
    function lockPage() {
        var sbw = window.innerWidth - root.clientWidth;
        root.style.setProperty('--sbw', sbw > 0 ? sbw + 'px' : '0px');
        document.body.classList.add('menu-open');
        if (window.VB && VB.lenis) VB.lenis.stop();   /* measured above, before Lenis hides the scrollbar */
        Array.prototype.slice.call(document.body.children).forEach(function (el) {
            if (el === nav || el === menu || el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') return;
            if (el.classList.contains('cursor-ring') || el.classList.contains('cursor-dot')) return;
            if (!el.inert) {
                el.inert = true;
                inerted.push(el);
            }
        });
    }

    function unlockPage() {
        document.body.classList.remove('menu-open');
        root.style.removeProperty('--sbw');
        if (window.VB && VB.lenis) VB.lenis.start();
        inerted.forEach(function (el) { el.inert = false; });
        inerted = [];
    }

    function openMenu() {
        if (menuOpen) return;
        menuOpen = true;
        menu.inert = false;
        menu.classList.add('is-open');
        nav.classList.add('nav--menu-open');
        burger.classList.add('is-open');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Menü bezárása');
        lockPage();
        if (menuLinks[0]) menuLinks[0].focus({ preventScroll: true });
    }

    function closeMenu(returnFocus) {
        if (!menuOpen) return;
        menuOpen = false;
        menu.classList.remove('is-open');
        nav.classList.remove('nav--menu-open');
        burger.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Menü megnyitása');
        unlockPage();
        menu.inert = true;
        if (returnFocus !== false) burger.focus({ preventScroll: true });
        applyTheme();
    }

    burger.addEventListener('click', function () {
        if (menuOpen) closeMenu(); else openMenu();
    });

    document.addEventListener('keydown', function (e) {
        if (!menuOpen) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeMenu();
            return;
        }
        if (e.key !== 'Tab') return;
        var items = [logo, burger].concat(menuLinks).filter(Boolean);
        var first = items[0];
        var last = items[items.length - 1];
        var active = document.activeElement;
        if (items.indexOf(active) === -1) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    });

    /* Click on the empty menu background closes it. */
    menu.addEventListener('click', function (e) {
        if (!e.target.closest('.menu__link, .menu__cta')) closeMenu();
    });

    function scrollToHash(hash) {
        var target = hash.length > 1 ? document.querySelector(hash) : null;
        if (!target) return false;
        if (window.VB && VB.lenis) VB.lenis.scrollTo(target, { offset: 0 });
        else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        if (window.history && history.pushState) history.pushState(null, '', hash);
        return true;
    }

    menuLinks.forEach(function (link) {
        link.addEventListener('click', function (e) {
            var href = link.getAttribute('href') || '';
            if (href.charAt(0) === '#') {
                e.preventDefault();
                closeMenu();
                setTimeout(function () { scrollToHash(href); }, reduceMotion ? 0 : 260);
            } else {
                closeMenu(false);   /* other page: let the browser follow the link */
            }
        });
    });

    /* Logo on the home page: smooth scroll to the top instead of a jump. */
    if (logo) {
        logo.addEventListener('click', function (e) {
            var href = logo.getAttribute('href') || '';
            if (menuOpen) closeMenu(false);
            if (href.charAt(0) === '#') {
                e.preventDefault();
                if (!scrollToHash(href)) {
                    if (window.VB && VB.lenis) VB.lenis.scrollTo(0);
                    else window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
                }
            }
        });
    }

    window.addEventListener('pageshow', function (e) {
        if (e.persisted && menuOpen) closeMenu(false);
    });
})();
