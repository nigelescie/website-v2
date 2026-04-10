document.addEventListener('DOMContentLoaded', async () => {
    const sliderContainer = document.querySelector('.hero-image-slider');
    // Optional: If you added dots from the previous step, keep this
    const dotsContainer = document.querySelector('.slider-dots');

    if (!sliderContainer) return;

    try {
        const res = await fetch('/api/content');
        if (res.ok) {
            const data = await res.json();
            if (data.hero && data.hero.slides && data.hero.slides.length > 0) {
                sliderContainer.innerHTML = '';
                data.hero.slides.forEach(slideData => {
                    const slide = document.createElement('div');
                    slide.classList.add('hero-slide');
                    const img = document.createElement('img');
                    img.src = slideData.image;
                    img.alt = slideData.label || 'Hero Slide';
                    slide.appendChild(img);
                    sliderContainer.appendChild(slide);
                });
            }
        }
    } catch (error) {
        console.error('Error fetching hero slides:', error);
    }

    const slides = Array.from(sliderContainer.querySelectorAll('.hero-slide'));
    if (slides.length === 0) return;

    // --- State ---
    let currentSlide = 0;
    let isDragging = false;
    let startPos = 0;
    let currentTranslate = 0;
    let animationID;
    let slideInterval;
    const intervalTime = 4000;

    // Optional: Setup Dots array if they exist
    let dots = [];
    if (dotsContainer) {
        // Clear existing to avoid duplicates if re-running
        dotsContainer.innerHTML = '';
        slides.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.classList.add('slider-dot');
            dot.addEventListener('click', () => {
                stopAutoSlide();
                currentSlide = index;
                updateSliderPosition();
                startAutoSlide();
            });
            dotsContainer.appendChild(dot);
            dots.push(dot);
        });
    }

    // --- Core Logic ---

    function setSliderPosition() {
        slides.forEach((slide, index) => {
            // Calculate where this slide should be relative to the current one
            // Base offset: (index - currentSlide) * 100%
            // Drag offset: pixel value converted to approximate percentage or kept as px

            // We use a combination: standard position + drag offset
            const basePosition = (index - currentSlide) * 100;

            // Apply transform
            // We use calc() to combine percentage (layout) and pixels (drag)
            slide.style.transform = `translateX(calc(${basePosition}% + ${currentTranslate}px))`;

            // Add transition only if NOT dragging (for smooth auto-slide)
            if (isDragging) {
                slide.style.transition = 'none';
            } else {
                slide.style.transition = 'transform 0.5s ease-out';
            }
        });

        // Update Dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }

    function updateSliderPosition() {
        // Wrapper for non-dragging updates (snapping to slide)
        currentTranslate = 0;
        setSliderPosition();
    }

    function nextSlide() {
        if (currentSlide < slides.length - 1) {
            currentSlide++;
        } else {
            currentSlide = 0; // Loop back to start
        }
        updateSliderPosition();
    }

    function prevSlide() {
        if (currentSlide > 0) {
            currentSlide--;
        } else {
            currentSlide = slides.length - 1; // Loop to end
        }
        updateSliderPosition();
    }

    // --- Auto Slide ---
    function startAutoSlide() {
        clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, intervalTime);
    }

    function stopAutoSlide() {
        clearInterval(slideInterval);
    }

    // --- Touch / Mouse Events ---

    function touchStart(index) {
        return function (event) {
            // Ignore if clicking a dot/control
            if (event.target.closest('.slider-dots')) return;

            stopAutoSlide();
            isDragging = true;
            startPos = getPositionX(event);
            sliderContainer.style.cursor = 'grabbing';

            // Animation loop allows smooth updates during drag
            animationID = requestAnimationFrame(animation);
        }
    }

    function touchMove(event) {
        if (isDragging) {
            const currentPosition = getPositionX(event);
            currentTranslate = currentPosition - startPos;
        }
    }

    function touchEnd() {
        isDragging = false;
        cancelAnimationFrame(animationID);
        sliderContainer.style.cursor = 'grab';

        const movedBy = currentTranslate;

        // Determine if we should change slide
        // Threshold: 100px swipe
        if (movedBy < -100) {
            nextSlide();
        } else if (movedBy > 100) {
            prevSlide();
        } else {
            updateSliderPosition(); // Snap back if drag wasn't long enough
        }

        startAutoSlide();
    }

    function getPositionX(event) {
        return event.type.includes('mouse') ? event.pageX : event.touches[0].clientX;
    }

    function animation() {
        if (isDragging) {
            setSliderPosition();
            requestAnimationFrame(animation);
        }
    }

    // --- Initialization ---

    // Bind Events
    sliderContainer.addEventListener('touchstart', touchStart());
    sliderContainer.addEventListener('touchend', touchEnd);
    sliderContainer.addEventListener('touchmove', touchMove);

    sliderContainer.addEventListener('mousedown', touchStart());
    sliderContainer.addEventListener('mouseup', touchEnd);
    sliderContainer.addEventListener('mouseleave', () => {
        if (isDragging) touchEnd();
    });
    sliderContainer.addEventListener('mousemove', touchMove);

    // Initial Render
    updateSliderPosition();
    startAutoSlide();
});