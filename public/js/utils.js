// public/js/utils.js

const API_CONTENT_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE) ? CONFIG.API_BASE + '/content' : '/api/content';

async function loadContent() {
    try {
        const response = await fetch(API_CONTENT_URL);
        const raw = await response.json();
        if (raw) {
            const data = parseApiResponse(raw);
            window.lastLoadedData = data;
            updateDOM(data);
        }
    } catch (error) {
        console.error("Error loading content:", error);
    }
}

function parseApiResponse(raw) {
    if (!raw) return {};
    const data = {};
    for (const key in raw) {
        const entry = raw[key];
        if (entry && typeof entry.data === 'string') {
            try { data[key] = JSON.parse(entry.data); } catch { data[key] = entry.data; }
        } else {
            data[key] = entry;
        }
    }
    return data;
}

function resolveUrl(url, pathPrefix) {
    if (!url || url.startsWith('http') || url.startsWith('/') || url.startsWith('data:')) return url || '';
    if (url.startsWith('uploads/')) {
        return (typeof CONFIG !== 'undefined' ? CONFIG.UPLOADS_BASE.replace(/\/uploads$/, '') : '') + '/' + url;
    }
    return (pathPrefix || '') + url;
}

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

function uniqueSlug(base, used) {
    const normalizedBase = base || 'solution';
    let candidate = normalizedBase;
    let i = 2;
    while (used.has(candidate)) {
        candidate = `${normalizedBase}-${i}`;
        i++;
    }
    used.add(candidate);
    return candidate;
}

