// Custom cursor: dot + morphing ring (fine pointers only, respects reduced motion).
//
// One rule set for the whole site (all pages, menu overlay, modals, footer, forms, cookie banner):
//   interactive target = LINK selector below (+ [data-cursor], checkbox / radio controls).
//   target class, decided from the element's computed style (never from its size):
//     text    – no own background / border (menu items, footer links, inline links): capsule around the text box,
//               padding ~0.18em vertical / 0.35em horizontal (min 4px / 8px), radius up to 20px
//     box     – buttons, icon buttons, chips, selects, checkbox: frame follows the element's own rect (+4px) and radius (+4px)
//     card    – big clickable surfaces (own background/border and > 420 x 160): no frame, the ring grows to a small
//               ring (intentional, unchanged)
//     view    – [data-cursor="view"] / about photo: the labelled disc (unchanged)
//   text fields: native text cursor, custom cursor hidden.
// Rects are measured at hover time and cached; re-measured on scroll, resize, element resize, transitions/animations
// ending and a few settle timers - never per frame. The frame is clamped to the viewport (12px margin).
// Keyboard: :focus-visible gets the same frame. Dark/light contrast comes from the background colour under the
// pointer (nearest ancestor with a solid background), so it holds on overlays, modals and gradients.
(function () {
    /* the custom cursor must never leave a user without a pointer: any failure restores the native one */
    function restoreNative(why) {
        try {
            document.documentElement.classList.remove('has-cursor', 'cursor-hidden', 'cursor-keyboard');
            Array.prototype.forEach.call(document.querySelectorAll('.cursor-ring, .cursor-dot'), function (e) { e.remove(); });
            if (window.console) console.warn('[VarBro] custom cursor off:', why);
        } catch (e) { /* nothing left to do */ }
    }
    try { init(); } catch (err) { restoreNative(err); }

    function init() {
    /* Activation is based on REAL INPUT, not on media queries (touch-screen laptops report pointer: coarse / hover: none
       even with a mouse in hand): the native cursor stays until the first mouse / pen pointermove; a touch turns the
       custom cursor off again. Only prefers-reduced-motion keeps it off for good. */
    var reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMq.matches) return;
    var enabled = false, broken = false, lastTouch = 0;

    var LINK = 'a, button, [role="button"], label, summary, select, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], [data-cursor="frame"], .hero-chip, .skills-dot, .about-sign';
    var MAGNETIC = '.hbtn, .burger, .nav__logo, .menu__link, .modal-quote-btn, .stamp, .service-modal-trigger, .svt-btn, .pf-btn, .btn-about';
    var VIEW = '.about-photo-card, [data-cursor="view"]';
    var TEXT = 'p, h1, h2, h3, h4, li, blockquote';
    var FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]';
    var MARGIN = 12;            /* the frame never gets closer than this to the viewport edge */
    var HOLD = 90;              /* ms the frame is kept when the pointer crosses a gap between two targets */

    var root = document.documentElement;
    var dot = null, ring = null, label = null;      /* created on the first real mouse move */
    function ensureElements() {
        if (ring) return;
        dot = document.createElement('div');
        dot.className = 'cursor-dot';
        ring = document.createElement('div');
        ring.className = 'cursor-ring';
        label = document.createElement('span');
        label.className = 'cursor-label';
        ring.appendChild(label);
        [ring, dot].forEach(function (el) {
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
        });
    }

    var mx = -100, my = -100, rx = -100, ry = -100;
    var running = false;
    var magnet = null, magRect = null, mOffX = 0, mOffY = 0;   /* layout rect (without the magnet translate) + current offset */
    var frame = null;           /* { el, kind, box:{l,t,w,h}, radius, base:{...} } */
    var mode = 'hover';         /* 'hover' | 'focus' */
    var holdTimer = 0, settleTimers = [], ro = null, lastEl = null;

    /* ------------------------------------------------------------ helpers */
    function alpha(c) {
        var m = /rgba?\(([^)]+)\)/.exec(c || '');
        if (!m) return 0;
        var p = m[1].split(/[ ,\/]+/).filter(Boolean);
        return p.length > 3 ? parseFloat(p[3]) : 1;
    }
    function lum(c) {
        var m = /rgba?\(([^)]+)\)/.exec(c || '');
        if (!m) return 1;
        var p = m[1].split(/[ ,\/]+/).map(parseFloat);
        return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
    }
    /* dark = the nearest ancestor with a solid background (or a gradient) is dark */
    function isDark(t) {
        var forced = t.closest('[data-cursor-theme]');
        if (forced) return forced.getAttribute('data-cursor-theme') === 'dark';
        var nav = t.closest('.nav');   /* the transparent header: its theme is the section under it (or the menu overlay) */
        if (nav) return nav.classList.contains('nav--menu-open') || !nav.classList.contains('nav--on-light');
        for (var e = t; e && e.nodeType === 1; e = e.parentElement) {
            var cs = getComputedStyle(e);
            if (cs.backgroundImage !== 'none' && cs.backgroundClip !== 'text' && /gradient/.test(cs.backgroundImage)) return true;
            if (alpha(cs.backgroundColor) >= 0.5) return lum(cs.backgroundColor) < 0.5;
        }
        return false;
    }
    function layoutRect(el) {
        var r = el.getBoundingClientRect();
        var off = (magnet && magnet.contains(el)) ? { x: mOffX, y: mOffY } : { x: 0, y: 0 };
        return { l: r.left - off.x, t: r.top - off.y, w: r.width, h: r.height };
    }

    /* which class is this target? decided from style, never from size (except the card class) */
    function classify(el) {
        if (el.matches('select, input, [data-cursor="frame"]')) return 'box';
        var cs = getComputedStyle(el);
        var clipText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text';   /* menu items fill their text on hover */
        var plainBg = clipText || (alpha(cs.backgroundColor) < 0.05 && cs.backgroundImage === 'none');
        var bordered = parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.05;
        var hasText = (el.textContent || '').trim().length > 0;
        var media = !!el.querySelector('img, picture, video, canvas');
        var rounded = (parseFloat(cs.borderTopLeftRadius) || 0) > 0;   /* pills whose fill lives in child layers (.hbtn) are boxes */
        if (plainBg && !bordered && !rounded && hasText && !media) return 'text';
        var r = el.getBoundingClientRect();
        if (r.width > 420 || r.height > 160) return 'card';
        return 'box';
    }

    function computeBox(f) {
        var el = f.el, cs = getComputedStyle(el), b = layoutRect(el), l, t, w, h, rad;
        if (f.kind === 'text') {
            var fs = parseFloat(cs.fontSize) || 16;
            var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
            var pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
            var padV = Math.max(4, 0.18 * fs), padH = Math.max(8, 0.35 * fs);
            l = b.l + pl - padH; t = b.t + pt - padV;
            w = b.w - pl - pr + 2 * padH; h = b.h - pt - pb + 2 * padV;
            rad = Math.min(20, h / 2);
        } else {
            var br = parseFloat(cs.borderTopLeftRadius) || 0;
            l = b.l - 4; t = b.t - 4; w = b.w + 8; h = b.h + 8;
            rad = br > 0 ? Math.min(br + 4, h / 2) : 10;
        }
        /* clamp to the viewport minus the margin: never clipped */
        var vw = root.clientWidth, vh = window.innerHeight;
        var r2 = Math.min(l + w, vw - MARGIN), b2 = Math.min(t + h, vh - MARGIN);
        l = Math.max(l, MARGIN); t = Math.max(t, MARGIN);
        f.box = { l: l, t: t, w: Math.max(8, r2 - l), h: Math.max(8, b2 - t) };
        f.radius = Math.min(rad, f.box.h / 2);
        ring.style.setProperty('--rw', f.box.w.toFixed(1) + 'px');
        ring.style.setProperty('--rh', f.box.h.toFixed(1) + 'px');
        ring.style.setProperty('--rr', f.radius.toFixed(1) + 'px');
    }

    function measure() {
        if (!enabled) return;
        if (frame) computeBox(frame);
        if (magnet) magRect = layoutRect(magnet);
        kick();
    }
    function settle() {
        settleTimers.forEach(clearTimeout);
        settleTimers = [80, 320, 800].map(function (ms) { return setTimeout(measure, ms); });
    }

    function setFrame(el, kind) {
        if (!el) {
            if (!frame) return;
            frame = null;
            if (ro) ro.disconnect();
            ring.classList.remove('is-frame');
            return;
        }
        if (frame && frame.el === el && frame.kind === kind) return;
        frame = { el: el, kind: kind, box: null, radius: 10 };
        computeBox(frame);
        ring.classList.add('is-frame');
        if (window.ResizeObserver) {
            if (!ro) ro = new ResizeObserver(function () { if (frame) measure(); });
            ro.disconnect();
            ro.observe(el);
        }
        settle();
    }

    function cancelHold() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; } }

    /* ------------------------------------------------------------ animation loop (no layout reads) */
    function loop() {
        var tx = mx, ty = my;
        if (frame && frame.box) {
            var b = frame.box;
            var off = (magnet && magnet.contains(frame.el)) ? { x: mOffX, y: mOffY } : { x: 0, y: 0 };
            var cx = b.l + b.w / 2 + off.x, cy = b.t + b.h / 2 + off.y;
            if (mode === 'focus') { tx = cx; ty = cy; } else { tx = cx + (mx - cx) * 0.1; ty = cy + (my - cy) * 0.1; }
        } else if (magnet && magRect) {
            var mcx = magRect.l + magRect.w / 2, mcy = magRect.t + magRect.h / 2;
            tx = mcx + (mx - mcx) * 0.25;
            ty = mcy + (my - mcy) * 0.25;
        }
        rx += (tx - rx) * 0.2;
        ry += (ty - ry) * 0.2;
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        if (Math.abs(tx - rx) > 0.1 || Math.abs(ty - ry) > 0.1 || magnet || frame) {
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
            magRect = null;
            mOffX = mOffY = 0;
        }
    }

    var watchdog = 0;
    function enable(x, y) {
        ensureElements();
        enabled = true;
        mx = rx = x;
        my = ry = y;                                   /* start at the pointer: no jump from 0,0 */
        dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        ring.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        root.classList.add('has-cursor');
        root.classList.remove('cursor-hidden');
        if (!watchdog) {
            /* self-check: 1.5 s after the first mouse move the ring must exist and have been positioned */
            watchdog = setTimeout(function () {
                if (document.hidden || !enabled) { watchdog = 0; return; }
                if (!ring.isConnected || !ring.style.transform || getComputedStyle(ring).display === 'none') { broken = true; restoreNative('ring did not render'); }
            }, 1500);
        }
        setState(document.elementFromPoint(x, y));
        kick();
    }
    function disable() {
        if (!enabled) return;
        enabled = false;
        cancelHold();
        releaseMagnet();
        setFrame(null);
        mode = 'hover';
        if (ring) ring.classList.remove('is-link-small', 'is-text', 'is-view', 'is-magnetic');
        root.classList.remove('has-cursor', 'cursor-keyboard', 'cursor-on-field', 'cursor-press');
    }
    /* touch: switch off at once; the compat mouse events browsers fire right after a tap are ignored for 500 ms */
    function touched() { lastTouch = Date.now(); disable(); }
    ['touchstart', 'touchend', 'touchcancel'].forEach(function (n) { document.addEventListener(n, touched, { passive: true, capture: true }); });
    ['pointerdown', 'pointerup'].forEach(function (n) { document.addEventListener(n, function (e) { if (e.pointerType === 'touch') touched(); }, true); });
    if (reducedMq.addEventListener) reducedMq.addEventListener('change', function () { if (reducedMq.matches) { broken = true; disable(); } });

    document.addEventListener('pointermove', function (e) {
        if (broken) return;
        if (e.pointerType === 'touch') { touched(); return; }
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        if (Date.now() - lastTouch < 500) return;
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
        if (!enabled) { enable(e.clientX, e.clientY); return; }
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        root.classList.remove('cursor-hidden');
        if (mode === 'focus') {
            mode = 'hover';
            root.classList.remove('cursor-keyboard');
            setState(document.elementFromPoint(mx, my));
        }
        if (magnet && magRect) {
            var dx = (mx - (magRect.l + magRect.w / 2)) / (magRect.w / 2);
            var dy = (my - (magRect.t + magRect.h / 2)) / (magRect.h / 2);
            mOffX = dx * 8;
            mOffY = dy * 6;
            magnet.style.translate = mOffX.toFixed(2) + 'px ' + mOffY.toFixed(2) + 'px';
        }
        kick();
    }, { passive: true });

    /* ------------------------------------------------------------ state from the element under the pointer */
    function resolve(t) {
        if (!t || t.closest(FIELD) || t.closest('[data-cursor="plain"]')) return null;   /* plain zones (values accordion): no frame */
        var el = t.closest(LINK);
        if (!el) return null;
        if (el.tagName === 'LABEL') {
            var c = el.querySelector('input[type="checkbox"], input[type="radio"]');
            if (c) el = c;
        }
        return el;
    }

    function applyPlain(t) {
        releaseMagnet();
        setFrame(null);
        ring.classList.remove('is-link-small', 'is-magnetic');
        if (!t) return;
        if (t.closest(FIELD)) { root.classList.add('cursor-on-field'); return; }
        if (t.closest('[data-cursor="plain"]')) return;     /* ring + dot only: no text beam, no frame */
        var view = t.closest(VIEW);
        if (view) {
            ring.classList.add('is-view');
            label.textContent = view.getAttribute('data-cursor-label') || 'Nézze';
        } else if (t.closest(TEXT)) {
            ring.classList.add('is-text');
        }
    }

    function focusVisible(el) { try { return el.matches(':focus-visible'); } catch (e) { return false; } }   /* older Safari throws on the selector */
    var failures = 0;
    function setState(target) {
        try { setStateInner(target); } catch (err) {
            /* one bad element must not stop the cursor: drop the frame and carry on; repeated failures give the native cursor back */
            if (++failures > 5) { broken = true; disable(); restoreNative(err); return; }
            try { setFrame(null); ring.classList.remove('is-link-small', 'is-text', 'is-view', 'is-magnetic'); } catch (e2) { /* ignore */ }
        }
    }
    function setStateInner(target) {
        var t = target instanceof Element ? target : null;
        if (t) root.classList.toggle('cursor-dark', isDark(t));
        root.classList.remove('cursor-on-field');
        var el = resolve(t);
        lastEl = el;

        if (!el) {
            /* between two targets (gap, padding): keep the frame for a moment instead of flashing the plain ring */
            if (frame && mode === 'hover') {
                if (!holdTimer) holdTimer = setTimeout(function () {
                    holdTimer = 0;
                    ring.classList.remove('is-view', 'is-text', 'is-link-small', 'is-magnetic');
                    label.textContent = '';
                    applyPlain(document.elementFromPoint(mx, my));
                    kick();
                }, HOLD);
                return;
            }
            cancelHold();
            ring.classList.remove('is-view', 'is-text', 'is-link-small', 'is-magnetic');
            label.textContent = '';
            applyPlain(t);
            return;
        }

        cancelHold();
        ring.classList.remove('is-view', 'is-text', 'is-link-small', 'is-magnetic');
        label.textContent = '';
        var kind = classify(el);
        if (kind === 'card') {
            setFrame(null);
            ring.classList.add('is-link-small');
        } else {
            setFrame(el, kind);
        }
        var mag = el.closest(MAGNETIC);
        if (mag !== magnet) {
            releaseMagnet();
            if (mag) { magnet = mag; magRect = layoutRect(mag); }
        }
        if (magnet) ring.classList.add('is-magnetic');
    }

    document.addEventListener('pointerover', function (e) {
        if (!enabled) return;
        if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
        if (mode === 'focus') return;
        setState(e.target);
        kick();
    });

    document.addEventListener('pointerdown', function (e) { if (enabled && e.pointerType !== 'touch') root.classList.add('cursor-press'); });
    document.addEventListener('pointerup', function () { root.classList.remove('cursor-press'); });

    document.documentElement.addEventListener('pointerleave', function () {
        if (!enabled) return;
        root.classList.add('cursor-hidden');
        cancelHold();
        releaseMagnet();
        setFrame(null);
    });

    /* ------------------------------------------------------------ keyboard: :focus-visible gets the same frame */
    document.addEventListener('focusin', function (e) {
        if (!enabled) return;
        var t = e.target;
        if (!(t instanceof Element) || !focusVisible(t)) return;
        var el = resolve(t);
        if (!el) { if (t.closest(FIELD)) { setFrame(null); root.classList.add('cursor-on-field'); } return; }
        mode = 'focus';
        cancelHold();
        root.classList.add('cursor-keyboard');
        root.classList.remove('cursor-on-field', 'cursor-hidden');
        root.classList.toggle('cursor-dark', isDark(el));
        ring.classList.remove('is-view', 'is-text', 'is-link-small', 'is-magnetic');
        var kind = classify(el);
        if (kind === 'card') { setFrame(null); ring.classList.add('is-link-small'); } else { setFrame(el, kind); }
        kick();
    });
    document.addEventListener('focusout', function () {
        if (!enabled || mode !== 'focus') return;
        setTimeout(function () {
            if (mode !== 'focus' || (document.activeElement && focusVisible(document.activeElement))) return;
            mode = 'hover';
            root.classList.remove('cursor-keyboard');
            setFrame(null);
            ring.classList.remove('is-link-small');
        }, 0);
    });

    /* ------------------------------------------------------------ re-measure while hovered */
    var scrollTicking = false;
    window.addEventListener('scroll', function () {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(function () {
            scrollTicking = false;
            if (!enabled) return;
            if (mode === 'hover' && mx > 0) setState(document.elementFromPoint(mx, my));
            measure();
        });
    }, { passive: true });
    window.addEventListener('resize', measure);
    /* hover effects / reveals that finish under a resting pointer (menu items, modals) change the box */
    ['transitionend', 'animationend'].forEach(function (n) {
        document.addEventListener(n, function (e) {
            if (enabled && frame && (e.target === frame.el || frame.el.contains(e.target) || e.target.contains(frame.el))) measure();
        }, true);
    });
    /* what is under a resting pointer changes without pointer events (menu / modal opens and closes, elements removed) */
    setInterval(function () {
        if (!enabled || mode !== 'hover' || mx < 0 || root.classList.contains('cursor-hidden')) return;
        if (frame && !frame.el.isConnected) { setFrame(null); }
        var under = document.elementFromPoint(mx, my);
        var el = resolve(under);
        if (el !== lastEl) setState(under);
    }, 150);
    }
})();
