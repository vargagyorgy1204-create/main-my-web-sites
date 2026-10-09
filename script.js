// Floating glass header: scrolled state + smart hide
(function () {
    var header = document.querySelector('header');
    if (!header) return;
    var ticking = false;
    var lastY = window.scrollY;

    function updateHeader() {
        var y = window.scrollY;
        header.classList.toggle('header--scrolled', y > 40);
        var menuOpen = document.body.classList.contains('nav-open');
        if (menuOpen || header.contains(document.activeElement) && y < lastY + 1) {
            header.classList.remove('header--hidden');
        } else if (y > lastY + 4 && y > 140) {
            header.classList.add('header--hidden');
        } else if (y < lastY - 4 || y <= 140) {
            header.classList.remove('header--hidden');
        }
        lastY = y;
        ticking = false;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            requestAnimationFrame(updateHeader);
            ticking = true;
        }
    }, { passive: true });

    updateHeader();
})();

if (typeof AOS !== 'undefined') {
    AOS.init({
        duration: 700,
        easing: 'ease-out-cubic',
        once: true,
        offset: 60
    });
}

// Skill card click-to-flip animation
const skillCards = document.querySelectorAll('.skill-card');
if (skillCards.length > 0) {
    skillCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Close other cards
            skillCards.forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('flipped');
                }
            });
            // Toggle current card
            card.classList.toggle('flipped');
        });
    });
}

// Typing animation for benefit items
const typeText = (el, text, speed = 70) => {
    let i = 0;
    if (el._typingTimer) {
        clearInterval(el._typingTimer);
    }
    el.classList.add('is-retyping');
    el.classList.add('typing-cursor');
    el.textContent = '';
    el._typingTimer = setInterval(() => {
        if (i < text.length) {
            el.textContent += text[i];
            i++;
        } else {
            clearInterval(el._typingTimer);
            el._typingTimer = null;
            el.classList.remove('typing-cursor');
            el.classList.remove('is-retyping');
        }
    }, speed);
};

document.querySelectorAll('.benefit-typed').forEach((span) => {
    const label = span.dataset.text || '';
    span.textContent = label;

    const card = span.closest('.benefit-item');
    if (card) {
        setTimeout(() => {
            typeText(span, label, 52);
        }, 180 * Array.from(document.querySelectorAll('.benefit-typed')).indexOf(span));

        card.addEventListener('mouseenter', () => {
            typeText(span, label, 50);
        });
    }
});

// Modal Logic
function closeModal() {
    document.getElementById('thankYouModal').style.display = 'none';
}

// Form Submission
const form = document.querySelector('.contact-form-ui, .contact-form');
if (form) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
            document.getElementById('thankYouModal').style.display = 'flex';
            form.reset();
        } else {
            alert('Hiba történt a küldés során.');
        }
    };
}

// Mobile burger menu toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
    const setMenu = (open) => {
        navToggle.classList.toggle('active', open);
        navLinks.classList.toggle('active', open);
        document.body.classList.toggle('nav-open', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        navToggle.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
    };

    navToggle.addEventListener('click', () => setMenu(!navLinks.classList.contains('active')));

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenu(false));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navLinks.classList.contains('active')) setMenu(false);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 900) setMenu(false);
    });
}

