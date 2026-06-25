// Careers highlight box navigation
document.getElementById('company-careers-highlight')?.addEventListener('click', () => {
    window.location.href = 'careers.html';
});

// Timeline Management System
document.addEventListener('DOMContentLoaded', function () {
    // Load page content (Who We Are, Family Culture, Vision, Mission, Timeline) from API
    loadPageContent();

    // Timeline line scroll animation
    setupTimelineLineAnimation();

    // Fade-in animations observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            } else {
                // Allow fading out when scrolling away
                entry.target.classList.remove('visible');
            }
        });
    }, {
        threshold: 0,
        rootMargin: '0px'
    });

    document.querySelectorAll('.fade-in-left, .fade-in-right, .reveal-on-scroll').forEach(el => {
        observer.observe(el);
    });

    // Hero scroll parallax and fade animation
    const heroSection = document.querySelector('.hero-image-section');
    const heroInner = document.querySelector('.hero-inner');

    // Initialize hero-inner state for entrance animation
    if (heroInner) {
        heroInner.style.opacity = '0';
        heroInner.style.transform = 'translateY(30px)';
        heroInner.style.transition = 'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)';

        // Trigger entrance animation after a short delay
        setTimeout(() => {
            heroInner.style.opacity = '1';
            heroInner.style.transform = 'translateY(0)';

            // Remove transition after entrance to allow smooth JS-driven scroll animation
            setTimeout(() => {
                if (heroInner) heroInner.style.transition = 'none';
            }, 1200);
        }, 100);
    }

    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            window.requestAnimationFrame(() => {
                const scrolled = window.scrollY;
                const heroHeight = heroSection ? heroSection.offsetHeight : 500;

                if (scrolled <= heroHeight && heroInner) {
                    // Slightly more aggressive fade curve: starts fading immediately, transparent by 80% scroll
                    const opacity = Math.max(0, 1 - (scrolled / (heroHeight * 0.7)));
                    const yPos = scrolled * 0.45;

                    heroInner.style.opacity = opacity;
                    heroInner.style.transform = `translateY(${yPos}px)`;
                } else if (heroInner && scrolled > heroHeight && heroInner.style.opacity !== '0') {
                    // Ensure it's hidden when scrolled past
                    heroInner.style.opacity = '0';
                }
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    }, { passive: true });

    // Back to top functionality
    const backToTop = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// Function to load all page content from API
async function loadPageContent() {
    try {
        const response = await fetch(CONFIG.API_BASE + '/content');
        if (!response.ok) throw new Error('Failed to fetch content');
        const data = parseApiResponse(await response.json());

        // 1. Update "Who We Are"
        if (data.whoWeAre && data.whoWeAre.hidden) {
            const section = document.querySelector('.problem-section .content-centered');
            if (section) section.closest('.problem-section').style.display = 'none';
        } else if (data.whoWeAre) {
            const section = document.querySelector('.problem-section .content-centered');
            if (section) {
                const title = section.querySelector('.section-title');
                const content = section.querySelector('.section-text');
                if (title) title.textContent = data.whoWeAre.title || 'Who We Are';
                if (content) content.textContent = data.whoWeAre.content || '';
            }
        }

        // 2. Update "Family Culture"
        if (data.familyCulture && data.familyCulture.hidden) {
            const section = document.querySelectorAll('.solutions-section .content-split.company-content-split')[0];
            if (section) section.closest('.solutions-section').style.display = 'none';
        } else if (data.familyCulture) {
            const section = document.querySelectorAll('.solutions-section .content-split.company-content-split')[0];
            if (section) {
                updateSectionContent(section, data.familyCulture, 'Family Culture');
            }
        }

        // 3. Update "Vision"
        if (data.vision && data.vision.hidden) {
            const sections = document.querySelectorAll('.solutions-section .content-split.company-content-split');
            const section = sections[2];
            if (section) section.closest('.solutions-section').style.display = 'none';
        } else if (data.vision) {
            const sections = document.querySelectorAll('.solutions-section .content-split.company-content-split');
            // Vision is now the 3rd section (after Family and Mission)
            const section = sections[2];
            if (section) {
                updateSectionContent(section, data.vision, 'Vision');
            }
        }

        // 4. Update "Mission"
        if (data.mission && data.mission.hidden) {
            const sections = document.querySelectorAll('.solutions-section .content-split.company-content-split');
            const section = sections[1];
            if (section) section.closest('.solutions-section').style.display = 'none';
        } else if (data.mission) {
            const sections = document.querySelectorAll('.solutions-section .content-split.company-content-split');
            // Usually Mission is the second one if Family Culture is first
            // But to be safe, let's look for the one that isn't family culture or check title logic
            // The simplest is assuming index 1 as per strict HTML structure
            const section = sections[1];
            if (section) {
                updateSectionContent(section, data.mission, 'Mission');
            }
        }

        // 5. Update Timeline
        if (data.sectionVisibility && data.sectionVisibility.timelineHidden) {
            const timelineSection = document.querySelector('.timeline-section');
            if (timelineSection) timelineSection.style.display = 'none';
        } else if (data.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
            renderTimeline(data.timeline);
        } else if (!data.sectionVisibility || !data.sectionVisibility.timelineHidden) {
            loadDefaultTimeline();
        }

        // 6. Update Leaders
        if (data.leaders && data.leaders.hidden) {
            const leadersSectionContainer = document.getElementById('leaders-section-container');
            if (leadersSectionContainer) leadersSectionContainer.closest('.why-section').style.display = 'none';
        } else if (data.leaders) {
            renderLeaders(data.leaders);
        }

        // 7. Update Perks
        if (data.perks) {
            renderPerks(data.perks);
        }

        // 8. Custom Sections & Reorder
        if (data.companyPage) {
            if (data.companyPage.customSections) {
                renderCustomSections(data.companyPage.customSections);
            }
            if (data.companyPage.sectionOrder) {
                reorderSections('companyPage', data.companyPage.sectionOrder);
            }
        }

    } catch (error) {
        console.error('Error loading page content:', error);
        loadDefaultTimeline();
    }
}

