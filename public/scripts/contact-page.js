(async function loadContactContent() {
    try {
        const res = await fetch(CONFIG.API_BASE + '/content');
        const data = parseApiResponse(await res.json());
        const contactData = data.contactPage || {};

        // Update departments
        if (contactData.departments) {
            const visibleDepartments = contactData.departments.filter(dept => !dept.isHidden);

            if (visibleDepartments.length === 0) {
                const contactDeptGroup = document.querySelector('#contact-department-custom')?.closest('.form-group');
                if (contactDeptGroup) contactDeptGroup.style.display = 'none';

                const deptContents = document.querySelectorAll('.department-content');
                deptContents.forEach(el => el.style.display = 'none');

                const deptGroup = document.querySelector('#department-custom')?.closest('.form-group');
                if (deptGroup) deptGroup.style.display = 'none';
            } else {
                updateDepartmentDropdowns(visibleDepartments);
                updateDepartmentContent(visibleDepartments);

                // Ensure dropdowns are visible if previously hidden
                const contactDeptGroup = document.querySelector('#contact-department-custom')?.closest('.form-group');
                if (contactDeptGroup) contactDeptGroup.style.display = 'block';

                const deptGroup = document.querySelector('#department-custom')?.closest('.form-group');
                if (deptGroup) deptGroup.style.display = 'block';
            }
        }

        // Update business hours
        if (contactData.businessHours) {
            updateBusinessHours(contactData.businessHours);
        }

        // Update office location
        if (contactData.officeLocation) {
            updateOfficeLocation(contactData.officeLocation);
        }
    } catch (err) {
        console.error('Error loading contact content:', err);
        // Show disabled fallback in both dropdowns on error
        const deptMenu = document.getElementById('deptMenu');
        if (deptMenu) deptMenu.innerHTML = '<li class="dept-menu-item no-sub" style="pointer-events:none;opacity:0.5;"><div class="dept-item-left"><span>No departments available</span></div></li>';
        const contactDeptMenu = document.getElementById('contactDeptMenu');
        if (contactDeptMenu) contactDeptMenu.innerHTML = '<li style="pointer-events:none;opacity:0.5;">No departments available</li>';
    }
})();

// Store dept email map for form submission
window.deptEmailMap = {
    sales: 'sales@electronicscience.net',
    support: 'support@electronicscience.net',
    hr: 'hrd@electronicscience.net'
};

