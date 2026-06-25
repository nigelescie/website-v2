// Load all careers content
async function loadCareersContent() {
    try {
        const response = await fetch(CONFIG.API_BASE + '/content', {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to fetch content');
        const data = parseApiResponse(await response.json());

        await new Promise(resolve => setTimeout(resolve, 50));

        if (!data.careersPage) return;
        const cp = data.careersPage;

        // JobStreet Button Visibility
        if (cp.hideJobStreet) {
            document.body.classList.add('hide-jobstreet');
        }

        // 1. Hero
        if (cp.hero) {
            const heroTitle = document.getElementById('hero-title-container');
            const heroSub = document.getElementById('hero-subtitle');
            if (heroTitle && cp.hero.title) {
                const words = cp.hero.title.split(' ');
                if (words.length >= 2) {
                    heroTitle.innerHTML = `<span class="hero-headline-left">${words.slice(0, Math.ceil(words.length / 2)).join(' ')}</span>
                                           <span class="hero-headline-right">${words.slice(Math.ceil(words.length / 2)).join(' ')}</span>`;
                } else {
                    heroTitle.textContent = cp.hero.title;
                }
            }
            if (heroSub && cp.hero.subtitle) heroSub.textContent = cp.hero.subtitle;
        }

        // 2. Intro Section
        if (cp.intro) {
            const introTitle = document.getElementById('intro-title');
            const introDesc = document.getElementById('intro-description');
            const sliderContainer = document.getElementById('sliderContainer');

            if (introTitle && cp.intro.title) introTitle.textContent = cp.intro.title;
            if (introDesc && cp.intro.description) introDesc.textContent = cp.intro.description;

            if (sliderContainer && cp.intro.slides && cp.intro.slides.length > 0) {
                sliderContainer.innerHTML = cp.intro.slides.filter(s => !s.hidden).map(slide => {
                    let imgPath = resolveUrl(slide.image, '');
                    return `
                        <div class="hero-slide-item" style="background-image: url('${imgPath}');" role="img"></div>
                    `;
                }).join('');
                // Re-init slider
                if (window.initHeroSlider) window.initHeroSlider();
            }
        }

        // 3. Why Join Us
        if (cp.whyJoin && cp.whyJoin.hidden) {
            const section = document.getElementById('why-join-section');
            if (section) section.style.display = 'none';
        } else if (cp.whyJoin && cp.whyJoin.cards) {
            const whyTitle = document.getElementById('why-join-title');
            const whySub = document.getElementById('why-join-subtitle');
            const grid = document.getElementById('why-join-grid');

            if (whyTitle && cp.whyJoin.title) whyTitle.textContent = cp.whyJoin.title;
            if (whySub && cp.whyJoin.subtitle) whySub.textContent = cp.whyJoin.subtitle;

            if (grid) {
                // Store cards data globally for gallery access
                const visibleCards = cp.whyJoin.cards.filter(card => !card.hidden);
                window.whyJoinCards = visibleCards;

                grid.innerHTML = visibleCards.map((card, index) => {
                    const hasGallery = card.galleryImages && card.galleryImages.length > 0;
                    return `
                    <div class="gallery-card" data-gallery-type="why-join" data-gallery-index="${index}" style="${hasGallery ? 'cursor: pointer;' : 'cursor: default;'}">
                        <div style="height: 250px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative;">
                            ${card.image ? `<img src="${resolveUrl(card.image, '')}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;">` : `<span style="font-size: 3rem;">${card.icon || '🚀'}</span>`}
                            ${hasGallery ? '<div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">View Gallery ↗</div>' : ''}
                        </div>
                        <div class="gallery-info">
                            <h3>${card.title}</h3>
                            <p>${card.description}</p>
                        </div>
                    </div>
                `}).join('');

                grid.querySelectorAll('.gallery-card[data-gallery-type="why-join"]').forEach(el => {
                    el.addEventListener('click', () => openWhyJoinGallery(Number(el.dataset.galleryIndex)));
                });
            }
        }

        // 4. Perks
        if (data.perks) {
            renderPerks(data.perks);
        }

        // 5. Team Culture (Video)
        if (cp.teamCulture && cp.teamCulture.hidden) {
            const section = document.getElementById('team-culture-section');
            if (section) section.style.display = 'none';
        } else if (cp.teamCulture) {
            const teamTitle = document.getElementById('team-culture-title');
            const teamDesc = document.getElementById('team-culture-description');
            const video = document.getElementById('culture-video');

            if (teamTitle && cp.teamCulture.title) teamTitle.textContent = cp.teamCulture.title;
            if (teamDesc && cp.teamCulture.description) teamDesc.textContent = cp.teamCulture.description;
            if (video && cp.teamCulture.videoUrl) {
                video.src = resolveUrl(cp.teamCulture.videoUrl, '');
            }
        }

        // 6. Office Culture (Gallery)
        if (cp.officeCulture && cp.officeCulture.hidden) {
            const section = document.getElementById('office-culture-section');
            if (section) section.style.display = 'none';
        } else if (cp.officeCulture && cp.officeCulture.cards) {
            const offTitle = document.getElementById('office-culture-title');
            const offSub = document.getElementById('office-culture-subtitle');
            const grid = document.getElementById('office-culture-grid');

            if (offTitle && cp.officeCulture.title) offTitle.textContent = cp.officeCulture.title;
            if (offSub && cp.officeCulture.subtitle) offSub.textContent = cp.officeCulture.subtitle;

            if (grid) {
                // Store cards data globally for gallery access
                const visibleCards = cp.officeCulture.cards.filter(card => !card.hidden);
                window.officeCultureCards = visibleCards;

                grid.innerHTML = visibleCards.map((card, index) => {
                    const hasGallery = card.galleryImages && card.galleryImages.length > 0;
                    return `
                    <div class="gallery-card" data-gallery-type="office-culture" data-gallery-index="${index}" style="${hasGallery ? 'cursor: pointer;' : 'cursor: default;'}">
                        <div style="height: 250px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid rgba(255,255,255,0.05); position: relative;">
                            ${card.image ? `<img src="${resolveUrl(card.image, '')}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 3rem;">${card.icon}</span>`}
                            ${hasGallery ? '<div style="position: absolute; bottom: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">View Gallery ↗</div>' : ''}
                        </div>
                        <div class="gallery-info">
                            <h3>${card.title}</h3>
                            <p>${card.description}</p>
                        </div>
                    </div>
                `}).join('');

                grid.querySelectorAll('.gallery-card[data-gallery-type="office-culture"]').forEach(el => {
                    el.addEventListener('click', () => openOfficeCultureGallery(Number(el.dataset.galleryIndex)));
                });
            }
        }

        // 7. Opportunities
        if (cp.opportunities) {
            const jobGrid = document.getElementById('jobSliderContainer');
            const internGrid = document.getElementById('internshipSliderContainer');

            if (jobGrid && cp.opportunities.jobs) {
                jobGrid.innerHTML = cp.opportunities.jobs.map(job => `
                    <div class="hero-slide-item">
                        <img src="${resolveUrl(job.image, '')}" alt="${job.title}" class="job-slide-image">
                        <div class="job-slide-content">
                            <h3>${job.title}</h3>
                            <p>${job.description}</p>
                        </div>
                    </div>
                `).join('');
            }

            if (internGrid && cp.opportunities.internships) {
                internGrid.innerHTML = cp.opportunities.internships.map(intern => `
                    <div class="hero-slide-item">
                        <img src="${resolveUrl(intern.image, '')}" alt="${intern.title}" class="job-slide-image">
                        <div class="job-slide-content">
                            <h3>${intern.title}</h3>
                            <p>${intern.description}</p>
                        </div>
                    </div>
                `).join('');
            }

            // Re-init slider logic for jobs/internships if needed
            if (window.initAppleSlider) window.initAppleSlider();
        }

        // 8. Apply Section
        if (cp.apply && cp.apply.hidden) {
            const section = document.getElementById('apply');
            if (section) section.style.display = 'none';
        } else if (cp.apply) {
            const applyTitle = document.getElementById('apply-title');
            const applySub = document.getElementById('apply-subtitle');
            const applyEmail = document.getElementById('apply-email');
            const applyPhone = document.getElementById('apply-phone');
            const applyBtn = document.getElementById('apply-button');

            if (applyTitle && cp.apply.title) applyTitle.textContent = cp.apply.title;
            if (applySub && cp.apply.description) applySub.textContent = cp.apply.description;
            if (applyEmail && cp.apply.email) {
                applyEmail.textContent = cp.apply.email;
                applyEmail.href = `mailto:${cp.apply.email}`;
            }
            if (applyPhone && cp.apply.phone) {
                applyPhone.textContent = cp.apply.phone;
                applyPhone.href = `tel:${cp.apply.phone}`;
            }
            if (applyBtn) {
                if (cp.apply.buttonText) applyBtn.textContent = cp.apply.buttonText;
                if (cp.apply.email) applyBtn.href = `mailto:${cp.apply.email}?subject=Job Application`;
            }
        }

        // 9. Custom Sections
        if (cp.customSections) {
            renderCustomSections(cp.customSections);
        }

        // 10. Section Reordering
        if (cp.sectionOrder) {
            reorderSections('careersPage', cp.sectionOrder);
        }

    } catch (error) {
        console.error('Error loading careers content:', error);
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

        const imgSrc = perk.image ? resolveUrl(perk.image, '') : '/assets/icon-placeholder.svg';

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

// Fade-in animations observer
const careersRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        } else {
            entry.target.classList.remove('visible');
        }
    });
}, {
    threshold: 0,
    rootMargin: '0px'
});

