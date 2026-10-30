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
    clearTimeout(m._hideTimer);
    m.classList.remove('is-open');
    m.style.display = 'flex';
    void m.offsetWidth;
    m.classList.add('is-open');                    // fades the blurred backdrop in and replays the check draw-in
    const btn = m.querySelector('button');
    if (btn) btn.focus({ preventScroll: true });
}
function closeModal() {
    const m = document.getElementById('thankYouModal');
    if (!m) return;
    m.classList.remove('is-open');                 // fade out, then hide
    clearTimeout(m._hideTimer);
    m._hideTimer = setTimeout(() => { m.style.display = 'none'; }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
    if (thankYouOpener) thankYouOpener.focus({ preventScroll: true });
    thankYouOpener = null;
}
const thankYouEl = document.getElementById('thankYouModal');
if (thankYouEl) thankYouEl.addEventListener('click', (e) => { if (e.target === thankYouEl) closeModal(); });   // click outside the card closes
document.addEventListener('keydown', (e) => {
    const m = document.getElementById('thankYouModal');
    if (!m || m.style.display !== 'flex' || !m.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'Tab') { e.preventDefault(); const b = m.querySelector('button'); if (b) b.focus({ preventScroll: true }); }   // focus trap: the close button is the only control
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
        btn.style.minWidth = btn.offsetWidth + 'px';     // the "Elküldve" morph keeps the button's width
        btn.classList.add('is-sent');
        btn.innerHTML = '<svg class="sent-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Elküldve';
        setTimeout(() => { btn.classList.remove('is-sent'); btn.innerHTML = original; btn.style.minWidth = ''; if (window.lucide) lucide.createIcons(); resolve(); }, 1200);
    });
    // draft autosave: the text fields and the service (NOT the consent) live in sessionStorage while the visitor types, so a detour
    // (privacy page, reload) loses nothing; cleared after a successful submit
    const DRAFT_KEY = 'vb_contact_draft';
    const DRAFT_FIELDS = ['name', 'email', 'phone', 'service', 'message'];
    const draftGet = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; } };
    const draftClear = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* storage unavailable */ } };
    let draftTimer = 0;
    const draftSave = () => {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => {
            try {
                const d = {};
                DRAFT_FIELDS.forEach((n) => { const el = form.elements[n]; if (el && el.value) d[n] = el.value; });
                if (Object.keys(d).length) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); else sessionStorage.removeItem(DRAFT_KEY);
            } catch (e) { /* storage unavailable */ }
        }, 300);
    };
    const draft = draftGet();
    if (draft) {
        DRAFT_FIELDS.forEach((n) => {
            const el = form.elements[n];
            if (!el || typeof draft[n] !== 'string' || el.value) return;
            if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === draft[n])) return;
            el.value = draft[n];
        });
        syncAll();
    }
    form.addEventListener('input', draftSave);
    form.addEventListener('change', draftSave);
    form.onsubmit = async (e) => {
        e.preventDefault();
        if (submitBtn && submitBtn.disabled) return;
        const hp = form.querySelector('[name="_gotcha"]');
        if (hp && hp.value) {            // bot: pretend success, send nothing
            form.reset();
            syncAll();
            draftClear();
            openThankYou(submitBtn);
            return;
        }
        setStatus('', '');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); submitBtn.classList.add('is-sending'); }
        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            clearTimeout(draftTimer);
            draftClear();
            form.reset();
            syncAll();
            await sentMorph(submitBtn);
            openThankYou(submitBtn);
        } catch (err) {
            setStatus('Az üzenetet most nem sikerült elküldeni. Kérjük, próbálja újra, vagy írjon a info@varbro.pro címre.', 'error');
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.classList.remove('is-sending'); }
        }
    };
}

