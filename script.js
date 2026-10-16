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

// Thank-you modal
let thankYouOpener = null;
function openThankYou(opener) {
    const m = document.getElementById('thankYouModal');
    if (!m) return;
    thankYouOpener = opener || null;
    m.style.display = 'flex';
    const btn = m.querySelector('button');
    if (btn) btn.focus({ preventScroll: true });
}
function closeModal() {
    const m = document.getElementById('thankYouModal');
    if (!m) return;
    m.style.display = 'none';
    if (thankYouOpener) thankYouOpener.focus({ preventScroll: true });
    thankYouOpener = null;
}
document.addEventListener('keydown', (e) => {
    const m = document.getElementById('thankYouModal');
    if (e.key === 'Escape' && m && m.style.display === 'flex') closeModal();
});

// Contact form (Formspree): Hungarian validation messages, honeypot, inline status
const form = document.querySelector('.contact-form-ui, .contact-form');
if (form) {
    const status = form.querySelector('.contact-form-status');
    const submitBtn = form.querySelector('[type="submit"]');
    const MESSAGES = {
        name: 'Kérjük, adja meg a nevét.',
        email: 'Kérjük, adja meg az e-mail-címét.',
        service: 'Kérjük, válasszon a listából.',
        message: 'Kérjük, írja le röviden a projektet.',
        consent: 'A küldéshez kérjük, fogadja el az Adatkezelési tájékoztatót.'
    };
    const setStatus = (text, kind) => {
        if (!status) return;
        status.textContent = text;
        status.classList.toggle('is-error', kind === 'error');
        status.classList.toggle('is-ok', kind === 'ok');
    };
    // floating labels: .is-filled on the field wrapper while it holds a value
    const syncField = (el) => {
        const f = el.closest('.contact-field');
        if (f) f.classList.toggle('is-filled', el.value !== '');
    };
    let firstInvalid = false;
    if (submitBtn) submitBtn.addEventListener('click', () => { firstInvalid = true; });
    form.querySelectorAll('input, select, textarea').forEach((el) => {
        el.addEventListener('invalid', () => {
            let msg = '';
            if (el.validity.valueMissing) msg = MESSAGES[el.name] || 'Kérjük, töltse ki ezt a mezőt.';
            else if (el.validity.typeMismatch) msg = 'Kérjük, érvényes e-mail-címet adjon meg.';
            el.setCustomValidity(msg);
            const f = el.closest('.contact-field');
            if (f) {                       // small shake on the offending field
                f.classList.remove('is-shake');
                void f.offsetWidth;
                f.classList.add('is-shake');
                f.addEventListener('animationend', () => f.classList.remove('is-shake'), { once: true });
            }
            if (firstInvalid && msg) { setStatus(msg, 'error'); firstInvalid = false; }
        });
        const clear = () => {
            el.setCustomValidity('');
            syncField(el);
            if (status && status.classList.contains('is-error')) setStatus('', '');
        };
        el.addEventListener('input', clear);
        el.addEventListener('change', clear);
        el.addEventListener('blur', () => syncField(el));
        syncField(el);
    });
    const syncAll = () => form.querySelectorAll('input, select, textarea').forEach(syncField);
    // success: the button turns into a check + "Elküldve" for a moment, then the thank-you modal opens
    const sentMorph = (btn) => new Promise((resolve) => {
        if (!btn) { resolve(); return; }
        const original = btn.innerHTML;
        btn.classList.add('is-sent');
        btn.innerHTML = '<svg class="sent-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Elküldve';
        setTimeout(() => { btn.classList.remove('is-sent'); btn.innerHTML = original; resolve(); }, 1200);
    });
    form.onsubmit = async (e) => {
        e.preventDefault();
        if (submitBtn && submitBtn.disabled) return;
        const hp = form.querySelector('[name="_gotcha"]');
        if (hp && hp.value) {            // bot: pretend success, send nothing
            form.reset();
            syncAll();
            openThankYou(submitBtn);
            return;
        }
        setStatus('', '');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); }
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            form.reset();
            syncAll();
            await sentMorph(submitBtn);
            openThankYou(submitBtn);
        } catch (err) {
            setStatus('Az üzenetet most nem sikerült elküldeni. Kérjük, próbálja újra, vagy írjon a info@varbro.pro címre.', 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
        }
    };
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
    if (window.VB && VB.lenis) VB.lenis.start();
};

serviceModalTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
        const targetId = trigger.dataset.modalTarget;
        const targetModal = document.getElementById(targetId);
        if (!targetModal) return;

        closeServiceModals();
        targetModal.classList.add('is-open');
        targetModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('service-modal-open');
        if (window.VB && VB.lenis) VB.lenis.stop();
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
        const target = button.dataset.redirect || '#contact';
        if (target.charAt(0) !== '#') {
            window.location.href = target;
            return;
        }
        closeServiceModals();                      // closes the dialog and restarts Lenis
        const el = document.querySelector(target);
        if (!el) return;
        if (window.VB && VB.lenis) VB.lenis.scrollTo(el, { offset: 0 });
        else el.scrollIntoView({ behavior: 'auto', block: 'start' });
        if (window.history && history.pushState) history.pushState(null, '', target);
    });
});


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

// Hero buttons – liquid fill origin + click ripple
(function () {
    document.querySelectorAll('.hbtn').forEach(function (btn) {
        function setOrigin(e) {
            var r = btn.getBoundingClientRect();
            btn.style.setProperty('--fx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
            btn.style.setProperty('--fy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        }
        btn.addEventListener('pointerenter', setOrigin);
        btn.addEventListener('pointerleave', setOrigin);
        btn.addEventListener('pointerdown', function (e) {
            setOrigin(e);
            var host = btn.querySelector('.hbtn__rip');
            if (!host) return;
            var r = btn.getBoundingClientRect();
            var rip = document.createElement('span');
            rip.className = 'hbtn__ripple';
            rip.style.setProperty('--rx', (e.clientX - r.left) + 'px');
            rip.style.setProperty('--ry', (e.clientY - r.top) + 'px');
            host.appendChild(rip);
            setTimeout(function () { rip.remove(); }, 700);
        });
    });
})();

// Skills – floating logo preview following the cursor
(function () {
    var list = document.querySelector('.skills-list');
    var preview = document.querySelector('.skills-preview');
    if (!list || !preview) return;
    var ok = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 901px) and (prefers-reduced-motion: no-preference)');
    var inner = preview.querySelector('.skills-preview__inner');
    var mx = 0, my = 0, px = 0, py = 0, rot = 0, running = false, active = null;

    function loop() {
        var dx = mx - px;
        px += dx * 0.16;
        py += (my - py) * 0.16;
        rot += ((Math.max(-12, Math.min(12, dx * 0.15))) - rot) * 0.12;
        preview.style.transform = 'translate3d(' + (px + 130).toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
        if (active || Math.abs(dx) > 0.2) requestAnimationFrame(loop);
        else running = false;
    }

    list.addEventListener('pointermove', function (e) {
        if (!ok.matches || e.pointerType !== 'mouse') return;
        mx = e.clientX; my = e.clientY;
        var row = e.target.closest('.skill-row');
        if (row && row !== active) {
            if (!active) { px = mx; py = my; }
            active = row;
            var logo = row.querySelector('.skill-row__logo');
            inner.innerHTML = logo ? logo.innerHTML : '';
            preview.classList.add('is-visible');
        }
        if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });

    list.addEventListener('pointerleave', function () {
        active = null;
        preview.classList.remove('is-visible');
    });
})();

// Why section – expanding panels / mobile accordion
(function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.why-panel'));
    if (!panels.length) return;
    var desktopHover = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');

    function activate(panel) {
        panels.forEach(function (p) {
            var on = p === panel;
            p.classList.toggle('is-active', on);
            var tab = p.querySelector('.why-panel__tab');
            if (tab) tab.setAttribute('aria-expanded', on ? 'true' : 'false');
        });
    }

    panels.forEach(function (panel) {
        panel.addEventListener('pointerenter', function (e) {
            if (e.pointerType === 'mouse' && desktopHover.matches) activate(panel);
        });
        var tab = panel.querySelector('.why-panel__tab');
        if (tab) {
            tab.addEventListener('click', function () { activate(panel); });
            tab.addEventListener('focus', function () { activate(panel); });
        }
    });
})();

// Steps - process line drawn by scroll progress (pinned step-by-step on large screens)
(function () {
    var section = document.getElementById('steps');
    var process = document.querySelector('.process');
    if (!section || !process) return;
    var steps = Array.prototype.slice.call(process.querySelectorAll('.process__step'));
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pinQuery = window.matchMedia('(min-width: 768px) and (min-height: 520px) and (prefers-reduced-motion: no-preference)');
    var ticking = false;

    function setProgress(p) {
        process.style.setProperty('--progress', p.toFixed(3));
        steps.forEach(function (step, i) {
            var threshold = steps.length > 1 ? i / (steps.length - 1) : 0;
            step.classList.toggle('is-active', i === 0 ? p > 0.001 || pinQuery.matches : p >= threshold - 0.02);
        });
    }

    /* Fill 0 -> 1 across the nodes: a short hold on every node (the hold lengths
       reproduce the original 3-step timing when there are 3 steps). */
    function staged(t) {
        var n = Math.max(2, steps.length), segs = n - 1;
        var start = 0.08, end = 0.92, hold = 0.08;
        var seg = (end - start - (segs - 1) * hold) / segs;
        if (t < start) return 0;
        if (t >= end) return 1;
        var x = t - start;
        for (var i = 0; i < segs; i++) {
            if (x < seg) return (i + x / seg) / segs;
            x -= seg;
            if (i < segs - 1) {
                if (x < hold) return (i + 1) / segs;
                x -= hold;
            }
        }
        return 1;
    }

    function fit() {
        var inner = section.querySelector('.steps-inner');
        if (!inner) return;
        if (!pinQuery.matches) { section.style.removeProperty('--fit'); return; }
        var pin = section.querySelector('.steps-pin') || section;
        var pcs = window.getComputedStyle(pin);
        var avail = window.innerHeight - parseFloat(pcs.paddingTop) - parseFloat(pcs.paddingBottom);
        var natural = inner.offsetHeight;
        var s = natural > 0 ? Math.max(0.55, Math.min(1, avail / natural)) : 1;
        section.style.setProperty('--fit', s.toFixed(3));
    }

    function update() {
        ticking = false;
        if (reduce) { setProgress(1); section.classList.add('steps-done'); return; }
        var r = section.getBoundingClientRect();
        var vh = window.innerHeight;
        if (pinQuery.matches) {
            var total = Math.max(1, r.height - vh);
            var t = Math.max(0, Math.min(1, -r.top / total));
            setProgress(staged(t));
            section.classList.toggle('steps-done', t >= 0.94);
        } else {
            var pr = process.getBoundingClientRect();
            var start = vh * 0.85;
            var span = Math.max(pr.height, 120) + vh * 0.3;
            setProgress(Math.max(0, Math.min(1, (start - pr.top) / span)));
            section.classList.add('steps-done');
        }
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { fit(); onScroll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); update(); });
    fit();
    update();
})();

// Why section - scale content to fit the viewport height on desktop
(function () {
    var section = document.getElementById('why');
    var inner = section && section.querySelector('.why-inner');
    if (!inner) return;
    var q = window.matchMedia('(min-width: 768px) and (min-height: 520px)');

    function fit() {
        if (!q.matches) { section.style.removeProperty('--fit'); section.style.removeProperty('--fit-h'); return; }
        section.style.setProperty('--fit-h', 'auto');
        section.style.setProperty('--fit', '1');
        var wcs = window.getComputedStyle(section);
        var avail = window.innerHeight - parseFloat(wcs.paddingTop) - parseFloat(wcs.paddingBottom);
        var natural = inner.offsetHeight;
        var s = natural > 0 ? Math.max(0.55, Math.min(1, avail / natural)) : 1;
        section.style.setProperty('--fit', s.toFixed(3));
        section.style.setProperty('--fit-h', Math.round(natural * s) + 'px');
    }

    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('load', fit);
    fit();
})();

// Footer: back to top (Lenis when present, native smooth otherwise), focus follows
document.querySelectorAll('.footer-top-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (window.VB && VB.lenis) VB.lenis.scrollTo(0);
        else window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
        const target = document.getElementById('hero') || document.body;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    });
});