// Floating liquid background for header nav links
const navLiquid = navLinks ? navLinks.querySelector('.nav-liquid') : null;
if (navLinks && navLiquid) {
    const navLinkItems = Array.from(navLinks.querySelectorAll('a'));
    let lastX = 0;
    let lastY = 0;

    const moveLiquidTo = (target) => {
        const parentRect = navLinks.getBoundingClientRect();
        const linkRect = target.getBoundingClientRect();
        const nextX = linkRect.left - parentRect.left;
        const nextY = linkRect.top - parentRect.top;
        lastX = nextX;
        lastY = nextY;

        navLiquid.style.width = `${linkRect.width}px`;
        navLiquid.style.height = `${linkRect.height}px`;
        navLiquid.style.transform = `translate(${nextX}px, ${nextY}px) scale(1)`;
        navLiquid.style.opacity = '1';

        navLinkItems.forEach((item) => item.classList.remove('liquid-active'));
        target.classList.add('liquid-active');
    };

    const hideLiquid = () => {
        navLiquid.style.opacity = '0';
        navLiquid.style.transform = `translate(${lastX}px, ${lastY}px) scale(0.86)`;
        navLinkItems.forEach((item) => item.classList.remove('liquid-active'));
    };

    navLinkItems.forEach((link) => {
        link.addEventListener('mouseenter', () => moveLiquidTo(link));
        link.addEventListener('focus', () => moveLiquidTo(link));
    });

    // Scrollspy: pill rests on the link of the section currently in view
    const spyMap = {};
    navLinkItems.forEach((link) => {
        const href = link.getAttribute('href') || '';
        const hash = href.indexOf('#') > -1 ? href.slice(href.indexOf('#')) : '';
        if (hash.length > 1 && document.querySelector(hash)) spyMap[hash] = link;
    });
    let spyLink = null;
    let hovering = false;

    const restOnSpy = () => {
        if (spyLink) moveLiquidTo(spyLink);
        else hideLiquid();
    };

    if ('IntersectionObserver' in window && Object.keys(spyMap).length) {
        const visible = new Set();
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const id = '#' + entry.target.id;
                if (entry.isIntersecting) visible.add(id); else visible.delete(id);
            });
            const order = Object.keys(spyMap);
            const current = order.filter((id) => visible.has(id)).pop();
            spyLink = current ? spyMap[current] : null;
            if (!hovering) restOnSpy();
        }, { rootMargin: '-45% 0px -50% 0px' });
        Object.keys(spyMap).forEach((id) => spy.observe(document.querySelector(id)));
    }

    navLinks.addEventListener('mouseenter', () => { hovering = true; });
    navLinks.addEventListener('mouseleave', () => {
        hovering = false;
        restOnSpy();
    });

    navLinks.addEventListener('focusout', (event) => {
        if (!navLinks.contains(event.relatedTarget)) {
            restOnSpy();
        }
    });

    window.addEventListener('resize', () => {
        const activeLink = navLinks.querySelector('a.liquid-active');
        if (activeLink) {
            moveLiquidTo(activeLink);
        }
    });
}

// Service modals (pricing)
const serviceModalTriggers = document.querySelectorAll('.service-modal-trigger');
const serviceModalOverlays = document.querySelectorAll('.service-modal-overlay');

const closeServiceModals = () => {
    serviceModalOverlays.forEach((overlay) => {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('service-modal-open');
};

serviceModalTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
        const targetId = trigger.dataset.modalTarget;
        const targetModal = document.getElementById(targetId);
        if (!targetModal) return;

        closeServiceModals();
        if (targetId === 'extraModal') {
            resetBizTabs();
        }
        targetModal.classList.add('is-open');
        targetModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('service-modal-open');
    });
});

// Üzleti Kiegészítők – segmented tab control
const bizTabs = document.querySelectorAll('.biz-tab');
const bizPanels = document.querySelectorAll('.biz-panel');

function activateBizTab(tab) {
    bizTabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle('is-active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        t.tabIndex = isActive ? 0 : -1;
    });
    bizPanels.forEach((panel) => {
        const isActive = panel.id === tab.getAttribute('aria-controls');
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
    });
}

function resetBizTabs() {
    if (bizTabs.length) activateBizTab(bizTabs[0]);
}

bizTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateBizTab(tab));
    tab.addEventListener('keydown', (event) => {
        let newIndex = null;
        if (event.key === 'ArrowRight') newIndex = (index + 1) % bizTabs.length;
        if (event.key === 'ArrowLeft') newIndex = (index - 1 + bizTabs.length) % bizTabs.length;
        if (newIndex === null) return;

        event.preventDefault();
        bizTabs[newIndex].focus();
        activateBizTab(bizTabs[newIndex]);
    });
});

if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

serviceModalOverlays.forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeServiceModals();
        }
    });

    const closeBtn = overlay.querySelector('.service-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeServiceModals);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeServiceModals();
    }
});

document.querySelectorAll('.modal-quote-btn').forEach((button) => {
    button.addEventListener('click', () => {
        const target = button.dataset.redirect || 'whatsappcontact.html';
        window.location.href = target;
    });
});

