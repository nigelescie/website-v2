// Enhanced stats animation with progressive counting
// Enhanced stats animation with progressive counting
function initStatsAnimation() {
    const statsSection = document.querySelector('.stats-section');
    // Re-select elements as they might have been added dynamically
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    let hasAnimated = false;

    function animateNumber(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }

            element.textContent = Math.floor(current);

            // Add pulsing effect during animation
            if (current < target) {
                element.style.transform = 'scale(1.02)';
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                }, 100);
            }
        }, 16);
    }

    function handleStatsAnimation() {
        if (!statsSection || hasAnimated) return;

        const rect = statsSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        if (rect.top < windowHeight * 0.8) {
            hasAnimated = true;

            // Staggered animation for each stat
            statNumbers.forEach((stat, index) => {
                setTimeout(() => {
                    const target = parseInt(stat.dataset.target);
                    animateNumber(stat, target, 1500 + (index * 200));

                    // Add entrance animation
                    const card = stat.closest('.stat-card');
                    if (card) {
                        card.style.animation = `fadeUp 0.8s ease forwards ${index * 0.1}s`;
                    }
                }, index * 150);
            });
        }
    }

    // Remove old listener if any (primitive way, but works if function re-run)
    window.removeEventListener('scroll', window._statsScrollHandler);
    window._statsScrollHandler = handleStatsAnimation;

    // Listen for scroll events
    window.addEventListener('scroll', handleStatsAnimation, { passive: true });

    // Check on load in case already in view
    handleStatsAnimation();
}

window.initStatsAnimation = initStatsAnimation;