document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    careersRevealObserver.observe(el);
});

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

// Load content on page load
document.addEventListener('DOMContentLoaded', function () {
    loadCareersContent();
});

// Opportunity Toggle Logic
document.addEventListener('DOMContentLoaded', function () {
    const btnJobs = document.getElementById('btn-jobs');
    const btnInternships = document.getElementById('btn-internships');
    const sectionJobs = document.getElementById('jobs-section');
    const sectionInternships = document.getElementById('internships-section');

    if (btnJobs && btnInternships && sectionJobs && sectionInternships) {
        btnJobs.addEventListener('click', () => {
            btnJobs.classList.add('active');
            btnInternships.classList.remove('active');

            sectionJobs.classList.remove('hidden');
            sectionJobs.classList.add('visible');

            sectionInternships.classList.remove('visible');
            sectionInternships.classList.add('hidden');
        });

        btnInternships.addEventListener('click', () => {
            btnInternships.classList.add('active');
            btnJobs.classList.remove('active');

            sectionInternships.classList.remove('hidden');
            sectionInternships.classList.add('visible');

            sectionJobs.classList.remove('visible');
            sectionJobs.classList.add('hidden');
        });
    }
});

// Gallery Logic
let currentGalleryImages = [];
let currentGalleryIndex = 0;
const modal = document.getElementById('gallery-modal');
const modalImg = document.getElementById('modal-image');
const modalVideo = document.getElementById('modal-video');
const modalCaption = document.getElementById('modal-caption');

