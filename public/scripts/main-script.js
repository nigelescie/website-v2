// ===== SCROLL ANIMATIONS =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = (window.IntersectionObserver) ? new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions) : null;

// Observe all animated elements
document.addEventListener('DOMContentLoaded', () => {
    const animatedElements = document.querySelectorAll(
        '.fade-up, .fade-in-left, .fade-in-right, .fade-in-scale'
    );

    if (observer) {
        animatedElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for older Safari/browsers: make all elements visible immediately
        animatedElements.forEach(el => el.classList.add('visible'));
    }
});

// ===== SPLASH SCREEN =====
// Run immediately to prevent stuck splash screen
(function () {
    const splashScreen = document.getElementById('splashScreen');
    if (!splashScreen) return;

    // Check if this is a back/forward navigation
    let navigationType = 'navigate';
    try {
        const entries = performance.getEntriesByType('navigation');
        if (entries.length > 0) {
            navigationType = entries[0].type;
        }
    } catch (e) {
        console.warn('Navigation timing not supported');
    }
    const isBackForward = navigationType === 'back_forward';

    // Check if user has already seen splash in this session
    const hasSeenSplash = sessionStorage.getItem('splashShown');

    if (hasSeenSplash || isBackForward) {
        // User has already seen splash or navigated back - hide immediately
        splashScreen.style.display = 'none';
        splashScreen.remove();
    } else {
        // First visit in session - show splash screen for 3 seconds
        sessionStorage.setItem('splashShown', 'true');
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            setTimeout(() => {
                splashScreen.remove();
            }, 500);
        }, 3000);

        // Failsafe: force remove after 4 seconds no matter what
        setTimeout(() => {
            if (splashScreen && splashScreen.parentNode) {
                splashScreen.remove();
            }
        }, 4000);
    }
})();

// Handle browser back/forward button navigation
window.addEventListener('pageshow', (event) => {
    const splashScreen = document.getElementById('splashScreen');
    if (splashScreen) {
        splashScreen.style.display = 'none';
        splashScreen.remove();
    }
});

// ===== NAVIGATION SCROLL EFFECT =====
let lastScroll = 0;
const nav = document.querySelector('.nav');

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (currentScroll > 100) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// ===== PARALLAX EFFECT =====
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxSections = document.querySelectorAll('.parallax-section');

    parallaxSections.forEach(section => {
        const speed = 0.05;
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        // Only apply parallax if section is in view
        if (scrolled + window.innerHeight > sectionTop && scrolled < sectionTop + sectionHeight) {
            const yPos = (scrolled - sectionTop) * speed;
            section.style.transform = `translateY(${yPos}px)`;
        }
    });
});

// ===== SMOOTH SCROLL FOR ANCHOR LINKS AND ACTIVE STATE =====
document.querySelectorAll('.nav-links a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Only prevent default for same-page anchors
        if (href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);

            if (target) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// Scroll Spy for navigation removed in favor of nav-state-manager.js

// ===== MOBILE MENU TOGGLE =====
const mobileToggle = document.querySelector('.nav-mobile-toggle');
const navLinks = document.querySelector('.nav-links');

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        mobileToggle.classList.toggle('active');
    });
}

// ===== STATS COUNTER ANIMATION =====
const animateCounter = (element, target) => {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target + (element.dataset.suffix || '');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current) + (element.dataset.suffix || '');
        }
    }, 30);
};

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
            const statNumber = entry.target.querySelector('.stat-number');
            const targetValue = parseInt(statNumber.dataset.target);

            if (!isNaN(targetValue)) {
                statNumber.dataset.suffix = statNumber.textContent.replace(/[0-9]/g, '');
                animateCounter(statNumber, targetValue);
            }

            entry.target.classList.add('counted');
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-card').forEach(card => {
    statsObserver.observe(card);
});

// ===== ENHANCED HOVER EFFECTS =====
document.querySelectorAll('.solution-card, .why-card, .testimonial-card').forEach(card => {
    card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-8px) scale(1.02)';
    });

    card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// ===== PERFORMANCE OPTIMIZATION =====
// Debounce scroll events
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
    }

    scrollTimeout = window.requestAnimationFrame(() => {
        // Scroll-based animations here
    });
}, { passive: true });

// ===== PRELOAD CRITICAL RESOURCES =====
window.addEventListener('load', () => {
    // Add loaded class to body for any load-dependent animations
    document.body.classList.add('loaded');
});

// ===== ACCESSIBILITY ENHANCEMENTS =====
// Add keyboard navigation support
document.querySelectorAll('.nav-links a, .btn-primary, .btn-secondary').forEach(element => {
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            element.click();
        }
    });
});

// ===== DYNAMIC GRADIENT ANIMATION =====
const heroBackground = document.querySelector('.hero-background');
let gradientPosition = 0;

function animateGradient() {
    gradientPosition += 0.5;
    if (gradientPosition > 360) gradientPosition = 0;

    requestAnimationFrame(animateGradient);
}

animateGradient();


// ===== BACK TO TOP =====
const backToTopBtn = document.getElementById('backToTop');