// Custom service dropdown (Kapcsolat form). The native <select> stays in the DOM as the source of truth (name, options, required,
// custom validity, Formspree value); the custom UI only sets select.value and dispatches input / change. It is switched on for
// pointer:fine devices or once a real mouse is seen (html.has-cursor); touch devices keep the native picker.
(() => {
    const select = document.querySelector('.contact-form-ui select[name="service"]');
    if (!select) return;
    const field = select.closest('.contact-field');
    if (!field) return;
    const options = [...select.options].filter((o) => o.value !== '');
    const uid = 'cs-' + Math.random().toString(36).slice(2, 7);
    const root = document.createElement('div');
    root.className = 'cs';
    root.innerHTML =
        '<button type="button" class="cs__trigger" data-cursor="frame" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + uid + '-list" aria-labelledby="' + (select.id ? select.id + '-lbl ' : '') + uid + '-val">' +
        '<span class="cs__value" id="' + uid + '-val"></span><i data-lucide="chevron-down" class="icon cs__chevron" aria-hidden="true"></i></button>' +
        '<ul class="cs__panel" data-cursor="plain" role="listbox" id="' + uid + '-list" tabindex="-1" aria-label="' + ((field.querySelector('label') || {}).textContent || '').trim() + '">' +
        options.map((o, i) => '<li class="cs__opt" role="option" id="' + uid + '-o' + i + '" data-value="' + o.value.replace(/"/g, '&quot;') + '" aria-selected="false"><span>' + o.textContent + '</span><i data-lucide="check" class="icon cs__check" aria-hidden="true"></i></li>').join('') +
        '</ul>';
    const lbl = field.querySelector('label');
    if (lbl && select.id) lbl.id = select.id + '-lbl';
    field.appendChild(root);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    const trigger = root.querySelector('.cs__trigger');
    const valueEl = root.querySelector('.cs__value');
    const list = root.querySelector('.cs__panel');
    const rows = [...root.querySelectorAll('.cs__opt')];
    const placeholder = (select.querySelector('option[value=""]') || {}).textContent || '';
    let active = -1, buffer = '', bufferTimer = 0;
    const isOpen = () => root.classList.contains('is-open');

    const render = () => {
        const idx = options.findIndex((o) => o.value === select.value);
        valueEl.textContent = idx >= 0 ? options[idx].textContent : placeholder;
        valueEl.classList.toggle('is-placeholder', idx < 0);
        rows.forEach((r, i) => r.setAttribute('aria-selected', i === idx ? 'true' : 'false'));
    };
    const setActive = (i) => {
        active = Math.max(0, Math.min(rows.length - 1, i));
        rows.forEach((r, k) => r.classList.toggle('is-active', k === active));
        trigger.setAttribute('aria-activedescendant', rows[active].id);
        rows[active].scrollIntoView({ block: 'nearest' });
    };
    const open = () => {
        if (isOpen()) return;
        const r = field.getBoundingClientRect();
        const need = list.offsetHeight || rows.length * 40 + 14;
        root.classList.toggle('is-up', window.innerHeight - r.bottom < need + 16 && r.top > need + 16);   // flips above when there is no room below
        root.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        const sel = options.findIndex((o) => o.value === select.value);
        setActive(sel >= 0 ? sel : 0);
    };
    const close = () => {
        if (!isOpen()) return;
        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.removeAttribute('aria-activedescendant');
        rows.forEach((r) => r.classList.remove('is-active'));
    };
    const choose = (i) => {
        select.value = options[i].value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        render();
        close();
    };
    select.addEventListener('change', render);
    if (select.form) select.form.addEventListener('reset', () => setTimeout(render, 0));
    // the native validation bubble / autofocus lands on the hidden select: forward the focus to the visible trigger
    select.addEventListener('focus', () => { if (document.documentElement.classList.contains('cs-on')) trigger.focus(); });

    trigger.addEventListener('click', () => (isOpen() ? close() : open()));
    trigger.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'Tab') { close(); return; }
        if (k === 'Escape') { if (isOpen()) { e.preventDefault(); e.stopPropagation(); close(); } return; }
        if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); if (!isOpen()) open(); else setActive(active + (k === 'ArrowDown' ? 1 : -1)); return; }
        if (k === 'Home' || k === 'End') { if (isOpen()) { e.preventDefault(); setActive(k === 'Home' ? 0 : rows.length - 1); } return; }
        if (k === 'Enter' || (k === ' ' && !buffer)) { e.preventDefault(); if (isOpen()) choose(active); else open(); return; }
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {          // type-ahead
            buffer += k.toLowerCase();
            clearTimeout(bufferTimer);
            bufferTimer = setTimeout(() => { buffer = ''; }, 700);
            const from = isOpen() ? active : options.findIndex((o) => o.value === select.value);
            const order = rows.map((_, i) => (i + from + (buffer.length > 1 ? 0 : 1)) % rows.length);
            const hit = order.find((i) => options[i].textContent.toLowerCase().startsWith(buffer));
            if (hit !== undefined) { if (!isOpen()) open(); setActive(hit); }
        }
    });
    rows.forEach((r, i) => {
        r.addEventListener('pointermove', () => { if (active !== i) setActive(i); });
        r.addEventListener('click', () => { choose(i); trigger.focus(); });
    });
    list.addEventListener('mousedown', (e) => e.preventDefault());               // keep the focus on the trigger
    document.addEventListener('pointerdown', (e) => { if (isOpen() && !root.contains(e.target)) close(); });
    window.addEventListener('blur', close);

    // on: pointer:fine, or as soon as a real mouse is seen
    const html = document.documentElement;
    const on = () => { html.classList.add('cs-on'); select.tabIndex = -1; };   // the trigger is the only tab stop
    if (window.matchMedia('(pointer: fine)').matches || html.classList.contains('has-cursor')) on();
    else new MutationObserver((_, mo) => { if (html.classList.contains('has-cursor')) { on(); mo.disconnect(); } }).observe(html, { attributes: true, attributeFilter: ['class'] });
    render();
})();

// Privacy page: "Vissza a főoldalra" goes back in history (the browser restores the scroll position near the form) when the visitor
// came from this site; otherwise the link (index.html#contact) is followed
document.querySelectorAll('[data-smart-back]').forEach((a) => {
    a.addEventListener('click', (e) => {
        try {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
                e.preventDefault();
                history.back();
            }
        } catch (err) { /* follow the link */ }
    });
});

// Service modals (pricing)
const serviceModalTriggers = document.querySelectorAll('.service-modal-trigger');
const serviceModalOverlays = document.querySelectorAll('.service-modal-overlay');

