document.addEventListener('DOMContentLoaded', async () => {
    // Support both hash-based (#id=value) and query-based (?id=value) params
    let productId = null;
    const hash = window.location.hash;
    if (hash && hash.includes('id=')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        productId = hashParams.get('id');
    }
    if (!productId) {
        const params = new URLSearchParams(window.location.search);
        productId = params.get('id');
    }
    console.log('Product ID:', productId);

    if (!productId) {
        // window.location.href = 'solutions.html';
        return;
    }

    const decodedProductId = decodeURIComponent(productId);

    try {
        const res = await fetch(CONFIG.API_BASE + '/content');
        if (!res.ok) throw new Error('Failed to fetch content');
        const data = await res.json();

        let productsPage = null;
        if (data.productsPage && data.productsPage.data) {
            try {
                productsPage = JSON.parse(data.productsPage.data);
            } catch (e) {
                productsPage = data.productsPage;
            }
        } else if (data.productsPage && data.productsPage.sections) {
            productsPage = data.productsPage;
        }

        let foundProduct = null;
        if (productsPage && productsPage.sections) {
            for (const section of productsPage.sections) {
                if (section.products) {
                    foundProduct = section.products.find(p => p.id === decodedProductId);
                    if (foundProduct) break;
                }
            }
        }

        if (!foundProduct) {
            document.getElementById('loading-state').innerText = 'Product not found.';
            return;
        }

        // Update Hero
        document.getElementById('hero-title').innerText = foundProduct.title;
        document.getElementById('hero-subtitle').innerText = foundProduct.heroSubtitle || foundProduct.description;

        // Update page title
        document.title = foundProduct.title + ' - eScience';

        // Update Long Description
        const longDesc = foundProduct.longDescription || foundProduct.description;
        document.getElementById('detail-long-description').innerText = longDesc;
        document.getElementById('detail-lead-in').innerText = `Here are just some of the Key Features of ${foundProduct.title}:`;

        // Update Intro Image
        if (foundProduct.introImage) {
            document.getElementById('detail-intro-image').src = resolveUrl(foundProduct.introImage, '');
            document.getElementById('detail-intro-image').alt = foundProduct.title;
            document.getElementById('intro-visual-wrapper').style.display = 'block';
        }

        // Update Image
        if (foundProduct.image) {
            document.getElementById('detail-image').src = resolveUrl(foundProduct.image, '');
            document.getElementById('detail-image').alt = foundProduct.title;
            document.getElementById('hero-logo-wrapper').style.display = 'flex';
        }

        // Features Grid
        const featuresGrid = document.getElementById('detail-features-grid');
        if (foundProduct.features && foundProduct.features.length > 0) {
            foundProduct.features.forEach((feature, idx) => {
                const card = document.createElement('div');
                card.className = `feature-card-apple fade-up`;
                if (idx > 0) card.classList.add(`delay-${Math.min(idx, 3)}`);

                // Handle both string and object features
                let title = "";
                let iconHtml = "";
                let descriptionHtml = "";

                if (typeof feature === 'object' && feature !== null) {
                    title = feature.title || "";
                    if (feature.icon) {
                        iconHtml = `
                            <div class="feature-icon-wrapper">
                                <img src="${resolveUrl(feature.icon, '')}" class="feature-icon" alt="${title}">
                            </div>
                        `;
                    }
                } else {
                    title = feature;
                }

                card.innerHTML = `
                    ${iconHtml}
                    <h4>${title}</h4>
                `;
                featuresGrid.appendChild(card);
            });
        }

        // Benefits
        const benefitsList = document.getElementById('detail-benefits-list');
        if (foundProduct.benefits && foundProduct.benefits.length > 0) {
            foundProduct.benefits.forEach((benefit, idx) => {
                const item = document.createElement('div');
                item.className = `benefit-item-apple fade-up`;
                if (idx > 0) item.classList.add(`delay-${Math.min(idx, 3)}`);

                // Support both string format and object format with title/description
                if (typeof benefit === 'object' && benefit !== null) {
                    item.innerHTML = `
                        <div class="benefit-bullet"></div>
                        <div class="benefit-content">
                            <h3 class="benefit-title">${benefit.title || ''}</h3>
                            <p class="benefit-description">${benefit.description || ''}</p>
                        </div>
                    `;
                } else {
                    // Legacy string format - treat as title only
                    item.innerHTML = `
                        <div class="benefit-bullet"></div>
                        <div class="benefit-content">
                            <h3 class="benefit-title">${benefit}</h3>
                        </div>
                    `;
                }

                benefitsList.appendChild(item);
            });
        } else {
            document.getElementById('benefits-section').style.display = 'none';
        }

        // Use Case and Video
        if (foundProduct.useCase || foundProduct.video) {
            if (foundProduct.useCase) {
                document.getElementById('detail-use-case').innerText = foundProduct.useCase;
            }
            if (foundProduct.video) {
                document.getElementById('detail-video').src = resolveUrl(foundProduct.video, '');
                document.getElementById('video-container').style.display = 'block';
            }
            document.getElementById('use-case-video-section').style.display = 'block';
        }

        document.getElementById('loading-state').style.display = 'none';
        document.getElementById('product-content').style.display = 'block';

        // Initial Scroll Animations for newly visible content
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        });

        // Observe all fade-up elements
        document.querySelectorAll('.fade-up').forEach(el => {
            observer.observe(el);

            // Check if element is already in viewport and trigger animation
            const rect = el.getBoundingClientRect();
            const isInViewport = (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );

            if (isInViewport) {
                // Add a small delay to ensure smooth animation even for visible elements
                setTimeout(() => {
                    el.classList.add('visible');
                }, 100);
            }
        });

    } catch (e) {
        console.error('Error loading product details:', e);
        document.getElementById('loading-state').innerText = 'Error loading product details.';
    }
});