function updateDepartmentDropdowns(departments) {
    // Build email map from API data — prefer explicit formEmail, then first contact email
    departments.forEach(dept => {
        if (dept.formEmail) {
            window.deptEmailMap[dept.id] = dept.formEmail;
        } else {
            const emailContact = (dept.contacts || []).find(c => c.type === 'email');
            if (emailContact) {
                const email = Array.isArray(emailContact.values)
                    ? emailContact.values[0]
                    : emailContact.value;
                if (email) window.deptEmailMap[dept.id] = email;
            }
        }
    });

    // Populate native <select> elements
    const formSelect = document.getElementById('department');
    if (formSelect) {
        formSelect.innerHTML = '<option value="" disabled selected>Select a department</option>' +
            departments.map(dept => `<option value="${dept.id}">${dept.dropdownLabel || dept.name}</option>`).join('');
        formSelect.addEventListener('change', function() {
            const dept = departments.find(d => d.id === this.value);
            if (dept) updateFieldIcon(this, dept);
        });
    }
    const contactSelect = document.getElementById('contact-department');
    if (contactSelect) {
        contactSelect.innerHTML = '<option value="" disabled selected>Select a department</option>' +
            departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');
        contactSelect.value = departments[0].id;
        updateFieldIcon(contactSelect, departments[0]);
        contactSelect.onchange = function() {
            const dept = departments.find(d => d.id === this.value);
            if (dept) updateFieldIcon(this, dept);
            if (window.showDepartment) window.showDepartment(this.value);
        };
    }

    function updateFieldIcon(selectEl, dept) {
        const wrapper = selectEl.closest('.field-wrapper');
        if (!wrapper) return;
        const oldIcon = wrapper.querySelector('.field-icon');
        if (!oldIcon) return;
        if (dept.icon) {
            const img = document.createElement('img');
            img.src = resolveUrl(dept.icon, '');
            img.alt = '';
            img.className = 'field-icon dept-icon-img';
            img.style.cssText = 'width:18px;height:18px;object-fit:contain;';
            oldIcon.replaceWith(img);
        } else {
            // Use default SVG based on dept id
            const svgHtml = getDeptIcon(dept.id);
            const temp = document.createElement('div');
            temp.innerHTML = svgHtml;
            const svgEl = temp.firstElementChild;
            svgEl.classList.add('field-icon');
            svgEl.setAttribute('width', '18');
            svgEl.setAttribute('height', '18');
            oldIcon.replaceWith(svgEl);
        }
    }

    // Default hardcoded icons based on ID (fallback) with TEAL color
    const iconStyle = 'width: 20px; height: 20px; object-fit: contain; color: var(--primary-color); flex-shrink: 0;';
    // Generic department icon used as fallback for unknown IDs
    const genericSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${iconStyle}"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
    const svgs = {
        sales: genericSvg,
        support: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${iconStyle}"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
        hr: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${iconStyle}"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
    };

    const getIcon = (dept) => {
        if (dept.icon) {
            // Use class so CSS filter tints it to primary cyan
            return `<img src="${resolveUrl(dept.icon, '')}" alt="" class="dept-icon-img" style="${iconStyle}">`;
        }
        // Fall back to known SVG or the generic department SVG
        return svgs[dept.id] || genericSvg;
    };

    // ── Rebuild #deptMenu with nested sub-items ──────────────────
    const formDropdown = document.getElementById('deptMenu');
    if (formDropdown) {
        formDropdown.innerHTML = '';

        departments.forEach(dept => {
            const label = dept.dropdownLabel || dept.name;
            const deptEmail = window.deptEmailMap[dept.id] || '';

            // Collect email-type contacts for sub-menu
            const emailContacts = (dept.contacts || []).filter(c => c.type === 'email');

            // Build sub-items:
            // If there is a specific formEmail OR only one email contact, we can still
            // show subItems for all email contacts. If none, just the dept itself.
            let subItems = [];
            emailContacts.forEach(c => {
                const vals = Array.isArray(c.values) ? c.values : (c.value ? [c.value] : []);
                vals.forEach(v => {
                    subItems.push({ label: c.label || v, email: v });
                });
            });
            // If formEmail is set and not already in the list, add it as "General"
            if (dept.formEmail && !subItems.some(s => s.email === dept.formEmail)) {
                subItems.unshift({ label: 'General', email: dept.formEmail });
            }

            const hasSubItems = subItems.length > 1;

            // --- Parent row ---
            const parentLi = document.createElement('li');
            parentLi.className = 'dept-menu-item' + (hasSubItems ? '' : ' no-sub');
            parentLi.dataset.deptId = dept.id;
            parentLi.dataset.email = deptEmail;
            parentLi.innerHTML = `
                <div class="dept-item-left">
                    ${getIcon(dept)}
                    <span>${label}</span>
                </div>
                <span class="submenu-arrow">&#9657;</span>
            `;

            // --- Sub-menu ---
            const subUl = document.createElement('ul');
            subUl.className = 'dept-submenu';

            if (hasSubItems) {
                subItems.forEach(sub => {
                    const subLi = document.createElement('li');
                    subLi.dataset.deptId = dept.id;
                    subLi.dataset.email = sub.email;
                    subLi.innerHTML = `<span class="sub-dot"></span><span>${sub.label}</span>`;
                    subLi.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectFormDepartment(dept, sub.label, sub.email);
                    });
                    subUl.appendChild(subLi);
                });

                // Toggle submenu open/close on parent click
                parentLi.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isOpen = parentLi.classList.toggle('submenu-open');
                    // Close sibling submenus
                    formDropdown.querySelectorAll('.dept-menu-item.submenu-open').forEach(el => {
                        if (el !== parentLi) el.classList.remove('submenu-open');
                    });
                });
            } else {
                // No sub-items — clicking the parent selects the dept directly
                parentLi.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectFormDepartment(dept, label, deptEmail);
                });
            }

            formDropdown.appendChild(parentLi);
            formDropdown.appendChild(subUl);
        });
    }

    // Helper to Create List Items (Icon + Text wrapper)
    const createListItem = (dept, label) => {
        // We use flex gap for spacing
        return `<li data-value="${dept.id}" style="display: flex; align-items: center; gap: 12px;">
                    ${getIcon(dept)}
                    <span>${label}</span>
                </li>`;
    };

    // Helper to update toggle button content
    const updateToggleContent = (dropdownId, dept) => {
        const dropdown = document.getElementById(dropdownId)?.closest('.custom-dropdown');
        if (!dropdown) return;

        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        const chev = dropdown.querySelector('.chev'); // Preserve existing chevron

        // Create wrapper for content
        const contentWrapper = document.createElement('div');
        contentWrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        contentWrapper.innerHTML = `${getIcon(dept)}<span>${dropdownId === 'deptMenu' ? (dept.dropdownLabel || dept.name) : dept.name}</span>`;

        toggleBtn.innerHTML = '';
        toggleBtn.appendChild(contentWrapper);
        if (chev) toggleBtn.appendChild(chev);

        // Adjust padding for Get in Touch toggle specifically
        if (dropdownId === 'contactDeptMenu') { // Using menu ID to identify the specific dropdown logic context
            toggleBtn.style.paddingLeft = '1.25rem';
        }
    };

    // Update contact info dropdown ("Get in Touch")
    const contactDropdown = document.getElementById('contactDeptMenu');
    if (contactDropdown && departments.length > 0) {
        contactDropdown.innerHTML = departments.map(dept =>
            createListItem(dept, dept.name)
        ).join('');

        // Initialize the Get In Touch button with the first department (default)
        updateToggleContent('contactDeptMenu', departments[0]);
    }

    // Re-initialize click handlers for Get in Touch dropdown only
    // (#deptMenu nested items already have their own listeners from above)
    document.querySelectorAll('#contactDeptMenu li').forEach(item => {
        item.addEventListener('click', function () {
            const dropdown = this.closest('.custom-dropdown');
            const toggleBtn = dropdown.querySelector('.dropdown-toggle');

            const chev = dropdown.querySelector('.chev');
            const hidden = dropdown.querySelector('input[type="hidden"]');

            // Create wrapper for selected content to keep them together on the left
            const selectedContentWrapper = document.createElement('div');
            selectedContentWrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';
            selectedContentWrapper.innerHTML = this.innerHTML; // Copies Icon + Span(Text)

            toggleBtn.innerHTML = '';
            toggleBtn.appendChild(selectedContentWrapper);

            if (chev) toggleBtn.appendChild(chev);

            if (hidden) hidden.value = this.dataset.value;

            dropdown.classList.remove('open');
            dropdown.querySelector('.dropdown-menu').setAttribute('hidden', '');
            dropdown.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');

            // Trigger department content switch if applicable
            if (dropdown.id === 'contact-department-custom') {
                showDepartment(this.dataset.value);
            }
        });
    });
}

