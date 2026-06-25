// ===== SCROLL RESTORATION =====
window.addEventListener('beforeunload', () => {
    window.scrollTo(0, 0);
});

if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// ===== DYNAMIC PRODUCTS RENDERING =====
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('dynamic-products-container');
    if (!container) return;

    try {
        // Use the same loadContent function as other pages
        await loadContent();

        // Get the data from the global variable set by loadContent
        const data = window.lastLoadedData;
        if (!data) {
            console.error('No data loaded from API');
            return;
        }

        // Parse the nested JSON for productsPage
        let productsData = null;
        if (data.productsPage && data.productsPage.data) {
            try {
                productsData = JSON.parse(data.productsPage.data);
                console.log('Parsed productsPage data from nested JSON string: ', productsData);
            } catch (e) {
                console.error('Failed to parse productsPage data:', e);
                return;
            }
        } else if (data.productsPage && data.productsPage.sections) {
            // Fallback for already parsed data
            productsData = data.productsPage;
        }

        if (!productsData || !productsData.sections) return;

        // Small delay to ensure data is fully processed
        await new Promise(resolve => setTimeout(resolve, 50));

        // Clear container first
        container.innerHTML = '';

        productsData.sections.filter(s => !s.hidden).forEach((section, index) => {
            const sectionEl = document.createElement('section');
            sectionEl.className = 'solutions-section sticky-section';
            sectionEl.id = section.id || '';

            // Build Products HTML
            let productsHtml = '';
            if (section.products && section.products.length > 0) {
                section.products.filter(p => !p.hidden).forEach((prod, prodIndex) => {
                    const delayClass = prodIndex > 0 ? `delay-${prodIndex}` : '';
                    productsHtml += `
                        <a href="product-detail.html#id=${encodeURIComponent(prod.id || '')}" class="solution-card fade-up ${delayClass}" data-product-id="${prod.id || ''}" style="cursor: pointer; text-decoration: none; color: inherit;">
                            <div class="product-logo-container">
                                ${prod.image ? `<img src="${resolveUrl(prod.image, '../')}" alt="${prod.title}" class="product-logo">` : ''}
                                <h3 class="product-card-title">${prod.title}</h3>
                            </div>
                            <div class="solution-content">
                                <p class="product-card-description">${prod.description}</p>
                            </div>
                        </a>
                    `;
                });
            }

            sectionEl.innerHTML = `
                <div class="container">
                    <h2 class="section-title-center">${section.title}</h2>
                    <p class="section-subtitle-center">${section.subtitle || ''}</p>
                    <div class="solutions-grid products-page-grid">
                        ${productsHtml}
                    </div>
                </div>
            `;

            container.appendChild(sectionEl);
        });

        // Ensure CTA is NOT sticky and is after the container
        const ctaSection = document.getElementById('cta');
        if (ctaSection) {
            ctaSection.classList.remove('sticky-section');
            container.after(ctaSection);
        }

        // Apply Stacking Effect to ALL sticky sections
        const applyStacking = () => {
            const isMobile = window.innerWidth <= 768;
            const stickySections = document.querySelectorAll('.sticky-section');

            stickySections.forEach((section, index) => {
                const isDynamic = section.parentElement === container;
                if (isMobile && isDynamic) {
                    const baseOffset = 70;
                    const stepOffset = 60;
                    const topValue = baseOffset + (index * stepOffset);

                    section.style.setProperty('--stack-top', `${topValue}px`);
                    section.style.setProperty('--stack-z', `${10 + index}`);

                    // Add Click Interaction (One-time setup)
                    if (!section.dataset.hasClick) {
                        section.dataset.hasClick = 'true';
                        section.addEventListener('click', (e) => {
                            // Don't interfere with product card links
                            if (e.target.closest('a.solution-card')) return;

                            const isExpanding = !section.classList.contains('expanded-card');
                            // Accordion behavior: Close others
                            stickySections.forEach(s => {
                                if (s !== section) s.classList.remove('expanded-card');
                            });

                            if (isExpanding) {
                                section.classList.add('expanded-card');
                                // Disable body scroll
                                document.body.style.overflow = 'hidden';
                                setTimeout(() => {
                                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 100);
                            } else {
                                section.classList.remove('expanded-card');
                                // Re-enable body scroll
                                document.body.style.overflow = 'auto';
                            }
                        });
                    }
                } else {
                    section.style.removeProperty('--stack-top');
                    section.style.removeProperty('--stack-z');
                    section.classList.remove('expanded-card');
                    // Re-enable body scroll on desktop
                    document.body.style.overflow = 'auto';
                }
            });
        };

        // Initial apply
        applyStacking();
        window.addEventListener('resize', applyStacking);

        // Initialize scroll animations for dynamic content
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('#dynamic-products-container .fade-up').forEach(el => observer.observe(el));

        // Handle clicks outside expanded sections to close them
        document.addEventListener('click', (e) => {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) return;

            const expandedSection = document.querySelector('.sticky-section.expanded-card');
            if (expandedSection && !expandedSection.contains(e.target)) {
                expandedSection.classList.remove('expanded-card');
                document.body.style.overflow = 'auto';
            }
        });
        if (window.location.hash) {
            const hash = window.location.hash.substring(1);
            setTimeout(() => {
                const target = document.getElementById(hash);
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }

        // Mobile Swipe Navigation for Solution Cards
        if (window.innerWidth <= 768) {
            setupSwipeNavigation();
        }

        console.log('Solutions Stacking v1.3 - Persistent Deck Ready');
    } catch (e) {
        console.error('Failed to load products:', e);
    }
});

// Swipe Navigation Function
function setupSwipeNavigation() {
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50; // Minimum distance to trigger swipe

    // Get all solution grids
    document.querySelectorAll('.solutions-grid').forEach(grid => {
        grid.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        grid.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe(grid);
        }, false);
    });

    function handleSwipe(grid) {
        const diff = touchStartX - touchEndX;

        // Swipe left - scroll to next card
        if (diff > swipeThreshold) {
            grid.scrollBy({
                left: 300,
                behavior: 'smooth'
            });
        }

        // Swipe right - scroll to previous card
        if (diff < -swipeThreshold) {
            grid.scrollBy({
                left: -300,
                behavior: 'smooth'
            });
        }
    }
}

// ===== ACCESSIBILITY FOR DYNAMICALLY RENDERED SOLUTION CARDS =====
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('dynamic-products-container');
    const observer = new MutationObserver((mutations) => {
        const cards = document.querySelectorAll('.solution-card');
        cards.forEach(card => {
            if (!card.getAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
                card.setAttribute('role', 'link');
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        card.click();
                    }
                });
            }
        });
    });
    if (container) {
        observer.observe(container, { childList: true, subtree: true });
    }
});