// Testimonial carousel
(function () {
    var viewport = document.querySelector('.testimonial-carousel-viewport');
    var track = document.querySelector('.testimonial-carousel-track');
    if (!track || !viewport) return;

    var GAP = 20;
    var cards = Array.from(track.querySelectorAll('.bento-showcase-card'));
    var total = cards.length;

    // Append clones for infinite loop
    cards.forEach(function (card) {
        var clone = card.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
    });

    var currentIndex = 0;
    var isAnimating = false;

    function getSPV() {
        return window.innerWidth > 768 ? 4 : 1;
    }

    function getCardWidth() {
        var spv = getSPV();
        return (viewport.offsetWidth - GAP * (spv - 1)) / spv;
    }

    function applyWidths() {
        var w = getCardWidth();
        Array.from(track.querySelectorAll('.bento-showcase-card')).forEach(function (c) {
            c.style.width = w + 'px';
        });
    }

    function setPosition(index, animate) {
        var w = getCardWidth();
        var offset = index * (w + GAP);
        track.style.transition = animate
            ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none';
        track.style.transform = 'translateX(-' + offset + 'px)';
    }

    function updateDots(dotIndex) {
        document.querySelectorAll('.tcarousel-dot').forEach(function (dot, i) {
            dot.classList.toggle('tcarousel-dot--active', i === dotIndex);
        });
    }

    function goTo(index, animate) {
        currentIndex = index;
        setPosition(currentIndex, animate);
        updateDots(currentIndex % total);
    }

    function next() {
        if (isAnimating) return;
        isAnimating = true;
        var nextIndex = currentIndex + 1;
        goTo(nextIndex, true);
        if (nextIndex >= total) {
            setTimeout(function () {
                goTo(nextIndex % total, false);
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { isAnimating = false; });
                });
            }, 420);
        } else {
            setTimeout(function () { isAnimating = false; }, 420);
        }
    }

    function prev() {
        if (isAnimating) return;
        isAnimating = true;
        if (currentIndex === 0) {
            goTo(total, false);
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    goTo(total - 1, true);
                    setTimeout(function () { isAnimating = false; }, 420);
                });
            });
        } else {
            goTo(currentIndex - 1, true);
            setTimeout(function () { isAnimating = false; }, 420);
        }
    }

    document.querySelector('.tcarousel-btn--prev').addEventListener('click', prev);
    document.querySelector('.tcarousel-btn--next').addEventListener('click', next);

    document.querySelectorAll('.tcarousel-dot').forEach(function (dot, i) {
        dot.addEventListener('click', function () {
            if (isAnimating) return;
            isAnimating = true;
            goTo(i, true);
            setTimeout(function () { isAnimating = false; }, 420);
        });
    });

    window.addEventListener('resize', function () {
        applyWidths();
        setPosition(currentIndex, false);
    });

    applyWidths();
    setPosition(0, false);
})();