// Helper: update the Send us a Message toggle button to show selected dept + sub-label
function selectFormDepartment(dept, subLabel, email) {
    const dropdown = document.getElementById('department-custom');
    if (!dropdown) return;

    const toggleBtn = dropdown.querySelector('.dropdown-toggle');
    const chev = dropdown.querySelector('.chev');
    const hiddenInput = document.getElementById('department');
    const staticIcon = dropdown.querySelector('.field-icon');

    // The icon to show in the button
    const iconStyle = 'width: 20px; height: 20px; object-fit: contain; color: var(--primary-color); flex-shrink: 0;';
    const iconHtml = dept.icon
        ? `<img src="${resolveUrl(dept.icon, '')}" alt="" class="dept-icon-img" style="${iconStyle}">`
        : '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 12px;';
    wrapper.innerHTML = `${iconHtml}<span>${dept.dropdownLabel || dept.name}${subLabel && subLabel !== (dept.dropdownLabel || dept.name) ? ' – ' + subLabel : ''}</span>`;

    toggleBtn.innerHTML = '';
    toggleBtn.appendChild(wrapper);
    if (chev) toggleBtn.appendChild(chev);

    // Store dept ID and target email: "deptId::email"
    if (hiddenInput) hiddenInput.value = `${dept.id}::${email}`;

    // Hide the static field icon
    if (staticIcon) {
        staticIcon.style.display = 'none';
        toggleBtn.style.paddingLeft = '1.25rem';
    }

    // Close dropdown
    dropdown.classList.remove('open');
    const deptMenu = document.getElementById('deptMenu');
    if (deptMenu) deptMenu.setAttribute('hidden', '');
    toggleBtn.setAttribute('aria-expanded', 'false');
}