let serviceModalReturn = null;                 // the "Részletek" button that opened the dialog: focus goes back to it
const closeServiceModals = (returnFocus = true) => {
    const wasOpen = document.querySelector('.service-modal-overlay.is-open');
    serviceModalOverlays.forEach((overlay) => {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.remove('service-modal-open');
    if (window.VB && VB.lenis) VB.lenis.start();
    if (wasOpen && returnFocus !== false && serviceModalReturn) serviceModalReturn.focus({ preventScroll: true });
    if (wasOpen) serviceModalReturn = null;
};

// the dialog's two views: the full one (every plan / group, the block's title) or a single item (one plan card, or one group of the Extra dialog), opened from a list row
const setServiceView = (modal, idx) => {
    const dlg = modal.querySelector('.service-modal');
    const h3 = dlg && dlg.querySelector('h3');
    if (!dlg || !h3) return;
    if (!h3.dataset.full) h3.dataset.full = h3.textContent;
    dlg.querySelectorAll('.is-item').forEach((el) => el.classList.remove('is-item'));
    const iconSlot = dlg.querySelector('.svm-icon');
    if (iconSlot) iconSlot.innerHTML = '';
    const scroller = dlg.querySelector('.service-modal__scroll');
    if (scroller) scroller.scrollTop = 0;
    const groups = dlg.querySelectorAll('.modal-group');
    const item = Number.isInteger(idx) ? (groups.length ? groups[idx] : dlg.querySelectorAll('.pricing-item')[idx]) : null;
    if (!item) {
        dlg.removeAttribute('data-view');
        dlg.removeAttribute('data-item');
        h3.textContent = h3.dataset.full;
        return;
    }
    item.classList.add('is-item');
    const planIcon = !groups.length && item.querySelector('.pricing-icon');
    if (iconSlot && planIcon) iconSlot.innerHTML = planIcon.innerHTML;          // the plan's icon tile goes above the centred title
    dlg.setAttribute('data-view', 'single');
    dlg.setAttribute('data-item', String(idx));
    h3.textContent = (groups.length ? item.querySelector('.modal-group__title') : item.querySelector('h4')).textContent.trim();
};

// opens a service dialog; focusIdx (from a list row of the section) opens the single-item view of that plan / group, no focusIdx the full view
const openServiceModal = (trigger, focusIdx) => {
    const targetModal = document.getElementById(trigger.dataset.modalTarget);
    if (!targetModal) return;

    closeServiceModals(false);
    serviceModalReturn = trigger;
    setServiceView(targetModal, focusIdx);          // reopening always starts from the right view (the full one for "Részletek")
    targetModal.classList.add('is-open');
    targetModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('service-modal-open');
    if (window.VB && VB.lenis) VB.lenis.stop();
    const dlg = targetModal.querySelector('.service-modal');
    // the overlay fades in from visibility:hidden: focus() on a hidden element does nothing, so move focus into the dialog a moment later
    if (dlg) {
        let tries = 0;
        const moveFocus = () => {
            if (!targetModal.classList.contains('is-open') || dlg.contains(document.activeElement) || tries++ > 12) return;
            dlg.focus({ preventScroll: true });
            if (document.activeElement !== dlg) window.setTimeout(moveFocus, 40);
        };
        window.setTimeout(moveFocus, 40);
    }
};

// "Az összes csomag megtekintése": the SAME open dialog switches to the full view (short crossfade), focus moves to the title
document.querySelectorAll('.modal-all-link').forEach((link) => {
    link.addEventListener('click', () => {
        const modal = link.closest('.service-modal-overlay');
        const scroller = modal && modal.querySelector('.service-modal__scroll');
        if (!modal || !scroller) return;
        const dlg = modal.querySelector('.service-modal');
        const swap = () => {
            setServiceView(modal);
            const h3 = modal.querySelector('.service-modal h3');
            if (h3) h3.focus({ preventScroll: true });
        };
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { swap(); scroller.classList.remove('is-fading'); return; }
        // the content fades out (0.15s), the view swaps while it is invisible and the dialog's width eases (0.3s, from the click), then the content fades in
        dlg.classList.add('is-switching');
        scroller.classList.add('is-fading');
        window.setTimeout(swap, 150);
        window.setTimeout(() => { scroller.classList.remove('is-fading'); }, 310);
        window.setTimeout(() => { dlg.classList.remove('is-switching'); }, 360);
    });
});

serviceModalTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openServiceModal(trigger));
});
// the rows of the Szolgáltatások lists are real buttons: they open the block's dialog in the single-item view of the matching plan / group
document.querySelectorAll('.svt-list__row').forEach((row) => {
    row.addEventListener('click', () => openServiceModal(row, parseInt(row.dataset.focus, 10)));
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
    const open = document.querySelector('.service-modal-overlay.is-open');
    if (event.key === 'Escape') {
        closeServiceModals();
    } else if (event.key === 'Tab' && open) {
        // focus trap: Tab / Shift+Tab cycle through the dialog's controls
        const dlg = open.querySelector('.service-modal');
        const items = Array.from(dlg.querySelectorAll('button, a[href]')).filter((el) => el.offsetParent !== null);
        if (!items.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1], cur = document.activeElement;
        if (!dlg.contains(cur)) { event.preventDefault(); first.focus(); }
        else if (event.shiftKey && (cur === first || cur === dlg)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && cur === last) { event.preventDefault(); first.focus(); }
    }
});