modal.addEventListener('click', (event) => {
    if (event.target === modal) closeGallery();
});
document.getElementById('modal-close-btn').addEventListener('click', closeGallery);
document.getElementById('modal-prev-btn').addEventListener('click', () => changeGalleryImage(-1));
document.getElementById('modal-next-btn').addEventListener('click', () => changeGalleryImage(1));

function openWhyJoinGallery(index) {
    if (!window.whyJoinCards || !window.whyJoinCards[index]) return;

    const card = window.whyJoinCards[index];
    if (!card.galleryImages || card.galleryImages.length === 0) return;

    currentGalleryImages = card.galleryImages;
    currentGalleryIndex = 0;

    updateGalleryImage();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function openOfficeCultureGallery(index) {
    if (!window.officeCultureCards || !window.officeCultureCards[index]) return;

    const card = window.officeCultureCards[index];
    if (!card.galleryImages || card.galleryImages.length === 0) return;

    currentGalleryImages = card.galleryImages;
    currentGalleryIndex = 0;

    updateGalleryImage();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function closeGallery() {
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling

    // Pause video if playing
    if (modalVideo) {
        modalVideo.pause();
        modalVideo.currentTime = 0;
    }
}

function changeGalleryImage(direction) {
    currentGalleryIndex += direction;

    // Wrap around
    if (currentGalleryIndex >= currentGalleryImages.length) {
        currentGalleryIndex = 0;
    } else if (currentGalleryIndex < 0) {
        currentGalleryIndex = currentGalleryImages.length - 1;
    }

    updateGalleryImage();
}

function updateGalleryImage() {
    const mediaPath = currentGalleryImages[currentGalleryIndex];
    const fullPath = resolveUrl(mediaPath, '');
    const isVideo = fullPath.match(/\.(mp4|webm|ogg)$/i);

    modalImg.style.opacity = '0'; // Fade out image
    if (modalVideo) modalVideo.style.opacity = '0'; // Fade out video

    setTimeout(() => {
        modalCaption.textContent = `${currentGalleryIndex + 1} / ${currentGalleryImages.length}`;

        if (isVideo) {
            modalImg.style.display = 'none';
            if (modalVideo) {
                modalVideo.style.display = 'block';
                modalVideo.src = fullPath;
                modalVideo.load();
                modalVideo.onloadstart = () => {
                    modalVideo.style.opacity = '1';
                };
                modalVideo.play().catch(e => console.log("Auto-play prevented", e));
            }
        } else {
            if (modalVideo) {
                modalVideo.style.display = 'none';
                modalVideo.pause();
            }
            modalImg.style.display = 'block';
            modalImg.src = fullPath;
            modalImg.onload = () => {
                modalImg.style.opacity = '1'; // Fade in
            };
        }
    }, 200);
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;

    if (e.key === 'Escape') closeGallery();
    if (e.key === 'ArrowLeft') changeGalleryImage(-1);
    if (e.key === 'ArrowRight') changeGalleryImage(1);
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
});