function updateDepartmentContent(departments) {
    const container = document.querySelector('.contact-info');
    if (!container) return;

    // Find existing department contents
    const existingContent = container.querySelectorAll('.department-content');
    existingContent.forEach(el => el.remove());

    // Add department content for each department
    const insertTarget = container.querySelector('.business-hours-box');

    departments.forEach((dept, index) => {
        const deptDiv = document.createElement('div');
        deptDiv.className = 'department-content' + (index === 0 ? ' active' : '');
        deptDiv.id = dept.id + '-content';

        let contactsHtml = '';
        (dept.contacts || []).forEach(contact => {
            const icon = getContactIcon(contact.type);

            if (Array.isArray(contact.values)) {
                // Multiple values
                let valuesHtml = '';
                contact.values.forEach((val, idx) => {
                    const link = contact.links && contact.links[idx] ? contact.links[idx] : null;
                    if (contact.type === 'email') {
                        valuesHtml += `<a href="mailto:${val}">${val}</a>`;
                    } else if (contact.type === 'phone') {
                        const cleanPhone = val.replace(/[^0-9+]/g, '');
                        valuesHtml += `<a href="tel:${cleanPhone}">${icon}${val}</a>`;
                    } else if (contact.type === 'social' && link) {
                        valuesHtml += `<a href="${link}" target="_blank">${val}</a>`;
                    } else {
                        valuesHtml += `<span>${val}</span>`;
                    }
                });

                contactsHtml += `
                    <div class="contact-method">
                        <div class="method-icon">${icon}</div>
                        <div class="method-content">
                            <div class="method-label">${contact.label}</div>
                            <div class="method-value">${valuesHtml}</div>
                        </div>
                    </div>
                `;
            } else {
                // Single value
                let valueHtml = '';
                if (contact.type === 'email') {
                    valueHtml = `<a href="mailto:${contact.value}">${contact.value}</a>`;
                } else if (contact.type === 'phone') {
                    const cleanPhone = contact.value.replace(/[^0-9+]/g, '');
                    valueHtml = `<a href="tel:${cleanPhone}">${contact.value}</a>`;
                } else {
                    valueHtml = contact.value;
                }

                contactsHtml += `
                    <div class="contact-method">
                        <div class="method-icon">${icon}</div>
                        <div class="method-content">
                            <div class="method-label">${contact.label}</div>
                            <div class="method-value">${valueHtml}</div>
                        </div>
                    </div>
                `;
            }
        });

        // Use the uploaded icon if present (tinted via CSS filter), else fall back to SVG
        const titleIcon = dept.icon
            ? `<img src="${resolveUrl(dept.icon, '')}" alt="" class="dept-icon-img" style="width:24px;height:24px;object-fit:contain;vertical-align:middle;margin-right:8px;">`
            : getDeptIcon(dept.id);

        deptDiv.innerHTML = `
            <div class="dept-details">
                <h4>${titleIcon}${dept.name}</h4>
                <p>${dept.description || ''}</p>
                ${contactsHtml}
            </div>
        `;

        if (insertTarget) {
            insertTarget.parentNode.insertBefore(deptDiv, insertTarget);
        } else {
            container.appendChild(deptDiv);
        }
    });

    // Update the toggle to show first department
    const toggle = document.getElementById('contactDeptToggle');
    if (toggle && departments.length > 0) {
        toggle.querySelector('span').textContent = departments[0].name;
        document.getElementById('contact-department').value = departments[0].id;
    }
}

