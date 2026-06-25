let currentCategory = 'all';
let currentSearch = '';
let currentPage = 1;
const POSTS_PER_PAGE = 6;

// Initialize blog grid
async function initializeBlog() {
    try {
        const response = await fetch(CONFIG.API_BASE + '/content');
        const data = parseApiResponse(await response.json());

        if (data && data.sectionVisibility && data.sectionVisibility.blogPageHidden) {
            const blogHero = document.querySelector('.blog-hero');
            const blogPostsSection = document.querySelector('.blog-posts-section');
            if (blogHero) blogHero.style.display = 'none';
            if (blogPostsSection) blogPostsSection.style.display = 'none';

            const container = document.querySelector('.cta-section')?.parentElement || document.body;
            const msg = document.createElement('div');
            msg.style.padding = '100px 20px';
            msg.style.textAlign = 'center';
            msg.style.color = '#fff';
            msg.innerHTML = '<h2>This page is currently unavailable.</h2>';
            if (document.querySelector('.cta-section')) {
                document.querySelector('.cta-section').parentNode.insertBefore(msg, document.querySelector('.cta-section'));
            } else {
                container.appendChild(msg);
            }

            // Clear posts to prevent errors
            window.blogPosts = [];
            window.categoryLabels = {};
            return;
        }

        if (data && data.blogPage) {
            // Update hero content
            if (data.blogPage.heroTitle) {
                // Split title into words for gradient effect
                const titleWords = data.blogPage.heroTitle.split(' ');
                const titleEl = document.getElementById('blogHeroTitle');
                if (titleWords.length >= 2) {
                    // Use first word for left span, rest for right span
                    titleEl.innerHTML = `
                        <span class="blog-title-left">${titleWords[0]}</span>
                        <span class="blog-title-right">${titleWords.slice(1).join(' ')}</span>
                    `;
                } else {
                    // If only one word, put it in the right span
                    titleEl.innerHTML = `<span class="blog-title-right">${data.blogPage.heroTitle}</span>`;
                }
            }
            if (data.blogPage.heroDescription) {
                document.getElementById('blogHeroDescription').textContent = data.blogPage.heroDescription;
            }

            // Store blog posts
            window.blogPosts = data.blogPage.posts || [];

            // Store category labels if available
            window.categoryLabels = {};
            if (data.blogPage.categories) {
                data.blogPage.categories.forEach(cat => {
                    window.categoryLabels[cat.id] = cat.label;
                });
            }
        } else {
            window.blogPosts = [];
            window.categoryLabels = {};
        }
    } catch (error) {
        console.error('Error fetching blog posts:', error);
        window.blogPosts = [];
        window.categoryLabels = {};
    }

    renderCategories();
    renderBlogPosts();
    setupEventListeners();
}

// Render category buttons based on available categories in settings
function renderCategories() {
    const categoriesContainer = document.getElementById('blogCategories');

    // Build the definitive list of categories
    let uniqueCategories = [];

    // Default category labels if no custom data exists
    const defaultLabels = {
        'events': 'Events',
        'company': 'Company News',
        'case-study': 'Case Studies',
        'press': 'Press Release',
        'team': 'Team & Culture'
    };

    if (window.categoryLabels && Object.keys(window.categoryLabels).length > 0) {
        // Use exclusively explicitly defined categories from settings
        uniqueCategories = Object.keys(window.categoryLabels);
    } else {
        // Fallback to default categories
        uniqueCategories = Object.keys(defaultLabels);
    }

    // Build category buttons HTML
    let html = '<button class="category-btn active" data-category="all">All Posts</button>';

    uniqueCategories.forEach(catId => {
        const label = (window.categoryLabels && window.categoryLabels[catId]) || defaultLabels[catId] || catId;
        html += `<button class="category-btn" data-category="${catId}">${label}</button>`;
    });

    categoriesContainer.innerHTML = html;

    // Setup event listeners for category buttons
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.dataset.category;
            renderBlogPosts();
        });
    });
}

// Helper function to parse dates
function parsePostDate(dateStr) {
    // Try to parse the date string
    const date = new Date(dateStr);
    // If invalid, return a very old date so it goes to the end
    return isNaN(date.getTime()) ? new Date('1970-01-01') : date;
}