function updateDOM(data) {
    if (!data) return;

    const visibility = data.sectionVisibility || {};

    // 1. Hero
    if (data.hero && data.hero.hidden) {
        const heroSection = document.querySelector('.hero');
        if (heroSection) heroSection.style.display = 'none';
    } else if (data.hero) {
        if (data.hero.buttonText) {
            const heroBtn = document.querySelector('.hero-cta-buttons .hero-btn');
            if (heroBtn) heroBtn.textContent = data.hero.buttonText;
        }
        if (data.hero.slides && data.hero.slides.length > 0) {
            const sliderContainer = document.querySelector('.hero-image-slider');
            if (sliderContainer) {
                sliderContainer.innerHTML = '';
                data.hero.slides.filter(s => !s.hidden).forEach(slide => {
                    const el = document.createElement('div');
                    el.className = 'hero-slide';
                    el.innerHTML = `<img src="${resolveUrl(slide.image, '')}" alt="${slide.label || 'Hero Slide'}">`;
                    sliderContainer.appendChild(el);
                });
                if (window.initHeroSlider) window.initHeroSlider();
            }
        }
    }

    // 2. Stats
    if (visibility.statsHidden) {
        const statsSection = document.querySelector('.stats-section') || document.getElementById('stats');
        if (statsSection) statsSection.style.display = 'none';
    } else if (data.stats && Array.isArray(data.stats)) {
        renderStats(data.stats);
    }

    // 2.5 Our Clients
    console.log("Updating Our Clients section with data:", data.ourClients)
    if (visibility.ourClientsHidden) {
        const ourClientsSection = document.getElementById('our-clients');
        // if (ourClientsSection) ourClientsSection.style.display = 'none';
    } else if (data.ourClients && Array.isArray(data.ourClients)) {
        renderOurClients(data.ourClients);
    }

    // 3. Problem
    if (data.problem && data.problem.hidden) {
        const problemSection = document.getElementById('homepage-problem-section');
        if (problemSection) problemSection.style.display = 'none';
    } else if (data.problem) {
        setText('#homepage-problem-section .section-title', data.problem.title);
        setText('#homepage-problem-section .section-text', data.problem.text);
        if (data.problem.titleColor) {
            const title = document.querySelector('#homepage-problem-section .section-title');
            if (title) title.style.color = data.problem.titleColor;
        }
        if (data.problem.textColor) {
            const text = document.querySelector('#homepage-problem-section .section-text');
            if (text) text.style.color = data.problem.textColor;
        }
    }

    // 4. Solutions
    if (visibility.solutionsHidden) {
        const solutionsSection = document.getElementById('solutions');
        if (solutionsSection) solutionsSection.style.display = 'none';
    } else if (data.solutions && Array.isArray(data.solutions)) {
        renderSolutions(data.solutions);
    }

    // 5. Why Us
    if (visibility.whyUsHidden) {
        const whyUsSection = document.getElementById('why-us') || document.querySelector('.why-us');
        if (whyUsSection) whyUsSection.style.display = 'none';
    } else if (data.whyUs && Array.isArray(data.whyUs)) {
        const whyUsGrid = document.getElementById('why-us-grid');
        if (whyUsGrid) {
            whyUsGrid.innerHTML = '';
            data.whyUs.filter(item => !item.hidden).forEach((item, index) => {
                const card = document.createElement('div');
                const delayClass = index > 0 && index <= 3 ? ` delay-${index}` : '';
                card.className = `solution-card fade-up${delayClass} visible`;
                card.innerHTML = `
                    <div class="solution-banner"><img src="${resolveUrl(item.image, '')}" alt="${item.title || ''}" class="solution-image" /></div>
                    <div class="solution-content"><h3>${item.title || ''}</h3><p>${item.description || ''}</p></div>
                `;
                whyUsGrid.appendChild(card);
            });
        }
    }

    // 6. Testimonials
    if (visibility.testimonialsHidden) {
        const testimonialsSection = document.getElementById('testimonials') || document.querySelector('.testimonials-section');
        if (testimonialsSection) testimonialsSection.style.display = 'none';
    } else if (data.testimonials && Array.isArray(data.testimonials)) {
        const container = document.getElementById('testimonialsContainer');
        if (container) {
            container.innerHTML = '';
            data.testimonials.filter(item => !item.hidden).forEach((item) => {
                const slide = document.createElement('div');
                slide.className = 'testimonial-slide';
                slide.innerHTML = `
                    <div class="testimonial-header">
                        <div class="client-logo-container"><img src="${resolveUrl(item.logo, '')}" alt="Client Logo" class="client-logo" /></div>
                        <div class="company-name">${item.company || ''}</div>
                    </div>
                    <div class="testimonial-content"><p>"${item.quote || ''}"</p></div>
                    <div class="testimonial-author">
                        <div class="author-name">${item.name || ''}</div>
                        <div class="author-title">${item.title || ''}</div>
                    </div>
                `;
                container.appendChild(slide);
            });
            if (window.initTestimonialsSlider) window.initTestimonialsSlider();
        }
    }

    // 11. Custom Dynamic Sections
    let pageKey = '';
    const currentPath = window.location.pathname;
    if (currentPath.endsWith('index.html') || currentPath === '/' || currentPath.endsWith('/')) {
        pageKey = 'homePage';
    } else if (currentPath.includes('company.html')) {
        pageKey = 'companyPage';
    } else if (currentPath.includes('careers.html')) {
        pageKey = 'careersPage';
    }

    if (pageKey && data[pageKey]) {
        if (data[pageKey].customSections) {
            renderCustomSections(data[pageKey].customSections);
        }
        if (data[pageKey].sectionOrder) {
            reorderSections(pageKey, data[pageKey].sectionOrder);
        }
    }

    // 12. Nav Spacer Adjustment
    setTimeout(() => {
        const mainElements = Array.from(document.body.children).filter(el => {
            const tag = el.tagName.toLowerCase();
            if (['script', 'style', 'nav', 'link', 'meta', 'title'].includes(tag)) return false;
            if (window.getComputedStyle(el).display === 'none') return false;
            if (el.id === 'nav-spacer') return false;
            return true;
        });

        const firstVisible = mainElements[0];
        if (firstVisible) {
            const isHero = firstVisible.classList.contains('hero') || 
                           firstVisible.classList.contains('hero-image-section') ||
                           firstVisible.classList.contains('hero-banner') ||
                           (firstVisible.id && firstVisible.id.toLowerCase().includes('hero'));

                let spacer = document.getElementById('nav-spacer');
                if (!isHero) {
                    if (!spacer) {
                        spacer = document.createElement('div');
                        spacer.id = 'nav-spacer';
                        spacer.style.width = '100%';
                        spacer.style.backgroundColor = 'transparent';
                        firstVisible.parentNode.insertBefore(spacer, firstVisible);
                    }
                    // Compute nav height dynamically instead of using a fixed 120px value.
                    const navEl = document.querySelector('.nav');
                    const computedNavHeight = navEl ? navEl.offsetHeight : 86; // fallback to 86px
                    spacer.style.height = computedNavHeight + 'px';

                    // Watch for other scripts that might later override the spacer height
                    // or the hero padding; if detected, restore the computed value.
                    try {
                        const restoreSpacerHeight = () => {
                            const navH = (document.querySelector('.nav') || {}).offsetHeight || computedNavHeight;
                            if (spacer.style.height !== navH + 'px') spacer.style.height = navH + 'px';
                        };

                        // Observe attribute changes on the spacer and on the hero element
                        const observerTargets = [];
                        if (spacer) observerTargets.push(spacer);
                        const heroEl = document.querySelector('.hero-image-section');
                        if (heroEl) observerTargets.push(heroEl);

                        const mo = new MutationObserver((mutations) => {
                            restoreSpacerHeight();
                            // ensure hero padding is not larger than nav height
                            if (heroEl) {
                                const navH = (document.querySelector('.nav') || {}).offsetHeight || computedNavHeight;
                                const heroPad = parseInt(window.getComputedStyle(heroEl).paddingTop, 10) || 0;
                                if (heroPad > navH + 40) { // arbitrary threshold
                                    heroEl.style.paddingTop = navH + 'px';
                                }
                            }
                        });

                        observerTargets.forEach(t => mo.observe(t, { attributes: true, attributeFilter: ['style', 'class'], subtree: false }));

                        // Failsafe: re-apply correct spacer height a few times during initial load
                        let enforcementRuns = 0;
                        const enforcer = setInterval(() => {
                            restoreSpacerHeight();
                            enforcementRuns++;
                            if (enforcementRuns > 20) clearInterval(enforcer);
                        }, 100);
                    } catch (e) {
                        // If MutationObserver isn't available, still set the height once.
                    }
                spacer.style.display = 'block';
                if (firstVisible.classList.contains('stats-section')) firstVisible.style.marginTop = '0px';
            } else {
                if (spacer) spacer.style.display = 'none';
                const statsSection = document.querySelector('.stats-section');
                if (statsSection && statsSection !== firstVisible) statsSection.style.marginTop = '';
            }
        }
    }, 50);
}