function getContactIcon(type) {
    if (type === 'email') {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
    } else if (type === 'phone') {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    } else if (type === 'social') {
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`;
    }
    return '';
}

function getDeptIcon(deptId) {
    // Generic department/building icon used as fallback for new unknown IDs
    const genericIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
    const icons = {
        sales: genericIcon,
        support: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg>`,
        hr: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`
    };
    return icons[deptId] || genericIcon;
}

function updateBusinessHours(hours) {
    const hoursBox = document.querySelector('.business-hours-box');
    if (!hoursBox) return;

    const weekdayP = hoursBox.querySelectorAll('p')[0];
    const weekendP = hoursBox.querySelectorAll('p')[1];
    const timezoneP = hoursBox.querySelectorAll('p')[2];

    if (weekdayP && hours.weekdays) {
        weekdayP.innerHTML = `<strong>Monday - Friday:</strong> ${hours.weekdays}`;
    }
    if (weekendP && hours.weekends) {
        weekendP.innerHTML = `<strong>Saturday & Sunday:</strong> ${hours.weekends}`;
    }
    if (timezoneP && hours.timezone) {
        timezoneP.textContent = hours.timezone;
    }
}

function updateOfficeLocation(office) {
    // Update address
    const addressEl = document.querySelector('.office-details-list .detail-item:first-child .detail-text p');
    if (addressEl && office.address) {
        addressEl.innerHTML = office.address.replace(/\n/g, '<br>');
    }

    // Update direct line
    const phoneEl = document.querySelector('.office-details-list .detail-item:nth-child(2) .detail-text p');
    if (phoneEl && office.directLine) {
        phoneEl.textContent = office.directLine;
    }

    // Update email
    const emailEl = document.querySelector('.office-details-list .detail-item:nth-child(3) .detail-text p');
    if (emailEl && office.email) {
        emailEl.textContent = office.email;
    }

    // Update Get Directions link
    const directionsBtn = document.querySelector('.get-directions-btn');
    if (directionsBtn && office.googleMapsLink) {
        directionsBtn.href = office.googleMapsLink;
    }

    // Update map embed
    const mapIframe = document.querySelector('.map-iframe');
    if (mapIframe && office.googleMapsEmbed) {
        mapIframe.src = office.googleMapsEmbed;
    }
}

// Make showDepartment globally accessible
window.showDepartment = function (deptId) {
    document.querySelectorAll('.department-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetContent = document.getElementById(deptId + '-content');
    if (targetContent) {
        targetContent.classList.add('active');
    }
};

// ── Send us a Message: mailto handler + static fallback item wiring ────────
document.querySelector('.contact-form form').addEventListener('submit', function (e) {
    e.preventDefault();

    const rawDeptValue = document.getElementById('department').value;
    const name = document.getElementById('name').value.trim();
    const senderEmail = document.getElementById('email').value.trim();
    const company = document.getElementById('company').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const message = document.getElementById('message').value.trim();

    // Parse "deptId::email" (set by selectFormDepartment) or plain "deptId" (old fallback)
    let toEmail, deptId;
    if (rawDeptValue.includes('::')) {
        const parts = rawDeptValue.split('::');
        deptId = parts[0];
        toEmail = parts[1];
    } else {
        deptId = rawDeptValue;
        toEmail = (window.deptEmailMap && window.deptEmailMap[deptId])
            ? window.deptEmailMap[deptId]
            : 'sales@electronicscience.net';
    }

    if (!rawDeptValue) {
        alert('Please select a department before sending.');
        return;
    }

    // Build subject from the toggle button display text
    const deptLabel = document.getElementById('deptToggle')
        ?.querySelector('span')?.textContent || deptId || 'General';
    const subject = encodeURIComponent(`Contact Form: ${deptLabel} Inquiry from ${name}`);

    // Build body
    const bodyLines = [
        `Name: ${name}`,
        `Email: ${senderEmail}`,
        company ? `Company: ${company}` : '',
        phone ? `Phone: ${phone}` : '',
        '',
        'Message:',
        message
    ].filter(l => l !== null);
    const body = encodeURIComponent(bodyLines.join('\n'));

    // Open the user's mail client
    window.location.href = `mailto:${toEmail}?subject=${subject}&body=${body}`;
});

// Scroll Animations with Intersection Observer
const revealObserverOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        } else {
            entry.target.classList.remove('visible');
        }
    });
}, revealObserverOptions);

document.querySelectorAll('.fade-up, .fade-in-left, .fade-in-right, .fade-in-scale').forEach(el => {
    revealObserver.observe(el);
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
                const opacity = Math.max(0, 1 - (scrolled / (heroHeight * 0.7)));
                const yPos = scrolled * 0.45;

                heroInner.style.opacity = opacity;
                heroInner.style.transform = `translateY(${yPos}px)`;
            } else if (heroInner && scrolled > heroHeight && heroInner.style.opacity !== '0') {
                heroInner.style.opacity = '0';
            }
            scrollTicking = false;
        });
        scrollTicking = true;
    }
});

// Custom Dropdown Handling
document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    const menu = dropdown.querySelector('.dropdown-menu');
    const hiddenInput = dropdown.querySelector('input[type="hidden"]');
    const label = toggle.querySelector('span');

    toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = dropdown.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
        if (isOpen) {
            menu.removeAttribute('hidden');
        } else {
            menu.setAttribute('hidden', '');
        }

        // Close other dropdowns
        document.querySelectorAll('.custom-dropdown').forEach(other => {
            if (other !== dropdown) {
                other.classList.remove('open');
                other.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
                other.querySelector('.dropdown-menu').setAttribute('hidden', '');
            }
        });
    });

    menu.querySelectorAll('li').forEach(item => {
        item.addEventListener('click', () => {
            const value = item.getAttribute('data-value');
            const text = item.textContent;

            label.textContent = text;
            if (hiddenInput) {
                hiddenInput.value = value;
                // Trigger change event for form validation/listeners
                hiddenInput.dispatchEvent(new Event('change'));
            }

            dropdown.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
            menu.setAttribute('hidden', '');

            // Special case for department switching in info section
            if (dropdown.id === 'contact-department-custom') {
                showDepartment(value);
            }
        });
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
            dropdown.classList.remove('open');
            dropdown.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
            dropdown.querySelector('.dropdown-menu').setAttribute('hidden', '');
        });
    }
});

// Function to display department content
function showDepartment(dept) {
    if (!dept) {
        // Hide all if no selection
        document.querySelectorAll('.department-content').forEach(content => {
            content.classList.remove('active');
        });
        return;
    }

    // Hide all department contents
    document.querySelectorAll('.department-content').forEach(content => {
        content.classList.remove('active');
    });

    // Show selected department content
    const targetContent = document.getElementById(dept + '-content');
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

// Initial setup for default selection
const initialDept = document.getElementById('contact-department').value;
if (initialDept) {
    showDepartment(initialDept);
}

// Back to Top functionality
const backToTopBtn = document.getElementById('backToTop');
if (backToTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}
