// Static "Recommended Reading" cards (before dynamic content replaces them)
document.querySelectorAll('.blog-related-card[data-post-id]').forEach(card => {
    card.addEventListener('click', () => navigateToPost(card.dataset.postId));
});
document.getElementById('newsletter-subscribe-btn')?.addEventListener('click', subscribeToNewsletter);

// Share functionality
function sharePost(platform) {
    const title = document.title;
    const url = window.location.href;

    if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'linkedin') {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'email') {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    }
}

// Navigate to related post
function navigateToPost(postId) {
    window.location.href = `blog-post.html#id=${encodeURIComponent(postId)}`;
}

async function loadBlogPost() {
    // Read id from hash (e.g. blog-post.html#id=123)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const postId = hashParams.get('id');

    if (!postId) {
        loadPostContent(7);
        return;
    }

    loadPostContent(postId);
}

async function loadPostContent(postId) {
    try {
        const response = await fetch(CONFIG.API_BASE + '/content');
        const raw = await response.json();
        const data = parseApiResponse(raw);

        if (data && data.blogPage && data.blogPage.posts) {
            const allPosts = data.blogPage.posts;

            // Sort posts by date (newest first) to match main blog list
            allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

            const currentIndex = allPosts.findIndex(p => p.id.toString() === postId.toString());
            post = allPosts[currentIndex];

            // Store index and array for navigation
            window.currentPostIndex = currentIndex;
            window.allBlogPosts = allPosts;
        }

        if (!post) {
            document.querySelector('.blog-post-content').innerHTML = `
                <div class="container" style="text-align: center; padding: 100px 0;">
                    <h2>Blog post not found</h2>
                    <a href="blog.html" class="blog-back-link" style="position: static; display: inline-block; margin-top: 20px;">Return to Blog</a>
                </div>
            `;
            return;
        }

        // Populate Content
        document.title = `${post.title} - eScience Blog`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', post.excerpt || '');

        // Hero Section
        const categoryEl = document.querySelector('.blog-post-category');
        if (categoryEl) categoryEl.textContent = (post.category || 'Company News').replace(/-/g, ' ');

        const titleEl = document.querySelector('.blog-post-header h1');
        if (titleEl) titleEl.textContent = post.title;

        const metaItems = document.querySelectorAll('.blog-post-meta-item span:last-child');
        if (metaItems.length >= 1) {
            metaItems[0].textContent = post.date;
        }

        // Calculate and display reading time
        if (metaItems.length >= 2) {
            const readingTime = calculateReadingTime(post);
            metaItems[1].textContent = readingTime;
        }

        // Image Fix
        const heroSection = document.querySelector('.blog-post-hero');

        if (post.image) {
            const fullPath = resolveUrl(post.image, '');

            // Use as dynamic background for hero depth
            if (heroSection) {
                heroSection.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.95)), url(${fullPath})`;
                heroSection.style.backgroundSize = 'cover';
                heroSection.style.backgroundPosition = 'center';
            }
        }

        // Body Content (Block-Based Rendering)
        const contentContainer = document.querySelector('.blog-post-body');
        if (contentContainer) {
            contentContainer.innerHTML = '';

            if (post.blocks && post.blocks.length > 0) {
                // Render modular blocks
                post.blocks.forEach(block => {
                    let blockHtml = '';
                    switch (block.type) {
                        case 'text':
                            blockHtml = `<div class="blog-block blog-text-block animate-on-scroll">${DOMPurify.sanitize(block.content || '')}</div>`;
                            break;
                        case 'image':
                            // Support both new multi-image format and legacy single image
                            if (block.images && block.images.length > 0) {
                                // New multi-image gallery format
                                const imagesHtml = block.images.map(img => {
                                    const imgPath = resolveUrl(img.url, '');
                                    const hasCaption = img.caption && img.caption.trim() !== '';
                                    return `
                                        <div class="gallery-image-wrapper ${!hasCaption ? 'no-caption' : ''}">
                                            <img src="${imgPath}" alt="${img.caption || ''}">
                                            ${hasCaption ? `<figcaption>${img.caption}</figcaption>` : ''}
                                        </div>
                                    `;
                                }).join('');

                                blockHtml = `
                                    <div class="blog-block blog-gallery-block animate-on-scroll">
                                        <div class="blog-gallery-grid">
                                            ${imagesHtml}
                                        </div>
                                    </div>`;
                            } else if (block.url) {
                                // Legacy single image format
                                const imgPath = resolveUrl(block.url, '');
                                blockHtml = `
                                    <div class="blog-block blog-image-block wp-block-image animate-on-scroll">
                                        <img src="${imgPath}" alt="${block.caption || ''}">
                                        ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                                    </div>`;
                            }
                            break;
                        case 'quote':
                            blockHtml = `<div class="blog-block blog-quote-block animate-on-scroll"><blockquote>${DOMPurify.sanitize(block.content || '')}</blockquote></div>`;
                            break;
                        case 'divider':
                            blockHtml = `<div class="blog-block blog-divider"></div>`;
                            break;
                        case 'video':
                            if (block.url) {
                                let embedUrl = null;
                                let videoUrl = block.url;
                                const ytMatch = block.url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                                const vimeoMatch = block.url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);

                                if (ytMatch) embedUrl = 'https://www.youtube.com/embed/' + ytMatch[1];
                                else if (vimeoMatch) embedUrl = 'https://player.vimeo.com/video/' + vimeoMatch[1];

                                if (embedUrl) {
                                    blockHtml = `
                                        <div class="blog-block blog-video-block animate-on-scroll">
                                            <div class="video-wrapper">
                                                <iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                                            </div>
                                            ${block.caption ? `<div style="text-align: center; color: rgba(255,255,255,0.6); margin-top: -3.5rem; margin-bottom: 2rem; font-size: 0.9rem; font-style: italic;">${block.caption}</div>` : ''}
                                        </div>`;
                                } else {
                                    // Handle local video file
                                    const vidPath = resolveUrl(videoUrl, '');
                                    blockHtml = `
                                        <div class="blog-block blog-video-block animate-on-scroll" style="margin: 4.5rem 0;">
                                            <div class="video-native-wrapper" style="border-radius: 24px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); background: #000;">
                                                <video src="${vidPath}#t=0.1" controls style="width: 100%; display: block;" preload="metadata"></video>
                                            </div>
                                            ${block.caption ? `<div style="text-align: center; color: rgba(255,255,255,0.6); margin-top: 1rem; font-size: 0.9rem; font-style: italic;">${block.caption}</div>` : ''}
                                        </div>`;
                                }
                            }
                            break;
                        case 'header':
                            blockHtml = `<h2 class="blog-block blog-header-block animate-on-scroll">${DOMPurify.sanitize(block.content || '')}</h2>`;
                            break;
                    }
                    contentContainer.innerHTML += blockHtml;
                });

                // Navigation Logic
                const currentIndex = window.currentPostIndex;
                const allPosts = window.allBlogPosts;

                // Previous = Newer (index - 1)
                // Next = Older (index + 1)
                const prevPost = (currentIndex !== -1 && currentIndex > 0) ? allPosts[currentIndex - 1] : null;
                const nextPost = (currentIndex !== -1 && currentIndex < allPosts.length - 1) ? allPosts[currentIndex + 1] : null;

                let navHtml = `<div class="blog-post-navigation animate-on-scroll">`;

                if (prevPost) {
                    navHtml += `
                        <a href="blog-post.html#id=${encodeURIComponent(prevPost.id)}" class="nav-btn prev-post">
                            <span class="nav-label">← Previous Article</span>
                            <span class="nav-title">${prevPost.title}</span>
                        </a>
                    `;
                } else {
                    navHtml += `<div class="nav-btn hidden"></div>`;
                }

                if (nextPost) {
                    navHtml += `
                        <a href="blog-post.html#id=${encodeURIComponent(nextPost.id)}" class="nav-btn next-post">
                            <span class="nav-label">Next Article →</span>
                            <span class="nav-title">${nextPost.title}</span>
                        </a>
                    `;
                } else {
                    navHtml += `<div class="nav-btn hidden"></div>`;
                }

                navHtml += `</div>`;

                // Append Navigation
                contentContainer.innerHTML += navHtml;

            } else {
                // Fallback for legacy HTML content
                contentContainer.innerHTML = DOMPurify.sanitize(post.content || '<p>No content available for this post.</p>');
            }
        }

        // Dynamic Recommended Reading
        if (data.blogPage && data.blogPage.posts) {
            const allPosts = data.blogPage.posts;
            const relatedGrid = document.querySelector('.blog-related-grid');

            if (relatedGrid) {
                // Filter out current post and get other posts
                let otherPosts = allPosts.filter(p => p.id.toString() !== postId.toString());

                // Sort by relevance (same category first) then shuffle
                otherPosts.sort((a, b) => {
                    if (a.category === post.category && b.category !== post.category) return -1;
                    if (a.category !== post.category && b.category === post.category) return 1;
                    return 0.5 - Math.random();
                });

                // Take top 3
                const recommended = otherPosts.slice(0, 3);

                if (recommended.length > 0) {
                    relatedGrid.innerHTML = '';
                    recommended.forEach((rp, index) => {
                        const imgPath = resolveUrl(rp.image || 'assets/hero-bg.jpg', '');
                        const card = document.createElement('div');
                        card.className = 'blog-related-card animate-on-scroll';
                        card.style.transitionDelay = `${index * 100}ms`;
                        card.addEventListener('click', () => navigateToPost(rp.id));
                        const imgWrap = document.createElement('div');
                        imgWrap.style.cssText = 'height: 180px; overflow: hidden;';
                        const img = document.createElement('img');
                        img.src = imgPath;
                        img.className = 'blog-related-image';
                        img.alt = rp.title || '';
                        imgWrap.appendChild(img);
                        const info = document.createElement('div');
                        info.className = 'blog-related-info';
                        const h4 = document.createElement('h4');
                        h4.textContent = rp.title || '';
                        const p = document.createElement('p');
                        p.textContent = rp.excerpt || '';
                        info.appendChild(h4);
                        info.appendChild(p);
                        card.appendChild(imgWrap);
                        card.appendChild(info);
                        relatedGrid.appendChild(card);
                    });
                }
            }
        }

        // Initialize scroll animations
        setupScrollAnimations();

    } catch (error) {
        console.error('Error loading blog post:', error);
        document.querySelector('.blog-post-content').innerHTML = `
                <div class="container" style="text-align: center; padding: 100px 0;">
                    <h2>Error loading blog post</h2>
                    <p>Please try again later.</p>
                    <a href="blog.html" class="blog-back-link" style="position: static; display: inline-block; margin-top: 20px;">Return to Blog</a>
                </div>
            `;
    }
}

// Setup scroll animations
function setupScrollAnimations() {
    setTimeout(() => {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        const animatedElements = document.querySelectorAll('.animate-on-scroll');
        animatedElements.forEach(el => observer.observe(el));
    }, 100); // Slight delay to ensure DOM is ready
}


// Calculate reading time based on word count
function calculateReadingTime(post) {
    const wordsPerMinute = 200;
    let wordCount = 0;

    if (post.blocks && post.blocks.length > 0) {
        // Calculate from blocks
        post.blocks.forEach(block => {
            if (block.type === 'text' || block.type === 'header' || block.type === 'quote') {
                // Strip HTML tags and count words
                const text = (block.content || '').replace(/<[^>]*>/g, ' ');
                const words = text.trim().split(/\s+/).length;
                wordCount += words;
            }
        });
    } else if (post.content) {
        // Legacy content fallback
        const text = post.content.replace(/<[^>]*>/g, ' ');
        wordCount = text.trim().split(/\s+/).length;
    }

    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    // Ensure at least 1 min read for very short posts
    return `${Math.max(1, readingTime)} min read`;
}

// Back to top button
const backToTop = document.getElementById('backToTop');
if (backToTop) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Reading progress bar logic
window.addEventListener('scroll', () => {
    const progress = document.getElementById('reading-progress');
    if (progress) {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progress.style.width = scrolled + "%";
    }
});

async function subscribeToNewsletter() {
    const emailInput = document.getElementById('newsletter-email');
    const button = document.querySelector('#newsletter-form button');
    const email = emailInput.value.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    const originalText = button.textContent;
    button.textContent = 'Subscribing...';
    button.disabled = true;

    try {
        const res = await fetch(CONFIG.API_BASE + '/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (data.success) {
            alert(data.message);
            emailInput.value = '';
        } else {
            alert(data.message || 'Subscription failed. Please try again.');
        }
    } catch (err) {
        console.error('Subscription error:', err);
        alert('An error occurred. Please try again later.');
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', loadBlogPost);
