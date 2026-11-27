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
// the plan icons draw their strokes when the dialog opens (style.css: pathLength 1 + data-draw)
const prepDraw = (root) => root.querySelectorAll('svg').forEach((svg) => {
    if (svg.hasAttribute('data-draw')) return;
    svg.querySelectorAll('*').forEach((e) => e.setAttribute('pathLength', '1'));
    svg.setAttribute('data-draw', '');
});
document.querySelectorAll('.service-modal .pricing-icon:not(.svm-icon)').forEach(prepDraw);

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
    if (iconSlot && planIcon) { iconSlot.innerHTML = planIcon.innerHTML; prepDraw(iconSlot); }          // the plan's icon tile goes above the centred title
    dlg.setAttribute('data-view', 'single');
    dlg.setAttribute('data-item', String(idx));
    h3.textContent = (groups.length ? item.querySelector('.modal-group__title') : item.querySelector('h4')).textContent.trim();
};

// phones: the full view's title is fixed above the scrolling cards, so the scroll area starts below it: its height (it may wrap) goes to --sm-th
const fitServiceTitle = (overlay) => {
    const dlg = overlay && overlay.querySelector('.service-modal');
    const h3 = dlg && dlg.querySelector('h3');
    if (h3 && h3.offsetHeight) dlg.style.setProperty('--sm-th', h3.offsetHeight + 'px');
};
window.addEventListener('resize', () => fitServiceTitle(document.querySelector('.service-modal-overlay.is-open')));          // also a rotation

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
    fitServiceTitle(targetModal);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitServiceTitle(targetModal));
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
            fitServiceTitle(modal);
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
    /* the "Cookie beállítások" buttons inside the privacy policy text (page and modal) open the same settings as the footer trigger */
    document.addEventListener('click', (e) => { if (e.target.closest('[data-open-cookie-settings]') && settingsBtn) { e.preventDefault(); settingsBtn.click(); } });

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
    var mx = -1, my = -1, px = 0, py = 0, rot = 0, tiltX = 0, tiltY = 0, running = false, active = null, tick = false;

    function loop() {
        var dx = mx - px;
        px += dx * 0.16;
        py += (my - py) * 0.16;
        rot += ((Math.max(-12, Math.min(12, dx * 0.15))) - rot) * 0.12;
        preview.style.transform = 'translate3d(' + (px + 130).toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
        /* subtle 3D tilt toward the pointer (max 6deg, eased); the CSS transform adds perspective(900px) */
        tiltX += ((Math.max(-1, Math.min(1, (my - py) / 80)) * -6) - tiltX) * 0.12;
        tiltY += ((Math.max(-1, Math.min(1, (mx - (px + 130)) / 130)) * 6) - tiltY) * 0.12;
        inner.style.setProperty('--rx', tiltX.toFixed(2) + 'deg');
        inner.style.setProperty('--ry', tiltY.toFixed(2) + 'deg');
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

// Steps (Együttműködés) - a smooth step progress: a thin 2px track through the four nodes, a brand-gradient fill that grows with the scroll (scrub, no steps) with a soft glowing head at its tip.
// A node is a 10px dot until the fill reaches it, then it grows into a 48px round gradient icon (one glow pulse); a completed step gets a check badge. The text of a step: upcoming 45% / current
// 100% / completed 75% (CSS, 0.4s). Everything is reversible. The counter in the heading ("1/4.") rolls with the steps; the heading plays the shared letter-rise reveal when the section top
// reaches 85% of the viewport. >= 900px (and >= 520px tall, motion allowed) the section pins (240svh of run; nothing is lit before the pin begins); below / short windows: no pin, the track is vertical
// (stacked steps) and the fill follows the mark at ~60% of the viewport. Reduced motion: every step completed, static (4/4).
(function () {
    var section = document.getElementById('steps');
    var process = document.querySelector('.process');
    if (!section || !process) return;
    var steps = Array.prototype.slice.call(process.querySelectorAll('.process__step'));
    var N = steps.length;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pinQuery = window.matchMedia(window.VB.desk(900, '(min-height: 520px) and (prefers-reduced-motion: no-preference)'));
    var ticking = false;
    var title = section.querySelector('.steps-title');
    var reel = section.querySelector('.st-reel'), counter = section.querySelector('.st-count');
    var nodes = steps.map(function (s) { return s.querySelector('.process__node'); });
    /* the closing row (.cta-row, shared with Szolgáltatások) plays its sequential entrance only in the pinned layout */
    var ctaRow = section.querySelector('.cta-row');
    function armCta() { if (ctaRow) ctaRow.classList.toggle('cta-row--armed', pinQuery.matches); }
    armCta(); window.addEventListener('resize', armCta);

    /* ---- geometry: the track runs through the centres of the nodes (x in the row layout, y in the stacked one); th[i] = where along it node i sits (0..1) ---- */
    var th = [0, 1 / 3, 2 / 3, 1], len = 0, vertical = false;
    function measure() {
        var pr = process.getBoundingClientRect(), k = pr.width / (process.offsetWidth || 1) || 1;
        vertical = window.innerWidth < 900 || window.VB.mqPT.matches;
        var c = nodes.map(function (n) { var r = n.getBoundingClientRect(); return vertical ? ((r.top + r.height / 2) - pr.top) / k : ((r.left + r.width / 2) - pr.left) / k; });
        len = Math.max(0, c[N - 1] - c[0]);
        th = c.map(function (v) { return len > 0 ? (v - c[0]) / len : 0; });
        process.style.setProperty('--len', len.toFixed(1) + 'px');
    }
    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    /* ---- the state: cur = the latest step the fill has reached (-1: none), finAll = the last step is completed too ---- */
    var curState = -2, finState = null;
    function setState(cur, finAll) {
        if (cur === curState && finAll === finState) return;
        curState = cur; finState = finAll;
        steps.forEach(function (step, i) {
            var reached = i <= cur, done = i < cur || (finAll && i === N - 1 && cur === N - 1);
            step.classList.toggle('is-active', reached);
            step.classList.toggle('is-current', reached && !done);
            step.classList.toggle('is-done', done);
        });
        if (reel) reel.style.setProperty('--cur', String(cur + 1));            /* 0/4 (dim) before step 1, then 1..4 exactly with the steps; rolls back on reverse */
        if (counter) counter.classList.toggle('on', cur >= 0);
    }

    /* pos (-1 = not started, 0..1 along the track) -> the fill, the head, the state */
    function applyPos(pos, finAll) {
        var p = pos < 0 ? 0 : clamp01(pos);
        process.style.setProperty('--p', p.toFixed(4));
        process.classList.toggle('is-running', pos >= 0 && !(finAll && pos >= 1));
        var cur = -1;
        for (var i = 0; i < N; i++) if (pos >= 0 && pos >= th[i] - 1e-6) cur = i;
        setState(cur, !!finAll);
    }

    /* the pinned timeline: t -> pos; step 1 is reached just after the pin begins (nothing before) */
    var T0 = 0.07, T1 = 0.93, TDONE = 0.97;
    function posAt(t) { return t < T0 ? -1 : clamp01((t - T0) / (T1 - T0)); }

    function fit() {
        var inner = section.querySelector('.steps-inner');
        if (!inner) return;
        if (!pinQuery.matches) { section.style.removeProperty('--fit'); section.classList.remove('steps-center'); return; }
        var pin = section.querySelector('.steps-pin') || section;
        var pcs = window.getComputedStyle(pin);
        var avail = window.innerHeight - parseFloat(pcs.paddingTop) - parseFloat(pcs.paddingBottom);
        section.style.setProperty('--fit', '1');
        var natural = inner.offsetHeight;
        /* centre the block in the pinned viewport (>= 800px tall) only while the space above / below it is >= the header height + 24px */
        var hdrH = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--hdr-h')) || 92;
        section.classList.toggle('steps-center', window.innerHeight >= 800 && (window.innerHeight - natural) / 2 >= hdrH + 24);
        pcs = window.getComputedStyle(pin); avail = window.innerHeight - parseFloat(pcs.paddingTop) - parseFloat(pcs.paddingBottom);
        /* the head line (and the label / subheading) are laid out at size / fit, so they always render at the common size: only the rest scales */
        var hd = inner.querySelector('.steps-title');
        var fixedH = hd ? hd.offsetHeight : 0;
        var s = natural > fixedH ? Math.max(0.55, Math.min(1, (avail - fixedH) / (natural - fixedH))) : 1;
        section.style.setProperty('--fit', s.toFixed(3));
        /* the stage is its content (+ paddings) tall, at most one viewport: the section is that + the pin run (CSS) */
        section.style.setProperty('--stage-h', Math.round(s < 1 ? window.innerHeight : Math.min(pin.offsetHeight, window.innerHeight)) + 'px');
    }

    function update() {
        ticking = false;
        if (reduce) { applyPos(1, true); section.classList.add('steps-done'); if (ctaRow) ctaRow.classList.add('is-in'); return; }
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
            /* no pin: the fill follows the mark (~60% of the viewport) along the track (stacked: down the nodes; a short wide window: by the row's position) */
            var mark = vh * 0.6, pos;
            if (vertical) {
                var yc = nodes.map(function (n) { var b = n.getBoundingClientRect(); return b.top + b.height / 2; });
                pos = mark < yc[0] - 24 ? -1 : clamp01((mark - yc[0]) / Math.max(1, yc[N - 1] - yc[0]));
            } else {
                var pr = process.getBoundingClientRect();
                pos = clamp01((vh * 0.85 - pr.top) / (vh * 0.4)); if (pos <= 0) pos = -1;
            }
            var bodyB = steps[N - 1].getBoundingClientRect().bottom;
            applyPos(pos, pos >= 1 && bodyB < vh * 0.85);
            section.classList.add('steps-done');
            if (ctaRow) ctaRow.classList.toggle('is-in', pos >= th[N - 1]);
        }
    }

    function onScroll() {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
        scheduleSnap();
    }

    /* ---- gentle snap (pinned only): after the scroll stops, settle where a step has just been reached (like Értékek) ---- */
    var snapT = 0;
    function scheduleSnap() { clearTimeout(snapT); snapT = setTimeout(snap, 180); }
    function snap() {
        if (reduce || !pinQuery.matches || !window.VB || !VB.lenis || VB.lenis.isScrolling) return;
        var r = section.getBoundingClientRect(), pinEl = section.querySelector('.steps-pin');
        var total = Math.max(1, r.height - (pinEl ? pinEl.offsetHeight : window.innerHeight));
        var t = -r.top / total;
        if (t < 0.03 || t > 0.995) return;
        var targets = th.slice(1).map(function (x) { return T0 + x * (T1 - T0) + 0.01; }); targets.push(0.985);      /* a hair past the node: the step has surely been reached */
        var best = targets[0];
        targets.forEach(function (x) { if (Math.abs(x - t) < Math.abs(best - t)) best = x; });
        var dy = (best - t) * total;
        if (Math.abs(dy) < 6) return;
        VB.lenis.scrollTo(window.scrollY + dy, { duration: 0.6 });
    }

    /* ---- the heading: the SAME reveal as "Három terület, egy kézből." (the shared .fx-* rules in style.css: letters rise from their masks, the accent dot drops with a ripple; the
       proximity hover comes from js/heading-fx.js) - compressed to <= 1.3s and started EARLY: when the section top enters 85% of the viewport (before the pin begins), so it has
       landed before step 1 is reached. Leaving downwards (scrolling back up) reverses it. The counter is not part of it (see setState). ---- */
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
    window.addEventListener('resize', function () { fit(); measure(); onScroll(); });
    if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); onScroll(); }).observe(process);
    window.addEventListener('load', function () { measure(); update(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); measure(); update(); });
    fit();
    measure();
    update();
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