function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el && text) el.innerText = text;
}

function reorderSections(pageKey, order) {
    const wrapper = document.getElementById('main-content-wrapper');
    if (!wrapper || !order) return;
    
    order.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentNode === wrapper) {
            wrapper.appendChild(el);
        }
    });
}

function renderCustomSections(sections) {
    const container = document.getElementById('dynamic-sections-container');
    if (!container || !sections || sections.length === 0) {
        if (container) container.innerHTML = '';
        return;
    }

    container.innerHTML = '';
    const isSubPage = window.location.pathname.includes('/nav-pages/');
    const pathPrefix = isSubPage ? '../' : '';

    sections.filter(s => !s.hidden).forEach((section, index) => {
        const sectionEl = document.createElement('section');
        sectionEl.id = `custom-${index}`;
        sectionEl.className = 'custom-dynamic-section';
        sectionEl.style.opacity = '1';
        sectionEl.style.transform = 'none';

        const wrapper = document.getElementById('main-content-wrapper');
        if (wrapper && !document.getElementById(sectionEl.id)) {
            wrapper.appendChild(sectionEl);
        } else if (!wrapper) {
            // Fallback for pages without main-content-wrapper
            const fallbackContainer = document.getElementById('dynamic-sections-container');
            if (fallbackContainer) fallbackContainer.appendChild(sectionEl);
        }

        if (section.template === 'centered-hero') {
            sectionEl.classList.add('premium-hero-style');
            const bgBlock = (section.blocks || []).find(b => b.type === 'image');
            if (bgBlock && bgBlock.imageUrl) {
                const url = resolveUrl(bgBlock.imageUrl, pathPrefix);
                sectionEl.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('${url}')`;
            }
        }

        const outerContainer = document.createElement('div');
        outerContainer.className = 'container';

        const blocks = section.blocks || [];

        // ── Row-based grid rendering ──────────────────────────────────────────
        // Group blocks by `row` index. Fall back to flat stacking for legacy sections.
        const anyHasRow = blocks.some(b => b.row !== undefined);

        if (anyHasRow) {
            // Build row map
            const rowMap = {};
            blocks.forEach(b => {
                const r = b.row ?? 0;
                if (!rowMap[r]) rowMap[r] = [];
                rowMap[r].push(b);
            });

            Object.keys(rowMap).map(Number).sort((a, b) => a - b).forEach(rowKey => {
                const rowBlocks = rowMap[rowKey].sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
                const isSingleBlock = rowBlocks.length === 1;

                const rowEl = document.createElement('div');
                rowEl.className = 'custom-row';
                if (!isSingleBlock) {
                    if (section.template && section.template.startsWith('split-') && rowKey == 0) {
                        rowEl.classList.add('content-split');
                    } else {
                        rowEl.style.display = 'flex';
                        rowEl.style.gap = '1.5rem';
                        rowEl.style.alignItems = 'flex-start';
                        rowEl.style.flexWrap = 'wrap';
                    }
                }

                rowBlocks.forEach(block => {
                    const blockDiv = document.createElement('div');
                    
                    if (section.template && section.template.startsWith('split-') && rowKey == 0) {
                        blockDiv.className = (block.type === 'image') ? 'content-right' : 'content-left';
                        if (section.template === 'split-image-left') {
                            blockDiv.style.order = (block.type === 'image') ? '1' : '2';
                        }
                    } else {
                        blockDiv.style.flex = '1';
                        blockDiv.style.minWidth = '0';
                    }
                    
                    blockDiv.innerHTML = buildBlockHtml(block, pathPrefix, section);
                    rowEl.appendChild(blockDiv);

                    // Stats need deferred rendering
                    if (block.type === 'stats') {
                        setTimeout(() => {
                            if (window.lastLoadedData && window.lastLoadedData.stats) {
                                renderStats(window.lastLoadedData.stats, `#blocks-stats-container-${block.id}`);
                            }
                        }, 0);
                    }
                });

                outerContainer.appendChild(rowEl);
            });
        } else {
            // Legacy flat list — preserve old split wrapper behavior
            let splitWrapper = null;
            if (section.template === 'split-image-left' || section.template === 'split-image-right') {
                splitWrapper = document.createElement('div');
                splitWrapper.className = 'content-split';
                outerContainer.appendChild(splitWrapper);
            }

            blocks.forEach(block => {
                const blockHtml = buildBlockHtml(block, pathPrefix, section);
                if (splitWrapper) {
                    const column = document.createElement('div');
                    column.className = (block.type === 'image') ? 'content-right' : 'content-left';
                    if (section.template === 'split-image-left') {
                        if (block.type === 'image') column.style.order = '1';
                        else column.style.order = '2';
                    }
                    column.innerHTML = blockHtml;
                    splitWrapper.appendChild(column);
                } else {
                    const div = document.createElement('div');
                    div.innerHTML = blockHtml;
                    outerContainer.appendChild(div);
                }
                if (block.type === 'stats') {
                    setTimeout(() => {
                        if (window.lastLoadedData && window.lastLoadedData.stats) {
                            renderStats(window.lastLoadedData.stats, `#blocks-stats-container-${block.id}`);
                        }
                    }, 0);
                }
            });
        }

        sectionEl.appendChild(outerContainer);
        console.log('Rendered custom section:', section.title);
    });

    // Remove the old container if it exists and is empty
    const oldContainer = document.getElementById('dynamic-sections-container');
    if (oldContainer) oldContainer.style.display = 'none';
}

