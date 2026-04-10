// Apple-style page slider with support for multiple instances
function initSliders() {
    const sliders = document.querySelectorAll('.hero-media, .apple-slider');

    sliders.forEach(sliderWrapper => {
        const slider = sliderWrapper.querySelector('.hero-slider-container');
        const indicators = sliderWrapper.querySelector('.hero-indicators');
        const slides = sliderWrapper.querySelectorAll('.hero-slide-item');

        if (!slider || !slides.length) return;

        // Clear existing indicators
        if (indicators) indicators.innerHTML = '';

        let isDragging = false;
        let startX = 0;
        let currentIndex = 0;
        const slideCount = slides.length;
        const isCenterFocused = sliderWrapper.classList.contains('center-focused');

        // Create indicators
        for (let i = 0; i < slideCount; i++) {
            const indicator = document.createElement('button');
            indicator.classList.add('hero-indicator');
            if (i === 0) indicator.classList.add('active');
            indicator.addEventListener('click', () => goToSlide(i));
            if (indicators) indicators.appendChild(indicator);
        }

        // Touch events
        slider.addEventListener('touchstart', touchStart, { passive: false });
        slider.addEventListener('touchmove', touchMove, { passive: false });
        slider.addEventListener('touchend', touchEnd);

        // Mouse events
        slider.addEventListener('mousedown', touchStart);
        slider.addEventListener('mousemove', touchMove);
        slider.addEventListener('mouseup', touchEnd);
        slider.addEventListener('mouseleave', touchEnd);

        function touchStart(event) {
            isDragging = true;
            startX = getPositionX(event);
            stopAutoScroll();
            // event.preventDefault(); // Removed to allow scroll if not moving horizontal
        }

        let ticking = false;
        let currentEvent = null;

        function touchMove(event) {
            if (!isDragging) return;

            const currentPosition = getPositionX(event);
            const diff = currentPosition - startX;

            // Only prevent default if we're clearly trying to slide
            if (Math.abs(diff) > 10 && event.cancelable) {
                event.preventDefault();
            }

            // Store event for the animation frame
            currentEvent = event;

            if (!ticking) {
                requestAnimationFrame(() => {
                    updateSliderPosition(currentEvent);
                    ticking = false;
                });
                ticking = true;
            }
        }

        function updateSliderPosition(event) {
            if (!isDragging || !event) return;

            const currentPosition = getPositionX(event);
            const diff = currentPosition - startX;

            // Only prevent default if we're clearly trying to slide
            // Note: event.preventDefault() cannot be used inside rAF passively usually, 
            // but we can check the diff here. The preventDefault was previously in the sync handler.
            // For scroll performance, we should ideally NOT preventDefault in the rAF but in the original listener if needed.
            // However, since we set passive: false, we can preventDefault in the original listener if we want to block scrolling.
            // For now, we'll keep the logic simple: visual updates happen here.

            if (!isCenterFocused) {
                slides.forEach((slide, index) => {
                    const offset = (index - currentIndex) * 100 + (diff / slider.offsetWidth * 100);
                    slide.style.transform = `translateX(${offset}%)`;
                });
            }
        }

        function touchEnd(event) {
            if (!isDragging) return;
            isDragging = false;

            // Check if event exists and has valid position data
            // For mouse events: check clientX
            // For touch events: check touches or changedTouches length
            if (!event ||
                (event.type && event.type.includes('mouse') && event.clientX === undefined) ||
                (event.type && event.type.includes('touch') && (!event.touches || !event.touches.length) && (!event.changedTouches || !event.changedTouches.length))) {
                goToSlide(currentIndex);
                setTimeout(() => {
                    if (!isDragging) {
                        startAutoScroll();
                    }
                }, 3000);
                return;
            }

            const currentPosition = getPositionX(event);
            const diff = currentPosition - startX;
            const threshold = slider.offsetWidth * 0.15;

            if (diff > threshold) {
                currentIndex = (currentIndex > 0) ? currentIndex - 1 : slideCount - 1;
            } else if (diff < -threshold) {
                currentIndex = (currentIndex < slideCount - 1) ? currentIndex + 1 : 0;
            }

            goToSlide(currentIndex);

            setTimeout(() => {
                if (!isDragging) {
                    startAutoScroll();
                }
            }, 3000);
        }

        function getPositionX(event) {
            if (event.type.includes('mouse')) {
                return event.clientX;
            }
            // For touch events, use touches[0] if available, otherwise changedTouches[0]
            // touchend events use changedTouches instead of touches
            return event.touches && event.touches.length > 0
                ? event.touches[0].clientX
                : event.changedTouches[0].clientX;
        }

        function goToSlide(index) {
            currentIndex = index;

            if (isCenterFocused) {
                slides.forEach((slide, i) => {
                    slide.classList.remove('active', 'prev', 'next', 'far-prev', 'far-next');

                    // Simple wrap-around logic for 3D positions
                    const diff = (i - currentIndex + slideCount) % slideCount;

                    if (diff === 0) {
                        slide.classList.add('active');
                    } else if (diff === 1) {
                        slide.classList.add('next');
                    } else if (diff === slideCount - 1) {
                        slide.classList.add('prev');
                    } else if (diff === 2) {
                        slide.classList.add('far-next');
                    } else if (diff === slideCount - 2) {
                        slide.classList.add('far-prev');
                    }

                    // Apply class-based transforms instead of inline for center focus
                    slide.style.transform = '';
                });
            } else {
                slides.forEach((slide, i) => {
                    slide.style.transform = `translateX(${(i - currentIndex) * 100}%)`;
                });
            }

            // Update indicators
            if (indicators) {
                const allIndicators = indicators.querySelectorAll('.hero-indicator');
                allIndicators.forEach((ind, i) => {
                    ind.classList.toggle('active', i === currentIndex);
                });
            }
        }

        // Auto-scroll functionality
        let autoScrollInterval;
        const autoScrollDelay = 5000;

        function startAutoScroll() {
            stopAutoScroll();
            autoScrollInterval = setInterval(() => {
                currentIndex = (currentIndex + 1) % slideCount;
                goToSlide(currentIndex);
            }, autoScrollDelay);
        }

        function stopAutoScroll() {
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
            }
        }

        sliderWrapper.addEventListener('mouseenter', stopAutoScroll);
        sliderWrapper.addEventListener('mouseleave', startAutoScroll);

        // Initialize
        goToSlide(0);
        startAutoScroll();
    });
}

// Global scroll animation for the MAIN hero slider (if any)
// Global scroll animation moved to landing-hero-slider.js for index.html compatibility
// Preserving only the slider initialization logic here for other pages (e.g. careers.html)

// Initialize on page load
document.addEventListener('DOMContentLoaded', initSliders);

// Expose to window for dynamic content re-initialization
window.initHeroSlider = initSliders;
window.initAppleSlider = initSliders;