if (backToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ===== TESTIMONIALS SHAPES SCROLL VISIBILITY =====
const testimonialsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const shapes = document.querySelectorAll('[class^="testimonials-shape-"]');
        if (entry.isIntersecting) {
            shapes.forEach(shape => shape.classList.add('visible'));
        } else {
            shapes.forEach(shape => shape.classList.remove('visible'));
        }
    });
}, { threshold: 0.2 });

document.addEventListener('DOMContentLoaded', () => {
    const testimonialsSection = document.querySelector('.testimonials-section');
    if (testimonialsSection) {
        testimonialsObserver.observe(testimonialsSection);
    }
});

// ===== HERO IMAGE / CAROUSEL + PARALLAX =====
document.addEventListener('DOMContentLoaded', () => {
    const heroMedia = document.getElementById('heroMedia');
    if (!heroMedia) return;

    const slides = Array.from(heroMedia.querySelectorAll('.hero-slide'));
    const prevBtn = document.getElementById('heroPrev');
    const nextBtn = document.getElementById('heroNext');
    const indicatorsContainer = document.getElementById('heroIndicators');
    let current = 0;
    let autoplayTimer = null;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // create indicators based on number of slides
    slides.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.setAttribute('aria-label', `Go to slide ${i + 1}`);
        btn.setAttribute('role', 'tab');
        btn.dataset.index = i;
        btn.addEventListener('click', () => {
            goTo(i);
            pauseAutoplay();
        });
        indicatorsContainer.appendChild(btn);
    });

    const indicators = Array.from(indicatorsContainer.children);

    function updateIndicators() {
        indicators.forEach((btn, idx) => {
            btn.classList.toggle('active', idx === current);
            btn.setAttribute('aria-selected', idx === current ? 'true' : 'false');
            btn.setAttribute('tabindex', idx === current ? '0' : '-1');
        });
    }

    function setActive(index) {
        slides.forEach((s, i) => {
            s.classList.toggle('active', i === index);
        });
        updateIndicators();
    }

    function goTo(index) {
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;
        current = index;
        setActive(current);
    }

    function next() {
        goTo(current + 1);
    }

    function prev() {
        goTo(current - 1);
    }

    // autoplay (disabled if prefers-reduced-motion or if single slide)
    function startAutoplay() {
        if (prefersReducedMotion) return;
        if (slides.length < 2) return;
        stopAutoplay();
        autoplayTimer = setInterval(next, 5000);
    }
    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    }
    function pauseAutoplay() {
        stopAutoplay();
        // resume after a delay
        if (!prefersReducedMotion) {
            setTimeout(() => {
                startAutoplay();
            }, 6000);
        }
    }

    // attach controls
    prevBtn?.addEventListener('click', () => { prev(); pauseAutoplay(); });
    nextBtn?.addEventListener('click', () => { next(); pauseAutoplay(); });

    // keyboard accessibility for the hero media: left/right to navigate
    heroMedia.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prev();
            pauseAutoplay();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            next();
            pauseAutoplay();
        }
    });

    // pause on hover/focus to let users inspect images
    heroMedia.addEventListener('mouseenter', () => stopAutoplay());
    heroMedia.addEventListener('mouseleave', () => startAutoplay());
    heroMedia.addEventListener('focusin', () => stopAutoplay());
    heroMedia.addEventListener('focusout', () => startAutoplay());

    // initialize
    if (slides.length > 0) {
        // make sure the first slide is active
        setActive(0);

        // lazy-load background images (if needed) - create Image objects to warm cache
        slides.forEach(s => {
            const bg = s.style.backgroundImage;
            const urlMatch = bg.match(/url\(["']?(.*?)["']?\)/);
            if (urlMatch && urlMatch[1]) {
                const img = new Image();
                img.src = urlMatch[1];
            }
        });

        // start autoplay if allowed
        startAutoplay();
    }

    // subtle parallax on scroll for heroMedia
    function heroParallax() {
        const rect = heroMedia.getBoundingClientRect();
        const viewportCenter = window.innerHeight / 2;
        const elementCenter = rect.top + rect.height / 2;
        const distance = elementCenter - viewportCenter;
        const maxTranslate = 18; // px
        // small effect: maps distance to translateY within [-maxTranslate, maxTranslate]
        const translateY = Math.max(-maxTranslate, Math.min(maxTranslate, -distance * 0.02));
        // apply transform to slides only (not overlay/controls)
        slides.forEach(s => {
            s.style.transform = `translateY(${translateY}px)`;
        });
    }

    // run parallax on scroll & resize
    const throttledHeroParallax = () => {
        window.requestAnimationFrame(heroParallax);
    };
    window.addEventListener('scroll', throttledHeroParallax, { passive: true });
    window.addEventListener('resize', throttledHeroParallax);

    // initial parallax position
    heroParallax();

    // Respect reduced motion: disable slide transitions if user prefers reduced motion
    if (prefersReducedMotion) {
        slides.forEach(s => s.style.transition = 'none');
    }
});