/** Build the HTML for a single block */
function buildBlockHtml(block, pathPrefix, section) {
    if (block.type === 'text') {
        return `<div class="section-text" style="color: inherit !important;">${block.content}</div>`;
    } else if (block.type === 'image') {
        // Skip image-as-bg for centered-hero (already used as background)
        if (section.template === 'centered-hero') return '';
        const url = resolveUrl(block.imageUrl || 'assets/placeholder.png', pathPrefix);
        if (url.includes('via.placeholder.com')) url = url.replace('via.placeholder.com', 'placehold.co');
        return `<div class="visual-card"><div class="visual-content"><img src="${url}" class="visual-image" style="width:100%; height:auto; display:block;" /></div></div>`;
    } else if (block.type === 'button') {
        const align = block.buttonAlign || 'left';
        const bgColor = block.buttonBgColor ? `background-color: ${block.buttonBgColor}; border-color: ${block.buttonBgColor};` : '';
        const textColor = block.buttonTextColor ? `color: ${block.buttonTextColor} !important;` : '';
        return `<div style="margin-top: 2rem; text-align: ${align};"><a href="${block.buttonLink || '#'}" class="btn-primary-large" style="${bgColor} ${textColor}">${block.buttonText || 'Learn More'}</a></div>`;
    } else if (block.type === 'stats') {
        return `<div id="blocks-stats-container-${block.id}" class="stats-grid"></div>`;
    }
    return '';
}


