// Section Scroll Animation
document.addEventListener('DOMContentLoaded', function () {
    const solutionsSection = document.querySelector('.solutions-section');
    const whySection = document.querySelector('.why-section');

    let lastScrollY = window.scrollY;

    function handleSectionScroll() {
        const currentScrollY = window.scrollY;
        const scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';

        // Solutions Section Animation
        if (solutionsSection) {
            const solutionsRect = solutionsSection.getBoundingClientRect();
            const solutionsInView = solutionsRect.top < window.innerHeight && solutionsRect.bottom > 0;

            if (solutionsInView) {
                solutionsSection.classList.remove('scroll-away');
                solutionsSection.classList.add('scroll-back');
            } else {
                solutionsSection.classList.remove('scroll-back');
                solutionsSection.classList.add('scroll-away');
            }
        }

        // Why eScience Section Animation
        if (whySection) {
            const whyRect = whySection.getBoundingClientRect();
            const whyInView = whyRect.top < window.innerHeight && whyRect.bottom > 0;

            if (whyInView) {
                whySection.classList.remove('scroll-away');
                whySection.classList.add('scroll-back');
            } else {
                whySection.classList.remove('scroll-back');
                whySection.classList.add('scroll-away');
            }
        }

        lastScrollY = currentScrollY;
    }

    let ticking = false;
    function requestTick() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleSectionScroll();
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick);

    // Initial check
    handleSectionScroll();
});