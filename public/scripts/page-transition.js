// ===== BROWSER DETECTION (runs immediately at parse time) =====
(function () {
    const ua = navigator.userAgent;
    const vendor = navigator.vendor || '';
    // Safari includes "Safari" but NOT "Chrome"; Chrome includes both.
    // Edge includes "Edg/" — exclude it so only Chrome/Chromium gets the class.
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(vendor) && !/Edg\//.test(ua);
    const isEdge = /Edg\//.test(ua);
    const isFirefox = /Firefox/.test(ua);
    if (isChrome) {
        document.documentElement.classList.add('is-chrome');
    }
    if (isEdge) {
        document.documentElement.classList.add('is-edge');
    }
    if (isFirefox) {
        document.documentElement.classList.add('is-firefox');
    }
})();

// ===== PAGE TRANSITION LOADING SCREEN =====
(function () {
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

    // Don't create transition overlay on back/forward navigation
    if (isBackForward) return;

    // Create transition overlay
    const transition = document.createElement('div');
    transition.className = 'page-transition';

    // Add particles background
    const particles = document.createElement('div');
    particles.className = 'page-transition-particles';
    transition.appendChild(particles);

    document.body.appendChild(transition);

    // Immediately hide transition
    setTimeout(() => {
        transition.classList.remove('active');
    }, 50);

    // Intercept all internal links
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');

            // Only intercept links to other HTML pages (not anchors or external links)
            if (href && href.endsWith('.html') && !link.target) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Show transition
                    transition.classList.add('active');

                    // Navigate after brief delay
                    setTimeout(() => {
                        window.location.href = href;
                    }, 300);
                });
            }
        });
    });
})();

// Handle pageshow event for back/forward navigation
window.addEventListener('pageshow', (event) => {
    const transition = document.querySelector('.page-transition');
    if (transition) {
        transition.style.display = 'none';
        transition.remove();
    }
});
