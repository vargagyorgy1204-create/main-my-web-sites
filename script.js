// Hero typing animation (safe fallback if Typed.js is unavailable)
const heroTypedEl = document.querySelector('#typed');
if (heroTypedEl && typeof Typed !== 'undefined') {
    new Typed('#typed', {
        strings: [
            'Egyedi weboldalak',
            'Profi Landing Page-ek',
            'Vizuális design',
            'Modern Websopok',
            'Technikai támogatás',
            'Tartalmi frissítések',
            'SEO optimalizálás',
            'Karbantartás'
        ],
        typeSpeed: 50,
        backSpeed: 30,
        backDelay: 400,
        loop: true,
        showCursor: true,
        cursorChar: '|'
    });
}

if (typeof AOS !== 'undefined') {
    AOS.init({
        duration: 700,
        easing: 'ease-out-cubic',
        once: true,
        offset: 60
    });
}

// Hero pointer parallax (desktop only)
const heroSection = document.querySelector('#hero');
if (heroSection && window.matchMedia('(pointer: fine)').matches) {
    let rafId = null;
    const updateParallax = (clientX, clientY) => {
        const rect = heroSection.getBoundingClientRect();
        const relX = (clientX - rect.left) / rect.width - 0.5;
        const relY = (clientY - rect.top) / rect.height - 0.5;
        const mx = Math.max(-16, Math.min(16, relX * 32));
        const my = Math.max(-14, Math.min(14, relY * 28));
        heroSection.style.setProperty('--mx', `${mx}px`);
        heroSection.style.setProperty('--my', `${my}px`);
    };

    heroSection.addEventListener('mousemove', (e) => {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
            updateParallax(e.clientX, e.clientY);
        });
    });

    heroSection.addEventListener('mouseleave', () => {
        heroSection.style.setProperty('--mx', '0px');
        heroSection.style.setProperty('--my', '0px');
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

// ─── Interactive Particle Grid ───────────────────────────────────────────────
(() => {
    const canvas = document.getElementById('hero-particle-grid');
    const hero   = document.getElementById('hero');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Tune these to change the feel ────────────────────────────────────────
    const config = {
        spacing:         24,   // px between grid points
        interactionRadius: 100, // px – mouse influence radius
        repulsionPower:  220,  // strength of the push away from cursor
        spring:          0.05, // how fast points return to origin
        friction:        0.9,  // velocity damping per frame (0–1)
        pointSize:       1.5   // fillRect side length in px
    };
    // ─────────────────────────────────────────────────────────────────────────

    const pointer = { x: -9999, y: -9999, active: false };

    let dpr = 1, width = 0, height = 0;
    let cols = 0, rows = 0;
    let particles = [];

    function createGrid() {
        particles = [];
        cols = Math.floor(width  / config.spacing) + 2;
        rows = Math.floor(height / config.spacing) + 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = c * config.spacing;
                const y = r * config.spacing;
                particles.push({ x, y, originX: x, originY: y, vx: 0, vy: 0 });
            }
        }
    }

    function resize() {
        const rect = hero.getBoundingClientRect();
        dpr    = Math.min(window.devicePixelRatio || 1, 2);
        width  = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));

        canvas.width  = Math.floor(width  * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width  = width  + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        createGrid();
    }

    function updateParticle(p) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Repulsion – inversely proportional to distance
        if (pointer.active && dist < config.interactionRadius && dist > 0.0001) {
            const force = config.repulsionPower / dist;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
        }

        // Spring back to origin
        p.vx += (p.originX - p.x) * config.spring;
        p.vy += (p.originY - p.y) * config.spring;

        // Friction
        p.vx *= config.friction;
        p.vy *= config.friction;

        p.x += p.vx;
        p.y += p.vy;
    }

    function render() {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            updateParticle(p);

            // Brightness tied to displacement from origin
            const ox = p.x - p.originX;
            const oy = p.y - p.originY;
            const displacement = Math.sqrt(ox * ox + oy * oy);
            const alpha = Math.max(0.3, Math.min(0.8, 0.3 + displacement * 0.03));

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#000000';
            ctx.fillRect(p.x, p.y, config.pointSize, config.pointSize);
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(render);
    }

    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        pointer.x = e.clientX - rect.left;
        pointer.y = e.clientY - rect.top;
        pointer.active = true;
    }, { passive: true });

    hero.addEventListener('mouseleave', () => { pointer.active = false; }, { passive: true });
    window.addEventListener('resize', resize, { passive: true });

    resize();
    requestAnimationFrame(render);
})();

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