// Helper to update standard split sections
function updateSectionContent(section, data, defaultTitle) {
    const title = section.querySelector('.section-title');
    const content = section.querySelector('.section-text');
    const image = section.querySelector('.split-image');

    if (title) title.textContent = data.title || defaultTitle;
    if (content) content.textContent = data.content || '';
    if (image && data.imageUrl) {
        // Ensure path starts with / if it's not a data URL and doesn't have it
        let src = data.imageUrl;
        if (!src.startsWith('data:') && !src.startsWith('/') && !src.startsWith('http')) {
            src = resolveUrl(src, '');
        }
        image.src = src;
        image.alt = data.title || defaultTitle;
    }
}

// Function to scroll to timeline section
function scrollToTimeline() {
    const timelineSection = document.querySelector('.timeline-section');
    if (timelineSection) {
        timelineSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Function to set up timeline line scroll animation
function setupTimelineLineAnimation() {
    const timeline = document.querySelector('.timeline');

    if (!timeline) return;

    let timelineTicking = false;
    window.addEventListener('scroll', () => {
        if (!timelineTicking) {
            window.requestAnimationFrame(() => {
                const timelineRect = timeline.getBoundingClientRect();
                const timelineTop = timelineRect.top;
                const timelineHeight = timelineRect.height;
                const windowHeight = window.innerHeight;

                let scrollProgress = 0;

                if (timelineTop < windowHeight && timelineTop > -timelineHeight) {
                    // Timeline is in viewport
                    const visibleTop = Math.max(0, -timelineTop);
                    const visibleBottom = Math.min(timelineHeight, windowHeight - timelineTop);
                    const visibleHeight = visibleBottom - visibleTop;
                    scrollProgress = (visibleTop + visibleHeight) / timelineHeight;
                } else if (timelineTop <= -timelineHeight) {
                    // Timeline has been fully scrolled past
                    scrollProgress = 1;
                }

                // Update the line height using CSS custom property
                document.documentElement.style.setProperty('--timeline-line-height', `${scrollProgress * 100}%`);

                // Animate timeline containers based on scroll progress
                animateTimelineContainers(scrollProgress);
                timelineTicking = false;
            });
            timelineTicking = true;
        }
    }, { passive: true });
}

// Function to animate timeline containers based on scroll progress
function animateTimelineContainers(scrollProgress) {
    const containers = document.querySelectorAll('.timeline-container');

    containers.forEach((container, index) => {
        const itemProgress = (scrollProgress * containers.length) - index;

        if (itemProgress > 0) {
            // Item is visible or becoming visible
            const opacity = Math.min(1, itemProgress);
            const translateY = Math.max(0, (1 - itemProgress) * 30);

            container.style.opacity = opacity;
            container.style.transform = `translateY(${translateY}px)`;
        } else {
            // Item is not yet visible
            container.style.opacity = 0;
            container.style.transform = 'translateY(30px)';
        }
    });
}

// Function to load default timeline data
function loadDefaultTimeline() {
    const defaultTimelineData = [
        {
            id: 1,
            title: "Pioneering Mobile Technology",
            year: "1999",
            description: "10 years before online stores and e-commerce sites gained popularity in the Philippines, there was already E-Store Exchange, the first ever electronic store in the country that allowed users to sell, buy and pay for products online through their phone.",
            position: "left"
        },
        {
            id: 2,
            title: "Official Establishment of eScience",
            year: "Year 0 - 2000",
            description: "After pioneer E-Store Exchange in the country, Mr. Dagelet together with his wife co-founded eScience, an IT company that develops high-impact mobile applications and IT solutions that help companies automate their operations.",
            position: "right"
        },
        {
            id: 3,
            title: "Awarded by the Australian Government",
            year: "Year 4 - 2004",
            description: "eScience won the \"Secrets of Australian IT Innovation\" in 2004 for developing the first ever mobile karaoke application.",
            position: "left"
        },
        {
            id: 4,
            title: "Vendor of the Year Awardee",
            year: "Year 7 - 2007",
            description: "eScience received Nokia's Best Partner: Vendor of the Year Award in 2007 for providing innovative services in the IT industry.",
            position: "right"
        },
        {
            id: 5,
            title: "From Consulting to SAAS",
            year: "Year 10 - 2010",
            description: "eScience shifted to a Software As A Service (SAAS) business model, developing mobile solutions that are in a subscription basis accessible across different industries and countries.",
            position: "left"
        }
    ];

    renderTimeline(defaultTimelineData);
}

// Function to render timeline items
function renderTimeline(timelineData) {
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = '';

    timelineData.forEach((item, index) => {
        const positionClass = item.position === 'left' ? 'left-container' : 'right-container';
        const arrowClass = item.position === 'left' ? 'left-container-arrow' : 'right-container-arrow';

        const timelineItem = document.createElement('div');
        timelineItem.className = `timeline-container ${positionClass}`;

        // Set initial hidden state - animations will be handled by scroll
        timelineItem.style.opacity = '0';
        timelineItem.style.transform = 'translateY(30px)';
        timelineItem.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

        timelineItem.innerHTML = `
            <img src="../assets/shapes-assets/timeline-circle.png" alt="Timeline marker">
            <div class="text-box">
                <h2>${item.title}</h2>
                <small>${item.year}</small>
                <p>${item.description}</p>
                <span class="${arrowClass}"></span>
            </div>
        `;

        timelineContainer.appendChild(timelineItem);
    });
}

// Function to add new timeline item (for admin use)
function addTimelineItem(item) {
    const timelineContainer = document.getElementById('timeline-container');
    const existingItems = timelineContainer.querySelectorAll('.timeline-container');
    const newIndex = existingItems.length;

    const positionClass = newIndex % 2 === 0 ? 'left-container' : 'right-container';
    const arrowClass = newIndex % 2 === 0 ? 'left-container-arrow' : 'right-container-arrow';

    const timelineItem = document.createElement('div');
    timelineItem.className = `timeline-container ${positionClass}`;
    timelineItem.style.animationDelay = `${newIndex * 1.5}s`;

    timelineItem.innerHTML = `
        <img src="../assets/shapes-assets/timeline-circle.png" alt="Timeline marker">
        <div class="text-box">
            <h2>${item.title}</h2>
            <small>${item.year}</small>
            <p>${item.description}</p>
            <span class="${arrowClass}"></span>
        </div>
    `;

    timelineContainer.appendChild(timelineItem);
}

// Function to render Leaders
function renderLeaders(leadersData) {
    const titleEl = document.getElementById('leaders-title');
    const descEl = document.getElementById('leaders-description');
    const gridEl = document.getElementById('leaders-grid');

    if (titleEl) titleEl.textContent = leadersData.title || 'Our Leaders';
    if (descEl) descEl.textContent = leadersData.description || '';

    if (gridEl && leadersData.list) {
        gridEl.innerHTML = '';
        leadersData.list.forEach(leader => {
            const card = document.createElement('div');
            card.className = 'leader-card';

            let imgSrc = leader.image || '../assets/placeholder-profile.png';
            if (imgSrc && !imgSrc.startsWith('data:') && !imgSrc.startsWith('/') && !imgSrc.startsWith('http')) {
                imgSrc = resolveUrl(imgSrc, '');
            }

            card.innerHTML = `
                <div class="leader-image-container">
                    <img src="${imgSrc}" alt="${leader.name}" class="leader-image">
                </div>
                <div class="leader-info">
                    <h3>${leader.name}</h3>
                    <p class="leader-role">${leader.role}</p>
                </div>
            `;
            gridEl.appendChild(card);
        });
    }
}

function renderPerks(perksData) {
    const section = document.getElementById('perks-section-container');
    if (section && perksData.hidden) {
        section.style.display = 'none';
        return;
    }

    const grid = document.getElementById('perks-grid');
    const title = document.getElementById('perks-title');
    const desc = document.getElementById('perks-description');

    if (title && perksData.title) title.textContent = perksData.title;
    if (desc && perksData.description) desc.textContent = perksData.description;

    if (!grid || !perksData.list) return;

    grid.innerHTML = '';

    perksData.list.filter(p => !p.hidden).forEach(perk => {
        const card = document.createElement('div');
        card.className = 'perk-card';

        const imgSrc = perk.image ? (perk.image.startsWith('/') ? perk.image : resolveUrl(perk.image, '')) : '/assets/icon-placeholder.svg';

        card.innerHTML = `
            <div class="perk-banner">
                <img src="${imgSrc}" alt="${perk.title}" class="perk-image">
            </div>
            <div class="perk-content">
                <h3>${perk.title}</h3>
                <p>${perk.description}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}
