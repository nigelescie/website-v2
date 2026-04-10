// Testimonials Slider
function initTestimonialsSlider(forceReset = false) {
    let slider = document.getElementById('testimonialsSlider');
    if (!slider) return;

    if (forceReset && slider.parentNode) {
        const clonedSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(clonedSlider, slider);
        slider = clonedSlider;
    }

    const container = document.getElementById('testimonialsContainer');
    const prevBtn = document.getElementById('testimonialsPrev');
    const nextBtn = document.getElementById('testimonialsNext');
    const indicatorsContainer = document.getElementById('testimonialsIndicators');

    if (!slider || !container || !indicatorsContainer) return;

    const slides = container.querySelectorAll('.testimonial-slide');
    let currentSlide = 0;
    let autoSlideInterval;
    let autoSlideTimeout;

    indicatorsContainer.innerHTML = '';

    // Create indicators
    slides.forEach((_, index) => {
        const indicator = document.createElement('div');
        indicator.className = 'testimonial-indicator';
        if (index === 0) indicator.classList.add('active');
        indicator.addEventListener('click', () => goToSlide(index));
        indicatorsContainer.appendChild(indicator);
    });

    const indicators = indicatorsContainer.querySelectorAll('.testimonial-indicator');

    function updateSlider() {
        const translateX = -currentSlide * 100;
        container.style.transform = `translateX(${translateX}%)`;

        // Update indicators
        indicators.forEach((indicator, index) => {
            indicator.classList.toggle('active', index === currentSlide);
        });
    }

    function goToSlide(index) {
        if (!slides.length) return;
        currentSlide = index;
        updateSlider();
        resetAutoSlide();
    }

    function nextSlide() {
        if (!slides.length) return;
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlider();
    }

    function prevSlide() {
        if (!slides.length) return;
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        updateSlider();
    }

    function startAutoSlide() {
        // Clear any existing interval first
        clearInterval(autoSlideInterval);
        autoSlideInterval = setInterval(() => {
            if (!isDragging) {
                nextSlide();
            }
        }, 8000);
    }

    function stopAutoSlide() {
        clearInterval(autoSlideInterval);
    }

    function resetAutoSlide() {
        stopAutoSlide();
        // Clear any existing timeout to prevent multiple intervals
        clearTimeout(autoSlideTimeout);
        startAutoSlide();
    }

    // Enhanced touch/drag support
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let dragOffset = 0;

    // Event listeners
    if (prevBtn) prevBtn.addEventListener('click', () => {
        prevSlide();
        resetAutoSlide();
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
        nextSlide();
        resetAutoSlide();
    });

    // Pause auto-slide on hover
    slider.addEventListener('mouseenter', () => {
        if (!isDragging) stopAutoSlide();
    });
    slider.addEventListener('mouseleave', () => {
        if (!isDragging) {
            setTimeout(() => {
                startAutoSlide();
            }, 500);
        }
    });

    // Touch events
    slider.addEventListener('touchstart', handleDragStart);
    slider.addEventListener('touchmove', handleDragMove);
    slider.addEventListener('touchend', handleDragEnd);

    // Mouse events for desktop drag
    slider.addEventListener('mousedown', handleDragStart);
    slider.addEventListener('mousemove', handleDragMove);
    slider.addEventListener('mouseup', handleDragEnd);
    slider.addEventListener('mouseleave', handleDragEnd);

    function handleDragStart(e) {
        isDragging = true;
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        currentX = startX;
        container.classList.add('dragging');
        stopAutoSlide();
    }

    function handleDragMove(e) {
        if (!isDragging) return;
        e.preventDefault();

        currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        dragOffset = currentX - startX;

        const currentTransform = -currentSlide * 100;
        const dragPercentage = (dragOffset / slider.offsetWidth) * 100;
        container.style.transform = `translateX(${currentTransform + dragPercentage}%)`;
    }

    function handleDragEnd(e) {
        if (!isDragging) return;

        isDragging = false;
        container.classList.remove('dragging');

        const threshold = slider.offsetWidth * 0.2; // 20% of slider width

        if (Math.abs(dragOffset) > threshold) {
            if (dragOffset > 0) {
                prevSlide();
            } else {
                nextSlide();
            }
        } else {
            updateSlider(); // Snap back to current slide
        }

        dragOffset = 0;
        // Delay auto-slide restart to prevent immediate conflicts
        setTimeout(() => {
            resetAutoSlide();
        }, 100);
    }

    // Prevent context menu on long press
    slider.addEventListener('contextmenu', (e) => {
        if (isDragging) e.preventDefault();
    });

    // Initialize
    updateSlider();
    startAutoSlide();
}

window.initTestimonialsSlider = initTestimonialsSlider;
document.addEventListener('DOMContentLoaded', () => initTestimonialsSlider(false));