// Render blog posts
function renderBlogPosts() {
    const blogGrid = document.getElementById('blogGrid');
    const noBlogResults = document.getElementById('noBlogResults');

    // Sort posts by date (newest first) and then filter
    let sortedPosts = [...(window.blogPosts || [])].sort((a, b) => {
        const dateA = parsePostDate(a.date);
        const dateB = parsePostDate(b.date);
        return dateB - dateA; // Descending order (newest first)
    });

    // Filter by category and search
    let filteredPosts = sortedPosts.filter(post => {
        const defaultLabels = {
            'events': 'Events',
            'company': 'Company News',
            'case-study': 'Case Studies',
            'press': 'Press Release',
            'team': 'Team & Culture'
        };
        const validCategories = (window.categoryLabels && Object.keys(window.categoryLabels).length > 0)
            ? Object.keys(window.categoryLabels)
            : Object.keys(defaultLabels);

        const isValidCategory = validCategories.includes(post.category);
        const categoryMatch = currentCategory === 'all' ? true : post.category === currentCategory;
        const searchMatch = (post.title || '').toLowerCase().includes(currentSearch.toLowerCase()) ||
            (post.excerpt || '').toLowerCase().includes(currentSearch.toLowerCase());

        return isValidCategory && categoryMatch && searchMatch;
    });

    // Pagination Logic
    const totalPosts = filteredPosts.length;
    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    // Adjust current page if out of bounds
    if (currentPage > totalPages) currentPage = 1;

    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    const endIndex = startIndex + POSTS_PER_PAGE;
    const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

    renderPagination(totalPages);

    if (filteredPosts.length === 0) {
        blogGrid.innerHTML = '';
        noBlogResults.style.display = 'block';
        return;
    }

    noBlogResults.style.display = 'none';
    blogGrid.innerHTML = paginatedPosts.map(post => {
        const imgPath = resolveUrl(post.image, '');
        return `
        <a href="blog-post.html#id=${encodeURIComponent(post.id)}" class="blog-card" id="post-${post.id}" style="text-decoration: none; color: inherit;">
            <img src="${imgPath}" alt="${post.title}" class="blog-featured-image">
            <div class="blog-card-content">
                <div class="blog-card-meta">
                    <span class="blog-card-date">${post.date}</span>
                    <span class="blog-card-category">${(post.category || '').charAt(0).toUpperCase() + (post.category || '').slice(1)}</span>
                </div>
                <h3 class="blog-card-title">${post.title}</h3>
                <p class="blog-card-excerpt">${post.excerpt}</p>
                <div class="blog-card-footer" style="justify-content: flex-end;">
                    <span class="blog-read-more">
                        Read More <span>→</span>
                    </span>
                </div>
            </div>
        </a>
    `;
    }).join('');
}

// Render Pagination Controls
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationControls');

    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';
    let html = '';

    // Previous Button
    html += `
        <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
                data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
    `;

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <button class="pagination-btn ${currentPage === i ? 'active' : ''}"
                    data-page="${i}">
                ${i}
            </button>
        `;
    }

    // Next Button
    html += `
        <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
                data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
    `;

    paginationContainer.innerHTML = html;

    paginationContainer.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => changePage(Number(btn.dataset.page)));
    });
}

// Change Page Function
function changePage(newPage) {
    currentPage = newPage;
    renderBlogPosts();
    // Scroll to top of grid
    document.getElementById('blogCategories').scrollIntoView({ behavior: 'smooth' });
}

// Setup event listeners
function setupEventListeners() {
    // Search box
    document.getElementById('blogSearch').addEventListener('input', function (e) {
        currentSearch = e.target.value;
        currentPage = 1; // Reset to first page on search
        renderBlogPosts();
    });
}

// Read blog post or navigate to blog post page
function navigateToBlogPost(postId) {
    window.location.href = `blog-post.html#id=${encodeURIComponent(postId)}`;
}

// Newsletter subscription
async function subscribeNewsletter() {
    const emailInput = document.getElementById('newsletterEmail');
    const button = document.getElementById('blog-newsletter-subscribe-btn');
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

document.getElementById('blog-newsletter-subscribe-btn')?.addEventListener('click', subscribeNewsletter);

// Back to top button
const backToTop = document.getElementById('backToTop');
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeBlog);