document.querySelectorAll('.modal-quote-btn, .modal-quote-link').forEach((button) => {
    button.addEventListener('click', (event) => {
        event.preventDefault();
        const target = button.dataset.redirect || '#contact';
        if (target.charAt(0) !== '#') {
            window.location.href = target;
            return;
        }
        closeServiceModals(false);                 // closes the dialog and restarts Lenis (focus goes to the target, not back)
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

    /* while the banner is open the footer gets room underneath, so the legal links are never hidden behind it */
    const reserveSpace = () => {
        document.documentElement.style.setProperty('--cb-h', banner && banner.classList.contains('is-visible') ? (banner.offsetHeight + 24) + 'px' : '0px');
    };

    const hideBanner = () => {
        if (!banner) return;
        banner.classList.remove('is-visible');
        banner.setAttribute('aria-hidden', 'true');
        reserveSpace();
    };

    const showBanner = () => {
        if (!banner) return;
        banner.classList.add('is-visible');
        banner.setAttribute('aria-hidden', 'false');
        reserveSpace();
    };
    window.addEventListener('resize', reserveSpace);

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
    function bind(btn) {
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
    }
    document.querySelectorAll('.hbtn').forEach(bind);
    (window.VB = window.VB || {}).bindHbtn = bind;      /* js/portfolio.js renders one more pill (Instagram card) after this runs */
})();

// Skills – floating logo preview following the cursor
// Exists only while the pointer is over a Skills row: hidden on leave, on scroll (content moving under a resting
// mouse fires no pointer events), when the section leaves the viewport, when the menu opens, on touch / blur.
(function () {
    var list = document.querySelector('.skills-list');
    var preview = document.querySelector('.skills-preview');
    var section = document.getElementById('skills');
    if (!list || !preview) return;
    /* real mouse input (html.has-cursor, set by cursor.js), not hover/pointer media queries: they are false on touch-screen laptops */
    var ok = { get matches() { return document.documentElement.classList.contains('has-cursor') && window.innerWidth > 900; } };
    var inner = preview.querySelector('.skills-preview__inner');
    var mx = -1, my = -1, px = 0, py = 0, rot = 0, running = false, active = null, tick = false;

    function loop() {
        var dx = mx - px;
        px += dx * 0.16;
        py += (my - py) * 0.16;
        rot += ((Math.max(-12, Math.min(12, dx * 0.15))) - rot) * 0.12;
        preview.style.transform = 'translate3d(' + (px + 130).toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
        if (active) requestAnimationFrame(loop);      /* stops as soon as the preview is hidden */
        else running = false;
    }

    function hide() {
        active = null;
        preview.classList.remove('is-visible');
    }
    function show(row) {
        if (!active) { px = mx; py = my; }
        active = row;
        var logo = row.querySelector('.skill-row__logo');
        inner.innerHTML = logo ? logo.innerHTML : '';
        preview.classList.add('is-visible');
        if (!running) { running = true; requestAnimationFrame(loop); }
    }

    list.addEventListener('pointermove', function (e) {
        if (!ok.matches || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
        mx = e.clientX; my = e.clientY;
        var row = e.target.closest('.skill-row');
        if (row && row !== active) show(row);
        else if (active && !running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });

    list.addEventListener('pointerleave', hide);
    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') hide(); }, true);

    /* scrolling: the list moves under a resting pointer, so re-test what is under it on every scroll tick */
    window.addEventListener('scroll', function () {
        if (!active || tick) return;
        tick = true;
        requestAnimationFrame(function () {
            tick = false;
            var u = document.elementFromPoint(mx, my);
            var row = u && u.closest ? u.closest('.skills-list .skill-row') : null;
            if (!row) hide();
            else if (row !== active) show(row);
        });
    }, { passive: true });

    /* section out of view, or the menu overlay opened: gone */
    if (section && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { if (!es[0].isIntersecting) hide(); }, { threshold: 0 }).observe(section);
    }
    new MutationObserver(function () { if (document.body.classList.contains('menu-open')) hide(); })
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

// Why section – expanding cards (click / tap / Enter / Space; no hover). Phones (< 768px): no accordion, a card plays its open state (.is-active) when it enters the viewport.
(function () {
    var panels = Array.prototype.slice.call(document.querySelectorAll('.why-panel'));
    if (!panels.length) return;
    var phone = window.matchMedia('(max-width: 767px)');
    var reduceWhy = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var segs = Array.prototype.slice.call(document.querySelectorAll('.why-progress button'));

    /* One card open at a time. `--k` = 1 when the open card sits before this one: the geometry of the row (>= 768px, style.css)
       is pure CSS from the open index, so nothing in the layout moves. */
    function activate(panel) {
        if (phone.matches) return;
        var s = panels.indexOf(panel);
        panels.forEach(function (p, i) {
            var on = p === panel;
            p.classList.toggle('is-active', on);
            p.classList.toggle('is-next', i === s + 1);          /* "up next": the next collapsed card's number + label stay at full opacity */
            p.style.setProperty('--k', i > s ? 1 : 0);
            var tab = p.querySelector('.why-panel__tab');
            if (tab) tab.setAttribute('aria-expanded', on ? 'true' : 'false');
        });
        if (!(API && API.pinned)) {                              /* not pinned (reduced motion, tablets, short windows): the bar shows the static current state; the pin scrubs it itself */
            segs.forEach(function (b, k) { b.style.setProperty('--f', k <= s ? 1 : 0); b.classList.remove('is-head'); });
        }
    }

    var API;
    var defaultPanel = panels.filter(function (p) { return p.classList.contains('is-active'); })[0] || panels[0];
    activate(defaultPanel);

    /* The vertical labels of the collapsed cards share one font size: 20px, or smaller when the longest label would not fit the card
       (card height - top padding - number - gap - bottom padding). Re-fitted whenever the row changes size (resize, pin on / off). */
    var row = panels[0].parentElement;
    function fitLabels() {
        if (window.innerWidth < 768) { row.style.removeProperty('--why-label-fs'); return; }          /* stacked accordion: horizontal labels */
        row.style.setProperty('--why-label-fs', '20px');
        var tab = panels[0].querySelector('.why-panel__tab'), cs = getComputedStyle(tab);
        var num = panels[0].querySelector('.why-panel__num').getBoundingClientRect().height;
        var avail = panels[0].getBoundingClientRect().height - parseFloat(cs.paddingTop) - num - 12 - parseFloat(cs.paddingBottom);
        var longest = 0;
        panels.forEach(function (p) { longest = Math.max(longest, p.querySelector('.why-panel__label').getBoundingClientRect().height); });
        if (longest > 0) row.style.setProperty('--why-label-fs', Math.max(11, Math.min(20, 20 * avail / longest)).toFixed(2) + 'px');
    }
    var fitRaf = 0;
    function queueFit() { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitLabels); }
    if (window.ResizeObserver) new ResizeObserver(queueFit).observe(row); else window.addEventListener('resize', queueFit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);
    queueFit();

    /* js/why-pin.js (>= 1024px, motion allowed) takes over `pinned` / `onSelect`: a click scrolls to the step of that card and the
       scroll position opens it. Everywhere else a click / tap opens the card directly (phones: tapping the open card closes it). */
    API = (window.VB = window.VB || {}).why = { panels: panels, activate: activate, pinned: false, onSelect: null };

    /* ---- the open-state pieces: title letters rise from masks, description rises line by line, icon strokes draw (pathLength 1) ---- */
    panels.forEach(function (panel) {
        var h = panel.querySelector('.why-panel__title');
        if (!h || reduceWhy) return;
        var text = h.textContent.trim(), n = 0;
        h.setAttribute('aria-label', text);
        h.textContent = '';
        text.split(' ').forEach(function (w, wi) {
            if (wi) h.appendChild(document.createTextNode(' '));
            var word = document.createElement('span');
            word.className = 'wm';
            word.setAttribute('aria-hidden', 'true');
            Array.from(w).forEach(function (ch) {
                var m = document.createElement('span'), s = document.createElement('span');
                m.className = 'wk';
                s.textContent = ch;
                s.style.setProperty('--ci', n++);
                m.appendChild(s);
                word.appendChild(m);
            });
            h.appendChild(word);
        });
    });
    function splitLines(p) {
        var text = p.getAttribute('data-t');
        if (!text) { text = p.textContent.replace(/\s+/g, ' ').trim(); p.setAttribute('data-t', text); }
        p.textContent = '';
        var words = text.split(' ').map(function (w, i) {
            var s = document.createElement('span');
            s.textContent = (i ? ' ' : '') + w;
            s.style.display = 'inline';
            p.appendChild(s);
            return s;
        });
        var lines = [], top = null;
        words.forEach(function (s) {
            var t = Math.round(s.getBoundingClientRect().top);
            if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
            lines[lines.length - 1].push(s.textContent);
        });
        p.textContent = '';
        lines.forEach(function (l, k) {
            var m = document.createElement('span'), s = document.createElement('span');
            m.className = 'wl';
            s.textContent = l.join('').replace(/^ /, '');
            s.style.setProperty('--li', k);
            m.appendChild(s);
            p.appendChild(m);
            if (k < lines.length - 1) p.appendChild(document.createTextNode(' '));
        });
    }
    function splitAll() {
        if (reduceWhy) return;
        panels.forEach(function (panel) { var p = panel.querySelector('.why-panel__text'); if (p) splitLines(p); });
    }
    function prepIcons() {
        panels.forEach(function (panel) {
            var svg = panel.querySelector('.why-panel__icon svg');
            if (!svg || svg.hasAttribute('data-draw')) return;
            Array.prototype.forEach.call(svg.querySelectorAll('*'), function (e) { e.setAttribute('pathLength', '1'); });
            svg.setAttribute('data-draw', '');
        });
    }
    prepIcons();
    window.addEventListener('DOMContentLoaded', prepIcons);
    window.addEventListener('load', prepIcons);
    var splitRaf = 0, splitW = 0;
    function queueSplit() {
        var w = Math.round(panels[0].querySelector('.why-panel__content').getBoundingClientRect().width);
        if (w === splitW) return;
        splitW = w; cancelAnimationFrame(splitRaf); splitRaf = requestAnimationFrame(splitAll);
    }
    if (window.ResizeObserver) new ResizeObserver(queueSplit).observe(row); else window.addEventListener('resize', queueSplit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { splitW = 0; queueSplit(); });
    queueSplit();

    /* ---- phones: each card opens (once) when it comes into view; the reduced-motion version shows them all open ---- */
    var seen = null;
    function phoneSetup() {
        if (seen) { seen.disconnect(); seen = null; }
        if (!phone.matches) { activate(panels.filter(function (p) { return p.classList.contains('is-active'); })[0] || panels[0]); return; }
        panels.forEach(function (p) { p.classList.remove('is-next'); });
        if (reduceWhy || !('IntersectionObserver' in window)) { panels.forEach(function (p) { p.classList.add('is-active'); }); return; }
        panels.forEach(function (p) { p.classList.remove('is-active'); });
        seen = new IntersectionObserver(function (es) {
            es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-active'); seen.unobserve(e.target); } });
        }, { threshold: 0.3, rootMargin: '0px 0px -8% 0px' });
        panels.forEach(function (p) { seen.observe(p); });
    }
    if (phone.addEventListener) phone.addEventListener('change', phoneSetup); else phone.addListener(phoneSetup);
    phoneSetup();

    segs.forEach(function (b, i) {
        b.addEventListener('click', function () {
            if (API.pinned && API.onSelect) API.onSelect(i); else if (!phone.matches) activate(panels[i]);
        });
    });

    panels.forEach(function (panel, i) {
        var tab = panel.querySelector('.why-panel__tab');
        if (!tab) return;
        tab.addEventListener('click', function () {
            if (API.pinned && API.onSelect) { API.onSelect(i); return; }
            if (window.innerWidth < 768 && panel.classList.contains('is-active')) {      /* stacked accordion: tap again = close */
                panel.classList.remove('is-active');
                tab.setAttribute('aria-expanded', 'false');
                return;
            }
            activate(panel);
        });
    });
})();

// Steps (Együttműködés) - "charge running along the line": ONE chain (a single svg: circle tracks + line tracks + their gradient fills, tangent joins, one stroke width, one gradient),
// scrubbed by the scroll: the head enters circle 1 at its left point, goes round it (the ring fills), leaves at the right point -> segment 1 -> circle 2 -> ... -> circle 4. A step is reached
// when the head arrives at its circle, passed when it leaves. The section pins on large screens (240svh of run; nothing is lit before the pin begins), the counter rolls 0/4 -> 4/4 with the steps,
// the heading plays the shared letter-rise reveal (+ dropping dot) when the section top reaches 85% of the viewport.
// Phones (< 768px) / short windows: no pin, the path follows the circles (the mark is ~60% of the viewport). Reduced motion: everything shown completed (4/4).
(function () {
    var section = document.getElementById('steps');
    var process = document.querySelector('.process');
    if (!section || !process) return;
    var steps = Array.prototype.slice.call(process.querySelectorAll('.process__step'));
    var N = steps.length;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pinQuery = window.matchMedia('(min-width: 768px) and (min-height: 520px) and (prefers-reduced-motion: no-preference)');
    var ticking = false;
    var title = section.querySelector('.steps-title');
    var reel = section.querySelector('.st-reel'), counter = section.querySelector('.st-count');
    var tip = process.querySelector('.process__head');
    var nodes = steps.map(function (s) { return s.querySelector('.process__node'); });
    var texts = steps.map(function (s) { return s.querySelector('.process__text'); });
    /* the closing row (.cta-row, shared with Szolgáltatások) plays its sequential entrance only in the pinned layout */
    var ctaRow = section.querySelector('.cta-row');
    function armCta() { if (ctaRow) ctaRow.classList.toggle('cta-row--armed', pinQuery.matches); }
    armCta(); window.addEventListener('resize', armCta);
    /* the KAPCSOLAT pill is exactly as large as the Szolgáltatások CTA pill (their labels differ in length): it takes that pill's width */
    function matchPill() {
        var mine = ctaRow && ctaRow.querySelector('.hbtn'), ref = document.querySelector('#services-cta .hbtn');
        if (!mine || !ref) return;
        mine.style.minWidth = '';
        var w = ref.getBoundingClientRect().width;
        if (w > mine.getBoundingClientRect().width) mine.style.minWidth = w.toFixed(2) + 'px';
    }
    window.addEventListener('resize', matchPill); window.addEventListener('load', matchPill);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(matchPill);
    matchPill();

    /* the Lucide check is drawn with its stroke: pathLength 1 */
    steps.forEach(function (step) {
        var ck = step.querySelector('.pn-check');
        if (ck) { Array.prototype.forEach.call(ck.querySelectorAll('path, polyline'), function (p) { p.setAttribute('pathLength', '1'); }); ck.setAttribute('data-draw', ''); }
    });

    /* ---- the descriptions: one mask per rendered line, risen when the step is reached ---- */
    function splitText(p) {
        var full = p.getAttribute('data-rv-text');
        if (full === null) { full = p.textContent.replace(/\s+/g, ' ').trim(); p.setAttribute('data-rv-text', full); }
        p.textContent = '';
        var words = full.split(' '), spans = words.map(function (w, i) {
            var s = document.createElement('span'); s.textContent = w; p.appendChild(s);
            if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
            return s;
        });
        var lines = [], top = null;
        spans.forEach(function (s, i) {
            var t = Math.round(s.getBoundingClientRect().top);
            if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
            lines[lines.length - 1].push(words[i]);
        });
        p.textContent = '';
        lines.forEach(function (ws, k) {
            var l = document.createElement('span'), i = document.createElement('span');
            l.className = 'rv-line'; i.className = 'rv-i'; i.textContent = ws.join(' ');
            l.style.setProperty('--ri', k); l.appendChild(i); p.appendChild(l);
        });
    }
    var splitDone = false;
    function splitAll() {
        if (reduce) return;
        texts.forEach(function (p, i) {
            if (!p) return;
            splitText(p); p.classList.add('rv-prep');
            p.classList.toggle('rv-in', steps[i].classList.contains('is-active'));         /* in sync with the steps already reached */
        });
        splitDone = true;
    }

    /* ---- the charge path: pieces ring0, seg0, ring1, seg1, ... (weights: a ring 0.55, a segment 1); pos 0..TW along it, -1 = not started ---- */
    /* a ring that is followed by a line is 1.5 turns (enter at the left point, round the whole circle, on over the top half to the right point where the line leaves); the last one is 1 turn */
    var WR = 0.55, WS = 1, ringS = [], ringE = [], segS = [], segE = [], WRk = [], TURN = [], TW = 0;
    for (var k = 0; k < N; k++) {
        TURN[k] = k < N - 1 ? 1.5 : 1; WRk[k] = WR * TURN[k];
        ringS[k] = TW; TW += WRk[k]; ringE[k] = TW;
        if (k < N - 1) { segS[k] = TW; TW += WS; segE[k] = TW; }
    }
    var SW = 2, geo = null, chain = null, chainFil = { rings: [], segs: [] }, vertical = false;
    /* the chain svg: built once, laid out (in the unscaled local pixels of .process) by layoutChain */
    function svgEl(tag, attrs, parent) {
        var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var a in attrs) e.setAttribute(a, attrs[a]);
        if (parent) parent.appendChild(e);
        return e;
    }
    var chainTrk = { rings: [], segs: [] };
    function buildChain() {
        chain = svgEl('svg', { 'class': 'pn-chain', 'aria-hidden': 'true', focusable: 'false' });
        var defs = svgEl('defs', {}, chain), g = svgEl('linearGradient', { id: 'pnChainGrad', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
        svgEl('stop', { offset: '0', 'stop-color': '#6c63ff' }, g); svgEl('stop', { offset: '1', 'stop-color': '#c850c0' }, g);
        var trk = svgEl('g', {}, chain), fil = svgEl('g', { 'class': 'pn-fills' }, chain);
        for (var i = 0; i < N; i++) {
            chainTrk.rings[i] = svgEl('path', { 'class': 'pn-trk' }, trk);
            chainFil.rings[i] = svgEl('path', { 'class': 'pn-fil', pathLength: '1' }, fil);
            if (i < N - 1) { chainTrk.segs[i] = svgEl('line', { 'class': 'pn-trk' }, trk); chainFil.segs[i] = svgEl('line', { 'class': 'pn-fil', pathLength: '1' }, fil); }
        }
        chain._grad = g;
        process.insertBefore(chain, process.firstChild);
    }
    function localPos(n, step) {                                    /* the node's position in the unscaled local pixels of .process (sub-pixel: the step's rect + the node's offset in it; the node itself may be scaled) */
        var pr = process.getBoundingClientRect(), sr = step.getBoundingClientRect(), k = pr.width / (process.offsetWidth || 1) || 1;
        return { x: (sr.left - pr.left) / k + n.offsetLeft, y: (sr.top - pr.top) / k + n.offsetTop };
    }
    function layoutChain() {
        if (!chain) buildChain();
        var W = process.offsetWidth, H = process.offsetHeight;
        vertical = window.innerWidth < 768;
        chain.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        geo = { rings: [], segs: [], a0: vertical ? 1.5 * Math.PI : Math.PI };
        var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        nodes.forEach(function (n, i) {
            var p = localPos(n, steps[i]), w = n.offsetWidth, r = w / 2 - SW / 2, cx = p.x + w / 2, cy = p.y + n.offsetHeight / 2;
            geo.rings[i] = { cx: cx, cy: cy, r: r };
            minX = Math.min(minX, cx - w / 2); maxX = Math.max(maxX, cx + w / 2); minY = Math.min(minY, cy - w / 2); maxY = Math.max(maxY, cy + w / 2);
            var sx = cx + r * Math.cos(geo.a0), sy = cy + r * Math.sin(geo.a0), ox = cx - r * Math.cos(geo.a0), oy = cy - r * Math.sin(geo.a0);
            var d = 'M' + sx + ' ' + sy + 'A' + r + ' ' + r + ' 0 1 1 ' + ox + ' ' + oy + 'A' + r + ' ' + r + ' 0 1 1 ' + sx + ' ' + sy;
            chainTrk.rings[i].setAttribute('d', d); chainFil.rings[i].setAttribute('d', d);
        });
        for (var i = 0; i < N - 1; i++) {
            var a = geo.rings[i], b = geo.rings[i + 1], o = a.r + SW / 2, s = null;           /* o = the ring's outer edge */
            if (Math.abs(a.cy - b.cy) < 2 && b.cx > a.cx) s = { x1: a.cx + o, y1: a.cy, x2: b.cx - o, y2: a.cy };
            else if (Math.abs(a.cx - b.cx) < 2 && b.cy > a.cy) s = { x1: a.cx, y1: a.cy + o, x2: a.cx, y2: b.cy - o };
            geo.segs[i] = s;
            [chainTrk.segs[i], chainFil.segs[i]].forEach(function (e) {
                if (s) { e.setAttribute('x1', s.x1); e.setAttribute('y1', s.y1); e.setAttribute('x2', s.x2); e.setAttribute('y2', s.y2); e.style.display = ''; }
                else e.style.display = 'none';
            });
        }
        var g = chain._grad;
        g.setAttribute('x1', vertical ? (minX + maxX) / 2 : minX); g.setAttribute('x2', vertical ? (minX + maxX) / 2 : maxX);
        g.setAttribute('y1', vertical ? minY : (minY + maxY) / 2); g.setAttribute('y2', vertical ? maxY : (minY + maxY) / 2);
    }
    layoutChain();
    window.addEventListener('load', layoutChain);
    if ('ResizeObserver' in window) new ResizeObserver(layoutChain).observe(process);
    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    /* ---- the state: cur = the latest step the head has arrived at (-1: none), doneTo = the last step whose ring is complete (-1: none) ---- */
    var curState = -2, doneState = -2, movingT = [];
    function setState(cur, doneTo) {
        if (cur === curState && doneTo === doneState) return;
        curState = cur; doneState = doneTo;
        steps.forEach(function (step, i) {
            var reached = i <= cur, done = i <= doneTo;
            step.classList.toggle('is-active', reached);
            step.classList.toggle('is-current', reached && !done);
            step.classList.toggle('is-done', done);
            var p = texts[i];
            if (p && p.classList.contains('rv-prep') && p.classList.contains('rv-in') !== reached) {
                p.classList.add('rv-moving'); p.classList.toggle('rv-in', reached);
                clearTimeout(movingT[i]); movingT[i] = setTimeout(function () { p.classList.remove('rv-moving'); }, 1600);
            }
        });
        if (reel) reel.style.setProperty('--cur', String(cur + 1));            /* 0/4 (dim) before step 1, then 1..4 exactly with the steps; rolls back on reverse */
        if (counter) counter.classList.toggle('on', cur >= 0);
    }

    /* pos -> every ring / segment fraction, the state and the glowing head */
    function applyPos(pos, finAll) {
        var cur = -1, doneTo = -1;
        for (var i = 0; i < N; i++) {
            var g = clamp01((pos - ringS[i]) / WRk[i]), rf = Math.min(1, g * TURN[i]), sf = i < N - 1 ? clamp01((pos - segS[i]) / WS) : 0;
            steps[i].style.setProperty('--ring', rf.toFixed(3));
            steps[i].style.setProperty('--seg', sf.toFixed(3));
            setFill(chainFil.rings[i], rf);
            if (i < N - 1) setFill(chainFil.segs[i], geo && geo.segs[i] ? sf : 0);
            if (pos >= ringS[i]) cur = i;
            if (pos > ringE[i] + 1e-6) doneTo = i;
        }
        if (finAll) doneTo = N - 1;
        setState(cur, doneTo);
        placeHead(pos);
    }
    function setFill(e, f) {                                        /* the gradient fill of one piece: dash offset = 1 - fraction; an undrawn round cap would leave a dot */
        if (!e) return;
        e.style.strokeDashoffset = (1 - f).toFixed(4); e.style.visibility = f > 0.0005 ? 'visible' : 'hidden';
    }
    function placeHead(pos) {
        if (!tip || reduce) return;
        if (pos <= 0.0001 || pos >= TW - 0.0001) { tip.style.opacity = '0'; return; }
        if (!geo) return;
        var x = null, y = null;
        for (var i = 0; i < N && x === null; i++) {
            if (pos <= ringE[i]) {                                        /* round circle i: in at its left (top on phones) point, clockwise; 1.5 turns, out at the opposite point */
                var rg = geo.rings[i], th = geo.a0 + clamp01((pos - ringS[i]) / WRk[i]) * TURN[i] * 2 * Math.PI;
                x = rg.cx + rg.r * Math.cos(th); y = rg.cy + rg.r * Math.sin(th);
            } else if (i < N - 1 && pos <= segE[i]) {                     /* along line i, towards the next circle */
                var s = geo.segs[i], f = clamp01((pos - segS[i]) / WS);
                if (s) { x = s.x1 + f * (s.x2 - s.x1); y = s.y1 + f * (s.y2 - s.y1); }
            }
        }
        if (x === null) { tip.style.opacity = '0'; return; }
        tip.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        tip.style.opacity = '1';
    }

    /* the pinned timeline: t -> pos; step 1 is reached just after the pin begins (nothing before) */
    var T0 = 0.07, T1 = 0.93, TDONE = 0.97;
    function posAt(t) { return t < T0 ? -1 : clamp01((t - T0) / (T1 - T0)) * TW; }

    function fit() {
        var inner = section.querySelector('.steps-inner');
        if (!inner) return;
        if (!pinQuery.matches) { section.style.removeProperty('--fit'); return; }
        var pin = section.querySelector('.steps-pin') || section;
        var pcs = window.getComputedStyle(pin);
        var avail = window.innerHeight - parseFloat(pcs.paddingTop) - parseFloat(pcs.paddingBottom);
        section.style.setProperty('--fit', '1');
        var natural = inner.offsetHeight;
        /* the head line is laid out at size / fit, so it always renders at the common size: only the rest scales */
        var hd = inner.querySelector('.steps-title');
        var fixedH = hd ? hd.offsetHeight : 0;
        var s = natural > fixedH ? Math.max(0.55, Math.min(1, (avail - fixedH) / (natural - fixedH))) : 1;
        section.style.setProperty('--fit', s.toFixed(3));
        /* the stage is its content (+ paddings) tall, at most one viewport: the section is that + the pin run (CSS) */
        section.style.setProperty('--stage-h', Math.round(s < 1 ? window.innerHeight : Math.min(pin.offsetHeight, window.innerHeight)) + 'px');
    }

    function update() {
        ticking = false;
        if (reduce) { applyPos(TW, true); section.classList.add('steps-done'); if (ctaRow) ctaRow.classList.add('is-in'); return; }
        var r = section.getBoundingClientRect();
        var vh = window.innerHeight;
        if (pinQuery.matches) {
            var pinEl = section.querySelector('.steps-pin');
            var total = Math.max(1, r.height - (pinEl ? pinEl.offsetHeight : vh));
            var t = Math.max(0, Math.min(1, -r.top / total));
            applyPos(posAt(t), t >= TDONE);
            section.classList.toggle('steps-done', t >= TDONE);
            if (ctaRow) ctaRow.classList.toggle('is-in', t >= TDONE);
        } else {
            /* no pin: the path follows the circles: the mark (~60% of the viewport) is a position along it; a ring takes +-36px of scroll */
            var mark = vh * 0.6, R = 36, yc = nodes.map(function (n) { var b = n.getBoundingClientRect(); return b.top + b.height / 2; });
            var pos = -1;
            for (var i = 0; i < N; i++) {
                if (mark >= yc[i] - R && mark <= yc[i] + R) { pos = ringS[i] + (mark - (yc[i] - R)) / (2 * R) * WRk[i]; break; }
                if (i < N - 1 && mark > yc[i] + R && mark < yc[i + 1] - R) { pos = segS[i] + (mark - (yc[i] + R)) / Math.max(1, yc[i + 1] - yc[i] - 2 * R) * WS; break; }
                if (i === N - 1 && mark > yc[i] + R) pos = TW;
            }
            var bodyB = steps[N - 1].getBoundingClientRect().bottom;
            applyPos(pos, pos >= TW && bodyB < vh * 0.85);
            section.classList.add('steps-done');
            if (ctaRow) ctaRow.classList.toggle('is-in', pos >= ringS[N - 1]);
        }
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
        scheduleSnap();
    }

    /* ---- gentle snap (pinned only): after the scroll stops, settle where a ring is complete (like Értékek) ---- */
    var snapT = 0, TARGETS = [];
    for (var q = 0; q < N - 1; q++) TARGETS.push(T0 + ringE[q] / TW * (T1 - T0));
    TARGETS.push(0.985);
    function scheduleSnap() { clearTimeout(snapT); snapT = setTimeout(snap, 180); }
    function snap() {
        if (reduce || !pinQuery.matches || !window.VB || !VB.lenis || VB.lenis.isScrolling) return;
        var r = section.getBoundingClientRect(), pinEl = section.querySelector('.steps-pin');
        var total = Math.max(1, r.height - (pinEl ? pinEl.offsetHeight : window.innerHeight));
        var t = -r.top / total;
        if (t < 0.03 || t > 0.995) return;
        var best = TARGETS[0];
        TARGETS.forEach(function (x) { if (Math.abs(x - t) < Math.abs(best - t)) best = x; });
        var dy = (best - t) * total;
        if (Math.abs(dy) < 6) return;
        VB.lenis.scrollTo(window.scrollY + dy, { duration: 0.6 });
    }

    /* ---- the heading: the SAME reveal as "Három terület, egy kézből." (the shared .fx-* rules in style.css: letters rise from their masks, the accent dot drops with a ripple; the
       proximity hover comes from js/heading-fx.js) - compressed to <= 1.3s and started EARLY: when the section top enters 85% of the viewport (before the pin begins), so it has
       landed before step 1 charges. Leaving downwards (scrolling back up) reverses it. The counter is not part of it (see setState). ---- */
    var chars = [];
    if (title) {
        Array.prototype.forEach.call(title.querySelectorAll('.st-rv'), function (rv) {
            var frag = document.createDocumentFragment();
            rv.textContent.split(' ').forEach(function (w, wi, all) {
                var word = document.createElement('span'); word.className = 'sh-word'; word.setAttribute('aria-hidden', 'true');
                Array.from(w).forEach(function (c) {
                    var m = document.createElement('span'); m.className = 'sh-mask';
                    var s = document.createElement('span'); s.className = 'sh-char'; s.setAttribute('data-c', c.toUpperCase()); s.textContent = c; m.appendChild(s); word.appendChild(m); chars.push(s);
                });
                frag.appendChild(word);
                if (wi < all.length - 1) frag.appendChild(document.createTextNode(' '));
            });
            rv.parentNode.replaceChild(frag, rv);
        });
        var dotCh = title.querySelector('.sh-dot'); if (dotCh) chars.push(dotCh);          /* the dot is the last letter (after the counter) */
        chars.forEach(function (s, i) { s.style.setProperty('--ci', i); });
        title.style.setProperty('--cn', chars.length);
        title._shChars = chars; title.classList.add('is-split');
        if (!reduce && 'IntersectionObserver' in window) {
            var hTimer = 0;
            title.classList.add('fx-prep');
            if (dotCh) dotCh.addEventListener('animationend', function (ev) { if (ev.animationName === 'ctcDotDrop' && title.classList.contains('fx-in')) title.classList.add('fx-done'); });
            new IntersectionObserver(function (es) {
                var e = es[es.length - 1], on = e.isIntersecting;
                if (!on && !(e.boundingClientRect.top > 0)) return;
                if (on === title.classList.contains('fx-in')) return;
                if (!on) title.classList.remove('fx-done');
                title.classList.add('fx-moving'); title.classList.toggle('fx-in', on);
                clearTimeout(hTimer); hTimer = setTimeout(function () { title.classList.remove('fx-moving'); }, 2000);
            }, { rootMargin: '0px 0px -15% 0px', threshold: 0 }).observe(section);
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { fit(); if (splitDone) splitAll(); layoutChain(); onScroll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { splitAll(); fit(); layoutChain(); update(); });
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
        if (!q.matches || section.classList.contains('is-pinned')) { section.style.removeProperty('--fit'); section.style.removeProperty('--fit-h'); return; }
        section.style.setProperty('--fit-h', 'auto');
        section.style.setProperty('--fit', '1');
        var wcs = window.getComputedStyle(section);
        var avail = window.innerHeight - parseFloat(wcs.paddingTop) - parseFloat(wcs.paddingBottom);
        var natural = inner.offsetHeight;
        /* the section heading is laid out at size / fit, so it always renders at the common size: only the rest scales */
        var hd = inner.querySelector('.section-heading');
        var fixedH = hd ? hd.offsetHeight : 0;
        var s = natural > fixedH ? Math.max(0.55, Math.min(1, (avail - fixedH) / (natural - fixedH))) : 1;
        section.style.setProperty('--fit', s.toFixed(3));
        section.style.setProperty('--fit-h', Math.round(fixedH + (natural - fixedH) * s) + 'px');
    }

    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener('load', fit);
    fit();
})();

// Footer: back to top (the badge on the divider): Lenis scrollTo(0) ~1.2s when present, native smooth otherwise; the focus moves to the header logo
document.querySelectorAll('[data-back-top]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (window.VB && VB.lenis) VB.lenis.scrollTo(0, { duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
        else window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
        const target = document.querySelector('.nav__logo') || document.getElementById('hero') || document.body;
        if (!target.hasAttribute('tabindex') && !/^(A|BUTTON)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    });
});