function renderOurClients(clientsData) {
    const clientsGrid = document.getElementById('our-clients-grid');
    if (!clientsGrid) return;
    clientsGrid.innerHTML = '';
    const visibleClients = clientsData.filter(c => !c.hidden);
    if (visibleClients.length === 0) {
        const section = document.getElementById('our-clients');
        if (section) section.style.display = 'none';
        return;
    } else {
        const section = document.getElementById('our-clients');
        if (section) section.style.display = 'block';
    }

    const isSubPage = window.location.pathname.includes('/nav-pages/');
    const pathPrefix = isSubPage ? '../' : '';

    visibleClients.forEach((client, index) => {
        const logoWrapper = document.createElement('div');
        logoWrapper.className = 'client-logo-wrapper fade-up visible';
        
        // Use a 5-item staggered delay for consistent entry animation
        logoWrapper.classList.add(`delay-${index % 5}`);
        
        const url = resolveUrl(client.logo || 'assets/placeholder.png', pathPrefix);
        logoWrapper.innerHTML = `<img src="${url}" alt="${client.name || 'Client Logo'}" />`;
        clientsGrid.appendChild(logoWrapper);
    });
}

function renderStats(statsData, containerSelector = '.stats-grid') {
    const statsGrid = document.querySelector(containerSelector);
    if (!statsGrid) return;
    statsGrid.innerHTML = '';
    const visibleStats = statsData.filter(s => !s.hidden);
    const iconPromises = visibleStats.map(async (stat, index) => {
        const div = document.createElement('div');
        div.className = 'stat-card card fade-up visible';
        const uniqueId = `stat-icon-${index}-${Math.random().toString(36).substr(2, 5)}`;
        div.innerHTML = `
            <div class="stat-icon" id="${uniqueId}"></div>
            <div class="stat-number" data-target="${stat.number}">${stat.number}</div>
            <div class="stat-label">${stat.label}</div>
        `;
        statsGrid.appendChild(div);
        const iconContainer = div.querySelector('.stat-icon');
        const iconPath = stat.icon || 'assets/icon-placeholder.svg';
        const isSvg = stat.type === 'svg' || stat.type === 'custom-svg' || iconPath.toLowerCase().endsWith('.svg');
        if (isSvg) {
            try {
                const res = await fetch(iconPath);
                const svgText = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgText, 'image/svg+xml');
                const svg = doc.querySelector('svg');
                if (svg) {
                    svg.querySelectorAll('script').forEach(el => el.remove());
                    iconContainer.appendChild(svg.cloneNode(true));
                } else {
                    iconContainer.innerHTML = `<img src="${iconPath}" alt="Icon" style="width: 100%; height: 100%;">`;
                }
            } catch (e) {
                iconContainer.innerHTML = `<img src="${iconPath}" alt="Icon" style="width: 100%; height: 100%;">`;
            }
        } else {
            iconContainer.innerHTML = `<img src="${iconPath}" alt="Icon" style="width: 100%; height: 100%;">`;
        }
    });

    Promise.all(iconPromises).then(() => {
        if (window.initStatsAnimation) window.initStatsAnimation();
    });
}

function renderSolutions(solutionsData, containerSelector = '.solutions-grid:not(#why-us-grid):not(.products-page-grid)') {
    const solutionsGrid = document.querySelector(containerSelector);
    if (!solutionsGrid) return;
    solutionsGrid.innerHTML = '';
    const solutionKeys = ['crm-tools', 'inventory-management', 'paperless-operations', 'mobile-pos', 'brand-loyalty', 'custom-solutions'];
    const usedSlugs = new Set(['crm-tools', 'inventory', 'paperless', 'mobile-pos', 'loyalty', 'custom']);
    solutionsData.filter(s => !s.hidden).forEach((item, index) => {
        const card = document.createElement('div');
        const delayClass = index > 0 && index <= 5 ? ` delay-${index}` : '';
        card.className = `solution-card fade-up visible${delayClass}`;
        if (solutionKeys[index]) {
            card.dataset.solution = solutionKeys[index];
            card.style.cursor = 'pointer';
        } else {
            const baseSlug = slugify(item.title) || `solution-${index + 1}`;
            const slug = item.id || uniqueSlug(baseSlug, usedSlugs);
            card.dataset.href = `nav-pages/solutions.html#${slug}`;
            card.style.cursor = 'pointer';
        }
        card.innerHTML = `
            <div class="solution-banner"><img src="${resolveUrl(item.image, '')}" alt="${item.title || ''}" class="solution-image" /></div>
            <div class="solution-content"><h3>${item.title || ''}</h3><p>${item.description || ''}</p></div>
        `;
        solutionsGrid.appendChild(card);
    });
    if (window.initSolutionCardsNavigation) window.initSolutionCardsNavigation();
}

document.addEventListener('DOMContentLoaded', loadContent);
// Add iframe detection for special styling in admin preview
if (window.self !== window.top) {
    document.body.classList.add('is-in-iframe');
}
