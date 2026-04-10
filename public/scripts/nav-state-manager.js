/**
 * nav-state-manager.js
 * Centralized logic for managing navigation active states (underlines).
 * Handles:
 * - Page load initialization (URL/Hash based)
 * - Homepage scroll spy (IntersectionObserver)
 * - Click-based immediate feedback
 */

(function () {
    const navLinks = document.querySelectorAll('.nav-links a');
    const isHomepage = window.location.pathname.endsWith('index.html') || 
                       window.location.pathname === '/' || 
                       window.location.pathname.endsWith('/');

    /**
     * Set active state for a specific link
     * @param {string} href - The href of the link to activate
     */
    function setActive(href) {
        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            // Check for exact match or hash-based match
            const isActive = (linkHref === href) || 
                             (href.includes('#') && linkHref.endsWith(href.split('#')[1])) ||
                             (linkHref.includes('#') && href.endsWith(linkHref.split('#')[1]));
            
            link.classList.toggle('active', isActive);
        });
    }

    /**
     * Clear all active states
     */
    function clearActive() {
        navLinks.forEach(link => link.classList.remove('active'));
    }

    /**
     * Initialize state based on current URL and Hash
     */
    function initActiveState() {
        const path = window.location.pathname;
        const hash = window.location.hash;

        if (path.includes('careers.html')) {
            // Highlight Careers explicitly on its page
            navLinks.forEach(link => {
                if (link.getAttribute('href').includes('careers.html')) {
                    link.classList.add('active');
                }
            });
        } else if (isHomepage) {
            if (hash) {
                setActive(hash);
            } else {
                // No hash on homepage - clear all or keep as is (scroll spy will take over)
                clearActive();
            }
        }
    }

    // Initialize on load
    window.addEventListener('load', initActiveState);

    // Update on hash change (browser back/forward or direct jump)
    window.addEventListener('hashchange', initActiveState);

    /**
     * Scroll Spy for Homepage
     */
    if (isHomepage && window.IntersectionObserver) {
        const spyOptions = {
            threshold: 0.2, // Trigger when 20% of section is visible
            rootMargin: '-10% 0px -70% 0px' // Offset to trigger near top/center
        };

        const spyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.getAttribute('id');
                const navLink = document.querySelector(`.nav-links a[href="#${id}"]`);

                if (entry.isIntersecting) {
                    clearActive();
                    if (navLink) navLink.classList.add('active');
                } else {
                    // If we scroll away from a section, clear its active state
                    if (navLink && navLink.classList.contains('active')) {
                        navLink.classList.remove('active');
                    }
                }
            });
        }, spyOptions);

        // Watch watched sections
        ['solutions', 'why-us'].forEach(id => {
            const el = document.getElementById(id);
            if (el) spyObserver.observe(el);
        });
    }

    /**
     * Manual Click Handling for Immediate Feedback
     */
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            
            // For same-page anchors, set active immediately
            if (href.startsWith('#')) {
                clearActive();
                this.classList.add('active');
            } else {
                // For cross-page links, let the load event on the target page handle it,
                // but we can set it active briefly for visual feedback before transition.
                clearActive();
                this.classList.add('active');
            }
        });
    });

})();