// GDPR cookie consent + GA4 lazy load
(() => {
    const CONSENT_KEY = 'varbro_cookie_consent';
    const CONSENT_ACCEPTED = 'accepted';
    const CONSENT_DECLINED = 'declined';
    const GA_MEASUREMENT_ID = 'G-F5GJPXZWBH';
    let gaLoaded = false;

    const getStoredConsent = () => {
        try {
            return localStorage.getItem(CONSENT_KEY);
        } catch (error) {
            return null;
        }
    };

    const saveConsent = (value) => {
        try {
            localStorage.setItem(CONSENT_KEY, value);
        } catch (error) {
            // If storage is unavailable, we still honor in-session choice.
        }
    };

    const loadGa4 = () => {
        if (gaLoaded || window.gtag) return;

        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
            window.dataLayer.push(arguments);
        };

        const gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(gaScript);

        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID);
        gaLoaded = true;
    };

    const banner = document.getElementById('cookie-consent-banner');
    const acceptBtn = document.getElementById('cookie-accept');
    const declineBtn = document.getElementById('cookie-decline');
    const settingsBtn = document.getElementById('cookie-settings-trigger');

    const hideBanner = () => {
        if (!banner) return;
        banner.classList.remove('is-visible');
        banner.setAttribute('aria-hidden', 'true');
    };

    const showBanner = () => {
        if (!banner) return;
        banner.classList.add('is-visible');
        banner.setAttribute('aria-hidden', 'false');
    };

    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            showBanner();
        });
    }

    if (!banner || !acceptBtn || !declineBtn) {
        return;
    }

    acceptBtn.addEventListener('click', () => {
        saveConsent(CONSENT_ACCEPTED);
        loadGa4();
        hideBanner();
    });

    declineBtn.addEventListener('click', () => {
        saveConsent(CONSENT_DECLINED);
        hideBanner();
    });

    const consent = getStoredConsent();

    if (consent === CONSENT_ACCEPTED) {
        loadGa4();
        hideBanner();
        return;
    }

    if (consent === CONSENT_DECLINED) {
        hideBanner();
        return;
    }

    showBanner();
})();
// Skills – mobile carousel dots
(function () {
    var track = document.querySelector('#skills > div > div[style*="grid-template-columns"]');
    var dots = document.querySelectorAll('.skills-dot');
    if (!track || !dots.length) return;

    var cards = Array.from(track.children);
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ticking = false;

    function isCarousel() {
        return track.scrollWidth > track.clientWidth + 1;
    }

    function activeIndex() {
        var center = track.scrollLeft + track.clientWidth / 2;
        var best = 0;
        var bestDist = Infinity;
        cards.forEach(function (card, i) {
            var d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
            if (d < bestDist) { bestDist = d; best = i; }
        });
        return best;
    }

    function update() {
        ticking = false;
        if (!isCarousel()) return;
        var idx = activeIndex();
        dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === idx); });
    }

    track.addEventListener('scroll', function () {
        if (!ticking) {
            requestAnimationFrame(update);
            ticking = true;
        }
    }, { passive: true });

    dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
            var card = cards[i];
            if (!card) return;
            track.scrollTo({
                left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
                behavior: reduceMotion ? 'auto' : 'smooth'
            });
        });
    });

    window.addEventListener('resize', update);
})();
// Hero headline – magnetic wave
(function () {
    var title = document.querySelector('.hero-title');
    var h1 = title && title.querySelector('.hero-headline');
    var outline = h1 && h1.querySelector('.hero-line--outline');
    if (!outline) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var letters = [];
    var centers = [];
    var current = [];
    var target = [];
    var running = false;
    var split = false;

    function splitLines() {
        if (split) return;
        split = true;
        h1.setAttribute('aria-label', 'WEB DEVELOPER');
        h1.querySelectorAll('.hero-line').forEach(function (line) {
            var text = line.textContent.trim();
            line.textContent = '';
            text.split('').forEach(function (ch) {
                var s = document.createElement('span');
                s.className = 'hl';
                s.setAttribute('aria-hidden', 'true');
                s.textContent = ch;
                line.appendChild(s);
                letters.push(s);
                current.push(0);
                target.push(0);
            });
            line.classList.add('is-split');
        });
        measure();
    }

    function measure() {
        var rect = outline.getBoundingClientRect();
        var range = document.createRange();
        range.selectNodeContents(outline);
        var textRect = range.getBoundingClientRect();
        outline.querySelectorAll('.hl').forEach(function (s) {
            s.style.setProperty('--lw', textRect.width + 'px');
            s.style.setProperty('--lx', (s.offsetLeft - (textRect.left - rect.left)) + 'px');
        });
        centers = letters.map(function (s) {
            var r = s.getBoundingClientRect();
            return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY };
        });
    }

    function setTargets(px, py) {
        var R = parseFloat(getComputedStyle(h1).fontSize) * 1.9;
        centers.forEach(function (c, i) {
            var d = Math.hypot(px - c.x, py - c.y);
            var p = Math.max(0, 1 - d / R);
            target[i] = p * p;
        });
        start();
    }

    function clearTargets() {
        for (var i = 0; i < target.length; i++) target[i] = 0;
        start();
    }

    function tick() {
        var moving = false;
        for (var i = 0; i < letters.length; i++) {
            var next = current[i] + (target[i] - current[i]) * 0.16;
            if (Math.abs(target[i] - next) < 0.001) next = target[i];
            if (next !== current[i]) {
                current[i] = next;
                letters[i].style.setProperty('--p', next.toFixed(4));
            }
            if (next !== target[i]) moving = true;
        }
        if (moving) requestAnimationFrame(tick);
        else running = false;
    }

    function start() {
        if (!running) {
            running = true;
            requestAnimationFrame(tick);
        }
    }

    function sweep() {
        if (!centers.length) return;
        var first = centers[0];
        var last = centers[centers.length - 1];
        var webEnd = centers[h1.querySelector('.hero-line--solid').children.length - 1];
        var t0 = performance.now();
        var dur = 1100;
        (function step(now) {
            var t = Math.min(1, (now - t0) / dur);
            if (t < 0.4) {
                var a = t / 0.4;
                setTargets(first.x + (webEnd.x - first.x) * a, first.y);
            } else {
                var b = (t - 0.4) / 0.6;
                var devStart = centers[h1.querySelector('.hero-line--solid').children.length];
                setTargets(devStart.x + (last.x - devStart.x) * b, last.y);
            }
            if (t < 1) requestAnimationFrame(step);
            else clearTargets();
        })(t0);
    }

    function init() {
        splitLines();
        var inside = false;
        document.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            var r = title.getBoundingClientRect();
            var pad = parseFloat(getComputedStyle(h1).fontSize) * 0.8;
            var hit = e.clientX >= r.left - pad && e.clientX <= r.right + pad &&
                      e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
            if (hit) {
                inside = true;
                setTargets(e.pageX, e.pageY);
            } else if (inside) {
                inside = false;
                clearTargets();
            }
        }, { passive: true });
        document.documentElement.addEventListener('pointerleave', clearTargets);
        h1.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'mouse') sweep();
        });
        window.addEventListener('resize', measure);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    }

    var done = false;
    function onIntroEnd(e) {
        if (done || (e && e.animationName !== 'heroFill')) return;
        done = true;
        outline.removeEventListener('animationend', onIntroEnd);
        init();
    }
    outline.addEventListener('animationend', onIntroEnd);
    setTimeout(function () { onIntroEnd(); }, 3000);
})();
