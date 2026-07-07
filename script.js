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
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        navToggle.setAttribute('aria-expanded', navLinks.classList.contains('active') ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
        }
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

    navLinks.addEventListener('mouseleave', () => {
        hideLiquid();
    });

    navLinks.addEventListener('focusout', (event) => {
        if (!navLinks.contains(event.relatedTarget)) {
            hideLiquid();
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
        targetModal.classList.add('is-open');
        targetModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('service-modal-open');
    });
});

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