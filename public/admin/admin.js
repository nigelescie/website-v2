// ===== HTML ESCAPE UTILITY =====
// Production logging guard (SEC-012): suppress console output when not in dev mode
if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    console.log = () => {};
    console.error = () => {};
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ===== BROWSER DETECTION (mirrors page-transition.js) =====
(function () {
    const ua = navigator.userAgent;
    const vendor = navigator.vendor || '';
    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(vendor) && !/Edg\//.test(ua);
    if (isChrome) {
        document.documentElement.classList.add('is-chrome');
    }
})();

// Validate image file type (only JPEG, PNG, GIF accepted)
function isValidImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    return validTypes.includes(file.type);
}

// Validate media file type (images and videos)
function isValidMediaFile(file) {
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const validVideoTypes = ['video/mp4'];
    return validImageTypes.includes(file.type) || validVideoTypes.includes(file.type);
}

// Resolve asset path: uploads go to CDN, static assets stay relative
function assetUrl(path) {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    if (path.startsWith('uploads/')) return CONFIG.UPLOADS_BASE + '/' + path.replace(/^uploads\//, '');
    return '/' + path.replace(/^\//, '');
}

// authenticatedFetch and Cognito helpers are provided by adminAuth.js

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];

    // Length check
    if (password.length >= 8) strength += 1;
    else feedback.push("At least 8 characters");

    if (password.length >= 12) strength += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) strength += 1;
    else feedback.push("Lowercase letters");

    if (/[A-Z]/.test(password)) strength += 1;
    else feedback.push("Uppercase letters");

    if (/\d/.test(password)) strength += 1;
    else feedback.push("Numbers");

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 1;
    else feedback.push("Special characters");

    // Bonus points for length
    if (password.length >= 16) strength += 1;

    // Determine strength level
    let level, color, text;
    if (strength <= 2) {
        level = 'weak';
        color = '#e74c3c';
        text = 'Weak';
    } else if (strength <= 4) {
        level = 'fair';
        color = '#f39c12';
        text = 'Fair';
    } else if (strength <= 6) {
        level = 'good';
        color = '#27ae60';
        text = 'Good';
    } else {
        level = 'strong';
        color = '#2ecc71';
        text = 'Strong';
    }

    return {
        score: strength,
        level: level,
        color: color,
        text: text,
        feedback: feedback
    };
}

// Update password strength indicator
function updatePasswordStrengthIndicator(password, indicatorId) {
    const strength = checkPasswordStrength(password);
    const indicator = document.getElementById(indicatorId);

    if (!indicator) return;

    // Update strength bar
    const strengthBar = indicator.querySelector('.strength-bar');
    const strengthText = indicator.querySelector('.strength-text');
    const strengthFeedback = indicator.querySelector('.strength-feedback');

    if (strengthBar) {
        strengthBar.style.width = `${(strength.score / 7) * 100}%`;
        strengthBar.style.backgroundColor = strength.color;
    }

    if (strengthText) {
        strengthText.textContent = strength.text;
        strengthText.style.color = strength.color;
    }

    if (strengthFeedback && strength.feedback.length > 0) {
        const feedbackText = strength.feedback.join(', ');
        strengthFeedback.innerHTML = '';
        const div = document.createElement('div');
        div.style.cssText = 'margin-top: 8px; font-size: 12px;';
        const strong = document.createElement('strong');
        strong.textContent = 'Add to improve: ';
        div.appendChild(strong);
        div.appendChild(document.createTextNode(feedbackText));
        strengthFeedback.appendChild(div);
    } else if (strengthFeedback) {
        strengthFeedback.innerHTML = '';
    }
}

let appData = {};
let apiIcons = [];

// Fetch available icons once at startup
fetch(CONFIG.API_BASE + '/icons')
    .then(res => res.json())
    .then(icons => { apiIcons = icons; })
    .catch(err => console.error('Failed to load icons:', err));

document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in via Cognito session
    getIdToken().then(token => {
        if (token) {
            document.getElementById('login-screen').style.display = 'none';
            initDashboard();
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('dashboard').style.display = 'none';
        }
    });

    // Login Handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const result = await cognitoLogin(username, password);
            if (result.newPasswordRequired) {
                alert('You must set a new password before continuing.');
                return;
            }
            document.getElementById('login-screen').style.display = 'none';
            initDashboard();
        } catch (err) {
            console.error('Login failed:', err);
            document.getElementById('login-error').textContent = err.message || 'Login failed. Please try again.';
        }
    });

    // Forgot Password Link Click
    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('forgot-password-form').style.display = 'block';
    });

    // Back to Login Link Click
    document.getElementById('back-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('forgot-password-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    // Forgot Password Form Submit — sends Cognito verification code
    document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('forgot-email').value;
        const msg = document.getElementById('forgot-message');
        const btn = e.target.querySelector('button');

        btn.disabled = true;
        btn.textContent = 'Sending...';
        msg.textContent = '';
        msg.style.color = '';

        try {
            await cognitoForgotPassword(username);
            msg.textContent = 'Verification code sent to your email. Enter it below to reset your password.';
            msg.style.color = '#28a745';
            // Show reset form
            document.getElementById('forgot-password-form').style.display = 'none';
            document.getElementById('reset-password-form').style.display = 'block';
            document.getElementById('reset-username').value = username;
        } catch (err) {
            msg.textContent = err.message || 'An error occurred. Please try again.';
            msg.style.color = '#e74c3c';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Reset Code';
        }
    });

    // Reset Password Form Submit — confirms with Cognito verification code
    document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('reset-username').value;
        const code = document.getElementById('reset-code').value;
        const newPassword = document.getElementById('reset-new-password').value;
        const confirmPassword = document.getElementById('reset-confirm-password').value;
        const msg = document.getElementById('reset-message');
        const btn = e.target.querySelector('button');

        if (newPassword !== confirmPassword) {
            msg.textContent = 'Passwords do not match';
            msg.style.color = '#e74c3c';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Updating...';
        msg.textContent = '';

        try {
            await cognitoConfirmPassword(username, code, newPassword);
            msg.textContent = 'Password reset successful! You can now log in.';
            msg.style.color = '#28a745';
            setTimeout(() => {
                document.getElementById('reset-password-form').style.display = 'none';
                document.getElementById('login-form').style.display = 'block';
            }, 2000);
        } catch (err) {
            msg.textContent = err.message || 'An error occurred. Please try again.';
            msg.style.color = '#e74c3c';
            btn.disabled = false;
            btn.textContent = 'Update Password';
        }
    });

    // Toggle Password Visibility for Reset Form
    function togglePasswordVisibility(inputId, buttonId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        if (!input || !button) return;
        const icon = button.querySelector('svg');
        button.addEventListener('click', () => {
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            if (type === 'text') {
                icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
            } else {
                icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line>`;
            }
        });
    }

    togglePasswordVisibility('reset-new-password', 'toggle-reset-password');
    togglePasswordVisibility('reset-confirm-password', 'toggle-reset-confirm-password');

    const resetPasswordInput = document.getElementById('reset-new-password');
    if (resetPasswordInput) {
        resetPasswordInput.addEventListener('input', () => {
            updatePasswordStrengthIndicator(resetPasswordInput.value, 'reset-password-strength-indicator');
        });
    }

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            cognitoSignOut();
            location.reload();
        }
    });

    // Password toggle
    const togglePassword = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const eyeIcon = document.getElementById('eye-icon');
            if (type === 'text') {
                eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            } else {
                eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line>';
            }
        });
    }

    // Main Navigation
    document.querySelectorAll('.main-nav li[data-main-tab]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active-main-tab'));
            document.querySelectorAll('.nav-section').forEach(section => section.classList.remove('active'));
            item.classList.add('active-main-tab');

            // Clear dashboard polling
            if (window.dashboardPollInterval) {
                clearInterval(window.dashboardPollInterval);
                window.dashboardPollInterval = null;
            }

            // Reset product section index when switching tabs to avoid double-click bug
            window.currentProductSectionIndex = -1;

            const targetSection = item.dataset.mainTab + '-sections';
            const section = document.getElementById(targetSection);
            if (section) section.classList.add('active');

            // Special handling for products section
            if (item.dataset.mainTab === 'products') {
                if (appData.productsPage && appData.productsPage.sections && appData.productsPage.sections.length > 0) {
                    renderProductSidebar();
                    // Default to the first product section (CRM)

                    // Helper to ensure the section is active
                    // We need to wait for sidebar render or just call the select function
                    // The selectProductSection function handles UI updates
                    selectProductSection(0);

                } else {
                    // If no products exist, show empty state
                    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
                    document.getElementById('single-product-section-editor').classList.add('active');
                    document.getElementById('editor-title').textContent = 'Products';
                    const container = document.getElementById('current-section-form');
                    if (container) {
                        container.innerHTML = '<p>No product sections found. Click "Add Section" to create your first product section.</p>';
                    }
                }
            } else if (item.dataset.mainTab === 'blog') {
                // Special handling for blog section - render the blog editor
                window.currentBlogCategory = null; // Reset to show Hero by default
                renderBlogEditor();
                // Show the blog-page section by default
                document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
                const blogSection = document.getElementById('blog-page');
                if (blogSection) {
                    blogSection.classList.add('active');
                    document.getElementById('editor-title').textContent = 'Categories';
                }
            } else if (item.dataset.mainTab === 'dashboard') {
                renderDashboard();
                // Start generic polling for realtime updates
                window.dashboardPollInterval = setInterval(renderDashboard, 30000);

                document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
                const dashSection = document.getElementById('dashboard-overview');
                if (dashSection) {
                    dashSection.classList.add('active');
                    document.getElementById('editor-title').textContent = 'Dashboard Overview';
                }
            } else if (item.dataset.mainTab === 'contact') {
                // Special handling for contact section - Default to Departments

                // 1. Render sidebar
                renderContactDepartmentsSidebar();

                // 2. Open Departments functionality
                window.isDepartmentsSectionOpen = true;
                const deptList = document.getElementById('contact-departments-sidebar-list');
                if (deptList) deptList.classList.add('open');

                // Re-render specifically to apply the open class to the container arrow if needed
                // (renderContactDepartmentsSidebar uses window.isDepartmentsSectionOpen)
                renderContactDepartmentsSidebar();

                // 3. Clear active states
                document.querySelectorAll('.sidebar li[data-tab]').forEach(li => li.classList.remove('active-tab'));
                document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));

                // 4. Activate Departments Editor Section
                const deptSection = document.getElementById('contact-departments');
                if (deptSection) {
                    deptSection.classList.add('active');
                }

                // 5. Select Sales & Marketing (Index 0) by default
                // selectDepartment(0) will set currentDeptIndex, render sidebar (updating highlights), update title, and render editor.
                if (appData.contactPage && appData.contactPage.departments && appData.contactPage.departments.length > 0) {
                    selectDepartment(0);
                } else {
                    window.currentDeptIndex = null;
                    renderContactDepartmentsEditor();
                    document.getElementById('editor-title').textContent = 'Departments';
                }

            } else if (item.dataset.mainTab === 'footer') {
                // Special handling for footer section - Default to Brand

                // 1. Clear active states
                document.querySelectorAll('.sidebar li[data-tab]').forEach(li => li.classList.remove('active-tab'));
                document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));

                // 2. Activate Footer Brand section by default
                const brandTab = document.querySelector('li[data-tab="footer-brand"]');
                if (brandTab) {
                    brandTab.classList.add('active-tab');
                    document.getElementById('editor-title').textContent = 'Footer Brand';
                    const brandSection = document.getElementById('footer-brand');
                    if (brandSection) {
                        brandSection.classList.add('active');
                        renderFooterBrand();
                    }
                }
            } else {
                // Page Key Map for custom sections
                const pageKeyMap = {
                    'home': 'homePage',
                    'company': 'companyPage',
                    'careers': 'careersPage'
                };
                const pageKey = pageKeyMap[item.dataset.mainTab];
                if (pageKey) {
                    renderAllSidebarSections(pageKey);
                }

                // Show first tab in the section for non-products sections
                const firstTab = section.querySelector('li[data-tab]');
                if (firstTab) {
                    document.querySelectorAll('.sidebar li[data-tab]').forEach(li => li.classList.remove('active-tab'));
                    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
                    firstTab.classList.add('active-tab');
                    const targetSection = document.getElementById(firstTab.dataset.tab);
                    if (targetSection) {
                        targetSection.classList.add('active');
                    }
                    // Update title
                    document.getElementById('editor-title').textContent = firstTab.textContent;

                    // Auto-load page content for page editor tabs
                    const tabId = firstTab.dataset.tab;
                    if (tabId === 'careers-hero') {
                        renderCareersHeroEditor();
                    } else if (tabId === 'contact-departments') {
                        renderContactDepartmentsSidebar();
                        renderContactDepartmentsEditor();
                    }
                }
            }
        });
    });

    // Toggle subsection function for collapsible sidebar
    window.toggleSubsection = function (listId, e) {
        const header = (e || window.event).currentTarget;
        const list = document.getElementById('contact-departments-sidebar-list');

        header.classList.toggle('open');
        list.classList.toggle('open');
    };

    // Sidebar Navigation
    window.subscriberPollInterval = null; // Initialize polling variable

    // Reusable Sidebar Click Handler
    window.handleSidebarItemClick = function(item) {
        // Clear any existing polling when switching tabs
        if (window.subscriberPollInterval) {
            clearInterval(window.subscriberPollInterval);
            window.subscriberPollInterval = null;
        }

        document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active-tab'));
        // Reset inline display styles set by selectCustomSection before toggling active class
        document.querySelectorAll('.editor-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = '';
        });

        item.classList.add('active-tab');
        const tabId = item.dataset.tab;

        // Clear active-tab from any section-items (dropdowns) if not a nested tab
        if (!tabId.startsWith('legal-') && !item.classList.contains('product-item-sidebar')) {
            document.querySelectorAll('.sidebar .section-item').forEach(sec => sec.classList.remove('active-tab'));
        }

        let previewContainer = document.getElementById('generic-section-preview');
        if (previewContainer) {
            previewContainer.classList.remove('active');
        }

        const PREVIEW_ONLY_SECTIONS = [
            'company-hero', 
            'homepage-problem-section', 
            'company-cta', 
            'company-careers-intro', 
            'why-us', 
            'contact', 
            'opportunities',
            'careers-apply' // Added for consistency
        ];
        
        if (PREVIEW_ONLY_SECTIONS.includes(tabId)) {
            if (!previewContainer) {
                previewContainer = document.createElement('section');
                previewContainer.id = 'generic-section-preview';
                previewContainer.className = 'editor-section';
                const mainEditor = document.querySelector('main.main-editor');
                if (mainEditor) {
                    mainEditor.appendChild(previewContainer);
                }
            }
            
            if (previewContainer) {
                previewContainer.classList.add('active');
                
                // Determine the correct page URL based on the active main tab
                let pageUrl = '../index.html';
                const activeMainTab = document.querySelector('.main-nav li.active-main-tab');
                if (activeMainTab) {
                    const pageName = activeMainTab.dataset.mainTab;
                    if (pageName === 'company') pageUrl = '../nav-pages/company.html';
                    if (pageName === 'careers') pageUrl = '../nav-pages/careers.html';
                }
                
                let extraContent = '';
                if (tabId === 'opportunities') {
                    const data = appData.careersPage || {};
                    extraContent = `
                        <div style="background: rgba(13, 71, 161, 0.05); padding: 15px 20px; border-bottom: 1px solid rgba(13, 71, 161, 0.2); position: relative; flex-shrink: 0;">
                            <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: #0d47a1;"></div>
                            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; margin-bottom: 0; color: #0d47a1; font-weight: 700;">
                                <input type="checkbox" ${data.hideJobStreet ? 'checked' : ''} 
                                    onchange="appData.careersPage.hideJobStreet = this.checked"
                                    style="width: 20px; height: 20px; cursor: pointer; accent-color: #0d47a1;">
                                <span style="font-size: 1.1rem;">Hide "View on JobStreet" buttons across careers page</span>
                            </label>
                            <p style="margin: 5px 0 0 32px; font-size: 0.85rem; color: #555; font-weight: 400; line-height: 1.4;">
                                When enabled, the JobStreet buttons will be hidden, and the <strong>"Apply Now"</strong> buttons will automatically center and expand to maintain a balanced layout.
                            </p>
                        </div>
                    `;
                }

                previewContainer.innerHTML = '';
                const previewWrapper = document.createElement('div');
                previewWrapper.style.cssText = 'width: 100%; height: calc(100vh - 150px); border: 1px solid #ddd; border-radius: 8px; overflow: hidden; position: relative; background: #fff; display: flex; flex-direction: column;';
                if (extraContent) {
                    const extraDiv = document.createElement('div');
                    extraDiv.innerHTML = extraContent;
                    previewWrapper.appendChild(extraDiv);
                }
                const previewBanner = document.createElement('div');
                previewBanner.style.cssText = 'background: rgba(15, 52, 96, 0.95); color: white; padding: 12px; text-align: center; font-weight: bold; font-size: 0.9rem; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px;';
                previewBanner.innerHTML = '<span>Live Website Preview</span><span style="font-size: 0.75rem; font-weight: normal; opacity: 0.8;">This section\'s structure is fixed within the page template.</span>';
                previewWrapper.appendChild(previewBanner);
                const previewIframe = document.createElement('iframe');
                previewIframe.src = `${pageUrl}#${tabId}`;
                previewIframe.style.cssText = 'width: 100%; flex-grow: 1; border: none; background: #fff;';
                const safeTabId = String(tabId).replace(/[^a-zA-Z0-9_-]/g, '');
                previewIframe.addEventListener('load', () => {
                    setTimeout(() => {
                        try {
                            const win = previewIframe.contentWindow;
                            const el = win.document.getElementById(safeTabId);
                            if (el) {
                                const y = el.getBoundingClientRect().top + win.scrollY - 100;
                                win.scrollTo({ top: y, behavior: 'smooth' });
                            }
                        } catch(e) { /* cross-origin */ }
                    }, 300);
                });
                previewWrapper.appendChild(previewIframe);
                previewContainer.appendChild(previewWrapper);
            }
        } else {
            const targetSection = document.getElementById(tabId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        }

        // Update editor title
        const titleElement = document.getElementById('editor-title');
        const sectionTitle = item.textContent;
        if (titleElement) {
            titleElement.textContent = sectionTitle;
        }

        // Load timeline data when timeline tab is clicked
        if (tabId === 'timeline') {
            loadTimelineItems();
        }

        // Load page content when page editor tabs are clicked
        if (tabId === 'careers-hero') {
            renderCareersHeroEditor();
        } else if (tabId === 'why-join') {
            renderWhyJoinEditor();
        } else if (tabId === 'our-culture') {
            renderOurCultureEditor();
        } else if (tabId === 'team-culture') {
            renderOurCultureEditor();
        } else if (tabId === 'career-opportunities') {
            renderCareerOpportunitiesEditor();
        } else if (tabId === 'careers-apply') {
            renderCareersApplyEditor();
        } else if (tabId === 'blog-page') {
            renderBlogEditor();
        } else if (tabId === 'contact-departments' || tabId.startsWith('contact-dept-')) {
            renderContactDepartmentsSidebar();
            if (tabId.startsWith('contact-dept-')) {
                const deptIndex = parseInt(tabId.replace('contact-dept-', ''));
                renderSingleDepartmentEditor(deptIndex);
            }
        } else if (tabId === 'contact-office') {
            renderContactOfficeEditor();
        } else if (tabId === 'contact-hours') {
            renderContactHoursEditor();
        } else if (tabId === 'subscribers') {
            if (typeof currentSubscriberPage !== 'undefined') currentSubscriberPage = 1;
            loadSubscribers();
            if (window.populateSubscriberSettings) window.populateSubscriberSettings();
            // Start polling every 5 seconds
            window.subscriberPollInterval = setInterval(loadSubscribers, 5000);
        } else if (tabId === 'legal-terms') {
            const legalSection = document.getElementById('legal-sidebar-section');
            if (legalSection) legalSection.classList.add('active-tab');
            renderLegalEditor('terms');
        } else if (tabId === 'legal-privacy') {
            const legalSection = document.getElementById('legal-sidebar-section');
            if (legalSection) legalSection.classList.add('active-tab');
            renderLegalEditor('privacy');
        } else if (tabId === 'legal-npc') {
            const legalSection = document.getElementById('legal-sidebar-section');
            if (legalSection) legalSection.classList.add('active-tab');
            renderFooterNPCSeal();
        } else if (tabId === 'account-settings') {
            cognitoGetEmail().then(email => {
                if (email) document.getElementById('admin-email').value = email;
            });
        } else if (tabId === 'perks') {
            renderPerksSection(document.getElementById('perks-editor-container'));
        } else if (tabId === 'footer-brand') {
            renderFooterBrand();
        } else if (tabId === 'footer-contact') {
            renderFooterContact();
        } else if (tabId === 'footer-npc') {
            renderFooterNPCSeal();
        } else if (tabId === 'footer-connect') {
            renderFooterConnect();
        }

        // Sync custom sections sidebar for the current main tab
        const activeMainTab = document.querySelector('.main-nav li.active-main-tab');
        if (activeMainTab) {
            const pageKeyMap = {
                'home': 'homePage',
                'company': 'companyPage',
                'careers': 'careersPage'
            };
            const pageKey = pageKeyMap[activeMainTab.dataset.mainTab];
            if (pageKey) {
                renderAllSidebarSections(pageKey);
            }
        }
    };

    document.querySelectorAll('.sidebar li[data-tab]').forEach(item => {
        item.addEventListener('click', () => handleSidebarItemClick(item));
    });

    // 8. Who We Are
    const whoWeAreContainer = document.getElementById('about-escience-list');
    renderWhoWeAreSection(whoWeAreContainer);

    // 9. Family Culture
    const familyCultureContainer = document.getElementById('family-culture-list');
    renderFamilyCultureSection(familyCultureContainer);

    // 10. Vision
    const visionContainer = document.getElementById('vision-list');
    renderVisionSection(visionContainer);

    // 11. Mission
    const missionContainer = document.getElementById('mission-list');
    renderMissionSection(missionContainer);

    // Save
    document.getElementById('save-all-btn').addEventListener('click', saveData);
});

// Add password strength indicator to new password field only
setTimeout(() => {
    // Add strength indicator to new password field (in settings)
    const newPasswordField = document.getElementById('new-password');

    if (newPasswordField) {
        // Create a container for new password field and its toggle button
        const newPasswordContainer = document.createElement('div');
        newPasswordContainer.style.cssText = 'position: relative; width: 100%;';
        newPasswordField.style.margin = '0'; // Ensure no margin affects height
        newPasswordField.parentNode.insertBefore(newPasswordContainer, newPasswordField);
        newPasswordContainer.appendChild(newPasswordField);

        // Add toggle button next to input field (like login form)
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.id = 'toggle-new-password';
        toggleButton.style.cssText = 'background: none; border: none; cursor: pointer; padding: 0; margin: 0; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10; color: #666; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;';
        toggleButton.title = 'Show/Hide Password';
        toggleButton.innerHTML = `
                <svg id="new-password-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        newPasswordContainer.appendChild(toggleButton);

        // Create password strength indicator
        const strengthIndicator = document.createElement('div');
        strengthIndicator.id = 'password-strength-indicator';
        strengthIndicator.innerHTML = `
                <div style="margin-top: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #666;">Password Strength:</span>
                        <span class="strength-text" style="font-weight: bold; font-size: 12px;">-</span>
                    </div>
                    <div style="width: 100%; height: 4px; background: #eee; border-radius: 2px; margin-top: 4px;">
                        <div class="strength-bar" style="height: 100%; border-radius: 2px; transition: all 0.3s ease; width: 0%;"></div>
                    </div>
                    <div class="strength-feedback"></div>
                </div>
            `;

        // Insert after the container
        newPasswordContainer.parentNode.insertBefore(strengthIndicator, newPasswordContainer.nextSibling);

        // Add input event listener for strength checking
        newPasswordField.addEventListener('input', (e) => {
            updatePasswordStrengthIndicator(e.target.value, 'password-strength-indicator');
        });

        // Add password toggle functionality
        const eyeIcon = document.getElementById('new-password-eye');

        if (toggleButton && eyeIcon) {
            toggleButton.addEventListener('click', () => {
                const type = newPasswordField.type === 'password' ? 'text' : 'password';
                newPasswordField.type = type;

                if (type === 'text') {
                    // Show eye icon (password visible)
                    eyeIcon.innerHTML = `
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        `;
                    toggleButton.title = 'Hide Password';
                } else {
                    // Hide eye icon
                    eyeIcon.innerHTML = `
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        `;
                    toggleButton.title = 'Show Password';
                }
            });
        }
    }

    // Also add toggle to confirm password field for consistency
    const confirmPasswordField = document.getElementById('confirm-password');

    if (confirmPasswordField) {
        // Create a container for confirm password field and its toggle button
        const confirmContainer = document.createElement('div');
        confirmContainer.style.cssText = 'position: relative; width: 100%;';
        confirmPasswordField.style.margin = '0'; // Ensure no margin affects height
        confirmPasswordField.parentNode.insertBefore(confirmContainer, confirmPasswordField);
        confirmContainer.appendChild(confirmPasswordField);

        // Add toggle button next to confirm password field
        const confirmToggleButton = document.createElement('button');
        confirmToggleButton.type = 'button';
        confirmToggleButton.id = 'toggle-confirm-password';
        confirmToggleButton.style.cssText = 'background: none; border: none; cursor: pointer; padding: 0; margin: 0; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10; color: #666; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;';
        confirmToggleButton.title = 'Show/Hide Confirm Password';
        confirmToggleButton.innerHTML = `
                <svg id="confirm-password-eye" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
            `;
        confirmContainer.appendChild(confirmToggleButton);

        // Add toggle functionality for confirm password
        const confirmEyeIcon = document.getElementById('confirm-password-eye');

        if (confirmToggleButton && confirmEyeIcon) {
            confirmToggleButton.addEventListener('click', () => {
                const type = confirmPasswordField.type === 'password' ? 'text' : 'password';
                confirmPasswordField.type = type;

                if (type === 'text') {
                    // Show eye icon (password visible) - shows open eye
                    confirmEyeIcon.innerHTML = `
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        `;
                    confirmToggleButton.title = 'Hide Confirm Password';
                } else {
                    // Hide eye icon
                    confirmEyeIcon.innerHTML = `
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        `;
                    confirmToggleButton.title = 'Show Confirm Password';
                }
            });
        }
    }
}, 500); // Increased timeout to ensure DOM is ready


async function initDashboard() {
    document.getElementById('dashboard').style.display = 'flex';
    document.querySelector('.main-nav li[data-main-tab="dashboard"]').classList.add('active-main-tab');
    document.getElementById('dashboard-sections').classList.add('active');
    document.getElementById('editor-title').textContent = 'Dashboard Overview';
    renderDashboard();

    // Load archives list
    if (typeof loadArchivesList === 'function') {
        loadArchivesList();
    }

    // Fetch Data
    try {
        const res = await authenticatedFetch(CONFIG.API_BASE + '/content');
        const serverData = await res.json();
        const defaults = getDefaultAppData();

        // Unwrap { data: "..." } envelope and parse JSON strings from DynamoDB
        const parsed = {};
        for (const key of Object.keys(serverData)) {
            const val = serverData[key];
            const raw = (val && typeof val === 'object' && 'data' in val) ? val.data : val;
            if (typeof raw === 'string') {
                try { parsed[key] = JSON.parse(raw); } catch { parsed[key] = raw; }
            } else {
                parsed[key] = raw;
            }
        }

        // Deep merge logic (simplified)
        appData = { ...defaults, ...parsed };
        const serverDataParsed = parsed;

        // Ensure nested objects like careersPage are also merged if they exist in serverDataParsed
        if (serverDataParsed.careersPage) {
            appData.careersPage = { ...defaults.careersPage, ...serverDataParsed.careersPage };
            // Further deep merge for nested careersPage sections
            if (serverDataParsed.careersPage.hero) appData.careersPage.hero = { ...defaults.careersPage.hero, ...serverDataParsed.careersPage.hero };
            if (serverDataParsed.careersPage.intro) appData.careersPage.intro = { ...defaults.careersPage.intro, ...serverDataParsed.careersPage.intro };
            if (serverDataParsed.careersPage.whyJoin) appData.careersPage.whyJoin = { ...defaults.careersPage.whyJoin, ...serverDataParsed.careersPage.whyJoin };
            if (serverDataParsed.careersPage.teamCulture) appData.careersPage.teamCulture = { ...defaults.careersPage.teamCulture, ...serverDataParsed.careersPage.teamCulture };
            if (serverDataParsed.careersPage.officeCulture) appData.careersPage.officeCulture = { ...defaults.careersPage.officeCulture, ...serverDataParsed.careersPage.officeCulture };
            if (serverDataParsed.careersPage.customSections) appData.careersPage.customSections = serverDataParsed.careersPage.customSections;
            if (serverDataParsed.careersPage.opportunities) appData.careersPage.opportunities = { ...defaults.careersPage.opportunities, ...serverDataParsed.careersPage.opportunities };
            if (serverDataParsed.careersPage.apply) appData.careersPage.apply = { ...defaults.careersPage.apply, ...serverDataParsed.careersPage.apply };
        }

        if (serverDataParsed.homePage && serverDataParsed.homePage.customSections) {
            appData.homePage = { customSections: serverDataParsed.homePage.customSections };
        } else {
            appData.homePage = { customSections: [] };
        }

        if (serverDataParsed.companyPage && serverDataParsed.companyPage.customSections) {
            appData.companyPage = { customSections: serverDataParsed.companyPage.customSections };
        } else {
            appData.companyPage = { customSections: [] };
        }

        if (serverDataParsed.contactPage) {
            appData.contactPage = { ...defaults.contactPage, ...serverDataParsed.contactPage };
            if (serverDataParsed.contactPage.officeLocation) appData.contactPage.officeLocation = { ...defaults.contactPage.officeLocation, ...serverDataParsed.contactPage.officeLocation };
            if (serverDataParsed.contactPage.businessHours) appData.contactPage.businessHours = { ...defaults.contactPage.businessHours, ...serverDataParsed.contactPage.businessHours };
        }

        if (serverDataParsed.footer) {
            appData.footer = { ...defaults.footer, ...serverDataParsed.footer };
            if (serverDataParsed.footer.brand) appData.footer.brand = { ...defaults.footer.brand, ...serverDataParsed.footer.brand };
            if (serverDataParsed.footer.contact) appData.footer.contact = { ...defaults.footer.contact, ...serverDataParsed.footer.contact };
            if (serverDataParsed.footer.legal) {
                appData.footer.legal = { ...defaults.footer.legal, ...serverDataParsed.footer.legal };
                if (serverDataParsed.footer.legal.npcSeal) appData.footer.legal.npcSeal = { ...defaults.footer.legal.npcSeal, ...serverDataParsed.footer.legal.npcSeal };
            }
            if (serverDataParsed.footer.connect) appData.footer.connect = { ...defaults.footer.connect, ...serverDataParsed.footer.connect };
        }

        renderForms();
    } catch (err) {
        console.error("Failed to load content from server, using default data:", err);
        // Use default data instead of showing error
        appData = getDefaultAppData();
        renderForms();
    }
}
// Add default data function
function getDefaultAppData() {
    return {
        hero: {
            slides: []
        },
        stats: [],
        solutions: [],
        whyUs: [],
        testimonials: [],
        productsPage: {
            sections: []
        },
        timeline: [],
        leaders: {
            title: "Our Leaders",
            description: "eScience is home to technology experts, unmatched industry knowledge, and timely response. We have the most talented, passionate, and committed IT experts, business development and customer specialists who share the essential core values that define our organization: Integrity, God-centeredness, Excellence, Innovation, Teamwork, and Customer focus.",
            list: []
        },
        perks: {
            title: "Employee Perks & Benefits",
            description: "We care about our employees and provide a comprehensive benefits package to support their growth, health, and well-being.",
            list: []
        },
        blogPage: {
            heroTitle: 'eScience Blog',
            heroDescription: 'Company news, case studies, and insights from the eScience team shaping the future of mobile enterprise',
            categories: [
                { id: 'company', label: 'Company News' },
                { id: 'events', label: 'Events' },
                { id: 'case-study', label: 'Case Studies' },
                { id: 'press', label: 'Press Release' },
                { id: 'team', label: 'Team & Culture' }
            ],
            posts: []
        },
        careersPage: {
            customSections: [],
            hideJobStreet: false,
            hero: {
                title: "JOIN OUR TEAM",
                subtitle: "Unlock your potential with exciting careers at eScience",
                backgroundImage: "assets/careers-hero.jpg"
            },
            intro: {
                title: "Be Part of Our Growing Family",
                description: "At eScience, we're not just building software— we're shaping the future of mobile enterprise solutions. Join a team of passionate innovators, problem-solvers, and technology enthusiasts who have been transforming businesses since 2000. Here, your ideas matter, your growth is our priority, and your impact is limitless.",
                slides: [
                    { image: "uploads/image-1768294952235-926490931.jpg" },
                    { image: "uploads/image-1765872330452-670956322.jpg" },
                    { image: "uploads/image-1765868069718-166301826.jpg" }
                ]
            },
            whyJoin: {
                title: "Why Join eScience?",
                subtitle: "Explore what makes eScience a great place to work",
                cards: [
                    { icon: "🚀", title: "Innovation", description: "Work on cutting-edge technologies and shape the future of mobile enterprise solutions", gradient: "linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)" },
                    { icon: "🌱", title: "Growth", description: "Continuous learning opportunities, training programs, and career advancement paths", gradient: "linear-gradient(135deg, #46C1A4 0%, #2F9D78 100%)" },
                    { icon: "👥", title: "Community", description: "Join a family-oriented culture where collaboration and mutual respect are paramount", gradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)" }
                ]
            },
            teamCulture: {
                title: "Meet Our Team",
                description: "Discover the culture that drives innovation and growth at eScience.",
                videoUrl: "uploads/image-1767683402482-929261138.mp4"
            },
            officeCulture: {
                title: "Office Culture & Events",
                subtitle: "Celebrate milestones and create memories together",
                cards: [
                    { icon: "🎉", title: "Team Events", description: "Regular team building activities, company outings, and celebration events", gradient: "linear-gradient(135deg, #FF6B6B 0%, #FF8E72 100%)" },
                    { icon: "💼", title: "Workspace", description: "Modern office facilities with collaborative spaces and comfortable work environment", gradient: "linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%)" },
                    { icon: "🏆", title: "Recognition", description: "Celebrate achievements and recognize outstanding contributions from team members", gradient: "linear-gradient(135deg, #F7DC6F 0%, #F8C471 100%)" }
                ]
            },
            opportunities: {
                jobs: [
                    { title: "Software Engineer", description: "Architect and build high-impact mobile and web applications using modern stacks. Drive innovation from concept to deployment.", image: "uploads/software_engineer.png" },
                    { title: "QA Engineer", description: "Ensure excellence through rigorous manual and automated testing. Be the gatekeeper of quality for our enterprise solutions.", image: "uploads/image-1765872330452-670956322.jpg" },
                    { title: "Customer Support", description: "Empower our clients with expert technical guidance. Bridge the gap between technology and user success.", image: "uploads/customer_support.png" },
                    { title: "System Admin", description: "Maintain and optimize the infrastructure that powers businesses. Manage cloud systems and ensure maximum uptime.", image: "uploads/system_admin.png" }
                ],
                internships: [
                    { title: "Cyber Security", description: "Learn security best practices and protect enterprise systems. Gain hands-on experience in threat detection and security protocols.", image: "uploads/internship_cyber_security.png" },
                    { title: "Accounting", description: "Gain hands-on experience in financial management and reporting. Work with professional accounting software and real-world scenarios.", image: "uploads/image-1768266348647-518797080.jpg" },
                    { title: "Marketing", description: "Develop creative campaigns and digital marketing strategies. Learn social media management and content creation.", image: "uploads/image-1768266630689-55910052.jpg" },
                    { title: "Human Resources", description: "Support talent acquisition and employee development initiatives. Experience recruitment, onboarding, and HR operations.", image: "uploads/image-1768267349002-829681080.JPG" },
                    { title: "Software Development", description: "Build real-world applications and learn modern development practices. Work alongside experienced engineers on live projects.", image: "uploads/image-1768268436943-176120665.jpg" }
                ]
            },
            apply: {
                title: "Let's Shape the Future Together!",
                description: "Connect with us for employment and internship opportunities",
                email: "hrd@electronicscience.net",
                phone: "02-8850-1324",
                buttonText: "Send Application"
            }
        },
        contactPage: {
            departments: [],
            businessHours: {},
            officeLocation: {}
        },
        footer: {
            brand: {
                logoUrl: "assets/NAV-LOGO.png",
                tagline: "Architects of Innovation since 2000"
            },
            contact: {
                email: "sales@electronicscience.net",
                phone: "02-8850-1324"
            },
            legal: {
                npcSeal: {
                    title: "NPC Seal",
                    content: "",
                    imageUrl: ""
                }
            },
            connect: {
                facebook: {
                    platform: "Facebook",
                    url: "https://facebook.com/esciencecorp",
                    label: "Follow us on Facebook"
                },
                linkedin: {
                    platform: "LinkedIn",
                    url: "https://www.linkedin.com/company/escience-corporation",
                    label: "Connect with us on LinkedIn"
                }
            }
        },
        legalPages: {
            terms: {
                sections: []
            },
            privacy: {
                sections: []
            }
        },
        homePage: {
            customSections: []
        },
        companyPage: {
            customSections: []
        }
    };
}

// Add new stat
window.addStat = function () {
    appData.stats.push({
        number: 0,
        label: 'New Stat',
        icon: 'assets/icon-placeholder.svg',
        type: 'svg',
        hidden: false
    });
    renderForms();
}

// Delete stat
window.deleteStat = function (index) {
    if (confirm('Are you sure you want to delete this stat?')) {
        appData.stats.splice(index, 1);
        renderForms();
    }
}

// ===== OUR CLIENTS EDITOR =====
window.renderOurClientsEditor = function() {
    const container = document.getElementById('our-clients-list');
    if (!container) return;
    if (!appData.ourClients) appData.ourClients = [];

    const isHidden = appData.sectionVisibility && appData.sectionVisibility.ourClientsHidden;

    let html = `<div class="item-card premium-card" style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h4 style="margin:0;">Our Clients Section ${isHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('ourClients', 'renderOurClientsEditor')" style="background:${isHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
        <p style="font-size:0.85rem; color:#888; margin:0 0 5px;">Upload client/partner logos below. Logos appear greyscale on the homepage and show colour on hover.</p>
    </div>`;
    container.innerHTML = html;

    appData.ourClients.forEach((client, index) => {
        const card = document.createElement('div');
        card.className = `item-card ${client.hidden ? 'hidden-item' : ''}`;
        card.style.marginBottom = '15px';
        card.innerHTML = `
            <div style="display:flex; gap:15px; align-items:flex-start; flex-wrap:wrap;">
                <div style="flex-shrink:0;">
                    ${client.logo ? `<img src="${assetUrl(client.logo)}" alt="Client Logo" style="width:100px; height:50px; object-fit:contain; background:#111; border-radius:6px; padding:6px; border:1px solid #333;">` : `<div style="width:100px; height:50px; background:#2a2a2a; border-radius:6px; border:1px dashed #555; display:flex; align-items:center; justify-content:center; font-size:0.75rem; color:#888;">No Logo</div>`}
                </div>
                <div style="flex:1; min-width:200px;">
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Client/Company Name</label>
                        <input type="text" value="${client.name || ''}" placeholder="Company Name" oninput="appData.ourClients[${index}].name = this.value">
                    </div>
                    <div class="form-group" style="margin-bottom:8px;">
                        <label>Logo Image</label>
                        <input type="file" accept="image/*" onchange="uploadOurClientLogo(this, ${index})">
                        ${client.logo ? `<p style="font-size:0.8rem; color:#888; margin:4px 0 0;">${client.logo}</p>` : ''}
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
                    <button onclick="moveOurClient(${index}, -1)" class="block-btn" title="Move up">↑</button>
                    <button onclick="moveOurClient(${index}, 1)" class="block-btn" title="Move down">↓</button>
                    <button onclick="toggleOurClientVisibility(${index})" style="background:${client.hidden ? '#27ae60' : '#607d8b'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        ${client.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deleteOurClient(${index})" class="block-btn remove-btn" title="Delete">×</button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
};

window.addOurClient = function() {
    if (!appData.ourClients) appData.ourClients = [];
    appData.ourClients.push({ name: 'Client Name', logo: '', hidden: false });
    renderOurClientsEditor();
};

window.deleteOurClient = function(index) {
    if (confirm('Delete this client logo?')) {
        appData.ourClients.splice(index, 1);
        renderOurClientsEditor();
    }
};

window.moveOurClient = function(index, direction) {
    const list = appData.ourClients;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    [list[index], list[newIndex]] = [list[newIndex], list[index]];
    renderOurClientsEditor();
};

window.toggleOurClientVisibility = function(index) {
    appData.ourClients[index].hidden = !appData.ourClients[index].hidden;
    renderOurClientsEditor();
};

window.uploadOurClientLogo = async function(inputEl, index) {
    const file = inputEl.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        inputEl.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'our-clients');
        appData.ourClients[index].logo = filePath;
        renderOurClientsEditor();
    } catch(e) {
        console.error('Logo upload error', e);
        alert('Upload error. Please try again.');
    }
};

// Also hook into toggleSectionVisibility for the ourClients key
const _origToggleSectionVisibility = window.toggleSectionVisibility;
window.toggleSectionVisibility = function(sectionKey, renderFuncStr, containerId) {
    if (sectionKey === 'ourClients') {
        if (!appData.sectionVisibility) appData.sectionVisibility = {};
        appData.sectionVisibility.ourClientsHidden = !appData.sectionVisibility.ourClientsHidden;
        renderOurClientsEditor();
        return;
    }
    _origToggleSectionVisibility(sectionKey, renderFuncStr, containerId);
};

// Toggle Hide/Show Item
window.toggleHideItem = function (targetPath, index, callbackName) {
    // Parse path supporting both dot notation and bracket notation (e.g. 'productsPage.sections[0].products')
    const pathParts = targetPath.replace(/\[(\d+)\]/g, '.$1').split('.');
    let target = appData;
    for (let i = 0; i < pathParts.length; i++) {
        if (!target[pathParts[i]]) return;
        target = target[pathParts[i]];
    }

    if (target && target[index]) {
        target[index].hidden = !target[index].hidden;

        // Sync logic for solutions <-> productsPage sections
        if (targetPath === 'solutions' && appData.productsPage && appData.productsPage.sections && appData.productsPage.sections[index]) {
            appData.productsPage.sections[index].hidden = target[index].hidden;
        } else if (targetPath === 'productsPage.sections' && appData.solutions && appData.solutions[index]) {
            appData.solutions[index].hidden = target[index].hidden;
        }

        if (callbackName && typeof window[callbackName] === 'function') {
            window[callbackName]();
        } else if (callbackName === 'renderForms') {
            renderForms();
        }
    }
}

window.toggleHideSection = function (targetPath, callbackName) {
    const pathParts = targetPath.split('.');
    let target = appData;
    for (let i = 0; i < pathParts.length; i++) {
        target = target[pathParts[i]];
    }

    if (target) {
        target.hidden = !target.hidden;
        if (callbackName && typeof window[callbackName] === 'function') {
            window[callbackName]();
        } else if (callbackName === 'renderForms') {
            renderForms();
        } else {
            // Default to refreshing the whole dashboard if unsure
            renderDashboard();
        }
    }
}

window.toggleSectionVisibility = function(sectionKey, renderFuncStr, containerId) {
    if (!appData.sectionVisibility) appData.sectionVisibility = {};
    
    // For object-based sections (like whoWeAre), we can store .hidden directly on them
    // For array-based sections (like timeline), we must use sectionVisibility
    if (appData[sectionKey] && !Array.isArray(appData[sectionKey]) && typeof appData[sectionKey] === 'object') {
        appData[sectionKey].hidden = !appData[sectionKey].hidden;
    } else {
        appData.sectionVisibility[`${sectionKey}Hidden`] = !appData.sectionVisibility[`${sectionKey}Hidden`];
    }
    
    // Auto-save changes entirely
    if (typeof window.saveData === 'function') {
        window.saveData();
    }
    
    // Re-render
    const container = document.getElementById(containerId);
    if (container && typeof window[renderFuncStr] === 'function') {
        window[renderFuncStr](container);
    } else if (typeof window[renderFuncStr] === 'function') {
        // Fallback for functions that don't take a container argument, e.g. renderTimelineItems
        window[renderFuncStr]();
    }
}

window.renderListCallback = function () {
    renderForms();
}

function renderForms() {
    // 1. Hero
    if (appData.hero) {
        renderHeroSlides();
    }

    // 2. Stats
    const statsContainer = document.getElementById('stats-list');
    const isStatsHidden = appData.sectionVisibility && appData.sectionVisibility.statsHidden;
    statsContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); ${isStatsHidden ? 'opacity: 0.7;' : ''}">
            <h4 style="margin:0;">Stats Section ${isStatsHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('stats', 'renderForms')" style="background:${isStatsHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isStatsHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
    `;

    // Create Icon Picker Modal (if not exists)
    let modal = document.getElementById('icon-picker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'icon-picker-modal';
        modal.style.cssText = `
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center;
        `;
        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative;">
                <h3 style="margin-top:0;">Select an Icon</h3>
                
                <div id="icon-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 1rem; margin-top: 1rem;"></div>
                
                <div style="margin-top: 2rem; display: flex; justify-content: flex-end; border-top: 1px solid #eee; padding-top: 15px;">
                    <button onclick="document.getElementById('icon-picker-modal').style.display='none'" style="background:#666; padding: 0.5rem 1.5rem;">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Create Icon Picker Modal (if not exists)

    appData.stats.forEach((stat, index) => {
        const isPreset = stat.type === 'svg' || (stat.icon && stat.icon.endsWith('.svg'));
        const currentType = stat.type || (isPreset ? 'svg' : 'image');

        const div = document.createElement('div');
        div.className = `item-card ${stat.hidden ? 'hidden-item' : ''}`;

        let iconInputHtml = '';
        if (currentType === 'svg') {
            // Visual Picker Trigger for Preset SVGs
            iconInputHtml = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="
                        width: 40px; height: 40px; background: #eee; display: flex; align-items: center; justify-content: center;
                        border: 1px solid #ccc; border-radius: 4px;
                    ">
                        <img src="${assetUrl(stat.icon || 'assets/icon-placeholder.svg')}" style="width: 24px; height: 24px;">
                    </div>
                    <button type="button" onclick="openIconPicker(${index})" style="padding: 0.5rem; cursor: pointer;">Browse Library</button>
                    <input type="hidden" value="${stat.icon}" id="stat-icon-input-${index}"> 
                </div>
            `;
        } else if (currentType === 'custom-svg') {
            // Upload Custom SVG
            iconInputHtml = `
                <input type="file" accept=".svg" onchange="uploadImage(this, 'stats', ${index}, 'icon')">
                <input type="text" value="${stat.icon}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.5rem; color:#333;" placeholder="SVG Path">
                <small style="color:#666; display:block; margin-top:4px;">Upload your own SVG file (will be styled with stroke)</small>
            `;
        } else {
            // Upload Image Logo (PNG/JPG)
            iconInputHtml = `
                <input type="file" onchange="uploadImage(this, 'stats', ${index}, 'icon')">
                <input type="text" value="${stat.icon}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.5rem; color:#333;" placeholder="Image Path">
            `;
        }

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Stat #${index + 1} ${stat.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <div style="display:flex; gap:8px;">
                     <button onclick="toggleHideItem('stats', ${index}, 'renderForms')" style="background:${stat.hidden ? '#27ae60' : '#607d8b'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        ${stat.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deleteStat(${index})" style="background:#e74c3c; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">Delete</button>
                </div>
            </div>
            <div class="form-group">
                <label>Number</label>
                <input type="number" value="${stat.number}" onchange="appData.stats[${index}].number = this.value">
            </div>
            <div class="form-group">
                <label>Label</label>
                <input type="text" value="${stat.label}" onchange="appData.stats[${index}].label = this.value">
            </div>
            <div class="form-group">
                <label>Icon Type</label>
                <select onchange="switchStatIconType(${index}, this.value)">
                    <option value="svg" ${currentType === 'svg' ? 'selected' : ''}>Preset SVG (Library)</option>
                    <option value="custom-svg" ${currentType === 'custom-svg' ? 'selected' : ''}>Upload Custom SVG</option>
                    <option value="image" ${currentType === 'image' ? 'selected' : ''}>Upload Image Logo (PNG/JPG)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Icon Source</label>
                ${iconInputHtml}
            </div>
        `;
        statsContainer.appendChild(div);
    });

    // Global function to open picker
    window.openIconPicker = function (statIndex) {
        window.currentPickerTarget = { type: 'stat', index: statIndex };
        const grid = document.getElementById('icon-grid');
        grid.innerHTML = '';

        apiIcons.forEach(iconPath => {
            const item = document.createElement('div');
            item.style.cssText = `
                cursor: pointer; border: 1px solid #ddd; padding: 10px; border-radius: 4px;
                display: flex; flex-direction: column; align-items: center; gap: 5px;
                transition: background 0.2s;
                background-color: #f8f9fa;
            `;
            item.onmouseover = () => item.style.borderColor = '#aaa';
            item.onmouseout = () => item.style.borderColor = '#ddd';
            item.onclick = () => {
                selectIconForStat(iconPath);
            };

            item.innerHTML = `
                <img src="${assetUrl(iconPath)}" style="width: 32px; height: 32px; object-fit: contain;">
                <span style="font-size: 10px; word-break: break-all; text-align: center;">${iconPath.split('/').pop()}</span>
            `;
            grid.appendChild(item);
        });

        document.getElementById('icon-picker-modal').style.display = 'flex';
    }

    function selectIconForStat(iconPath) {
        if (!window.currentPickerTarget || window.currentPickerTarget.type !== 'stat') return;
        appData.stats[window.currentPickerTarget.index].icon = iconPath;
        appData.stats[window.currentPickerTarget.index].type = 'svg';
        renderForms();
        document.getElementById('icon-picker-modal').style.display = 'none';
    }

    window.switchStatIconType = function (index, newType) {
        appData.stats[index].type = newType;
        if (newType === 'svg') {
            appData.stats[index].icon = 'assets/icon-placeholder.svg';
        } else if (newType === 'custom-svg') {
            appData.stats[index].icon = '';
        } else {
            appData.stats[index].icon = '';
        }
        renderForms();
    }


    // 3. Solutions
    renderList('solutions-list', appData.solutions, 'solutions', ['title', 'description', 'image'], {
        title: "New Solution",
        description: "Description here",
        image: ""
    });

    // 4. Our Clients
    renderOurClientsEditor();

    // 5. Why Us
    renderList('whyus-list', appData.whyUs, 'whyUs', ['title', 'description', 'image'], {
        title: "Reason",
        description: "Description",
        image: ""
    });

    // 6. Testimonials
    renderList('testimonials-list', appData.testimonials, 'testimonials', ['name', 'title', 'company', 'quote', 'logo'], {
        name: "Client Name",
        title: "Position",
        company: "Company",
        quote: "Testimonial...",
        logo: ""
    });

    // 7. Products Page Sidebar (Dynamic)
    renderProductSidebar();

    // Contact Departments Sidebar (Dynamic)
    renderContactDepartmentsSidebar();

    // 8. Who We Are
    const whoWeAreContainer = document.getElementById('about-escience-list');
    renderWhoWeAreSection(whoWeAreContainer);

    // 9. Family Culture
    const familyCultureContainer = document.getElementById('family-culture-list');
    renderFamilyCultureSection(familyCultureContainer);

    // 9b. Careers Jobs Sidebar
    renderCareersJobsSidebar();

    // 10. Mission
    const missionContainer = document.getElementById('mission-list');
    renderMissionSection(missionContainer);

    // 11. Vision
    const visionContainer = document.getElementById('vision-list');
    renderVisionSection(visionContainer);

    // 12. Our Leaders
    const leadersContainer = document.getElementById('leaders-list');
    renderLeadersSection(leadersContainer);

    // 13. Perks & Benefits
    const perksContainer = document.getElementById('perks-editor-container');
    renderPerksSection(perksContainer);

    // 14. Footer
    renderFooterBrand();
    renderFooterContact();
    renderFooterNPCSeal();
    renderFooterConnect();
}

// --- Dashboard Logic ---
let dashboardChart = null;
let deviceChart = null;
let trafficChart = null;

async function renderDashboard() {
    try {
        const res = await authenticatedFetch(CONFIG.API_BASE + '/analytics');
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.message || 'Failed to fetch analytics');
        }

        const data = await res.json();

        // 1. Update Summary Cards
        document.getElementById('total-visitors').textContent = data.totalVisitors || 0;
        let totalViews = 0;
        if (data.pageViews) {
            Object.values(data.pageViews).forEach(count => totalViews += count);
        }
        document.getElementById('total-pageviews').textContent = totalViews;

        // 2. Render Chart
        if (data.dailyStats) {
            renderVisitorChart(data.dailyStats);
        }

        if (data.deviceStats) {
            renderDeviceChart(data.deviceStats);
        }

        if (data.trafficSources) {
            renderTrafficChart(data.trafficSources);
        }

        // 3. Render Top Pages Table
        renderTopPages(data.pageViews || {});

    } catch (err) {
        console.error("Failed to load analytics:", err);
        const tbody = document.getElementById('top-pages-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #ff4d4d;">Error loading data</td></tr>';
        }
    }
}

function renderVisitorChart(dailyStats) {
    const ctx = document.getElementById('visitorsChart').getContext('2d');

    // Sort dates
    const dates = Object.keys(dailyStats).sort();
    // Get last 7 days (or all if less)
    const recentDates = dates.slice(-7);

    const visitorsData = recentDates.map(date => dailyStats[date].visitors);
    const pageViewsData = recentDates.map(date => dailyStats[date].pageViews);

    if (dashboardChart) {
        dashboardChart.destroy();
    }

    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: recentDates, // Date labels
            datasets: [
                {
                    label: 'Visitors',
                    data: visitorsData,
                    borderColor: '#00d2ff',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Page Views',
                    data: pageViewsData,
                    borderColor: '#7b2cbf', // Purple
                    backgroundColor: 'rgba(123, 44, 191, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#333' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.1)' },
                    ticks: { color: '#666' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#666' }
                }
            }
        }
    });
}

function renderDeviceChart(deviceStats) {
    const ctx = document.getElementById('deviceChart').getContext('2d');

    if (deviceChart) {
        deviceChart.destroy();
    }

    const labels = Object.keys(deviceStats).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    const data = Object.values(deviceStats);

    deviceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#3498db', '#95a5a6'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderTrafficChart(trafficSources) {
    const ctx = document.getElementById('trafficChart').getContext('2d');

    if (trafficChart) {
        trafficChart.destroy();
    }

    const labels = Object.keys(trafficSources).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    const data = Object.values(trafficSources);

    trafficChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Visits',
                data: data,
                backgroundColor: [
                    '#e74c3c', // Direct
                    '#f1c40f', // Search
                    '#2ecc71', // Social
                    '#9b59b6'  // Referral
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderTopPages(pageViews) {
    const tbody = document.getElementById('top-pages-body');
    tbody.innerHTML = '';

    // Convert to array and sort
    const pages = Object.entries(pageViews)
        .map(([path, views]) => ({ path, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10); // Top 10

    if (pages.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 12px; text-align: center; color: black;">No data yet</td></tr>';
        return;
    }

    pages.forEach(page => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';

        const pathCell = document.createElement('td');
        pathCell.style.cssText = 'padding: 12px; color: black;';
        pathCell.textContent = page.path === '/' ? 'Home /' : page.path;

        const viewsCell = document.createElement('td');
        viewsCell.style.cssText = 'padding: 12px; color: black; font-weight: bold;';
        viewsCell.textContent = page.views;

        tr.appendChild(pathCell);
        tr.appendChild(viewsCell);
        tbody.appendChild(tr);
    });
}

// Product Sidebar & Navigation Logic
function renderProductSidebar() {
    const list = document.getElementById('products-sidebar-list');
    if (!list) return;

    list.innerHTML = '';


    if (!appData.productsPage) appData.productsPage = { sections: [] };
    if (!appData.productsPage.sections) appData.productsPage.sections = [];

    appData.productsPage.sections.forEach((section, index) => {
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'section-item';
        if (window.currentProductSectionIndex === index) {
            sectionContainer.classList.add('active-tab');
        }

        const headerRow = document.createElement('div');
        headerRow.className = 'section-header-row';
        const headerSpan = document.createElement('span');
        if (section.hidden) {
            const hiddenBadge = document.createElement('span');
            hiddenBadge.style.cssText = 'color:#e67e22; font-size:0.8rem;';
            hiddenBadge.textContent = '(Hidden) ';
            headerSpan.appendChild(hiddenBadge);
        }
        headerSpan.appendChild(document.createTextNode(section.title || `Section #${index + 1}`));
        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'dropdown-arrow';
        arrowSpan.textContent = '▶';
        headerRow.appendChild(headerSpan);
        headerRow.appendChild(arrowSpan);
        headerRow.onclick = () => selectProductSection(index);

        sectionContainer.appendChild(headerRow);

        // Product Sub-list
        const prodUl = document.createElement('ul');
        prodUl.className = 'product-list-sidebar';

        if (section.products && section.products.length > 0) {
            section.products.forEach((prod, pIndex) => {
                const pLi = document.createElement('li');
                pLi.className = 'product-item-sidebar';
                if (prod.hidden) {
                    const badge = document.createElement('span');
                    badge.style.cssText = 'color:#e67e22; font-size:0.8rem;';
                    badge.textContent = '(Hidden) ';
                    pLi.appendChild(badge);
                }
                pLi.appendChild(document.createTextNode(prod.title || `Product #${pIndex + 1}`));
                pLi.onclick = (e) => {
                    e.stopPropagation();
                    scrollToProduct(index, pIndex);
                };
                prodUl.appendChild(pLi);
            });
        }

        // Add "Add New Product" button
        const addLi = document.createElement('li');
        addLi.className = 'product-item-sidebar';
        addLi.style.color = '#27ae60';
        addLi.textContent = '+ Add New Product';
        addLi.onclick = (e) => {
            e.stopPropagation();
            addProductToSection(index);
        };
        prodUl.appendChild(addLi);
        sectionContainer.appendChild(prodUl);
        list.appendChild(sectionContainer);
    });
}

function scrollToProduct(sIndex, pIndex) {
    if (window.currentProductSectionIndex !== sIndex) {
        selectProductSection(sIndex);
    }

    // Small delay to ensure render is complete
    setTimeout(() => {
        const prodId = `product-editor-${sIndex}-${pIndex}`;
        const el = document.getElementById(prodId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.boxShadow = '0 0 15px rgba(15, 52, 96, 0.4)';
            setTimeout(() => { el.style.boxShadow = ''; }, 2000);
        }
    }, 100);
}

window.currentProductSectionIndex = -1;

window.selectProductSection = function (index) {
    if (window.currentProductSectionIndex === index) {
        window.currentProductSectionIndex = -1;
        const sidebarSections = document.querySelectorAll('#products-sidebar-list .section-item');
        sidebarSections.forEach(sec => sec.classList.remove('active-tab'));
        document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
        return;
    }

    window.currentProductSectionIndex = index;

    // Update Sidebar Active Function
    const sidebarSections = document.querySelectorAll('#products-sidebar-list .section-item');
    sidebarSections.forEach(sec => sec.classList.remove('active-tab'));
    if (sidebarSections[index]) sidebarSections[index].classList.add('active-tab');

    // Show Editor
    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
    const editor = document.getElementById('single-product-section-editor');
    if (editor) editor.classList.add('active');

    const section = appData.productsPage.sections[index];
    if (section) {
        if (document.getElementById('editor-title')) {
            document.getElementById('editor-title').textContent = section.title || 'Edit Section';
        }
        renderSingleSectionEditor(index);
    }
}

function renderSingleSectionEditor(sIndex) {
    const container = document.getElementById('current-section-form');
    if (!container) return;
    container.innerHTML = '';

    const section = appData.productsPage.sections[sIndex];
    if (!section) return;

    const linkedSolution = appData.solutions && appData.solutions[sIndex];
    if (linkedSolution) {
        // Adopt values from solution to ensure sync
        section.title = linkedSolution.title;
        section.subtitle = linkedSolution.description;
        section.id = linkedSolution.id || generateId(linkedSolution.title);
    }

    window.refreshCurrentProductSection = function() {
        renderProductSidebar();
        if (window.currentProductSectionIndex !== -1) {
            renderSingleSectionEditor(window.currentProductSectionIndex);
        }
    };

    // Section Fields
    container.innerHTML = `
        ${linkedSolution ? '<div style="background:#e8f4fd; padding:10px; border-radius:4px; margin-bottom:15px; font-size:0.9rem; color:#2980b9;">ℹ️ This section is linked to the <b>' + escHtml(linkedSolution.title) + '</b> solution on the Home Page.</div>' : ''}
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
            <h4 style="margin:0;">Category Visibility</h4>
            <button type="button" onclick="toggleHideItem('productsPage.sections', ${sIndex}, 'refreshCurrentProductSection')" style="background:${section.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${section.hidden ? 'Show Category' : 'Hide Category'}
            </button>
        </div>

        <div class="form-group">
            <label>Section Title</label>
            <input type="text" value="${escHtml(section.title) || ''}"
                ${linkedSolution ? 'readonly style="background-color: #f0f0f0; color: #666; cursor: not-allowed;"' : `onchange="updateProductSection(${sIndex}, 'title', this.value)"`}>
        </div>
        <div class="form-group">
            <label>Section Subtitle</label>
            <textarea ${linkedSolution ? 'readonly style="background-color: #f0f0f0; color: #666; cursor: not-allowed;"' : `onchange="updateProductSection(${sIndex}, 'subtitle', this.value)"`}>${escHtml(section.subtitle)}</textarea>
        </div>
        <div class="form-group">
            <label>Section ID (Slug) <small>(Auto-generated)</small></label>
            <input type="text" value="${section.id || ''}" readonly style="background-color: #f0f0f0; color: #666;">
        </div>

        <div style="margin-top: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top:0;">Products in this Section</h4>
            <div id="current-section-products"></div>
            <button class="add-item-btn" onclick="addProductToSection(${sIndex})" style="margin-top:10px; font-size: 0.9rem;">+ Add Product</button>
        </div>
    `;

    // Render Products
    const productsList = container.querySelector('#current-section-products');
    if (!section.products) section.products = [];

    section.products.forEach((prod, pIndex) => {
        const prodDiv = document.createElement('div');
        prodDiv.className = `item-card ${prod.hidden ? 'hidden-item' : ''}`;
        prodDiv.id = `product-editor-${sIndex}-${pIndex}`;
        prodDiv.style.background = 'white';
        prodDiv.style.border = '1px solid #e0e0e0';
        prodDiv.style.transition = 'box-shadow 0.3s';
        if (prod.hidden) prodDiv.style.opacity = '0.6';

        const prodHeaderDiv = document.createElement('div');
        prodHeaderDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#f8f9fa; padding:10px 15px; border-radius:6px; border:1px solid #eee;';
        const prodH5 = document.createElement('h5');
        prodH5.style.cssText = 'margin:0; color:#333;';
        prodH5.textContent = `Product #${pIndex + 1}: ${prod.title || 'New Product'}`;
        if (prod.hidden) {
            const hiddenBadge = document.createElement('span');
            hiddenBadge.style.cssText = 'color:#e67e22; font-size:0.8rem; margin-left:10px;';
            hiddenBadge.textContent = '(Hidden)';
            prodH5.appendChild(hiddenBadge);
        }
        prodHeaderDiv.appendChild(prodH5);
        const prodBtnsDiv = document.createElement('div');
        const prodHideBtn = document.createElement('button');
        prodHideBtn.style.cssText = `background:${prod.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:0.4rem 0.8rem; border:none; border-radius:4px; cursor:pointer; font-size:0.85rem; margin-right:5px;`;
        prodHideBtn.textContent = prod.hidden ? 'Show' : 'Hide';
        prodHideBtn.onclick = () => toggleHideItem(`productsPage.sections[${sIndex}].products`, pIndex, 'refreshCurrentProductSection');
        const prodDelBtn = document.createElement('button');
        prodDelBtn.style.cssText = 'background:#e74c3c; color:white; padding:0.4rem 0.8rem; border:none; border-radius:4px; cursor:pointer; font-size:0.85rem;';
        prodDelBtn.textContent = 'Delete';
        prodDelBtn.onclick = () => deleteProductFromSection(sIndex, pIndex);
        prodBtnsDiv.appendChild(prodHideBtn);
        prodBtnsDiv.appendChild(prodDelBtn);
        prodHeaderDiv.appendChild(prodBtnsDiv);
        prodDiv.appendChild(prodHeaderDiv);

        const prodTitleGroup = document.createElement('div');
        prodTitleGroup.className = 'form-group';
        const prodTitleLabel = document.createElement('label');
        prodTitleLabel.textContent = 'Product Title';
        const prodTitleInput = document.createElement('input');
        prodTitleInput.type = 'text';
        prodTitleInput.value = prod.title || '';
        prodTitleInput.style.cssText = 'font-weight:bold; border-color:#0f3460;';
        prodTitleInput.onchange = function() { updateSectionProduct(sIndex, pIndex, 'title', this.value); };
        prodTitleGroup.appendChild(prodTitleLabel);
        prodTitleGroup.appendChild(prodTitleInput);
        prodDiv.appendChild(prodTitleGroup);
        prodDiv.insertAdjacentHTML('beforeend', `
            <div class="product-edit-grid">
                <!-- Column 1: Solutions Grid Settings -->
                <div style="background:#fff; border:1px solid #f0f0f0; padding:15px; border-radius:8px;">
                    <h6 style="margin:0 0 15px 0; text-transform:uppercase; font-size:0.75rem; color:#0f3460; letter-spacing:1px; border-bottom:2px solid #0f3460; padding-bottom:5px; display:inline-block;">Solutions Page (Grid View)</h6>
            </div>

            <div class="product-edit-grid">
                <!-- Column 1: Solutions Grid Settings -->
                <div style="background:#fff; border:1px solid #f0f0f0; padding:15px; border-radius:8px;">
                    <h6 style="margin:0 0 15px 0; text-transform:uppercase; font-size:0.75rem; color:#0f3460; letter-spacing:1px; border-bottom:2px solid #0f3460; padding-bottom:5px; display:inline-block;">Solutions Page (Grid View)</h6>
                    
                    <div class="form-group">
                        <label>Summary Description</label>
                        <textarea rows="5" onchange="updateSectionProduct(${sIndex}, ${pIndex}, 'description', this.value)" style="width:100%">${prod.description || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Product Image/Logo</label>
                        <input type="file" onchange="uploadProductImage(this, ${sIndex}, ${pIndex})" style="font-size:0.8rem;">
                        <input type="text" value="${prod.image || ''}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.4rem; color:#666; width:100%;" placeholder="Image Path">
                        ${prod.image ? `<img src="${assetUrl(prod.image)}" class="preview-img" style="margin-top:10px;">` : ''}
                    </div>
                </div>

                <!-- Column 2: Product Detail Settings -->
                <div style="background:#fff; border:1px solid #f0f0f0; padding:15px; border-radius:8px;">
                    <h6 style="margin:0 0 15px 0; text-transform:uppercase; font-size:0.75rem; color:#0f3460; letter-spacing:1px; border-bottom:2px solid #0f3460; padding-bottom:5px; display:inline-block;">Dedicated Product Page</h6>
                    
                    <div class="form-group">
                        <label>Features Intro Image</label>
                        <input type="file" onchange="uploadProductImage(this, ${sIndex}, ${pIndex}, 'introImage')" style="font-size:0.8rem;">
                        <input type="text" value="${prod.introImage || ''}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.4rem; color:#666; width:100%;" placeholder="Image Path">
                        ${prod.introImage ? `<img src="${assetUrl(prod.introImage)}" class="preview-img" style="margin-top:10px;">` : ''}
                    </div>

                    <div class="form-group">
                        <label>Hero Subtitle</label>
                        <textarea rows="3" onchange="updateSectionProduct(${sIndex}, ${pIndex}, 'heroSubtitle', this.value)" style="width:100%" placeholder="Short catchy phrase for the top of the detail page">${prod.heroSubtitle || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Long Description</label>
                        <textarea rows="6" onchange="updateSectionProduct(${sIndex}, ${pIndex}, 'longDescription', this.value)" style="width:100%">${prod.longDescription || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Use Case</label>
                        <textarea rows="4" onchange="updateSectionProduct(${sIndex}, ${pIndex}, 'useCase', this.value)" style="width:100%" placeholder="Describe the main use case for this product">${prod.useCase || ''}</textarea>
                    </div>

                    <div class="form-group">
                        <label>Demo Video</label>
                        <input type="file" accept="video/*" onchange="uploadProductVideo(this, ${sIndex}, ${pIndex})" style="font-size:0.8rem;">
                        <input type="text" value="${prod.video || ''}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.4rem; color:#666; width:100%;" placeholder="Video Path">
                        ${prod.video ? `<video controls style="width:100%; max-width:300px; margin-top:10px;"><source src="${assetUrl(prod.video)}" type="video/mp4"></video>` : ''}
                    </div>
                    
                    <div class="form-group">
                        <div class="collapsible-features-header" onclick="toggleFeaturesSection(${sIndex}, ${pIndex})" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:#f0f4f8; padding:8px 12px; border-radius:4px; margin-bottom:10px; border:1px solid #dce4ec;">
                            <label style="margin:0; cursor:pointer;">Key Features</label>
                            <span class="dropdown-arrow ${window.featuresCollapsedState && window.featuresCollapsedState[`${sIndex}-${pIndex}`] ? 'open' : ''}" style="font-size:0.7rem; transition:transform 0.3s; ${window.featuresCollapsedState && window.featuresCollapsedState[`${sIndex}-${pIndex}`] ? 'transform: rotate(90deg);' : ''}">▶</span>
                        </div>
                        <div id="features-editor-${sIndex}-${pIndex}" class="features-list-admin" style="${!window.featuresCollapsedState || !window.featuresCollapsedState[`${sIndex}-${pIndex}`] ? 'display:none;' : 'display:block;'}">
                            ${(prod.features || []).map((feat, fIndex) => {
            const isObj = typeof feat === 'object' && feat !== null;
            const title = isObj ? feat.title : feat;
            const icon = isObj ? feat.icon : 'assets/icons/check.svg';
            const currentType = isObj ? (feat.type || 'svg') : 'svg';

            let iconInputHtml = '';
            if (currentType === 'svg') {
                iconInputHtml = `
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <div onclick="openFeatureIconPicker(${sIndex}, ${pIndex}, ${fIndex})" style="width: 38px; height: 38px; background: #fff; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; transition: border-color 0.2s;" onmouseover="this.style.borderColor='#0f3460'" onmouseout="this.style.borderColor='#ccc'">
                            <img src="${assetUrl(icon || 'assets/icons/check.svg')}" style="width: 22px; height: 22px; object-fit: contain;">
                        </div>
                        <button type="button" onclick="openFeatureIconPicker(${sIndex}, ${pIndex}, ${fIndex})" style="padding: 4px 10px; cursor: pointer; font-size: 11px; background: #f0f0f0; color: #333; border: 1px solid #ccc; font-weight: normal;">Browse Library</button>
                    </div>
                `;
            } else if (currentType === 'custom-svg') {
                iconInputHtml = `
                    <input type="file" accept=".svg" onchange="uploadImage(this, 'productsPage.sections[${sIndex}].products[${pIndex}].features', ${fIndex}, 'icon')">
                    <input type="text" value="${icon}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.4rem; color:#333; width:100%; font-size:0.8rem;" placeholder="SVG Path">
                `;
            } else {
                iconInputHtml = `
                    <input type="file" onchange="uploadImage(this, 'productsPage.sections[${sIndex}].products[${pIndex}].features', ${fIndex}, 'icon')">
                    <input type="text" value="${icon}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.4rem; color:#333; width:100%; font-size:0.8rem;" placeholder="Image Path">
                `;
            }

            return `
                                    <div class="feature-item-row" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px; background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #eee;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:5px;">
                                            <span style="font-weight:bold; font-size:0.85rem; color:#666;">Feature #${fIndex + 1}</span>
                                            <button onclick="deleteProductFeature(${sIndex}, ${pIndex}, ${fIndex})" style="background:#ff7675; padding:4px 8px; border:none; border-radius:4px; color:white; cursor:pointer; font-size:0.8rem;">Delete</button>
                                        </div>
                                        <div class="form-group" style="margin-bottom:10px;">
                                            <label style="font-size:0.8rem;">Title</label>
                                            <input type="text" value="${title}" placeholder="Feature Title" onchange="updateProductFeature(${sIndex}, ${pIndex}, ${fIndex}, 'title', this.value)" style="font-size:0.9rem; padding:8px;">
                                        </div>
                                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                                            <div class="form-group" style="margin-bottom:0;">
                                                <label style="font-size:0.8rem;">Icon Type</label>
                                                <select onchange="switchProductFeatureIconType(${sIndex}, ${pIndex}, ${fIndex}, this.value)" style="font-size:0.8rem; padding:6px;">
                                                    <option value="svg" ${currentType === 'svg' ? 'selected' : ''}>Preset</option>
                                                    <option value="custom-svg" ${currentType === 'custom-svg' ? 'selected' : ''}>Custom SVG</option>
                                                    <option value="image" ${currentType === 'image' ? 'selected' : ''}>Image (PNG/JPG)</option>
                                                </select>
                                            </div>
                                            <div class="form-group" style="margin-bottom:0;">
                                                <label style="font-size:0.8rem;">Icon Source</label>
                                                ${iconInputHtml}
                                            </div>
                                        </div>
                                    </div>
                                `;
        }).join('')}
                        </div>
                        <button class="add-item-btn" onclick="addProductFeature(${sIndex}, ${pIndex})" style="margin-top:5px; font-size:0.8rem; padding:6px 12px;">+ Add Feature</button>
                    </div>
                    
                    <div class="form-group">
                        <div class="collapsible-features-header" onclick="toggleBenefitsSection(${sIndex}, ${pIndex})" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:#f0f4f8; padding:8px 12px; border-radius:4px; margin-bottom:10px; border:1px solid #dce4ec;">
                            <label style="margin:0; cursor:pointer;">Key Benefits</label>
                            <span class="dropdown-arrow ${window.benefitsCollapsedState && window.benefitsCollapsedState[`${sIndex}-${pIndex}`] ? 'open' : ''}" style="font-size:0.7rem; transition:transform 0.3s; ${window.benefitsCollapsedState && window.benefitsCollapsedState[`${sIndex}-${pIndex}`] ? 'transform: rotate(90deg);' : ''}">▶</span>
                        </div>
                        <div id="benefits-editor-${sIndex}-${pIndex}" class="benefits-list-admin" style="${!window.benefitsCollapsedState || !window.benefitsCollapsedState[`${sIndex}-${pIndex}`] ? 'display:none;' : 'display:block;'}">
                            ${(prod.benefits || []).map((benefit, bIndex) => {
            const isObj = typeof benefit === 'object' && benefit !== null;
            const title = isObj ? benefit.title : benefit;
            const description = isObj ? (benefit.description || '') : '';

            return `
                                    <div class="benefit-item-row" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px; background:#f9f9f9; padding:15px; border-radius:8px; border:1px solid #eee;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:5px;">
                                            <span style="font-weight:bold; font-size:0.85rem; color:#666;">Benefit #${bIndex + 1}</span>
                                            <button onclick="deleteProductBenefit(${sIndex}, ${pIndex}, ${bIndex})" style="background:#ff7675; padding:4px 8px; border:none; border-radius:4px; color:white; cursor:pointer; font-size:0.8rem;">Delete</button>
                                        </div>
                                        <div class="form-group" style="margin-bottom:10px;">
                                            <label style="font-size:0.8rem;">Title</label>
                                            <input type="text" value="${title}" placeholder="Benefit Title" onchange="updateProductBenefit(${sIndex}, ${pIndex}, ${bIndex}, 'title', this.value)" style="font-size:0.9rem; padding:8px;">
                                        </div>
                                        <div class="form-group" style="margin-bottom:0;">
                                            <label style="font-size:0.8rem;">Description</label>
                                            <textarea rows="3" placeholder="Benefit Description (optional)" onchange="updateProductBenefit(${sIndex}, ${pIndex}, ${bIndex}, 'description', this.value)" style="font-size:0.9rem; padding:8px; width:100%;">${description}</textarea>
                                        </div>
                                    </div>
                                `;
        }).join('')}
                        </div>
                        <button class="add-item-btn" onclick="addProductBenefit(${sIndex}, ${pIndex})" style="margin-top:5px; font-size:0.8rem; padding:6px 12px;">+ Add Benefit</button>
                    </div>
                </div>
            </div>

            <div style="margin-top:20px; padding:10px; background:#fcfcfc; border-radius:4px; border:1px solid #eee; display:flex; gap:20px;">
                <div style="flex:1;">
                    <label style="font-size:0.75rem; margin-bottom:2px;">Meta ID</label>
                    <input type="text" value="${prod.id || ''}" readonly style="width:100%; padding:4px 8px; font-family:monospace;">
                </div>
                <div style="flex:2;">
                    <label style="font-size:0.75rem; margin-bottom:2px;">Dynamic Link</label>
                    <input type="text" value="${prod.link || ''}" readonly style="width:100%; padding:4px 8px; font-family:monospace;">
                </div>
            </div>
        `;
        productsList.appendChild(prodDiv);
    });
}

window.addProductSection = function () {
    if (!appData.productsPage) appData.productsPage = { sections: [] };
    const title = 'New Section';
    const newLength = appData.productsPage.sections.push({
        id: generateId(title) + '-' + Date.now().toString().slice(-4), // Ensure uniqueness
        title: title,
        subtitle: '',
        products: []
    });
    renderProductSidebar();
    selectProductSection(newLength - 1); // Automatically Select New Section
}

window.deleteProductSection = function (index) {
    if (confirm('Delete entire section?')) {
        appData.productsPage.sections.splice(index, 1);
        renderProductSidebar();
        // Return to home or clear editor
        window.currentProductSectionIndex = -1;
        document.getElementById('single-product-section-editor').classList.remove('active');
        // Maybe default to first section or just empty
        if (appData.productsPage.sections.length > 0) {
            selectProductSection(0);
        }
    }
}

window.updateProductSection = function (index, field, value) {
    appData.productsPage.sections[index][field] = value;

    // Sync back to solutions if it exists
    if (appData.solutions && appData.solutions[index]) {
        const sol = appData.solutions[index];
        if (field === 'title') {
            sol.title = value;
            sol.id = generateId(value);
            appData.productsPage.sections[index].id = sol.id;
        } else if (field === 'subtitle') {
            sol.description = value;
        }
        // Only re-render the solutions list, not the entire form
        renderList('solutions-list', appData.solutions, 'solutions', ['title', 'description', 'image'], {
            title: "New Solution",
            description: "Description here",
            image: ""
        });
    }

    if (field === 'title') {
        const newId = generateId(value);
        if (!appData.solutions || !appData.solutions[index]) {
            appData.productsPage.sections[index].id = newId;
        }
        renderProductSidebar(); // Update sidebar name
        renderSingleSectionEditor(index); // Refresh to show new ID in read-only field
    }
}

window.addProductToSection = function (sIndex) {
    if (!appData.productsPage.sections[sIndex].products) appData.productsPage.sections[sIndex].products = [];
    const title = "New Product";
    const prodId = generateId(title) + '-' + Date.now().toString().slice(-4);
    appData.productsPage.sections[sIndex].products.push({
        id: prodId,
        title: title,
        description: '',
        image: '',
        link: `product-detail.html?id=${prodId}`
    });
    renderProductSidebar();
    renderSingleSectionEditor(sIndex);
}

window.deleteProductFromSection = function (sIndex, pIndex) {
    if (confirm('Delete product?')) {
        appData.productsPage.sections[sIndex].products.splice(pIndex, 1);
        renderProductSidebar();
        renderSingleSectionEditor(sIndex);
    }
}

window.updateSectionProduct = function (sIndex, pIndex, field, value) {
    if (field === 'features' || field === 'benefits') {
        value = value.split('\n').filter(line => line.trim() !== '');
    }
    appData.productsPage.sections[sIndex].products[pIndex][field] = value;

    if (field === 'title') {
        const newId = generateId(value);
        appData.productsPage.sections[sIndex].products[pIndex].id = newId;
        appData.productsPage.sections[sIndex].products[pIndex].link = `product-detail.html?id=${newId}`;
        renderProductSidebar();
        renderSingleSectionEditor(sIndex); // Refresh to show new ID
    }
}

window.addProductFeature = function (sIndex, pIndex) {
    const prod = appData.productsPage.sections[sIndex].products[pIndex];
    if (!prod.features) prod.features = [];
    prod.features.push({ title: "New Feature", icon: "assets/icons/check.svg", type: 'svg' });

    const scrollPos = document.querySelector('.main-editor').scrollTop;
    renderSingleSectionEditor(sIndex);
    setTimeout(() => {
        document.querySelector('.main-editor').scrollTop = scrollPos;
    }, 50);
}

window.deleteProductFeature = function (sIndex, pIndex, fIndex) {
    if (!confirm('Delete this feature?')) return;
    appData.productsPage.sections[sIndex].products[pIndex].features.splice(fIndex, 1);

    const scrollPos = document.querySelector('.main-editor').scrollTop;
    renderSingleSectionEditor(sIndex);
    setTimeout(() => {
        document.querySelector('.main-editor').scrollTop = scrollPos;
    }, 50);
}

window.updateProductFeature = function (sIndex, pIndex, fIndex, field, value) {
    const feat = appData.productsPage.sections[sIndex].products[pIndex].features[fIndex];
    if (typeof feat === 'string') {
        // Convert to object if it was a legacy string
        appData.productsPage.sections[sIndex].products[pIndex].features[fIndex] = { title: feat, icon: "assets/icons/check.svg", type: 'svg' };
    }
    appData.productsPage.sections[sIndex].products[pIndex].features[fIndex][field] = value;
}

window.addProductBenefit = function (sIndex, pIndex) {
    const prod = appData.productsPage.sections[sIndex].products[pIndex];
    if (!prod.benefits) prod.benefits = [];
    prod.benefits.push({ title: "New Benefit", description: "" });

    const scrollPos = document.querySelector('.main-editor').scrollTop;
    renderSingleSectionEditor(sIndex);
    setTimeout(() => {
        document.querySelector('.main-editor').scrollTop = scrollPos;
    }, 50);
}

window.deleteProductBenefit = function (sIndex, pIndex, bIndex) {
    if (!confirm('Delete this benefit?')) return;
    appData.productsPage.sections[sIndex].products[pIndex].benefits.splice(bIndex, 1);

    const scrollPos = document.querySelector('.main-editor').scrollTop;
    renderSingleSectionEditor(sIndex);
    setTimeout(() => {
        document.querySelector('.main-editor').scrollTop = scrollPos;
    }, 50);
}

window.updateProductBenefit = function (sIndex, pIndex, bIndex, field, value) {
    const benefit = appData.productsPage.sections[sIndex].products[pIndex].benefits[bIndex];
    if (typeof benefit === 'string') {
        // Convert to object if it was a legacy string
        appData.productsPage.sections[sIndex].products[pIndex].benefits[bIndex] = { title: benefit, description: "" };
    }
    appData.productsPage.sections[sIndex].products[pIndex].benefits[bIndex][field] = value;
}


window.switchProductFeatureIconType = function (sIndex, pIndex, fIndex, newType) {
    const feat = appData.productsPage.sections[sIndex].products[pIndex].features[fIndex];
    if (typeof feat === 'string') {
        appData.productsPage.sections[sIndex].products[pIndex].features[fIndex] = { title: feat, icon: "", type: newType };
    } else {
        feat.type = newType;
        if (newType === 'svg') {
            feat.icon = 'assets/icons/check.svg';
        } else {
            feat.icon = '';
        }
    }

    // Update just the icon input section without full re-render
    const featureRow = document.querySelector(`#features-editor-${sIndex}-${pIndex} .feature-item-row:nth-child(${fIndex + 1})`);
    if (featureRow) {
        // Find and update the icon source section
        const iconSourceDiv = featureRow.querySelector('.form-group:last-child');
        if (iconSourceDiv && newType === 'svg') {
            const iconInputHtml = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div onclick="openFeatureIconPicker(${sIndex}, ${pIndex}, ${fIndex})" style="width: 38px; height: 38px; background: #fff; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; transition: border-color 0.2s;" onmouseover="this.style.borderColor='#0f3460'" onmouseout="this.style.borderColor='#ccc'">
                        <img src="/assets/icons/check.svg" style="width: 22px; height: 22px; object-fit: contain;">
                    </div>
                    <button type="button" onclick="openFeatureIconPicker(${sIndex}, ${pIndex}, ${fIndex})" style="padding: 4px 10px; cursor: pointer; font-size: 11px; background: #f0f0f0; color: #333; border: 1px solid #ccc; font-weight: normal;">Browse Library</button>
                </div>
            `;
            iconSourceDiv.innerHTML = '<label style="font-size:0.8rem;">Icon Source</label>' + iconInputHtml;
        }
    }
}

window.featuresCollapsedState = {};
window.benefitsCollapsedState = {};

window.toggleFeaturesSection = function (sIndex, pIndex) {
    const key = `${sIndex}-${pIndex}`;
    window.featuresCollapsedState[key] = !window.featuresCollapsedState[key];

    // Just toggle the display of the features section
    const featuresDiv = document.getElementById(`features-editor-${sIndex}-${pIndex}`);
    if (featuresDiv) {
        featuresDiv.style.display = window.featuresCollapsedState[key] ? 'block' : 'none';
    }

    // Update arrow rotation
    const arrow = document.querySelector(`#features-editor-${sIndex}-${pIndex}`).parentElement.querySelector('.dropdown-arrow');
    if (arrow) {
        arrow.style.transform = window.featuresCollapsedState[key] ? 'rotate(90deg)' : '';
    }
}

window.toggleBenefitsSection = function (sIndex, pIndex) {
    const key = `${sIndex}-${pIndex}`;
    window.benefitsCollapsedState[key] = !window.benefitsCollapsedState[key];

    // Just toggle the display of the benefits section
    const benefitsDiv = document.getElementById(`benefits-editor-${sIndex}-${pIndex}`);
    if (benefitsDiv) {
        benefitsDiv.style.display = window.benefitsCollapsedState[key] ? 'block' : 'none';
    }

    // Update arrow rotation
    const arrow = document.querySelector(`#benefits-editor-${sIndex}-${pIndex}`).parentElement.querySelector('.dropdown-arrow');
    if (arrow) {
        arrow.style.transform = window.benefitsCollapsedState[key] ? 'rotate(90deg)' : '';
    }
}

window.currentPickerTarget = null;

window.openFeatureIconPicker = function (sIndex, pIndex, fIndex) {
    window.currentPickerTarget = { type: 'feature', sIndex, pIndex, fIndex };
    const grid = document.getElementById('icon-grid');
    grid.innerHTML = '';

    apiIcons.forEach(iconPath => {
        const item = document.createElement('div');
        item.style.cssText = `
            cursor: pointer; border: 1px solid #ddd; padding: 10px; border-radius: 4px;
            display: flex; flex-direction: column; align-items: center; gap: 5px;
            transition: background 0.2s;
            background-color: #f8f9fa;
        `;
        item.onmouseover = () => item.style.borderColor = '#aaa';
        item.onmouseout = () => item.style.borderColor = '#ddd';
        item.onclick = () => {
            selectIconForFeature(iconPath);
        };

        item.innerHTML = `
            <img src="${assetUrl(iconPath)}" style="width: 32px; height: 32px; object-fit: contain;">
            <span style="font-size: 10px; word-break: break-all; text-align: center;">${iconPath.split('/').pop()}</span>
        `;
        grid.appendChild(item);
    });

    document.getElementById('icon-picker-modal').style.display = 'flex';
}

function selectIconForFeature(iconPath) {
    if (!window.currentPickerTarget || window.currentPickerTarget.type !== 'feature') return;
    const { sIndex, pIndex, fIndex } = window.currentPickerTarget;

    const feat = appData.productsPage.sections[sIndex].products[pIndex].features[fIndex];
    if (typeof feat === 'string') {
        appData.productsPage.sections[sIndex].products[pIndex].features[fIndex] = { title: feat, icon: iconPath, type: 'svg' };
    } else {
        feat.icon = iconPath;
        feat.type = 'svg'; // Always set to svg as it's from library
    }

    // Update the icon preview in the UI without full re-render
    const iconPreview = document.querySelector(`#features-editor-${sIndex}-${pIndex} .feature-item-row:nth-child(${fIndex + 1}) img`);
    if (iconPreview) {
        iconPreview.src = '/' + iconPath;
    }

    document.getElementById('icon-picker-modal').style.display = 'none';
}

window.openDepartmentIconPicker = function (deptIndex) {
    window.currentPickerTarget = { type: 'department', deptIndex };
    const grid = document.getElementById('icon-grid');
    grid.innerHTML = '';

    apiIcons.forEach(iconPath => {
        const item = document.createElement('div');
        item.style.cssText = `
            cursor: pointer; border: 1px solid #ddd; padding: 10px; border-radius: 4px;
            display: flex; flex-direction: column; align-items: center; gap: 5px;
            transition: background 0.2s;
            background-color: #f8f9fa;
        `;
        item.onmouseover = () => item.style.borderColor = '#aaa';
        item.onmouseout = () => item.style.borderColor = '#ddd';
        item.onclick = () => {
            selectIconForDepartment(iconPath);
        };

        item.innerHTML = `
            <img src="${assetUrl(iconPath)}" style="width: 32px; height: 32px; object-fit: contain;">
            <span style="font-size: 10px; word-break: break-all; text-align: center;">${iconPath.split('/').pop()}</span>
        `;
        grid.appendChild(item);
    });

    document.getElementById('icon-picker-modal').style.display = 'flex';
}

function selectIconForDepartment(iconPath) {
    if (!window.currentPickerTarget || window.currentPickerTarget.type !== 'department') return;
    const { deptIndex } = window.currentPickerTarget;

    const dept = appData.contactPage.departments[deptIndex];
    if (dept) {
        dept.icon = iconPath;
        // If we want to support types, we can add dept.iconType = 'svg'
    }

    // Refresh editor to show new icon
    renderSingleDepartmentEditor(deptIndex);

    document.getElementById('icon-picker-modal').style.display = 'none';
}


window.uploadProductVideo = async function (input, sIndex, pIndex) {
    const file = input.files[0];
    if (!file) return;
    if (file.type !== 'video/mp4') {
        alert('Only MP4 video files are supported. Please convert your video to MP4 format before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await uploadFileToS3(file, 'products');
        appData.productsPage.sections[sIndex].products[pIndex].video = filePath;
        const parent = input.parentElement;
        parent.querySelector('input[type=text]').value = filePath;
        let video = parent.querySelector('video');
        if (!video) {
            video = document.createElement('video');
            video.controls = true;
            video.style.cssText = 'width:100%; max-width:300px; margin-top:10px;';
            const source = document.createElement('source');
            source.type = 'video/mp4';
            video.appendChild(source);
            parent.appendChild(video);
        }
        video.querySelector('source').src = CONFIG.UPLOADS_BASE + '/' + filePath.replace(/^uploads\//, '');
        video.load();
    } catch (err) {
        console.error(err);
        alert('Error uploading video');
    }
}

window.uploadVideo = async function (input, path, index, field) {
    const file = input.files[0];
    if (!file) return;
    if (file.type !== 'video/mp4') {
        alert('Only MP4 video files are supported. Please convert your video to MP4 format before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await uploadFileToS3(file, 'videos');
        const parts = path.split('.');
        let target = appData;
        for (let i = 0; i < parts.length; i++) {
            if (Array.isArray(target)) { target = target[index]; }
            else if (target[parts[i]]) { target = target[parts[i]]; }
        }
        if (Array.isArray(target)) { target[index][field] = filePath; }
        else { target[field] = filePath; }
        const parent = input.parentElement;
        const textInput = parent.querySelector('input[type=text]');
        if (textInput) textInput.value = filePath;
        const videoPreview = parent.querySelector('video');
        if (videoPreview) { videoPreview.src = CONFIG.UPLOADS_BASE + '/' + filePath.replace(/^uploads\//, ''); videoPreview.load(); }
    } catch (err) {
        console.error(err);
        alert('Error uploading video');
    }
}

window.uploadProductImage = async function (input, sIndex, pIndex, field = 'image') {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'products');
        appData.productsPage.sections[sIndex].products[pIndex][field] = filePath;
        const parent = input.parentElement;
        parent.querySelector('input[type=text]').value = filePath;
        let img = parent.querySelector('img');
        if (!img) { img = document.createElement('img'); img.className = 'preview-img'; parent.appendChild(img); }
        img.src = CONFIG.UPLOADS_BASE + '/' + filePath.replace(/^uploads\//, '');
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    }
}


function renderHeroSlides() {
    const list = document.getElementById('hero-slides-list');
    if (!list) return;
    
    if (!appData.hero) appData.hero = {};
    const isHidden = appData.hero.hidden;
    
    list.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); ${isHidden ? 'opacity: 0.7;' : ''}">
            <h4 style="margin:0;">Hero Section ${isHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('hero', 'renderHeroSlides', 'hero-slides-list')" style="background:${isHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
    `;

    if (!appData.hero.slides) appData.hero.slides = [];

    appData.hero.slides.forEach((slide, index) => {
        const div = document.createElement('div');
        div.className = `item-card ${slide.hidden ? 'hidden-item' : ''}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h4 style="margin:0;">Slide #${index + 1} ${slide.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleHideItem('hero.slides', ${index}, 'renderHeroSlides')" style="background:${slide.hidden ? '#27ae60' : '#607d8b'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        ${slide.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deleteHeroSlide(${index})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Delete</button>
                </div>
            </div>
            <div class="form-group">
                <label>Image</label>
                <input type="file" onchange="uploadImage(this, 'hero.slides', ${index}, 'image')">
                <input type="text" value="${slide.image}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.5rem; color:#333;" placeholder="Image Path">
                ${slide.image ? `<img src="${assetUrl(slide.image)}" class="preview-img">` : ''}
            </div>
            <div class="form-group">
                <label>Accessibility Label</label>
                <input type="text" value="${slide.label || ''}" onchange="appData.hero.slides[${index}].label = this.value">
            </div>
        `;
        list.appendChild(div);
    });
}

window.addHeroSlide = function () {
    if (!appData.hero.slides) appData.hero.slides = [];
    appData.hero.slides.push({ image: "", label: "New Slide" });
    renderHeroSlides();
}

window.deleteHeroSlide = function (index) {
    if (confirm('Delete this slide?')) {
        appData.hero.slides.splice(index, 1);
        renderHeroSlides();
    }
}

// Helper to render lists dynamically
function renderList(containerId, dataArray, arrayName, fields, templateObj) {
    const container = document.getElementById(containerId);
    
    const isHidden = appData.sectionVisibility && appData.sectionVisibility[`${arrayName}Hidden`];
    const sectionTitleDisplay = arrayName.charAt(0).toUpperCase() + arrayName.slice(1).replace(/([A-Z])/g, ' $1').trim() + ' Section';
    
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); ${isHidden ? 'opacity: 0.7;' : ''}">
            <h4 style="margin:0;">${sectionTitleDisplay} ${isHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('${arrayName}', 'renderForms')" style="background:${isHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
    `;
    dataArray.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `item-card ${item.hidden ? 'hidden-item' : ''}`;
        if (item.hidden) div.style.opacity = '0.6';

        // Add delete and hide buttons
        let itemHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                <h4 style="margin:0;">Item #${index + 1} ${item.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleHideItem('${arrayName}', ${index}, 'renderListCallback')" data-array="${arrayName}" style="background:${item.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        ${item.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deleteItem('${arrayName}', ${index})" style="background:#e74c3c; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">Delete</button>
                </div>
            </div>
        `;

        fields.forEach(field => {
            const val = item[field] || '';
            const capitalizedLabel = field.charAt(0).toUpperCase() + field.slice(1);

            if (field === 'image' || field === 'logo' || field === 'icon') {
                // Image Upload Logic
                itemHtml += `
                    <div class="form-group">
                        <label>${capitalizedLabel}</label>
                        <input type="file" onchange="uploadImage(this, '${arrayName}', ${index}, '${field}')">
                        <input type="text" value="${escHtml(val)}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.5rem; color:#333;" placeholder="Image Path">
                        ${val ? `<img src="${assetUrl(val)}" class="preview-img">` : ''}
                    </div>
                `;
            } else if (field === 'description' || field === 'quote') {
                itemHtml += `
                    <div class="form-group">
                        <label>${capitalizedLabel}</label>
                        <textarea onchange="updateArrayField('${arrayName}', ${index}, '${field}', this.value)">${escHtml(val)}</textarea>
                    </div>
                `;
            } else {
                itemHtml += `
                    <div class="form-group">
                        <label>${capitalizedLabel}</label>
                        <input type="text" value="${escHtml(val)}" onchange="updateArrayField('${arrayName}', ${index}, '${field}', this.value)">
                    </div>
                `;
            }
        });

        div.innerHTML = itemHtml;
        container.appendChild(div);
    });

    // Add "Add New" button
    const addButton = document.createElement('button');
    addButton.className = 'add-item-btn';
    const defaultAddLabel = `+ Add New ${arrayName.slice(0, -1)}`;
    addButton.textContent = arrayName === 'whyUs' ? '+ Add New item' : defaultAddLabel;
    addButton.onclick = () => addItem(arrayName, templateObj);
    container.appendChild(addButton);
}

window.addItem = function (arrayName, templateObj) {
    if (!appData[arrayName]) appData[arrayName] = [];

    // Push new item
    // We clone the template to avoid reference issues
    const newItem = JSON.parse(JSON.stringify(templateObj));
    appData[arrayName].push(newItem);

    // Sync Logic: If adding a "Solution", also add a "Product Section"
    if (arrayName === 'solutions') {
        if (!appData.productsPage) appData.productsPage = { sections: [] };
        if (!appData.productsPage.sections) appData.productsPage.sections = [];

        const solId = generateId(newItem.title);
        newItem.id = solId; // Set ID on the solution too

        appData.productsPage.sections.push({
            id: solId,
            title: newItem.title,
            subtitle: newItem.description,
            products: []
        });

        // Refresh sidebar since we added a section
        renderProductSidebar();
    }

    // Re-render based on what array it is
    renderForms(); // Simple re-render of everything
}

function generateId(text) {
    return text.toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

window.deleteItem = function (arrayName, index) {
    if (confirm('Delete this item?')) {
        appData[arrayName].splice(index, 1);

        // Sync Logic: If deleting a "Solution", also delete the corresponding "Product Section"
        if (arrayName === 'solutions' && appData.productsPage && appData.productsPage.sections) {
            appData.productsPage.sections.splice(index, 1);

            // Handle active section index if needed
            if (window.currentProductSectionIndex === index) {
                window.currentProductSectionIndex = -1;
                document.getElementById('single-product-section-editor').classList.remove('active');
            } else if (window.currentProductSectionIndex > index) {
                window.currentProductSectionIndex--;
            }
            renderProductSidebar();
        }

        renderForms();
    }
}

window.updateArrayField = function (path, index, field, value) {
    // Update data model using path traversal
    let target = appData;
    const parts = path.split('.');
    for (const part of parts) {
        const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
        if (arrayMatch) {
            const name = arrayMatch[1];
            const idx = parseInt(arrayMatch[2]);
            if (!target[name]) target[name] = [];
            target = target[name][idx];
        } else {
            if (!target[part]) target[part] = {};
            target = target[part];
        }
    }
    target[index][field] = value;

    // Sync Logic: If updating "Solutions", reflect changes in "Product Sections"
    if (path === 'solutions') {
        if (!appData.productsPage) appData.productsPage = { sections: [] };
        if (!appData.productsPage.sections) appData.productsPage.sections = [];

        const section = appData.productsPage.sections[index];
        const solution = appData.solutions[index];

        if (section) {
            if (field === 'title') {
                section.title = value;
                section.id = generateId(value);
                solution.id = section.id; // Sync ID to solution
                renderProductSidebar(); // Update sidebar name
            } else if (field === 'description') {
                section.subtitle = value;
            }

            // Refresh Single Section Editor if it's the one currently open
            if (window.currentProductSectionIndex === index) {
                renderSingleSectionEditor(index);
            }
        }
    }
}

window.uploadImage = async function (input, arrayName, index, field, reRenderFnName) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const folderMap = {
            'hero.slides': 'hero',
            'stats': 'stats',
            'solutions': 'solutions',
            'testimonials': 'testimonials',
            'careersPage.intro.slides': 'careers-intro',
            'careersPage.whyJoin.cards': 'why-join',
            'careersPage.officeCulture.cards': 'office-culture',
        };
        let folder = folderMap[arrayName];
        if (!folder) {
            if (arrayName.startsWith('productsPage.')) folder = 'products';
            else if (arrayName.startsWith('careersPage.opportunities')) folder = 'career-opportunities';
            else folder = arrayName.replace(/[\[\].]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        }
        const filePath = await processAndUpload(file, folder);
        let target = appData;
        const parts = arrayName.split('.');
        for (const part of parts) {
            const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
            if (arrayMatch) {
                const name = arrayMatch[1];
                const idx = parseInt(arrayMatch[2]);
                if (!target[name]) target[name] = [];
                target = target[name][idx];
            } else {
                if (!target[part]) target[part] = {};
                target = target[part];
            }
        }
        if (index !== null && index !== undefined) { target[index][field] = filePath; }
        else { target[field] = filePath; }
        if (window.saveData) await window.saveData();
        if (reRenderFnName && typeof window[reRenderFnName] === 'function') {
            window[reRenderFnName]();
        } else {
            const parent = input.parentElement;
            const pathInput = parent.querySelector('input[type=text]');
            if (pathInput) pathInput.value = filePath;
            let img = parent.querySelector('img');
            if (!img) { img = document.createElement('img'); img.className = 'preview-img'; parent.appendChild(img); }
            img.src = CONFIG.UPLOADS_BASE + '/' + filePath.replace(/^uploads\//, '');
        }
    } catch (err) {
        console.error(err);
        alert('Error uploading file');
    }
}

window.changeEmail = async function () {
    const newEmail = document.getElementById('admin-email').value;
    const msg = document.getElementById('email-msg');

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        msg.style.color = 'red';
        msg.textContent = 'Please enter a valid email address';
        return;
    }

    try {
        await cognitoUpdateEmail(newEmail);
        msg.style.color = 'green';
        msg.textContent = 'Email updated successfully! Check your email to verify the change.';
    } catch (err) {
        msg.style.color = 'red';
        msg.textContent = err.message || 'Failed to update email';
        console.error(err);
    }
}

window.changeUsername = async function () {
    const msg = document.getElementById('username-msg');
    msg.style.color = 'orange';
    msg.textContent = 'Username changes are managed through the AWS Cognito console.';
}

window.changePassword = async function () {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const msg = document.getElementById('password-msg');

    if (!currentPassword || !newPassword || !confirmPassword) {
        msg.style.color = 'red'; msg.textContent = 'Please fill in all fields'; return;
    }
    if (newPassword !== confirmPassword) {
        msg.style.color = 'red'; msg.textContent = 'New passwords do not match'; return;
    }
    const strength = checkPasswordStrength(newPassword);
    if (strength.level === 'weak') {
        msg.style.color = 'red'; msg.textContent = 'Password is too weak. Please choose a stronger password.'; return;
    }

    try {
        await cognitoChangePassword(currentPassword, newPassword);
        msg.style.color = 'green';
        msg.textContent = 'Password updated successfully!';
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    } catch (err) {
        msg.style.color = 'red';
        msg.textContent = err.message || 'Failed to update password';
    }
}

async function saveData() {
    // Capture Hero & Problem fields

    // Titles/Subtitles are updated in-place via onchange in the list, no need to capture manually.
    // Just Problem remains manual inputs:

    if (appData.problem) {
        const problemTitleEl = document.getElementById('problem-title');
        const problemTitleColorEl = document.getElementById('problem-title-color');
        const problemTextEl = document.getElementById('problem-text');
        const problemTextColorEl = document.getElementById('problem-text-color');

        if (problemTitleEl) appData.problem.title = problemTitleEl.value;
        if (problemTitleColorEl) appData.problem.titleColor = problemTitleColorEl.value;
        if (problemTextEl) appData.problem.text = problemTextEl.value;
        if (problemTextColorEl) appData.problem.textColor = problemTextColorEl.value;
    }

    // Wrap each top-level value in { data: stringifiedJSON } to match DynamoDB storage format
    const payload = {};
    for (const key of Object.keys(appData)) {
        const val = appData[key];
        payload[key] = { data: (val !== null && typeof val === 'object') ? JSON.stringify(val) : val };
    }

    try {
        const res = await authenticatedFetch(CONFIG.API_BASE + '/content', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        let result;
        try {
            result = await res.json();
        } catch (err) {
            console.error('Failed to parse save response as JSON', err);
            alert('Save failed: invalid response from server.');
            return;
        }

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                alert('Authentication failed. Please log in again.');
                cognitoSignOut();
                location.reload();
                return;
            }
            alert(result?.message || 'Failed to update content.');
            return;
        }

        if (result.success) {
            alert("Content updated successfully!");
        } else {
            alert(result?.message || "Failed to update content.");
        }
    } catch (err) {
        console.error(err);
        alert("Error saving content.");
    }
}


// Timeline Management Functions
function loadTimelineItems() {
    const timelineList = document.getElementById('timeline-list');
    if (!timelineList) return;

    // Initialize timeline data if not exists
    if (!appData.timeline) {
        appData.timeline = [
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
            }
        ];
    }

    renderTimelineItems();
}

function renderTimelineItems() {
    const timelineList = document.getElementById('timeline-list');
    if (!timelineList) return;
    const isHidden = appData.sectionVisibility && appData.sectionVisibility.timelineHidden;
    timelineList.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); ${isHidden ? 'opacity: 0.7;' : ''}">
            <h4 style="margin:0;">Timeline Section ${isHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('timeline', 'renderTimelineItems')" style="background:${isHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
    `;

    if (!appData.timeline || appData.timeline.length === 0) {
        timelineList.innerHTML = '<p>No timeline items yet. Click "Add Timeline Event" to get started.</p>';
        return;
    }

    appData.timeline.forEach((item, index) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <div class="item-header">
                <h4>${item.title || 'Untitled Event'}</h4>
                <div class="item-actions">
                    <button onclick="moveTimelineItem(${index}, 'up')" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button onclick="moveTimelineItem(${index}, 'down')" ${index === appData.timeline.length - 1 ? 'disabled' : ''}>↓</button>
                    <button onclick="deleteTimelineItem(${index})" style="background: #e74c3c;">Delete</button>
                </div>
            </div>
            <div class="form-group">
                <label>Event Title</label>
                <input type="text" value="${item.title || ''}" onchange="updateTimelineItem(${index}, 'title', this.value)" placeholder="Enter event title">
            </div>
            <div class="form-group">
                <label>Year</label>
                <input type="text" value="${item.year || ''}" onchange="updateTimelineItem(${index}, 'year', this.value)" placeholder="e.g., 2020 or Year 5 - 2005">
            </div>
            <div class="form-group">
                <label>Position</label>
                <select onchange="updateTimelineItem(${index}, 'position', this.value)">
                    <option value="left" ${item.position === 'left' ? 'selected' : ''}>Left</option>
                    <option value="right" ${item.position === 'right' ? 'selected' : ''}>Right</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea onchange="updateTimelineItem(${index}, 'description', this.value)" placeholder="Enter event description" rows="4">${item.description || ''}</textarea>
            </div>
        `;
        timelineList.appendChild(itemCard);
    });
}

function addTimelineItem() {
    if (!appData.timeline) {
        appData.timeline = [];
    }

    const newItem = {
        id: Date.now(),
        title: "New Timeline Event",
        year: new Date().getFullYear().toString(),
        description: "Description of the new timeline event.",
        position: appData.timeline.length % 2 === 0 ? "left" : "right"
    };

    appData.timeline.push(newItem);

    renderTimelineItems();
}

function updateTimelineItem(index, field, value) {
    if (!appData.timeline || !appData.timeline[index]) return;

    appData.timeline[index][field] = value;
}

function moveTimelineItem(index, direction) {
    if (!appData.timeline || appData.timeline.length <= 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= appData.timeline.length) return;

    // Swap items
    [appData.timeline[index], appData.timeline[newIndex]] = [appData.timeline[newIndex], appData.timeline[index]];

    renderTimelineItems();
}

function deleteTimelineItem(index) {
    if (!appData.timeline || !confirm('Are you sure you want to delete this timeline event?')) return;

    appData.timeline.splice(index, 1);

    renderTimelineItems();
}

// Who We Are Section Management
function renderWhoWeAreSection(container) {
    if (!container) return;

    // Initialize whoWeAre data if not exists
    if (!appData.whoWeAre) {
        appData.whoWeAre = {
            title: "Who We Are",
            content: "eScience grew out of a passion for innovation and mobile technology. We are a team of software engineers, designers, and business development specialists with more than 2 decades of experience in building mobile applications. We are pioneers in providing high-impact products and services that capitalize on emerging mobile technologies such as Mobile Tablets (Android and iOS), 5G, and location based services."
        };
    }

    container.innerHTML = `
        <div class="who-we-are-editor ${appData.whoWeAre.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Who We Are Section ${appData.whoWeAre.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('whoWeAre', 'renderWhoWeAreSection', '${container.id}')" style="background:${appData.whoWeAre.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${appData.whoWeAre.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" id="who-we-are-title" value="${appData.whoWeAre.title}" 
                       onchange="updateWhoWeAreData('title', this.value)">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="who-we-are-content" rows="6" 
                          onchange="updateWhoWeAreData('content', this.value)">${appData.whoWeAre.content}</textarea>
            </div>

        </div>
    `;
}

function updateWhoWeAreData(field, value) {
    if (!appData.whoWeAre) appData.whoWeAre = {};
    appData.whoWeAre[field] = value;
}



// Family Culture Section Management
function renderFamilyCultureSection(container) {
    if (!container) return;

    if (!appData.familyCulture) {
        appData.familyCulture = {
            title: "Family Culture",
            content: "We foster a collaborative and supportive environment where every team member is valued. Our culture is built on trust, respect, and shared success.",
            imageUrl: "assets/family-culture-img.jpeg"
        };
    }

    container.innerHTML = `
        <div class="family-culture-editor ${appData.familyCulture.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Family Culture Section ${appData.familyCulture.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('familyCulture', 'renderFamilyCultureSection', '${container.id}')" style="background:${appData.familyCulture.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${appData.familyCulture.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" id="family-culture-title" value="${appData.familyCulture.title}" 
                       onchange="updateFamilyCultureData('title', this.value)">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="family-culture-content" rows="6" 
                          onchange="updateFamilyCultureData('content', this.value)">${appData.familyCulture.content}</textarea>
            </div>
            <div class="form-group">
                <label>Visual Card Image</label>
                <input type="file" id="family-culture-image" accept="image/*" 
                       onchange="handleFamilyCultureImageUpload(this)">
                <div class="image-preview" style="margin-top: 10px;">
                    ${appData.familyCulture.imageUrl ? `<img src="${assetUrl(appData.familyCulture.imageUrl)}" alt="Current image" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">` : '<p>No image uploaded</p>'}
                </div>
            </div>
        </div>
    `;
}

function updateFamilyCultureData(field, value) {
    if (!appData.familyCulture) appData.familyCulture = {};
    appData.familyCulture[field] = value;
}

window.handleFamilyCultureImageUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'family-culture');
        updateFamilyCultureData('imageUrl', filePath);
        const preview = document.querySelector('#family-culture-image').nextElementSibling;
        preview.innerHTML = `<img src="${CONFIG.UPLOADS_BASE}/${filePath.replace(/^uploads\//, '')}" alt="Uploaded image" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">`;
        saveData();
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    }
}

// Vision Section Management
function renderVisionSection(container) {
    if (!container) return;

    if (!appData.vision) {
        appData.vision = {
            title: "Vision",
            content: "To be the global leader in mobile enterprise solutions, recognized for our commitment to innovation, quality, and customer success."
        };
    }

    container.innerHTML = `
        <div class="vision-editor ${appData.vision.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Vision Section ${appData.vision.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('vision', 'renderVisionSection', '${container.id}')" style="background:${appData.vision.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${appData.vision.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" id="vision-title" value="${appData.vision.title}" 
                       onchange="updateVisionData('title', this.value)">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="vision-content" rows="6" 
                          onchange="updateVisionData('content', this.value)">${appData.vision.content}</textarea>
            </div>
            <div class="form-group">
                <label>Visual Card Image</label>
                <input type="file" id="vision-image" accept="image/*" 
                       onchange="handleVisionImageUpload(this)">
                <div class="image-preview" style="margin-top: 10px;">
                    ${appData.vision.imageUrl ? `<img src="${assetUrl(appData.vision.imageUrl)}" alt="Current image" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">` : '<p>No image uploaded</p>'}
                </div>
            </div>
        </div>
    `;
}

function updateVisionData(field, value) {
    if (!appData.vision) appData.vision = {};
    appData.vision[field] = value;
}

window.handleVisionImageUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'vision');
        updateVisionData('imageUrl', filePath);
        const preview = document.querySelector('#vision-image').nextElementSibling;
        preview.innerHTML = `<img src="${CONFIG.UPLOADS_BASE}/${filePath.replace(/^uploads\//, '')}" alt="Uploaded image" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">`;
        saveData();
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    }
}

// Mission Section Management
function renderMissionSection(container) {
    if (!container) return;

    if (!appData.mission) {
        appData.mission = {
            title: "Mission",
            content: "To empower businesses with innovative mobile solutions that drive productivity, efficiency, and growth through real-time data access and intelligent automation.",
            imageUrl: "assets/mission-img.jpeg"
        };
    }

    container.innerHTML = `
        <div class="mission-editor ${appData.mission.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Mission Section ${appData.mission.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('mission', 'renderMissionSection', '${container.id}')" style="background:${appData.mission.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${appData.mission.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" id="mission-title" value="${appData.mission.title}" 
                       onchange="updateMissionData('title', this.value)">
            </div>
            <div class="form-group">
                <label>Content</label>
                <textarea id="mission-content" rows="6" 
                          onchange="updateMissionData('content', this.value)">${appData.mission.content}</textarea>
            </div>
            <div class="form-group">
                <label>Visual Card Image</label>
                <input type="file" id="mission-image" accept="image/*" 
                       onchange="handleMissionImageUpload(this)">
                <div class="image-preview" style="margin-top: 10px;">
                    ${appData.mission.imageUrl ? `<img src="${assetUrl(appData.mission.imageUrl)}" alt="Current image" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">` : '<p>No image uploaded</p>'}
                </div>
            </div>
        </div>
    `;
}

function updateMissionData(field, value) {
    if (!appData.mission) appData.mission = {};
    appData.mission[field] = value;
}

window.handleMissionImageUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'mission');
        updateMissionData('imageUrl', filePath);
        const preview = document.querySelector('#mission-image').nextElementSibling;
        preview.innerHTML = `<img src="${CONFIG.UPLOADS_BASE}/${filePath.replace(/^uploads\//, '')}" alt="Uploaded image" style="max-width: 200px; max-height: 150px; border: 1px solid #ddd; border-radius: 4px;">`;
        saveData();
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    }
}
// --- Our Leaders Logic ---

function renderLeadersSection(container) {
    if (!container) return;

    if (!appData.leaders) {
        appData.leaders = {
            title: "Our Leaders",
            description: "eScience is home to technology experts, unmatched industry knowledge, and timely response. We have the most talented, passionate, and committed IT experts, business development and customer specialists who share the essential core values that define our organization: Integrity, God-centeredness, Excellence, Innovation, Teamwork, and Customer focus.",
            list: [
                { name: "Ricky Dagelet", role: "CEO", image: "assets/ceo_profile.png" },
                { name: "Alvin Fabella", role: "COO", image: "assets/coo_profile.png" },
                { name: "Brenda Dagelet", role: "Vice President", image: "assets/vp_profile.png" }
            ]
        };
    }

    container.innerHTML = `
        <div class="leaders-editor ${appData.leaders.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Our Leaders Section ${appData.leaders.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('leaders', 'renderLeadersSection', '${container.id}')" style="background:${appData.leaders.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${appData.leaders.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" id="leaders-title" value="${appData.leaders.title}" 
                       onchange="updateLeadersHeader('title', this.value)">
            </div>
            <div class="form-group">
                <label>Section Description</label>
                <textarea id="leaders-description" rows="3" 
                          onchange="updateLeadersHeader('description', this.value)">${appData.leaders.description}</textarea>
            </div>
            
            <div id="leaders-items-container"></div>
        </div>
    `;

    renderLeaderItems();
}

function renderLeaderItems() {
    const listContainer = document.getElementById('leaders-items-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    appData.leaders.list.forEach((leader, index) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <h4>Leader #${index + 1}</h4>
                <button onclick="deleteLeader(${index})" class="delete-btn" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Delete</button>
            </div>
            
            <div class="form-group">
                <label>Name</label>
                <input type="text" value="${leader.name}" onchange="updateLeaderData(${index}, 'name', this.value)">
            </div>
            
            <div class="form-group">
                <label>Role</label>
                <input type="text" value="${leader.role}" onchange="updateLeaderData(${index}, 'role', this.value)">
            </div>
            
            <div class="form-group">
                <label>Profile Image</label>
                <input type="file" accept="image/*" onchange="handleLeaderImageUpload(this, ${index})">
                <div class="image-preview" style="margin-top: 10px;">
                    ${leader.image ? `<img src="${assetUrl(leader.image)}" alt="Profile" style="max-width: 150px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">` : '<p>No image uploaded</p>'}
                </div>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

window.updateLeadersHeader = function (field, value) {
    appData.leaders[field] = value;
};

window.addLeader = function () {
    if (!appData.leaders) appData.leaders = { list: [] };
    if (!appData.leaders.list) appData.leaders.list = [];

    appData.leaders.list.push({
        name: "New Leader",
        role: "Position",
        image: ""
    });

    renderLeadersSection(document.getElementById('leaders-list'));
};

window.deleteLeader = function (index) {
    if (confirm('Delete this leader?')) {
        appData.leaders.list.splice(index, 1);
        renderLeaderItems();
    }
};

window.updateLeaderData = function (index, field, value) {
    appData.leaders.list[index][field] = value;
};

window.handleLeaderImageUpload = async function (input, index) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'leaders');
        appData.leaders.list[index].image = filePath;
        renderLeaderItems();
        if (window.saveData) await window.saveData();
    } catch (err) {
        console.error('Error uploading leader image:', err);
        alert('Error uploading image.');
    }
};

// Perks & Benefits Section Management
function renderPerksSection(container) {
    if (!container) return;

    if (!appData.perks) {
        appData.perks = {
            title: "Employee Perks & Benefits",
            description: "We care about our employees and provide a comprehensive benefits package to support their growth, health, and well-being.",
            list: [
                { title: "Health Insurance", description: "Comprehensive medical and dental coverage.", image: "assets/perk-health.png" },
                { title: "Growth Opportunities", description: "Continuous learning and professional development.", image: "assets/perk-growth.png" },
                { title: "Great Culture", description: "A supportive and family-oriented environment.", image: "assets/perk-culture.png" }
            ]
        };
    }

    container.innerHTML = `
        <div class="perks-editor ${appData.perks.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Perks Section ${appData.perks.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('perks', 'renderPerksSection', '${container.id}')" style="background:${appData.perks.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${appData.perks.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" id="perks-title" value="${appData.perks.title}" 
                       onchange="updatePerksHeader('title', this.value)">
            </div>
            <div class="form-group">
                <label>Section Description</label>
                <textarea id="perks-description" rows="3" 
                          onchange="updatePerksHeader('description', this.value)">${appData.perks.description}</textarea>
            </div>
            
            <div id="perks-items-container"></div>
        </div>
    `;

    renderPerkItems();
}

function renderPerkItems() {
    const listContainer = document.getElementById('perks-items-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    appData.perks.list.forEach((perk, index) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <h4 style="margin:0;">Perk #${index + 1} ${perk.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleHideItem('perks.list', ${index}, 'renderPerkItems')" style="background:${perk.hidden ? '#27ae60' : '#607d8b'}; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.85rem;">
                        ${perk.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deletePerk(${index})" class="delete-btn" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.85rem;">Delete</button>
                </div>
            </div>
            
            <div class="form-group">
                <label>Title</label>
                <input type="text" value="${perk.title}" onchange="updatePerkValue(${index}, 'title', this.value)">
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea rows="2" onchange="updatePerkValue(${index}, 'description', this.value)">${perk.description}</textarea>
            </div>
            
            <div class="form-group">
                <label>Benefit Image</label>
                <input type="file" accept="image/*" onchange="handlePerkImageUpload(this, ${index})">
                <div class="image-preview" style="margin-top: 10px;">
                    ${perk.image ? `<img src="${assetUrl(perk.image)}" alt="Perk Image" style="max-width: 150px; max-height: 150px; border-radius: 4px; border: 1px solid #ddd;">` : '<p>No image uploaded</p>'}
                </div>
            </div>
        `;
        listContainer.appendChild(div);
    });
}

window.updatePerksHeader = function (field, value) {
    appData.perks[field] = value;
};

window.addPerk = function () {
    if (!appData.perks.list) appData.perks.list = [];
    appData.perks.list.push({ title: "New Perk", description: "Perk description here.", image: "" });
    renderPerkItems();
};

window.deletePerk = function (index) {
    if (confirm('Delete this perk?')) {
        appData.perks.list.splice(index, 1);
        renderPerkItems();
    }
};

window.updatePerkValue = function (index, field, value) {
    appData.perks.list[index][field] = value;
};

window.handlePerkImageUpload = async function (input, index) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'perks');
        appData.perks.list[index].image = filePath;
        renderPerkItems();
        if (window.saveData) await window.saveData();
    } catch (err) {
        console.error('Error uploading perk image:', err);
        alert('Error uploading image.');
    }
}

// Load page content when editor is opened
async function loadPageContent(page) {
    const textareaId = `${page}-content`;
    const textarea = document.getElementById(textareaId);
    const msgId = `${page}-msg`;
    const msgEl = document.getElementById(msgId);

    if (!textarea) return;

    try {
        const pagePath = {
            'careers': '../nav-pages/careers.html',
            'blog': '../nav-pages/blog.html',
            'contact': '../nav-pages/contact-us.html'
        }[page];

        if (!pagePath) throw new Error('Invalid page');

        const response = await fetch(pagePath);
        if (!response.ok) throw new Error('Failed to load page');

        const content = await response.text();
        textarea.value = content;
        msgEl.textContent = '✓ Page loaded successfully';
        msgEl.style.color = '#27ae60';
    } catch (err) {
        console.error(`Error loading ${page} page:`, err);
        msgEl.textContent = `✗ Error loading page: ${err.message}`;
        msgEl.style.color = '#e74c3c';
    }
}

// Save page content
window.savePageContent = async function (page) {
    const textareaId = `${page}-content`;
    const textarea = document.getElementById(textareaId);
    const msgId = `${page}-msg`;
    const msgEl = document.getElementById(msgId);

    if (!textarea) return;

    const content = textarea.value;

    if (!content.trim()) {
        msgEl.textContent = '✗ Content cannot be empty';
        msgEl.style.color = '#e74c3c';
        return;
    }

    try {
        const response = await authenticatedFetch(CONFIG.API_BASE + '/save-page', {
            method: 'POST',
            body: JSON.stringify({
                page: page,
                content: content
            })
        });

        if (!response.ok) throw new Error('Failed to save page');

        const result = await response.json();
        msgEl.textContent = '✓ Page saved successfully!';
        msgEl.style.color = '#27ae60';
    } catch (err) {
        console.error(`Error saving ${page} page:`, err);
        msgEl.textContent = `✗ Error saving page: ${err.message}`;
        msgEl.style.color = '#e74c3c';
    }
};

// --- Careers Hero & Intro ---
window.renderCareersHeroEditor = function () {
    const data = appData.careersPage;
    const introContainer = document.getElementById('careers-intro-editor');
    if (!introContainer) return;

    introContainer.innerHTML = `
        <div class="item-card premium-card">
            <h4>Intro Section (Be Part of Our Growing Family)</h4>
            <div class="form-group">
                <label>Intro Title</label>
                <input type="text" value="${data.intro.title}" onchange="appData.careersPage.intro.title = this.value">
            </div>
            <div class="form-group">
                <label>Intro Description</label>
                <textarea rows="4" onchange="appData.careersPage.intro.description = this.value">${data.intro.description}</textarea>
            </div>
            <div id="intro-slides-container"></div>
            <button class="add-btn" onclick="addIntroSlide()" style="margin-top: 15px;">+ Add Slide Image</button>
        </div>
    `;
    renderIntroSlides();
}

window.renderIntroSlides = function () {
    const list = document.getElementById('intro-slides-container');
    if (!list) return;
    list.innerHTML = '';

    appData.careersPage.intro.slides.forEach((slide, index) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.style.background = 'rgba(255,255,255,0.03)';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h5>Slide #${index + 1}</h5>
                <button onclick="deleteIntroSlide(${index})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Remove</button>
            </div>
            <div class="form-group">
                <label>Image</label>
                <input type="file" accept="image/*,video/*" onchange="uploadImage(this, 'careersPage.intro.slides', ${index}, 'image', 'renderIntroSlides')">
                <input type="text" value="${slide.image || ''}" placeholder="Image path" readonly style="margin-top:5px; background:rgba(0,0,0,0.1);">
                <div class="image-preview" style="margin-top:10px;">
                    ${slide.image ? `<img src="${assetUrl(slide.image)}" style="max-width:150px; border-radius:8px; border:1px solid #ddd;">` : ''}
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

window.addIntroSlide = function () {
    appData.careersPage.intro.slides.push({ image: '' });
    renderIntroSlides();
};

window.deleteIntroSlide = function (index) {
    if (!confirm('Delete this slide?')) return;
    appData.careersPage.intro.slides.splice(index, 1);
    renderIntroSlides();
};

// --- Why Join Us ---
function renderWhyJoinEditor() {
    const data = appData.careersPage.whyJoin;
    const container = document.getElementById('why-join-editor');
    if (!container) return;

    container.innerHTML = `
        <div class="item-card premium-card ${data.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Why Join eScience? ${data.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('careersPage.whyJoin', 'renderWhyJoinEditor', 'why-join-editor')" style="background:${data.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${data.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Section Title</label>
                <input type="text" value="${data.title}" onchange="appData.careersPage.whyJoin.title = this.value">
            </div>
            <div class="form-group">
                <label>Section Subtitle</label>
                <input type="text" value="${data.subtitle}" onchange="appData.careersPage.whyJoin.subtitle = this.value">
            </div>
            <div id="why-join-cards-container"></div>
        </div>
    `;
    renderWhyJoinCards();
}

function renderWhyJoinCards() {
    const list = document.getElementById('why-join-cards-container');
    if (!list) return;
    list.innerHTML = '';

    appData.careersPage.whyJoin.cards.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = `item-card ${card.hidden ? 'hidden-item' : ''}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h5 style="margin:0;">Card #${index + 1} ${card.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h5>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleHideItem('careersPage.whyJoin.cards', ${index}, 'renderWhyJoinCards')" style="background:${card.hidden ? '#27ae60' : '#607d8b'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        ${card.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deleteWhyJoinCard(${index})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Remove</button>
                </div>
            </div>
            <div class="form-group">
                <label>Card Image</label>
                <div class="image-preview-container" style="margin-bottom: 10px;">
                    ${card.image ? `<img src="${assetUrl(card.image)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; display: block;">` : '<div style="width: 50px; height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 4px; margin-bottom: 10px;">No Image</div>'}
                </div>
                <input type="file" onchange="uploadImage(this, 'careersPage.whyJoin.cards', ${index}, 'image', 'renderWhyJoinCards')">
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" value="${card.title || ''}" onchange="appData.careersPage.whyJoin.cards[${index}].title = this.value">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea rows="2" onchange="appData.careersPage.whyJoin.cards[${index}].description = this.value">${card.description || ''}</textarea>
            </div>
            
            <!-- Gallery Management -->
            <div class="form-group" style="background: rgba(0,0,0,0.02); padding: 15px; border-radius: 8px; margin-top: 15px;">
                <label style="display:block; margin-bottom:10px; font-weight:600;">Gallery Images & Videos</label>
                <div class="gallery-preview-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; margin-bottom: 15px;">
                    ${(card.galleryImages || []).map((img, imgIndex) => {
            const isVideo = img.match(/\.(mp4|webm|ogg)$/i);
            const mediaTag = isVideo
                ? `<video src="${assetUrl(img)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid #ddd;" muted loop autoplay></video>`
                : `<img src="${assetUrl(img)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid #ddd;">`;
            return `
                        <div style="position: relative; aspect-ratio: 1/1;">
                            ${mediaTag}
                            <button onclick="deleteWhyJoinGalleryImage(${index}, ${imgIndex})" style="position:absolute; top:-8px; right:-8px; background:#ff4444; color:white; border:2px solid white; border-radius:50%; width:24px; height:24px; padding:0; min-width:0; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    `}).join('')}
                </div>
                
                <input type="file" id="gallery-upload-${index}" style="display: none;" accept="image/*,video/*" onchange="uploadWhyJoinGalleryImage(this, ${index})">
                <button onclick="document.getElementById('gallery-upload-${index}').click()" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">+ Add Gallery Media</button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.addWhyJoinCard = function () {
    appData.careersPage.whyJoin.cards.push({ icon: '🚀', image: '', title: 'New Card', description: '', gradient: '', galleryImages: [] });
    renderWhyJoinCards();
};

window.deleteWhyJoinCard = function (index) {
    if (!confirm('Are you sure you want to remove this card?')) return;
    appData.careersPage.whyJoin.cards.splice(index, 1);
    renderWhyJoinCards();
};

window.uploadWhyJoinGalleryImage = async function (input, cardIndex) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidMediaFile(file)) {
        alert('Only JPEG, PNG, and GIF images, and MP4 videos are accepted. Please convert your file to a supported format before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'why-join');
        if (!appData.careersPage.whyJoin.cards[cardIndex].galleryImages) {
            appData.careersPage.whyJoin.cards[cardIndex].galleryImages = [];
        }
        appData.careersPage.whyJoin.cards[cardIndex].galleryImages.push(filePath);
        await saveData();
        renderWhyJoinCards();
    } catch (error) {
        console.error('Error uploading gallery image:', error);
        alert('Error uploading image');
    }
};

window.deleteWhyJoinGalleryImage = async function (cardIndex, imgIndex) {
    if (!confirm('Remove this image from gallery?')) return;

    if (appData.careersPage.whyJoin.cards[cardIndex] && appData.careersPage.whyJoin.cards[cardIndex].galleryImages) {
        appData.careersPage.whyJoin.cards[cardIndex].galleryImages.splice(imgIndex, 1);
        await saveData();
        renderWhyJoinCards();
    }
};

// --- Our Culture ---
function renderOurCultureEditor() {
    const data = appData.careersPage;
    const container = document.getElementById('team-culture-editor');
    if (!container) return;

    container.innerHTML = `
        <div class="item-card premium-card ${data.teamCulture.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Meet Our Team (Culture Video) ${data.teamCulture.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('careersPage.teamCulture', 'renderOurCultureEditor', 'team-culture-editor')" style="background:${data.teamCulture.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${data.teamCulture.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" value="${data.teamCulture.title}" onchange="appData.careersPage.teamCulture.title = this.value">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea rows="2" onchange="appData.careersPage.teamCulture.description = this.value">${data.teamCulture.description}</textarea>
            </div>
            <div class="form-group">
                <label>Video</label>
                <input type="file" accept="video/*" onchange="uploadVideo(this, 'careersPage.teamCulture', 0, 'videoUrl')">
                <input type="text" value="${data.teamCulture.videoUrl}" placeholder="Video path" readonly style="margin-top:5px; background:rgba(0,0,0,0.1);">
                ${data.teamCulture.videoUrl ? `<video controls style="max-width:300px; margin-top:10px;"><source src="${assetUrl(data.teamCulture.videoUrl)}" type="video/mp4"></video>` : ''}
            </div>
        </div>
    `;

    const cultureContainer = document.getElementById('office-culture-editor');
    if (!cultureContainer) return;

    cultureContainer.innerHTML = `
        <div class="item-card premium-card ${data.officeCulture.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Office Culture & Events (Gallery) ${data.officeCulture.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('careersPage.officeCulture', 'renderOurCultureEditor', 'office-culture-editor')" style="background:${data.officeCulture.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${data.officeCulture.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" value="${data.officeCulture.title}" onchange="appData.careersPage.officeCulture.title = this.value">
            </div>
            <div class="form-group">
                <label>Subtitle</label>
                <input type="text" value="${data.officeCulture.subtitle}" onchange="appData.careersPage.officeCulture.subtitle = this.value">
            </div>
            <div id="office-culture-cards-container"></div>
        </div>
    `;
    renderOfficeCultureCards();
}

function renderOfficeCultureCards() {
    const list = document.getElementById('office-culture-cards-container');
    if (!list) return;
    list.innerHTML = '';

    appData.careersPage.officeCulture.cards.forEach((card, index) => {
        const div = document.createElement('div');
        div.className = `item-card ${card.hidden ? 'hidden-item' : ''}`;
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h5 style="margin:0;">Card #${index + 1} ${card.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h5>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleHideItem('careersPage.officeCulture.cards', ${index}, 'renderOfficeCultureCards')" style="background:${card.hidden ? '#27ae60' : '#607d8b'}; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                        ${card.hidden ? 'Show' : 'Hide'}
                    </button>
                    <button onclick="deleteOfficeCultureCard(${index})" style="background:#e74c3c; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Remove</button>
                </div>
            </div>
            <div class="form-group">
                <label>Card Image</label>
                <div class="image-preview-container" style="margin-bottom: 10px;">
                    ${card.image ? `<img src="${assetUrl(card.image)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; display: block;">` : '<div style="width: 50px; height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; border-radius: 4px; margin-bottom: 10px;">No Image</div>'}
                </div>
                <input type="file" onchange="uploadImage(this, 'careersPage.officeCulture.cards', ${index}, 'image', 'renderOfficeCultureCards')">
            </div>
            <div class="form-group">
                <label>Title</label>
                <input type="text" value="${card.title || ''}" onchange="appData.careersPage.officeCulture.cards[${index}].title = this.value">
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea rows="2" onchange="appData.careersPage.officeCulture.cards[${index}].description = this.value">${card.description || ''}</textarea>
            </div>
            
            <!-- Gallery Management -->
            <div class="form-group" style="background: rgba(0,0,0,0.02); padding: 15px; border-radius: 8px; margin-top: 15px;">
                <label style="display:block; margin-bottom:10px; font-weight:600;">Gallery Images & Videos</label>
                <div class="gallery-preview-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; margin-bottom: 15px;">
                    ${(card.galleryImages || []).map((img, imgIndex) => {
            const isVideo = img.match(/\.(mp4|webm|ogg)$/i);
            const mediaTag = isVideo
                ? `<video src="${assetUrl(img)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid #ddd;" muted loop autoplay></video>`
                : `<img src="${assetUrl(img)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid #ddd;">`;
            return `
                        <div style="position: relative; aspect-ratio: 1/1;">
                            ${mediaTag}
                            <button onclick="deleteOfficeCultureGalleryImage(${index}, ${imgIndex})" style="position:absolute; top:-8px; right:-8px; background:#ff4444; color:white; border:2px solid white; border-radius:50%; width:24px; height:24px; padding:0; min-width:0; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    `}).join('')}
                </div>
                
                <input type="file" id="office-gallery-upload-${index}" style="display: none;" accept="image/*,video/*" onchange="uploadOfficeCultureGalleryImage(this, ${index})">
                <button onclick="document.getElementById('office-gallery-upload-${index}').click()" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">+ Add Gallery Media</button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.addOfficeCultureCard = function () {
    appData.careersPage.officeCulture.cards.push({ icon: '🎉', image: '', title: 'Team Events', description: '', gradient: '', galleryImages: [] });
    renderOfficeCultureCards();
};

window.deleteOfficeCultureCard = function (index) {
    if (!confirm('Delete this culture card?')) return;
    appData.careersPage.officeCulture.cards.splice(index, 1);
    renderOfficeCultureCards();
};

window.uploadOfficeCultureGalleryImage = async function (input, cardIndex) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidMediaFile(file)) {
        alert('Only JPEG, PNG, and GIF images, and MP4 videos are accepted. Please convert your file to a supported format before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'office-culture');
        if (!appData.careersPage.officeCulture.cards[cardIndex].galleryImages) {
            appData.careersPage.officeCulture.cards[cardIndex].galleryImages = [];
        }
        appData.careersPage.officeCulture.cards[cardIndex].galleryImages.push(filePath);
        await saveData();
        renderOfficeCultureCards();
    } catch (error) {
        console.error('Error uploading gallery image:', error);
        alert('Error uploading image');
    }
};

window.deleteOfficeCultureGalleryImage = async function (cardIndex, imgIndex) {
    if (!confirm('Remove this image from gallery?')) return;

    if (appData.careersPage.officeCulture.cards[cardIndex] && appData.careersPage.officeCulture.cards[cardIndex].galleryImages) {
        appData.careersPage.officeCulture.cards[cardIndex].galleryImages.splice(imgIndex, 1);
        await saveData();
        renderOfficeCultureCards();
    }
};

// --- Career Opportunities ---
// Track selected career opportunity
window.currentCareerType = null;
window.currentCareerIndex = null;
// Track open/close state of sidebar sections
window.isJobsSectionOpen = false;
window.isInternshipsSectionOpen = false;

// Render the Careers sidebar with dropdowns for Jobs and Internships
window.renderCareersJobsSidebar = function () {
    const container = document.getElementById('careers-jobs-sidebar');
    if (!container) return;
    container.innerHTML = '';

    // Helper to render a section
    const renderSection = (title, items, type) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'section-item';

        // Determine if open
        const isOpen = type === 'jobs' ? window.isJobsSectionOpen : window.isInternshipsSectionOpen;
        if (isOpen) sectionDiv.classList.add('active-tab');

        // Header
        const header = document.createElement('div');
        header.className = 'section-header-row';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'dropdown-arrow';
        arrowSpan.textContent = '▶';
        header.appendChild(titleSpan);
        header.appendChild(arrowSpan);
        header.onclick = () => {
            if (type === 'jobs') window.isJobsSectionOpen = !window.isJobsSectionOpen;
            else window.isInternshipsSectionOpen = !window.isInternshipsSectionOpen;

            // Re-render to update state class (or toggle directly)
            renderCareersJobsSidebar();
        };

        sectionDiv.appendChild(header);

        const listUl = document.createElement('ul');
        listUl.className = 'product-list-sidebar';

        items.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'product-item-sidebar';

            // Highlight active item
            if (window.currentCareerType === type && window.currentCareerIndex === index) {
                li.classList.add('active-tab');
            }

            li.textContent = item.title || `${type === 'jobs' ? 'Job' : 'Internship'} #${index + 1}`;
            li.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectCareerOpportunity(type, index);
            };
            listUl.appendChild(li);
        });

        // Add Button
        const addLi = document.createElement('li');
        addLi.className = 'product-item-sidebar';
        addLi.style.color = '#27ae60';
        addLi.textContent = `+ Add ${type === 'jobs' ? 'Job' : 'Internship'} Listing`;
        addLi.onclick = (e) => {
            e.stopPropagation();
            addCareerOpportunity(type);
        };
        listUl.appendChild(addLi);

        sectionDiv.appendChild(listUl);
        return sectionDiv;
    };

    const jobs = appData.careersPage?.opportunities?.jobs || [];
    const internships = appData.careersPage?.opportunities?.internships || [];

    container.appendChild(renderSection('Full-Time Jobs', jobs, 'jobs'));
    container.appendChild(renderSection('Internships', internships, 'internships'));
};

// Select a career opportunity to edit
window.selectCareerOpportunity = function (type, index) {
    window.currentCareerType = type;
    window.currentCareerIndex = index;

    // Update sidebar highlighting
    renderCareersJobsSidebar();

    // Show the editor section (reuse existing container or a new one?)
    // Existing logic used 'career-opportunities' section.
    // We need to hide all other sections and show this one.
    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));

    const editorSection = document.getElementById('career-opportunities');
    if (editorSection) {
        editorSection.classList.add('active');
        // Render the single editor inside it
        renderSingleCareerOpportunityEditor(type, index);
    }
};

// Render single editor form
window.renderSingleCareerOpportunityEditor = function (type, index) {
    const container = document.getElementById('career-opportunities');
    if (!container) return;

    const item = appData.careersPage?.opportunities?.[type]?.[index];
    if (!item) {
        container.innerHTML = '<p style="padding:20px;">Item not found.</p>';
        return;
    }

    container.innerHTML = `
        <div class="item-card premium-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                <h4 style="margin:0;">Edit ${type === 'jobs' ? 'Job' : 'Internship'}: ${item.title}</h4>
                <button onclick="deleteCareerListing('${type}', ${index})" style="background:#e74c3c; color:white; border:none; padding:8px 16px; border-radius:4px; cursor:pointer;">Delete Listing</button>
            </div>
            
            <div class="form-group">
                <label>Title</label>
                <input type="text" value="${item.title || ''}" onchange="updateCareerOpportunity('${type}', ${index}, 'title', this.value)">
            </div>
            <div class="form-group">
                <label>Description (Short)</label>
                <textarea rows="3" onchange="updateCareerOpportunity('${type}', ${index}, 'description', this.value)">${item.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Image</label>
                 <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="flex: 1;">
                         <input type="file" onchange="uploadImage(this, 'careersPage.opportunities.${type}', ${index}, 'image')">
                         <input type="text" value="${item.image || ''}" placeholder="Image path" readonly style="margin-top:5px; background:rgba(0,0,0,0.1); width: 100%;">
                    </div>
                     <div class="image-preview" style="width: 100px; height: 100px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; background: #f9f9f9; overflow: hidden; border-radius: 4px;">
                        ${item.image ? `<img src="${assetUrl(item.image)}" style="width:100%; height:100%; object-fit:cover;">` : '<span style="color:#ccc">No Image</span>'}
                    </div>
                </div>
            </div>
            
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
            <p style="color:#666; font-size: 0.9rem;">Changes are saved automatically when you edit fields.</p>
        </div>
    `;
};

window.updateCareerOpportunity = function (type, index, field, value) {
    if (appData.careersPage?.opportunities?.[type]?.[index]) {
        appData.careersPage.opportunities[type][index][field] = value;
        // If title changes, update sidebar
        if (field === 'title') {
            renderCareersJobsSidebar();
            renderSingleCareerOpportunityEditor(type, index); // Update header
        }
    }
};

window.addCareerOpportunity = function (type) {
    const list = appData.careersPage?.opportunities?.[type];
    if (list) {
        list.push({
            title: type === 'jobs' ? 'New Job Position' : 'New Internship',
            description: '',
            image: ''
        });
        const newIndex = list.length - 1;
        selectCareerOpportunity(type, newIndex);
    }
};

window.deleteCareerListing = function (type, index) {
    if (confirm('Are you sure you want to delete this listing?')) {
        appData.careersPage.opportunities[type].splice(index, 1);
        renderCareersJobsSidebar();
        document.getElementById('career-opportunities').innerHTML = '<div style="padding:40px; text-align:center; color:#666;">Select an item from the sidebar to edit.</div>';
        window.currentCareerType = null;
        window.currentCareerIndex = null;
        saveData();
    }
};

// --- Careers Apply ---
function renderCareersApplyEditor() {
    const data = appData.careersPage.apply || { title: '', description: '', email: '', buttonText: '' };
    const container = document.getElementById('careers-apply-editor');
    if (!container) return;

    container.innerHTML = `
        <div class="item-card premium-card ${data.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Apply Section ${data.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('careersPage.apply', 'renderCareersApplyEditor', 'careers-apply-editor')" style="background:${data.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${data.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>HR Email</label>
                <input type="text" value="${data.email}" onchange="appData.careersPage.apply.email = this.value">
            </div>
            <div class="form-group">
                <label>HR Phone</label>
                <input type="text" value="${data.phone || ''}" onchange="appData.careersPage.apply.phone = this.value">
            </div>
        </div>
    `;
}

// Blog Page Editor
function renderBlogEditor() {
    if (!appData.blogPage) {
        appData.blogPage = {
            heroTitle: 'eScience Blog',
            heroDescription: 'Company news, case studies, and insights from the eScience team shaping the future of mobile enterprise',
            categories: [
                { id: 'company', label: 'Company News' },
                { id: 'events', label: 'Events' },
                { id: 'case-study', label: 'Case Studies' },
                { id: 'press', label: 'Press Release' },
                { id: 'team', label: 'Team & Culture' }
            ],
            posts: [
                {
                    id: 1,
                    title: "eScience Launches AI-Powered Analytics Dashboard for Enterprise Clients",
                    excerpt: "We're excited to announce the launch of our latest feature: an intelligent analytics dashboard that helps businesses make data-driven decisions in real-time.",
                    date: "January 15, 2026",
                    category: "company",
                    author: "Sarah Chen",
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'%3E%3Cdefs%3E%3ClinearGradient id='grad1'%3E%3Cstop offset='0%25' style='stop-color:%2300d4ff;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%230099ff;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad1)' width='400' height='220'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='white' font-weight='bold'%3ENew Feature Launch%3C/text%3E%3C/svg%3E",
                    content: ""
                },
                {
                    id: 2,
                    title: "Case Study: How RetailCorp Increased Sales by 45% with eScience POS",
                    excerpt: "Discover how one of our leading retail clients transformed their operations and boosted revenue using our mobile POS solution.",
                    date: "January 10, 2026",
                    category: "case-study",
                    author: "Michael Torres",
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'%3E%3Cdefs%3E%3ClinearGradient id='grad2'%3E%3Cstop offset='0%25' style='stop-color:%2346C1A4;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23359176;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad2)' width='400' height='220'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='white' font-weight='bold'%3EClient Success%3C/text%3E%3C/svg%3E",
                    content: ""
                },
                {
                    id: 3,
                    title: "Meet the eScience Innovation Lab: Where Ideas Come to Life",
                    excerpt: "Behind every great product is a talented team. Learn about our innovation lab and the brilliant minds working on next-generation enterprise solutions.",
                    date: "January 5, 2026",
                    category: "team",
                    author: "Emma Rodriguez",
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'%3E%3Cdefs%3E%3ClinearGradient id='grad3'%3E%3Cstop offset='0%25' style='stop-color:%23a855f7;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%237c3aed;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad3)' width='400' height='220'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='white' font-weight='bold'%3ETeam Spotlight%3C/text%3E%3C/svg%3E",
                    content: ""
                },
                {
                    id: 4,
                    title: "eScience Named Best Enterprise Software Provider 2026",
                    excerpt: "We're honored to announce that eScience has been recognized as the leading provider of mobile enterprise solutions by industry analysts at TechVision Awards.",
                    date: "December 28, 2025",
                    category: "press",
                    author: "David Kumar",
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'%3E%3Cdefs%3E%3ClinearGradient id='grad4'%3E%3Cstop offset='0%25' style='stop-color:%23FF6B6B;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23FF8E72;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad4)' width='400' height='220'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='18' fill='white' font-weight='bold'%3EAward Winner%3C/text%3E%3C/svg%3E",
                    content: ""
                },
                {
                    id: 5,
                    title: "eScience Expands Global Operations with New Singapore Office",
                    excerpt: "We're thrilled to announce the opening of our new regional headquarters in Singapore, bringing our enterprise solutions closer to Asia-Pacific clients.",
                    date: "December 20, 2025",
                    category: "company",
                    author: "Lisa Wong",
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'%3E%3Cdefs%3E%3ClinearGradient id='grad5'%3E%3Cstop offset='0%25' style='stop-color:%234ECDC4;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%2344A08D;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad5)' width='400' height='220'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='white' font-weight='bold'%3EGlobal Expansion%3C/text%3E%3C/svg%3E",
                    content: ""
                },
                {
                    id: 6,
                    title: "How eScience is Investing in Sustainability and Social Impact",
                    excerpt: "Learn about our commitment to environmental responsibility and how we're using technology to create positive change in communities worldwide.",
                    date: "December 15, 2025",
                    category: "company",
                    author: "James Anderson",
                    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 220'%3E%3Cdefs%3E%3ClinearGradient id='grad6'%3E%3Cstop offset='0%25' style='stop-color:%23F7DC6F;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23F8C471;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad6)' width='400' height='220'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='20' fill='white' font-weight='bold'%3ESustainability%3C/text%3E%3C/svg%3E",
                    content: ""
                }
            ]
        };
    }
    const blogData = appData.blogPage;
    
    // Inject Section Toggle into the main blog editor container logic
    const isHidden = appData.sectionVisibility && appData.sectionVisibility.blogPageHidden;
    
    const blogEditorContainer = document.getElementById('blog-editor');
    if (blogEditorContainer && !document.getElementById('blog-section-toggle-header')) {
        const headerDiv = document.createElement('div');
        headerDiv.id = 'blog-section-toggle-header';
        headerDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); ${isHidden ? 'opacity: 0.7;' : ''}">
            <h4 style="margin:0;">Blog Section ${isHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('blogPage', 'renderBlogEditor')" style="background:${isHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
        `;
        blogEditorContainer.insertBefore(headerDiv, blogEditorContainer.firstChild);
    } else if (blogEditorContainer) {
        // Update existing header if it exists
        const headerDiv = document.getElementById('blog-section-toggle-header');
        headerDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); ${isHidden ? 'opacity: 0.7;' : ''}">
            <h4 style="margin:0;">Blog Section ${isHidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
            <button type="button" onclick="toggleSectionVisibility('blogPage', 'renderBlogEditor')" style="background:${isHidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                ${isHidden ? 'Show Section' : 'Hide Section'}
            </button>
        </div>
        `;
    }

    // Removed Hero title and description fields

    // Initialize categories if missing

    if (!appData.blogPage.categories) {
        appData.blogPage.categories = [
            { id: 'company', label: 'Company News' },
            { id: 'events', label: 'Events' },
            { id: 'case-study', label: 'Case Studies' },
            { id: 'press', label: 'Press Release' },
            { id: 'team', label: 'Team & Culture' }
        ];
    }

    // Render Category Manager
    renderCategoryManager();

    // Render sidebar with categories
    renderBlogSidebar(blogData.posts || []);

    // Render the main editor (initially show all posts or hero section)
    renderBlogPostsList(blogData.posts || []);

    // Set hero section as default view
    const heroSection = document.getElementById('blog-hero-section-card');
    if (heroSection) heroSection.style.display = 'block';

    const postsSection = document.getElementById('blog-posts-management-section');
    if (postsSection) postsSection.style.display = 'none';
}

// --- Category Manager ---
window.renderCategoryManager = function () {
    const container = document.getElementById('blog-hero-section-card');
    if (!container) return;

    let html = '<h4>Blog Categories Manager</h4>';
    html += '<p style="color: #666; margin-bottom: 20px;">Manage the categories available for your blog posts. These categories will appear in the sidebar and as options when creating new posts.</p>';

    appData.blogPage.categories.forEach((cat, index) => {
        html += `
            <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; margin-bottom: 10px; align-items: end; background: #f9f9f9; padding: 15px; border-radius: 8px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Category ID (URL-friendly)</label>
                    <input type="text" value="${cat.id}" onchange="updateBlogCategory(${index}, 'id', this.value)" ${['company', 'events', 'case-study', 'press', 'team'].includes(cat.id) ? 'readonly style="background:#f5f5f5; cursor:not-allowed;" title="Default categories cannot have their IDs changed"' : ''}>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Category Name</label>
                    <input type="text" value="${cat.label}" onchange="updateBlogCategory(${index}, 'label', this.value)">
                </div>
                <button onclick="removeBlogCategory(${index})" style="background: #e74c3c; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; height: 42px;" ${['company', 'events', 'case-study', 'press', 'team'].includes(cat.id) ? 'disabled style="opacity:0.5; cursor:not-allowed;" title="Default categories cannot be deleted"' : ''}>Delete</button>
            </div>
        `;
    });

    html += '<button class="add-item-btn" onclick="addBlogCategory()" style="margin-top: 20px;">+ Add Custom Category</button>';

    container.innerHTML = html;
};

window.updateBlogCategory = function (index, field, value) {
    const cat = appData.blogPage.categories[index];
    const oldId = cat.id;

    if (field === 'id') {
        value = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    cat[field] = value;

    // Auto-update ID when category name (label) is changed, if it's not a default category
    if (field === 'label' && !['company', 'events', 'case-study', 'press', 'team'].includes(oldId)) {
        const newId = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || ('category-' + Date.now());
        cat.id = newId;

        // If ID changed, update all posts that used the old ID
        if (oldId !== newId) {
            if (appData.blogPage.posts) {
                appData.blogPage.posts.forEach(post => {
                    if (post.category === oldId) {
                        post.category = newId;
                    }
                });
            }
            // If the old category was currently selected, update the selection
            if (window.currentBlogCategory === oldId) {
                window.currentBlogCategory = newId;
            }
        }
    }

    renderBlogSidebar(appData.blogPage.posts || []);
    renderCategoryManager();
    // Also re-render posts view to update dropdowns if category names changed
    if (window.currentBlogCategory) {
        renderBlogCategoryPosts(window.currentBlogCategory);
    } else {
        renderBlogPostsList(appData.blogPage.posts || []);
    }
};

window.addBlogCategory = function () {
    const newId = 'new-category-' + Date.now();
    appData.blogPage.categories.push({ id: newId, label: 'New Category' });
    renderBlogSidebar(appData.blogPage.posts || []);
    renderCategoryManager();
};

window.removeBlogCategory = function (index) {
    if (confirm('Are you sure you want to delete this category? Blog posts using this category might need to be reassigned manually.')) {
        appData.blogPage.categories.splice(index, 1);
        renderBlogSidebar(appData.blogPage.posts || []);
        renderCategoryManager();
    }
};
// ------------------------

// Render blog sidebar with categories
function renderBlogSidebar(posts) {

    const sidebarList = document.getElementById('blog-sidebar-list');
    if (!sidebarList) {
        console.error('blog-sidebar-list element not found!');
        return;
    }

    // Get categories from appData (dynamic)
    const categories = appData.blogPage.categories || [];

    // Create a map for quick lookup
    const categoryLabels = {};
    categories.forEach(cat => {
        categoryLabels[cat.id] = cat.label;
    });

    // Group posts by category
    const grouped = {};
    posts.forEach((post, index) => {
        const cat = post.category || 'company';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ post, index });
    });

    // Build sidebar HTML
    let html = '<li data-tab="blog-page" onclick="showBlogHeroOnly()" style="font-weight: bold;">Categories</li>';

    // Iterate through all categories (not just those with posts)
    categories.forEach(category => {
        const catKey = category.id;
        const catLabel = category.label;
        const postsInCategory = grouped[catKey] || [];

        const isActive = window.currentBlogCategory === catKey;
        html += `
            <div class="section-item ${isActive ? 'active-tab' : ''}" data-category="${catKey}">
                <div class="section-header-row" onclick="selectBlogCategory('${catKey}')">
                    <span>${catLabel}</span>
                    <span class="dropdown-arrow">▶</span>
                </div>
                <ul class="product-list-sidebar" id="blog-cat-${catKey}">
                    ${postsInCategory.map(({ post, index }) => `
                        <li class="product-item-sidebar" data-blog-post-index="${index}" onclick="scrollToBlogPost(event, ${index})">
                            ${post.title || 'Untitled Post'}
                        </li>
                    `).join('')}
                    <li class="product-item-sidebar" style="color: #27ae60;" onclick="event.stopPropagation(); addBlogPost('${catKey}')">
                        + Add ${catLabel} Post
                    </li>
                </ul>
            </div>
        `;
    });

    sidebarList.innerHTML = html;
}

// Track current blog category
window.currentBlogCategory = null;

// Select a blog category (shows all posts in that category)
window.selectBlogCategory = function (catKey) {
    // Toggle behavior: if clicking the same category, collapse it
    if (window.currentBlogCategory === catKey) {
        window.currentBlogCategory = null;
        const sidebarSections = document.querySelectorAll('#blog-sidebar-list .section-item');
        sidebarSections.forEach(sec => sec.classList.remove('active-tab'));
        document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));

        // Show hero section when returning to main blog page view
        const heroSection = document.getElementById('blog-hero-section-card');
        if (heroSection) heroSection.style.display = 'block';

        // Hide posts management section
        const postsSection = document.getElementById('blog-posts-management-section');
        if (postsSection) postsSection.style.display = 'none';

        return;
    }

    window.currentBlogCategory = catKey;

    // Update sidebar active state
    const sidebarSections = document.querySelectorAll('#blog-sidebar-list .section-item');
    sidebarSections.forEach(sec => sec.classList.remove('active-tab'));
    const activeSec = document.querySelector(`#blog-sidebar-list .section-item[data-category="${catKey}"]`);
    if (activeSec) activeSec.classList.add('active-tab');

    // Show the blog posts editor section
    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
    const blogSection = document.getElementById('blog-page');
    if (blogSection) blogSection.classList.add('active');

    // Hide hero section when viewing category-specific posts
    const heroSection = document.getElementById('blog-hero-section-card');
    if (heroSection) heroSection.style.display = 'none';

    // Show posts management section
    const postsSection = document.getElementById('blog-posts-management-section');
    if (postsSection) postsSection.style.display = 'block';

    // Update editor title
    const category = appData.blogPage.categories.find(c => c.id === catKey);
    const categoryLabel = category ? category.label : 'Blog Posts';
    if (document.getElementById('editor-title')) {
        document.getElementById('editor-title').textContent = categoryLabel;
    }

    // Render posts for this category only
    renderBlogCategoryPosts(catKey);
};

// Show only the blog categories section (when clicking "Categories" in sidebar)
window.showBlogHeroOnly = function () {
    // Clear any active category
    window.currentBlogCategory = null;

    // Remove active state from all category items
    const sidebarSections = document.querySelectorAll('#blog-sidebar-list .section-item');
    sidebarSections.forEach(sec => sec.classList.remove('active-tab'));

    // Show the blog page section
    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
    const blogSection = document.getElementById('blog-page');
    if (blogSection) blogSection.classList.add('active');

    // Show categories section (previously hero section)
    const heroSection = document.getElementById('blog-hero-section-card');
    if (heroSection) heroSection.style.display = 'block';

    // Hide posts management section
    const postsSection = document.getElementById('blog-posts-management-section');
    if (postsSection) postsSection.style.display = 'none';

    // Update editor title
    if (document.getElementById('editor-title')) {
        document.getElementById('editor-title').textContent = 'Categories';
    }
};

// Scroll to a specific blog post within the current category view
window.scrollToBlogPost = function (event, index) {
    event.stopPropagation();

    // Make sure the category is selected first
    const post = appData.blogPage.posts[index];
    if (post && post.category !== window.currentBlogCategory) {
        selectBlogCategory(post.category);
    }

    // Small delay to ensure render is complete
    setTimeout(() => {
        const postId = `blog-post-editor-${index}`;
        const el = document.getElementById(postId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.style.boxShadow = '0 0 15px rgba(0, 212, 255, 0.4)';
            setTimeout(() => { el.style.boxShadow = ''; }, 2000);
        }
    }, 100);
}

// Track Quill instances for blocks
let blockQuillInstances = {};

// Render posts for a specific category
function renderBlogCategoryPosts(catKey) {
    const container = document.getElementById('blog-posts-list');
    container.innerHTML = '';

    // Filter posts by category
    const categoryPosts = appData.blogPage.posts
        .map((post, index) => ({ post, index }))
        .filter(({ post }) => post.category === catKey);

    if (categoryPosts.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No posts in this category yet.</p>';
        return;
    }

    renderBlogPostsListInternal(categoryPosts);
}

// Internal function to render a list of posts
function renderBlogPostsListInternal(postsWithIndex) {
    const container = document.getElementById('blog-posts-list');
    blockQuillInstances = {};

    // Ensure categories exist
    if (!appData.blogPage.categories) {
        appData.blogPage.categories = [
            { id: 'company', label: 'Company News' },
            { id: 'events', label: 'Events' },
            { id: 'case-study', label: 'Case Studies' },
            { id: 'press', label: 'Press Release' },
            { id: 'team', label: 'Team & Culture' }
        ];
    }

    const categoryLabels = {};
    appData.blogPage.categories.forEach(cat => {
        categoryLabels[cat.id] = cat.label;
    });


    postsWithIndex.forEach(({ post, index }) => {
        const postCard = document.createElement('div');
        postCard.className = 'item-card premium-card';
        postCard.id = `blog-post-editor-${index}`;

        // Ensure blocks array exists
        if (!post.blocks) post.blocks = [];

        postCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
                <div>
                    <h5 style="margin:0 0 5px 0; color: var(--primary-color);">${post.title || 'Blog Post'}</h5>
                    <small style="color:rgba(255,255,255,0.4);">Post ID: <strong>${post.id}</strong> | Category: <strong>${categoryLabels[post.category] || post.category}</strong></small>
                </div>
                <button onclick="removeBlogPost(${index})" style="background:#e74c3c; color:white; padding:0.5rem 1rem; border:none; border-radius:4px; cursor:pointer; font-size:0.9rem;">Delete</button>
            </div>

            <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div class="form-group">
                    <label>Article Title</label>
                    <input type="text" value="${post.title || ''}" onchange="updateBlogPost(${index}, 'title', this.value)">
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select onchange="updateBlogPost(${index}, 'category', this.value)" style="width: 100%; background: #ffffff; border: 1px solid #ccc; color: #333; padding: 0.8rem; border-radius: 4px; font-size: 1rem; appearance: auto; -webkit-appearance: auto;">
                        ${appData.blogPage.categories.map(cat =>
            `<option value="${cat.id}" ${post.category === cat.id ? 'selected' : ''}>${cat.label}</option>`
        ).join('')}
                    </select>
                </div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
                <label>Excerpt / Summary (Shows on blog list)</label>
                <textarea rows="2" onchange="updateBlogPost(${index}, 'excerpt', this.value)">${post.excerpt || ''}</textarea>
            </div>

            <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div class="form-group">
                    <label>Publish Date</label>
                    <input type="text" value="${post.date || ''}" onchange="updateBlogPost(${index}, 'date', this.value)" placeholder="e.g., January 15, 2026">
                </div>
                <div class="form-group">
                    <label>Featured Image (Hero)</label>
                    <input type="file" accept="image/*" onchange="handleBlogImageUpload(this, ${index})" style="font-size:0.8rem;">
                    <input type="text" value="${post.image || ''}" readonly style="background:#f5f5f5; margin-top:5px; border:1px solid #ccc; padding:0.4rem; color:#666; width:100%;" placeholder="Image Path">
                    ${post.image ? `<img src="${assetUrl(post.image)}" class="preview-img" style="margin-top:10px;">` : ''}
                </div>
            </div>

            <div style="margin: 2rem 0 1rem;">
                <h4 style="color: #333; margin: 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.5rem;">Article Content Sections</h4>
                <p style="color: #666; font-size: 0.85rem; margin: 0.5rem 0 0 0;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                    Drag blocks to reorder • Click buttons below to add new content
                </p>
            </div>
            
            <div id="blog-blocks-${index}" class="blog-blocks-container">
                <!-- Blocks will be injected here -->
            </div>

            <div class="block-add-actions">
                <button class="add-block-btn" onclick="addBlogBlock(${index}, 'text')"><span>+</span> Add Text</button>
                <button class="add-block-btn" onclick="addBlogBlock(${index}, 'image')"><span>+</span> Add Image</button>
                <button class="add-block-btn" onclick="addBlogBlock(${index}, 'header')"><span>+</span> Add Header</button>
                <button class="add-block-btn" onclick="addBlogBlock(${index}, 'quote')"><span>+</span> Add Quote</button>
                <button class="add-block-btn" onclick="addBlogBlock(${index}, 'video')"><span>+</span> Add Video</button>
                <button class="add-block-btn" onclick="addBlogBlock(${index}, 'divider')"><span>+</span> Add Divider</button>
            </div>
        `;
        container.appendChild(postCard);
        renderBlogBlocks(index);
    });


}

function renderBlogBlocks(postIndex) {
    const post = appData.blogPage.posts[postIndex];
    const container = document.getElementById(`blog-blocks-${postIndex}`);
    if (!container) return;

    container.innerHTML = '';

    // Show empty state if no blocks
    if (!post.blocks || post.blocks.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #999; border: 2px dashed #ddd; border-radius: 8px; background: #f9f9f9;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                <p style="margin: 0; font-size: 1.1rem; font-weight: 600; color: #666;">No content blocks yet</p>
                <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #999;">Add your first content block using the buttons below</p>
            </div>
        `;
        return;
    }

    post.blocks.forEach((block, blockIndex) => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'blog-block-item';
        blockDiv.className = 'blog-block-item';
        // blockDiv.draggable = true; // Removed to prevent dragging from anywhere
        blockDiv.dataset.postIndex = postIndex;
        blockDiv.dataset.blockIndex = blockIndex;
        blockDiv.dataset.blockType = block.type; // Add block type for CSS targeting
        const editorId = `block-editor-${postIndex}-${blockIndex}`;

        let contentHtml = '';
        if (block.type === 'text' || block.type === 'quote' || block.type === 'header') {
            contentHtml = `<div class="quill-editor-wrapper"><div id="${editorId}">${block.content || ''}</div></div>`;
        } else if (block.type === 'image') {
            // Ensure images array exists (migrate from old single image format)
            if (!block.images) {
                block.images = block.url ? [{ url: block.url, caption: block.caption || '' }] : [];
            }

            const imagesHtml = block.images.map((img, imgIndex) => `
                <div class="gallery-image-item" draggable="true" data-img-index="${imgIndex}">
                    <div class="gallery-image-drag-handle" title="Drag to reorder">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="4" cy="3" r="1.5"/>
                            <circle cx="12" cy="3" r="1.5"/>
                            <circle cx="4" cy="8" r="1.5"/>
                            <circle cx="12" cy="8" r="1.5"/>
                            <circle cx="4" cy="13" r="1.5"/>
                            <circle cx="12" cy="13" r="1.5"/>
                        </svg>
                    </div>
                    <button class="gallery-image-remove" onclick="removeImageFromGallery(${postIndex}, ${blockIndex}, ${imgIndex})" title="Remove image">×</button>
                    <img src="${assetUrl(img.url)}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;">
                    <input type="text" value="${img.caption || ''}" onchange="updateGalleryImageCaption(${postIndex}, ${blockIndex}, ${imgIndex}, this.value)" placeholder="Image caption..." style="width: 100%; padding: 6px; font-size: 0.85rem; background: #ffffff; border: 1px solid #ddd; color: #333; border-radius: 4px;">
                </div>
            `).join('');

            contentHtml = `
                <div class="form-group">
                    <label>Upload Images (Multiple)</label>
                    <input type="file" accept="image/*" multiple onchange="handleMultipleBlockImageUpload(this, ${postIndex}, ${blockIndex})" style="margin-bottom: 15px;">
                </div>
                <div id="gallery-images-${postIndex}-${blockIndex}" class="gallery-images-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                    ${imagesHtml}
                    <div class="gallery-add-placeholder" onclick="document.querySelector('#gallery-images-${postIndex}-${blockIndex}').previousElementSibling.previousElementSibling.click()" style="border: 2px dashed rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 150px; cursor: pointer; transition: all 0.2s;">
                        <div style="text-align: center; color: rgba(255,255,255,0.4);">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                            <p style="margin: 0; font-size: 0.85rem;">Add Image</p>
                        </div>
                    </div>
                </div>
            `;
        } else if (block.type === 'divider') {
            contentHtml = `<div style="height: 1px; background: rgba(255,255,255,0.1); margin: 1rem 0;"></div><p style="text-align:center; color:#666; font-size:0.8rem;">Section Divider</p>`;
        } else if (block.type === 'video') {
            const videoUrl = block.url || '';
            const embedUrl = getEmbedUrl(videoUrl);

            contentHtml = `
                <div class="form-group">
                     <label>Video URL (YouTube, Vimeo) <strong>OR</strong> Upload Video</label>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                         <input type="text" value="${videoUrl}" onchange="updateBlockData(${postIndex}, ${blockIndex}, 'url', this.value); renderBlogBlocks(${postIndex})" placeholder="https://www.youtube.com/watch?v=..." style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                         <label class="btn-upload" style="cursor: pointer; background: #eee; padding: 8px 12px; border-radius: 4px; border: 1px solid #ddd; font-size: 0.9rem; white-space: nowrap;">
                            Upload Video
                            <input type="file" accept="video/*" onchange="window.handleBlockVideoUpload(this, ${postIndex}, ${blockIndex})" style="display: none;">
                        </label>
                    </div>
                </div>
                ${embedUrl ? `
                <div class="video-preview" style="margin: 10px 0; border-radius: 8px; overflow: hidden; background: #000;">
                    <div style="position: relative; padding-bottom: 56.25%; height: 0;">
                        <iframe src="${embedUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allowfullscreen></iframe>
                    </div>
                </div>` : ''}
                ${!embedUrl && videoUrl ? `
                <div class="video-preview" style="margin: 10px 0; border-radius: 8px; overflow: hidden; background: #000;">
                    <video src="${assetUrl(videoUrl)}" controls preload="auto" onloadeddata="this.currentTime=1" style="width: 100%; max-height: 400px; display: block;"></video>
                </div>
                ` : ''}
                <div class="form-group">
                    <label>Caption</label>
                    <input type="text" value="${block.caption || ''}" onchange="updateBlockData(${postIndex}, ${blockIndex}, 'caption', this.value)" placeholder="Video caption..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
            `;
        }

        blockDiv.innerHTML = `
            <div class="block-drag-handle" draggable="true" title="Drag to reorder">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="opacity: 0.5;">
                    <circle cx="4" cy="3" r="1.5"/>
                    <circle cx="12" cy="3" r="1.5"/>
                    <circle cx="4" cy="8" r="1.5"/>
                    <circle cx="12" cy="8" r="1.5"/>
                    <circle cx="4" cy="13" r="1.5"/>
                    <circle cx="12" cy="13" r="1.5"/>
                </svg>
            </div>
            <div class="block-type-tag">${block.type}</div>
            <div class="block-controls">
                <button class="block-btn" onclick="moveBlogBlock(${postIndex}, ${blockIndex}, -1)" title="Move up">↑</button>
                <button class="block-btn" onclick="moveBlogBlock(${postIndex}, ${blockIndex}, 1)" title="Move down">↓</button>
                <button class="block-btn remove-btn" onclick="removeBlogBlock(${postIndex}, ${blockIndex})" title="Remove block">×</button>
            </div>
            ${contentHtml}
        `;
        container.appendChild(blockDiv);

        // Init Quill for text/quote/header blocks
        if (block.type === 'text' || block.type === 'quote' || block.type === 'header') {
            setTimeout(() => {
                // Check if Quill instance already exists and destroy it
                if (blockQuillInstances[editorId]) {
                    delete blockQuillInstances[editorId];
                }

                // Only initialize if the element exists and doesn't already have Quill
                const editorElement = document.getElementById(editorId);
                if (editorElement && !editorElement.classList.contains('ql-container')) {
                    const quill = new Quill(`#${editorId}`, {
                        modules: {
                            toolbar: block.type === 'header' ? [['bold', 'italic']] : [
                                [{ 'size': ['small', false, 'large', 'huge'] }],
                                ['bold', 'italic', 'underline'],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                ['link', 'clean']
                            ]
                        },
                        placeholder: `Write ${block.type} component here...`,
                        theme: 'snow'
                    });

                    quill.on('text-change', () => {
                        post.blocks[blockIndex].content = quill.root.innerHTML;
                    });

                    blockQuillInstances[editorId] = quill;
                }
            }, 0);
        }
    });

    // Add drag-and-drop event listeners to all blocks
    setupBlockDragAndDrop(postIndex);

    // Setup drag-and-drop for all image galleries in this post
    post.blocks.forEach((block, blockIndex) => {
        if (block.type === 'image' && block.images && block.images.length > 0) {
            setTimeout(() => setupGalleryDragAndDrop(postIndex, blockIndex), 100);
        }
    });
}

// Drag and drop functionality for blog blocks
function setupBlockDragAndDrop(postIndex) {
    const container = document.getElementById(`blog-blocks-${postIndex}`);
    if (!container) return;

    const blocks = container.querySelectorAll('.blog-block-item');
    let draggedElement = null;
    let draggedIndex = null;

    blocks.forEach((block) => {
        // Drag start
        // Drag start - attached to handle, but needs to work for the block
        const handle = block.querySelector('.block-drag-handle');
        if (handle) {
            handle.addEventListener('dragstart', (e) => {
                draggedElement = block;
                draggedIndex = parseInt(block.dataset.blockIndex);
                block.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', block.innerHTML);
                // Important: Set drag image to the block, not just the handle
                e.dataTransfer.setDragImage(block, 0, 0);
            });
        }

        // Drag end
        block.addEventListener('dragend', (e) => {
            block.classList.remove('dragging');
            // Remove all drag-over classes
            blocks.forEach(b => b.classList.remove('drag-over'));
        });

        // Drag over
        block.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (draggedElement !== block) {
                block.classList.add('drag-over');
            }
        });

        // Drag leave
        block.addEventListener('dragleave', (e) => {
            block.classList.remove('drag-over');
        });

        // Drop
        block.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            block.classList.remove('drag-over');

            if (draggedElement !== block) {
                const dropIndex = parseInt(block.dataset.blockIndex);

                // Reorder the blocks array
                const post = appData.blogPage.posts[postIndex];
                const draggedBlock = post.blocks[draggedIndex];

                // Remove from old position
                post.blocks.splice(draggedIndex, 1);

                // Insert at new position
                const newIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
                post.blocks.splice(newIndex, 0, draggedBlock);

                // Re-render blocks
                renderBlogBlocks(postIndex);
            }
        });
    });
}

window.addBlogBlock = function (postIndex, type) {
    const post = appData.blogPage.posts[postIndex];
    const newBlock = { type: type, content: '', url: '', caption: '' };
    post.blocks.push(newBlock);
    renderBlogBlocks(postIndex);
};

window.removeBlogBlock = function (postIndex, blockIndex) {
    if (confirm('Remove this section?')) {
        appData.blogPage.posts[postIndex].blocks.splice(blockIndex, 1);
        renderBlogBlocks(postIndex);
    }
};

window.moveBlogBlock = function (postIndex, blockIndex, direction) {
    const blocks = appData.blogPage.posts[postIndex].blocks;
    const newIndex = blockIndex + direction;
    if (newIndex >= 0 && newIndex < blocks.length) {
        const temp = blocks[blockIndex];
        blocks[blockIndex] = blocks[newIndex];
        blocks[newIndex] = temp;
        renderBlogBlocks(postIndex);
    }
};

window.updateBlockData = function (postIndex, blockIndex, field, value) {
    appData.blogPage.posts[postIndex].blocks[blockIndex][field] = value;
};

window.handleBlockImageUpload = async function (input, postIndex, blockIndex) {
    const file = input.files[0];
    if (!file) return;
    try {
        const filePath = await processAndUpload(file, 'blog');
        appData.blogPage.posts[postIndex].blocks[blockIndex].url = filePath;
        renderBlogBlocks(postIndex);
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    }
};

// Handle multiple image uploads for gallery blocks
window.handleMultipleBlockImageUpload = async function (input, postIndex, blockIndex) {
    const files = input.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
        if (!isValidImageFile(files[i])) {
            alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your images before uploading.');
            input.value = '';
            return;
        }
    }
    let hasError = false;
    for (let i = 0; i < files.length; i++) {
        try {
            const filePath = await processAndUpload(files[i], 'blog');
            const block = appData.blogPage.posts[postIndex].blocks[blockIndex];
            if (!block.images) block.images = [];
            block.images.push({ url: filePath, caption: '' });
        } catch (err) {
            console.error('Error uploading gallery image:', err);
            alert(`Error uploading ${files[i].name}`);
            hasError = true;
        }
    }

    if (!hasError) {
        renderBlogBlocks(postIndex);
        setupGalleryDragAndDrop(postIndex, blockIndex);
    }
};

// Remove an image from a gallery
window.removeImageFromGallery = function (postIndex, blockIndex, imgIndex) {
    if (confirm('Remove this image?')) {
        const block = appData.blogPage.posts[postIndex].blocks[blockIndex];
        block.images.splice(imgIndex, 1);
        renderBlogBlocks(postIndex);
        setupGalleryDragAndDrop(postIndex, blockIndex);
    }
};

// Update gallery image caption
window.updateGalleryImageCaption = function (postIndex, blockIndex, imgIndex, caption) {
    const block = appData.blogPage.posts[postIndex].blocks[blockIndex];
    if (block.images && block.images[imgIndex]) {
        block.images[imgIndex].caption = caption;
    }
};

// Setup drag-and-drop for gallery images
function setupGalleryDragAndDrop(postIndex, blockIndex) {
    const container = document.getElementById(`gallery-images-${postIndex}-${blockIndex}`);
    if (!container) return;

    const images = container.querySelectorAll('.gallery-image-item');
    let draggedElement = null;
    let draggedIndex = null;

    images.forEach((img) => {
        // Drag start
        img.addEventListener('dragstart', (e) => {
            draggedElement = img;
            draggedIndex = parseInt(img.dataset.imgIndex);
            img.classList.add('dragging-gallery-image');
            e.dataTransfer.effectAllowed = 'move';
        });

        // Drag end
        img.addEventListener('dragend', (e) => {
            img.classList.remove('dragging-gallery-image');
            images.forEach(i => i.classList.remove('drag-over-gallery'));
        });

        // Drag over
        img.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            if (draggedElement !== img) {
                img.classList.add('drag-over-gallery');
            }
        });

        // Drag leave
        img.addEventListener('dragleave', (e) => {
            img.classList.remove('drag-over-gallery');
        });

        // Drop
        img.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            img.classList.remove('drag-over-gallery');

            if (draggedElement !== img) {
                const dropIndex = parseInt(img.dataset.imgIndex);

                // Reorder the images array
                const block = appData.blogPage.posts[postIndex].blocks[blockIndex];
                const draggedImage = block.images[draggedIndex];

                // Remove from old position
                block.images.splice(draggedIndex, 1);

                // Insert at new position
                const newIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
                block.images.splice(newIndex, 0, draggedImage);

                // Re-render blocks
                renderBlogBlocks(postIndex);
                setupGalleryDragAndDrop(postIndex, blockIndex);
            }
        });
    });
}



window.updateBlogPost = function (index, field, value) {
    if (!appData.blogPage.posts[index]) return;
    const oldCategory = appData.blogPage.posts[index].category;
    appData.blogPage.posts[index][field] = value;

    // If category or title changed, refresh sidebar
    if (field === 'category' || field === 'title') {
        renderBlogSidebar(appData.blogPage.posts);
        // Re-render the new category view
        if (window.currentBlogCategory) {
            renderBlogCategoryPosts(window.currentBlogCategory);
        }
    }
};

window.addBlogPost = function (category) {
    if (!appData.blogPage) appData.blogPage = { posts: [] };

    // Determine category: use provided category, or current category if one is selected, otherwise default to 'company'
    const defaultCategory = category || window.currentBlogCategory || 'company';

    const newPost = {
        id: Date.now(),
        title: 'New Blog Article',
        excerpt: 'Enter a short summary of the article here...',
        blocks: [
            { type: 'text', content: '<p>Welcome to your new article! Start by editing this block or adding more sections below.</p>' }
        ],
        category: defaultCategory,
        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        image: ''
    };
    appData.blogPage.posts.unshift(newPost);

    // Refresh sidebar and re-render current category
    renderBlogSidebar(appData.blogPage.posts);
    if (window.currentBlogCategory) {
        renderBlogCategoryPosts(window.currentBlogCategory);
    } else {
        // If no category selected, select the category of the new post
        selectBlogCategory(defaultCategory);
    }
};

window.removeBlogPost = function (index) {
    if (confirm('Delete this blog post?')) {
        appData.blogPage.posts.splice(index, 1);

        // Refresh sidebar and re-render current category
        renderBlogSidebar(appData.blogPage.posts);
        if (window.currentBlogCategory) {
            renderBlogCategoryPosts(window.currentBlogCategory);
        }
    }
};

window.handleBlogImageUpload = async function (input, index) {
    const file = input.files[0];
    if (!file) return;
    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(file, 'blog');
        appData.blogPage.posts[index].image = filePath;
        const parent = input.parentElement;
        parent.querySelector('input[type=text]').value = filePath;
        let img = parent.querySelector('img');
        if (!img) { img = document.createElement('img'); img.className = 'preview-img'; img.style.marginTop = '10px'; parent.appendChild(img); }
        img.src = CONFIG.UPLOADS_BASE + '/' + filePath.replace(/^uploads\//, '');
    } catch (err) {
        console.error(err);
        alert('Error uploading image');
    }
};

window.saveBlogPage = function () {
    const titleVal = document.getElementById('blog-title').value;
    const descVal = document.getElementById('blog-description').value;

    appData.blogPage.heroTitle = titleVal || 'eScience Blog';
    appData.blogPage.heroDescription = descVal || '';

    saveData().then(() => {
        const msgEl = document.getElementById('blog-page-hero-msg');
        if (msgEl) {
            msgEl.textContent = '✓ Blog page settings and articles saved successfully!';
            msgEl.style.color = '#27ae60';
            setTimeout(() => { msgEl.textContent = ''; }, 3000);
        }
    }).catch(err => {
        const msgEl = document.getElementById('blog-page-hero-msg');
        if (msgEl) {
            msgEl.textContent = '✗ Error saving: ' + err.message;
            msgEl.style.color = '#e74c3c';
        }
    });
};


// === CONTACT US PAGE EDITORS ===

// Track current department being edited
window.currentDeptIndex = null;
window.isDepartmentsSectionOpen = false; // Default to closed

// Render the sidebar list of departments (Single dropdown)
function renderContactDepartmentsSidebar() {
    const list = document.getElementById('contact-departments-sidebar-list');
    if (!list) return;

    list.innerHTML = '';

    const departments = appData.contactPage?.departments || [];

    // Create the single "Departments" container
    const deptContainer = document.createElement('div');
    deptContainer.className = 'section-item';

    // Toggle class based on open state
    if (window.isDepartmentsSectionOpen) {
        deptContainer.classList.add('active-tab');
    }

    // Create header row
    const headerRow = document.createElement('div');
    headerRow.className = 'section-header-row';
    headerRow.innerHTML = `
        <span>Departments</span>
        <span class="dropdown-arrow">▶</span>
    `;
    headerRow.onclick = () => {
        window.isDepartmentsSectionOpen = !window.isDepartmentsSectionOpen;
        if (window.isDepartmentsSectionOpen) {
            deptContainer.classList.add('active-tab');
        } else {
            deptContainer.classList.remove('active-tab');
        }
    };

    deptContainer.appendChild(headerRow);

    // Create departments sub-list
    const deptsUl = document.createElement('ul');
    deptsUl.className = 'product-list-sidebar';

    departments.forEach((dept, index) => {
        const li = document.createElement('li');
        li.className = 'product-item-sidebar';

        // Highlight active department
        if (window.currentDeptIndex === index) {
            li.classList.add('active-tab');
        }

        li.innerHTML = (dept.name || 'Department #' + (index + 1)) + (dept.isHidden ? ' <span style="color:#e67e22; font-size:0.75rem; margin-left:4px;">(Hidden)</span>' : '');
        li.onclick = (e) => {
            e.stopPropagation();
            selectDepartment(index);
        };
        deptsUl.appendChild(li);
    });

    // Add "Add New Department" button inside the list
    const addLi = document.createElement('li');
    addLi.className = 'product-item-sidebar';
    addLi.style.color = '#27ae60';
    addLi.innerHTML = '+ Add Department';
    addLi.onclick = (e) => {
        e.stopPropagation();
        addContactDepartment();
    };
    deptsUl.appendChild(addLi);

    deptContainer.appendChild(deptsUl);
    list.appendChild(deptContainer);
}

// Select a department to edit
window.selectDepartment = function (deptIndex) {
    window.currentDeptIndex = deptIndex;

    // Re-render sidebar to update highlighting
    renderContactDepartmentsSidebar();

    // Update editor title
    const dept = appData.contactPage?.departments?.[deptIndex];
    const titleEl = document.getElementById('editor-title');
    if (titleEl && dept) {
        titleEl.textContent = dept.name || 'Edit Department';
    }

    // Remove active from other sections and show department editor
    document.querySelectorAll('.editor-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('contact-departments').classList.add('active');

    renderSingleDepartmentEditor(deptIndex);
};

// Render a single department's editor
function renderSingleDepartmentEditor(deptIndex) {
    const container = document.getElementById('contact-departments-editor');
    if (!container) return;

    const departments = appData.contactPage?.departments || [];
    const dept = departments[deptIndex];

    if (!dept) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #666;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5; margin-bottom: 20px;">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h3 style="margin: 0 0 10px 0;">Select a Department</h3>
                <p style="margin: 0;">Choose a department from the sidebar to edit its details and contact information.</p>
            </div>
        `;
        return;
    }

    window.currentDeptIndex = deptIndex;

    // Build contacts HTML
    let contactsHtml = '';
    const contacts = dept.contacts || [];
    contacts.forEach((contact, contactIndex) => {
        const hasMultipleValues = Array.isArray(contact.values);
        contactsHtml += `
            <div class="contact-item" style="border: 1px solid #e0e0e0; padding: 12px; margin: 8px 0; border-radius: 8px; background: #fafafa;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #333;">Contact ${contactIndex + 1}</strong>
                    <button onclick="removeContact(${deptIndex}, ${contactIndex})" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Remove</button>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Type</label>
                    <select onchange="updateContact(${deptIndex}, ${contactIndex}, 'type', this.value)">
                        <option value="email" ${contact.type === 'email' ? 'selected' : ''}>Email</option>
                        <option value="phone" ${contact.type === 'phone' ? 'selected' : ''}>Phone</option>
                        <option value="social" ${contact.type === 'social' ? 'selected' : ''}>Social</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 10px;">
                    <label>Label</label>
                    <input type="text" value="${contact.label || ''}" onchange="updateContact(${deptIndex}, ${contactIndex}, 'label', this.value)">
                </div>
                ${hasMultipleValues ? `
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label>Values (one per line)</label>
                        <textarea rows="3" onchange="updateContactValues(${deptIndex}, ${contactIndex}, this.value)">${(contact.values || []).join('\n')}</textarea>
                    </div>
                    ${contact.type === 'social' ? `
                        <div class="form-group" style="margin-bottom: 10px;">
                            <label>Links (one per line, matching values order)</label>
                            <textarea rows="3" onchange="updateContactLinks(${deptIndex}, ${contactIndex}, this.value)">${(contact.links || []).join('\n')}</textarea>
                        </div>
                    ` : ''}
                ` : `
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label>Value</label>
                        <input type="text" value="${contact.value || ''}" onchange="updateContact(${deptIndex}, ${contactIndex}, 'value', this.value)">
                    </div>
                `}
                <button onclick="toggleMultipleValues(${deptIndex}, ${contactIndex})" style="background: #6c757d; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                    ${hasMultipleValues ? 'Switch to Single Value' : 'Switch to Multiple Values'}
                </button>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="item-card premium-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f3460; padding-bottom: 10px; margin-bottom: 20px;">
                <h4 style="margin: 0; color: #0f3460; font-size: 1.2rem;">${dept.name || 'Department'}</h4>
                <div style="display: flex; gap: 8px;">
                    <button type="button" onclick="removeContactDepartment(${deptIndex})" style="background: #e74c3c; color: white; padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; white-space: nowrap;">Delete</button>
                    <button type="button" onclick="toggleDepartmentVisibility(${deptIndex})" style="background: ${dept.isHidden ? '#27ae60' : '#607d8b'}; color: white; padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; white-space: nowrap;">${dept.isHidden ? 'Show' : 'Hide'}</button>
                </div>
            </div>
            <div class="form-group">
                <label>Department ID (Auto-generated)</label>
                <input type="text" value="${dept.id || ''}" readonly style="background-color: #f5f5f5; cursor: not-allowed; color: #666;" placeholder="Auto-generated from name">
            </div>
            <div class="form-group">
                <label>Department Name</label>
                <input type="text" value="${dept.name || ''}" onchange="updateDepartment(${deptIndex}, 'name', this.value)" placeholder="e.g., Sales & Marketing">
            </div>
            <div class="form-group">
                <label>Dropdown Label (for contact form)</label>
                <input type="text" value="${dept.dropdownLabel || ''}" onchange="updateDepartment(${deptIndex}, 'dropdownLabel', this.value)" placeholder="e.g., Sales - New Business Inquiries">
            </div>

            <!-- Icon Selection -->
            <div class="form-group">
                <label>Department Icon</label>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div onclick="openDepartmentIconPicker(${deptIndex})" style="width: 48px; height: 48px; background: #fff; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; transition: border-color 0.2s;" onmouseover="this.style.borderColor='#0f3460'" onmouseout="this.style.borderColor='#ccc'">
                        <img src="${assetUrl(dept.icon || 'assets/icons/business.svg')}" style="width: 24px; height: 24px; object-fit: contain;">
                    </div>
                    <div style="flex: 1;">
                        <input type="text" value="${dept.icon || ''}" readonly style="background:#f5f5f5; border:1px solid #ccc; padding:0.6rem; color:#666; width:100%; border-radius: 4px; font-size: 0.9rem;" placeholder="No icon selected">
                        <button type="button" onclick="openDepartmentIconPicker(${deptIndex})" style="margin-top: 5px; padding: 6px 12px; cursor: pointer; font-size: 0.85rem; background: #f0f0f0; color: #333; border: 1px solid #ccc; border-radius: 4px;">Browse Icon Library</button>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Description</label>
                <textarea rows="2" onchange="updateDepartment(${deptIndex}, 'description', this.value)">${dept.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Form Email <span style="font-weight: normal; color: #666; font-size: 0.85rem;">(used as recipient for \"Send us a Message\")</span></label>
                <input type="email" value="${dept.formEmail || ''}" onchange="updateDepartment(${deptIndex}, 'formEmail', this.value)" placeholder="e.g., sales@electronicscience.net">
                <small style="color: #888; display: block; margin-top: 4px;">If left blank, a contact email from this department will be used as fallback.</small>
            </div>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
            <h5>Contacts</h5>
            ${contactsHtml}
            <button onclick="addContact(${deptIndex})" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px;">+ Add Contact</button>
        </div>
    `;
}

// Legacy function for compatibility - redirect to sidebar render
function renderContactDepartmentsEditor() {
    renderContactDepartmentsSidebar();
    // Show default empty state if no department is selected
    if (window.currentDeptIndex === null || window.currentDeptIndex === undefined) {
        const container = document.getElementById('contact-departments-editor');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #666;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.5; margin-bottom: 20px;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <h3 style="margin: 0 0 10px 0;">Select a Department</h3>
                    <p style="margin: 0;">Choose a department from the sidebar to edit its details and contact information.</p>
                </div>
            `;
        }
    } else {
        renderSingleDepartmentEditor(window.currentDeptIndex);
    }
}

function renderContactOfficeEditor() {
    const container = document.getElementById('contact-office-editor');
    if (!container) return;

    const office = appData.contactPage?.officeLocation || {};

    container.innerHTML = `
        <div class="item-card premium-card ${office.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Office Location Details ${office.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('contactPage.officeLocation', 'renderContactOfficeEditor', 'contact-office-editor')" style="background:${office.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${office.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Address</label>
                <textarea rows="3" onchange="updateOfficeLocation('address', this.value)">${office.address || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Direct Phone Line</label>
                <input type="tel" value="${office.directLine || ''}" onchange="updateOfficeLocation('directLine', this.value)">
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" value="${office.email || ''}" onchange="updateOfficeLocation('email', this.value)">
            </div>
            <div class="form-group">
                <label>Google Maps Link (for "Get Directions" button)</label>
                <input type="url" value="${office.googleMapsLink || ''}" onchange="updateOfficeLocation('googleMapsLink', this.value)" placeholder="https://maps.app.goo.gl/...">
            </div>
            <div class="form-group">
                <label>Google Maps Embed URL (for iframe)</label>
                <input type="url" value="${office.googleMapsEmbed || ''}" onchange="updateOfficeLocation('googleMapsEmbed', this.value)" placeholder="https://www.google.com/maps/embed?pb=...">
                <small style="color: #666; display: block; margin-top: 5px;">Get this from Google Maps → Share → Embed a map → Copy the src URL from the iframe</small>
            </div>
        </div>
    `;
}

function renderContactHoursEditor() {
    const container = document.getElementById('contact-hours-editor');
    if (!container) return;

    const hours = appData.contactPage?.businessHours || {};

    container.innerHTML = `
        <div class="item-card premium-card ${hours.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Business Hours ${hours.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <button type="button" onclick="toggleSectionVisibility('contactPage.businessHours', 'renderContactHoursEditor', 'contact-hours-editor')" style="background:${hours.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${hours.hidden ? 'Show Section' : 'Hide Section'}
                </button>
            </div>
            <div class="form-group">
                <label>Weekday Hours (Monday - Friday)</label>
                <input type="text" value="${hours.weekdays || ''}" onchange="updateBusinessHours('weekdays', this.value)" placeholder="e.g., 9:00 AM - 6:00 PM">
            </div>
            <div class="form-group">
                <label>Weekend Hours (Saturday & Sunday)</label>
                <input type="text" value="${hours.weekends || ''}" onchange="updateBusinessHours('weekends', this.value)" placeholder="e.g., Closed">
            </div>
            <div class="form-group">
                <label>Timezone</label>
                <input type="text" value="${hours.timezone || ''}" onchange="updateBusinessHours('timezone', this.value)" placeholder="e.g., Philippine Standard Time (PST)">
            </div>
        </div>
    `;
}

// Department CRUD operations
window.updateDepartment = function (deptIndex, field, value) {
    if (!appData.contactPage?.departments?.[deptIndex]) return;
    appData.contactPage.departments[deptIndex][field] = value;
    if (field === 'name') {
        // Auto-generate ID from name
        const slug = value.toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
            .replace(/^-+|-+$/g, '');   // Remove leading/trailing hyphens

        appData.contactPage.departments[deptIndex].id = slug;

        // Update sidebar when name changes
        renderContactDepartmentsSidebar();
        // Also update the card title and reload editor to show new ID
        renderSingleDepartmentEditor(deptIndex);
    }
};

window.addContactDepartment = function () {
    if (!appData.contactPage) appData.contactPage = {};
    if (!appData.contactPage.departments) appData.contactPage.departments = [];

    appData.contactPage.departments.push({
        id: 'new-dept-' + Date.now(),
        name: 'New Department',
        dropdownLabel: 'New Department',
        description: '',
        formEmail: '',
        contacts: []
    });

    // Refresh sidebar and select the new department
    const newIndex = appData.contactPage.departments.length - 1;
    renderContactDepartmentsSidebar();
    selectDepartment(newIndex);
};

window.removeContactDepartment = function (deptIndex) {
    if (!confirm('Are you sure you want to delete this department?')) return;
    appData.contactPage.departments.splice(deptIndex, 1);

    // Reset selection and refresh
    window.currentDeptIndex = null;
    renderContactDepartmentsSidebar();
    renderContactDepartmentsEditor();
};

window.toggleDepartmentVisibility = function (deptIndex) {
    if (appData.contactPage && appData.contactPage.departments && appData.contactPage.departments[deptIndex]) {
        appData.contactPage.departments[deptIndex].isHidden = !appData.contactPage.departments[deptIndex].isHidden;
        renderSingleDepartmentEditor(deptIndex);
        renderContactDepartmentsSidebar();
    }
};

// Contact CRUD operations
window.addContact = function (deptIndex) {
    if (!appData.contactPage?.departments?.[deptIndex]) return;
    if (!appData.contactPage.departments[deptIndex].contacts) {
        appData.contactPage.departments[deptIndex].contacts = [];
    }

    appData.contactPage.departments[deptIndex].contacts.push({
        type: 'email',
        label: 'New Contact',
        value: ''
    });
    renderSingleDepartmentEditor(deptIndex);
};

window.removeContact = function (deptIndex, contactIndex) {
    if (!appData.contactPage?.departments?.[deptIndex]?.contacts) return;
    if (!confirm('Remove this contact?')) return;
    appData.contactPage.departments[deptIndex].contacts.splice(contactIndex, 1);
    renderSingleDepartmentEditor(deptIndex);
};

window.updateContact = function (deptIndex, contactIndex, field, value) {
    if (!appData.contactPage?.departments?.[deptIndex]?.contacts?.[contactIndex]) return;
    appData.contactPage.departments[deptIndex].contacts[contactIndex][field] = value;
};

window.updateContactValues = function (deptIndex, contactIndex, value) {
    if (!appData.contactPage?.departments?.[deptIndex]?.contacts?.[contactIndex]) return;
    const values = value.split('\n').map(v => v.trim()).filter(v => v);
    appData.contactPage.departments[deptIndex].contacts[contactIndex].values = values;
};

window.updateContactLinks = function (deptIndex, contactIndex, value) {
    if (!appData.contactPage?.departments?.[deptIndex]?.contacts?.[contactIndex]) return;
    const links = value.split('\n').map(v => v.trim()).filter(v => v);
    appData.contactPage.departments[deptIndex].contacts[contactIndex].links = links;
};

window.toggleMultipleValues = function (deptIndex, contactIndex) {
    if (!appData.contactPage?.departments?.[deptIndex]?.contacts?.[contactIndex]) return;

    const contact = appData.contactPage.departments[deptIndex].contacts[contactIndex];

    if (Array.isArray(contact.values)) {
        // Switch to single value
        const firstValue = contact.values[0] || '';
        contact.value = firstValue;
        delete contact.values;
        delete contact.links;
    } else {
        // Switch to multiple values
        contact.values = contact.value ? [contact.value] : [];
        delete contact.value;
        if (contact.type === 'social') {
            contact.links = [];
        }
    }

    renderSingleDepartmentEditor(deptIndex);
};

// Office location updates
window.updateOfficeLocation = function (field, value) {
    if (!appData.contactPage) appData.contactPage = {};
    if (!appData.contactPage.officeLocation) appData.contactPage.officeLocation = {};
    appData.contactPage.officeLocation[field] = value;
};

// Business hours updates
window.updateBusinessHours = function (field, value) {
    if (!appData.contactPage) appData.contactPage = {};
    if (!appData.contactPage.businessHours) appData.contactPage.businessHours = {};
    appData.contactPage.businessHours[field] = value;
};

// Helper to convert video URLs to embed URLs
function getEmbedUrl(url) {
    if (!url) return null;

    // YouTube
    const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return 'https://www.youtube.com/embed/' + ytMatch[1];
    }

    // Vimeo
    const vimeoMatch = url.match(/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
        return 'https://player.vimeo.com/video/' + vimeoMatch[1];
    }

    // Return original if no match (maybe it's already an embed link or other source)
    return url;
}

window.handleBlockVideoUpload = async function (input, postIndex, blockIndex) {
    const file = input.files[0];
    if (!file) return;
    if (file.type !== 'video/mp4') {
        alert('Only MP4 video files are supported. Please convert your video to MP4 format before uploading.');
        input.value = '';
        return;
    }
    const label = input.closest('label');
    label.childNodes[0].textContent = 'Uploading... ';
    label.style.opacity = '0.7';
    label.style.pointerEvents = 'none';
    try {
        const filePath = await uploadFileToS3(file, 'blog');
        appData.blogPage.posts[postIndex].blocks[blockIndex].url = filePath;
        renderBlogBlocks(postIndex);
    } catch (error) {
        console.error('Upload Error:', error);
        alert('Upload Error. Check console for details.');
    } finally {
        label.childNodes[0].textContent = 'Upload Video';
        label.style.opacity = '1';
        label.style.pointerEvents = 'auto';
        input.value = '';
    }
};

// --- Subscriber Management ---

// Pagination State
let allSubscribers = [];
let currentSubscriberPage = 1;
const subscribersPerPage = 10;

async function loadSubscribers() {
    try {
        const res = await authenticatedFetch(CONFIG.API_BASE + '/subscribers');
        allSubscribers = await res.json();

        // ensure newest first
        // If the API returns them in insertion order (oldest first), we reverse.
        // If we want to be safe, we just reverse what we get if that's the established pattern.
        // Original code did [...subscribers].reverse(), so we will reverse the array.
        // Note: destructively reversing allSubscribers is fine as it's a new array from json().
        allSubscribers.reverse();

        // Clamp Page (if items deleted or list shortened)
        const totalPages = Math.ceil(allSubscribers.length / subscribersPerPage);
        if (totalPages > 0 && currentSubscriberPage > totalPages) {
            currentSubscriberPage = totalPages;
        } else if (totalPages === 0) {
            currentSubscriberPage = 1;
        }

        renderSubscribers();
    } catch (error) {
        console.error('Error loading subscribers:', error);
        document.getElementById('subscribers-table-body').innerHTML = '<tr><td colspan="2" style="padding:12px; color:red;">Failed to load subscribers</td></tr>';
    }
}

window.populateSubscriberSettings = function () {
    // Load settings
    const welcomeMsgEl = document.getElementById('subscriber-welcome-msg');
    const subjectEl = document.getElementById('subscriber-email-subject');
    const titleEl = document.getElementById('subscriber-email-title');
    const quoteEl = document.getElementById('subscriber-email-quote');
    const closingEl = document.getElementById('subscriber-email-closing');

    if (appData.blogPage && appData.blogPage.settings) {
        if (welcomeMsgEl) welcomeMsgEl.value = appData.blogPage.settings.welcomeMessage || '';
        if (subjectEl) subjectEl.value = appData.blogPage.settings.emailSubject || '';
        if (titleEl) titleEl.value = appData.blogPage.settings.emailTitle || '';
        if (quoteEl) quoteEl.value = appData.blogPage.settings.emailQuote || '';
        if (closingEl) closingEl.value = appData.blogPage.settings.emailClosing || '';
    }
}

window.saveSubscriberSettings = async function () {
    const welcomeMsgEl = document.getElementById('subscriber-welcome-msg');
    const subjectEl = document.getElementById('subscriber-email-subject');
    const titleEl = document.getElementById('subscriber-email-title');
    const quoteEl = document.getElementById('subscriber-email-quote');
    const closingEl = document.getElementById('subscriber-email-closing');

    const msgEl = document.getElementById('sub-settings-msg');

    if (appData.blogPage && appData.blogPage.settings) {
        if (welcomeMsgEl) appData.blogPage.settings.welcomeMessage = welcomeMsgEl.value;
        if (subjectEl) appData.blogPage.settings.emailSubject = subjectEl.value;
        if (titleEl) appData.blogPage.settings.emailTitle = titleEl.value;
        if (quoteEl) appData.blogPage.settings.emailQuote = quoteEl.value;
        if (closingEl) appData.blogPage.settings.emailClosing = closingEl.value;

        if (msgEl) {
            msgEl.textContent = 'Saving...';
            msgEl.style.color = '#666';
        }

        if (window.saveData) {
            await window.saveData();
            if (msgEl) {
                msgEl.textContent = '✓ Saved!';
                msgEl.style.color = 'green';
                setTimeout(() => { msgEl.textContent = ''; }, 3000);
            }
        } else {
            console.error('saveData function not found');
            if (msgEl) {
                msgEl.textContent = 'Error: Save function not found.';
                msgEl.style.color = 'red';
            }
        }
    }
}

function renderSubscribers() {
    const tbody = document.getElementById('subscribers-table-body');
    const countEl = document.getElementById('subscriber-count');

    if (!tbody) return;

    countEl.textContent = `Total Subscribers: ${allSubscribers.length}`;
    tbody.innerHTML = '';

    if (allSubscribers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #666;">No subscribers yet.</td></tr>';
        renderPaginationControls();
        return;
    }

    const start = (currentSubscriberPage - 1) * subscribersPerPage;
    const end = start + subscribersPerPage;
    const pageItems = allSubscribers.slice(start, end);

    pageItems.forEach(sub => {
        // Handle both string (old data) and object (new data) formats
        const email = typeof sub === 'string' ? sub : sub.email;
        const dateStr = (typeof sub === 'object' && sub.date)
            ? new Date(sub.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #eee';
        row.innerHTML = `
            <td style="padding: 12px; color: #333;">${email}</td>
            <td style="padding: 12px; color: #666;">${dateStr}</td>
            <td style="padding: 12px; text-align: right;">
                <button onclick="deleteSubscriber('${email}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Remove</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderPaginationControls();
}

function renderPaginationControls() {
    const paginationEl = document.getElementById('pagination-controls');
    if (!paginationEl) return;

    paginationEl.innerHTML = '';
    const totalPages = Math.ceil(allSubscribers.length / subscribersPerPage);

    if (totalPages <= 1) return;

    // Prev Button
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '&lt; Prev';
    prevBtn.style.cssText = 'padding: 5px 15px; font-size: 0.9rem; background: #0f3460; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;';

    if (currentSubscriberPage === 1) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.5';
        prevBtn.style.cursor = 'default';
    } else {
        prevBtn.onclick = () => window.changeSubscriberPage(currentSubscriberPage - 1);
    }
    paginationEl.appendChild(prevBtn);

    // Page Info
    const pageInfo = document.createElement('span');
    pageInfo.innerText = `Page ${currentSubscriberPage} of ${totalPages}`;
    pageInfo.style.cssText = 'font-size: 0.9rem; color: #666; font-weight: 600;';
    paginationEl.appendChild(pageInfo);

    // Next Button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = 'Next &gt;';
    nextBtn.style.cssText = 'padding: 5px 15px; font-size: 0.9rem; background: #0f3460; color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;';

    if (currentSubscriberPage === totalPages) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'default';
    } else {
        nextBtn.onclick = () => window.changeSubscriberPage(currentSubscriberPage + 1);
    }
    paginationEl.appendChild(nextBtn);
}

window.changeSubscriberPage = function (newPage) {
    const totalPages = Math.ceil(allSubscribers.length / subscribersPerPage);
    if (newPage < 1 || newPage > totalPages) return;
    currentSubscriberPage = newPage;
    renderSubscribers();
};

window.deleteSubscriber = async function (email) {
    if (!confirm(`Are you sure you want to remove ${email} from the list?`)) return;

    try {
        const res = await authenticatedFetch(CONFIG.API_BASE + '/subscribers', {
            method: 'DELETE',
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
            // Reload list
            loadSubscribers();
        } else {
            alert('Failed to delete: ' + data.message);
        }
    } catch (err) {
        console.error('Error deleting subscriber:', err);
        alert('Error removing subscriber');
    }
};

window.downloadSubscribersCSV = async function () {
    try {
        const res = await authenticatedFetch(CONFIG.API_BASE + '/subscribers');
        const subscribers = await res.json();

        if (!subscribers || subscribers.length === 0) {
            alert('No subscribers to download.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,Email Address,Date Added\n";
        subscribers.forEach(sub => {
            const email = typeof sub === 'string' ? sub : sub.email;
            const date = (typeof sub === 'object' && sub.date) ? sub.date : '';
            csvContent += `${email},${date}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "escience_subscribers.csv");
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error downloading CSV:', error);
        alert('Failed to download subscriber list.');
    }
};

// --- Footer Functions ---
function renderFooterBrand() {
    const container = document.getElementById('footer-brand-editor');
    if (!container) return;

    if (!appData.footer) {
        appData.footer = getDefaultAppData().footer;
    }

    const brand = appData.footer.brand || {};

    container.innerHTML = `
        <div class="item-card premium-card ${brand.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Footer Brand ${brand.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <!--<button type="button" onclick="toggleSectionVisibility('footer.brand', 'renderFooterBrand', 'footer-brand-editor')" style="background:${brand.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${brand.hidden ? 'Show Section' : 'Hide Section'}
                </button> -->
            </div>
            <div class="form-group">
                <label>Brand Logo</label>
                <input type="file" id="footer-brand-logo" accept="image/*" 
                       onchange="handleFooterBrandLogoUpload(this)">
                <div class="image-preview" style="margin-top: 10px;">
                    ${brand.logoUrl ? `<img src="${assetUrl(brand.logoUrl)}" alt="Brand Logo" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd; border-radius: 4px;">` : '<p>No logo uploaded</p>'}
                </div>
            </div>
            <div class="form-group">
                <label>Brand Tagline</label>
                <input type="text" value="${brand.tagline || ''}" 
                       onchange="updateFooterBrand('tagline', this.value)" 
                       placeholder="e.g., Architects of Innovation since 2000">
            </div>
        </div>
    `;
}

function updateFooterBrand(field, value) {
    if (!appData.footer) appData.footer = {};
    if (!appData.footer.brand) appData.footer.brand = {};
    appData.footer.brand[field] = value;
}

async function handleFooterBrandLogoUpload(input) {
    if (!input.files[0]) return;
    if (!isValidImageFile(input.files[0])) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }
    try {
        const filePath = await processAndUpload(input.files[0], 'footer');
        appData.footer.brand.logoUrl = filePath;
        renderFooterBrand();
    } catch (error) {
        console.error('Error uploading footer brand logo:', error);
        alert('Error processing image file.');
    }
}

function renderFooterContact() {
    const container = document.getElementById('footer-contact-editor');
    if (!container) return;

    if (!appData.footer) {
        appData.footer = getDefaultAppData().footer;
    }

    const contact = appData.footer.contact || {};

    container.innerHTML = `
        <div class="item-card premium-card ${contact.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Contact Information ${contact.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <!-- <button type="button" onclick="toggleSectionVisibility('footer.contact', 'renderFooterContact', 'footer-contact-editor')" style="background:${contact.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${contact.hidden ? 'Show Section' : 'Hide Section'}
                </button> -->
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" value="${contact.email || ''}" 
                       onchange="updateFooterContact('email', this.value)" 
                       placeholder="sales@electronicscience.net">
            </div>
            <div class="form-group">
                <label>Phone Number</label>
                <input type="tel" value="${contact.phone || ''}" 
                       onchange="updateFooterContact('phone', this.value)" 
                       placeholder="02-8850-1324">
            </div>
        </div>
    `;
}

function updateFooterContact(field, value) {
    if (!appData.footer) appData.footer = {};
    if (!appData.footer.contact) appData.footer.contact = {};
    appData.footer.contact[field] = value;
}

function renderFooterNPCSeal() {
    const container = document.getElementById('footer-npc-editor');
    if (!container) return;

    if (!appData.footer) {
        appData.footer = getDefaultAppData().footer;
    }

    const npc = appData.footer.legal?.npcSeal || {};

    container.innerHTML = `
        <div class="item-card premium-card ${npc.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">NPC Seal Image ${npc.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <!-- <button type="button" onclick="toggleSectionVisibility('footer.legal.npcSeal', 'renderFooterNPCSeal', 'footer-npc-editor')" style="background:${npc.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${npc.hidden ? 'Show Section' : 'Hide Section'}
                </button> -->
            </div>
            <div class="form-group">
                <label>Upload Image</label>
                <input type="file" id="footer-npc-image" accept="image/*" 
                       onchange="handleFooterNPCImageUpload(this)">
                <div class="image-preview" style="margin-top: 15px; text-align: center;">
                    ${npc.imageUrl ? `<img src="${assetUrl(npc.imageUrl)}" alt="NPC Seal" style="max-width: 100%; max-height: 250px; border: 1px solid #eee; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">` : '<p style="color: #999; font-style: italic;">No image uploaded yet</p>'}
                </div>
            </div>
        </div>
    `;
}

function updateFooterNPCSeal(field, value) {
    if (!appData.footer) appData.footer = {};
    if (!appData.footer.legal) appData.footer.legal = {};
    if (!appData.footer.legal.npcSeal) appData.footer.legal.npcSeal = {};
    appData.footer.legal.npcSeal[field] = value;
}

async function handleFooterNPCImageUpload(input) {
    if (!input.files[0]) return;

    let file = input.files[0];

    if (!isValidImageFile(file)) {
        alert('Only JPEG, PNG, and GIF image files are accepted. Please convert your image before uploading.');
        input.value = '';
        return;
    }

    try {
        const filePath = await uploadFileToS3(file, 'footer');

        if (!appData.footer.legal) appData.footer.legal = {};
        if (!appData.footer.legal.npcSeal) appData.footer.legal.npcSeal = {};

        appData.footer.legal.npcSeal.imageUrl = filePath;
        renderFooterNPCSeal();

        if (window.saveData) {
            await window.saveData();
        }
    } catch (error) {
        console.error('Error uploading NPC Seal:', error);
        alert('Error uploading image.');
    }
}

function renderFooterConnect() {
    const container = document.getElementById('footer-connect-editor');
    if (!container) return;

    if (!appData.footer) {
        appData.footer = getDefaultAppData().footer;
    }

    const connect = appData.footer.connect || {};
    const facebook = connect.facebook || {};
    const linkedin = connect.linkedin || {};

    container.innerHTML = `
        <div class="item-card premium-card ${connect.hidden ? 'hidden-item' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h4 style="margin:0;">Social Media Links ${connect.hidden ? '<span style="color:#e67e22; font-size:0.8rem; margin-left:10px;">(Hidden)</span>' : ''}</h4>
                <!-- <button type="button" onclick="toggleSectionVisibility('footer.connect', 'renderFooterConnect', 'footer-connect-editor')" style="background:${connect.hidden ? '#27ae60' : '#607d8b'}; color:white; padding:4px 8px; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">
                    ${connect.hidden ? 'Show Section' : 'Hide Section'}
                </button> -->
            </div>
            
            <div style="margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid #eee;">
                <h5 style="margin-top: 0;">Facebook</h5>
                <div class="form-group">
                    <label>Facebook URL</label>
                    <input type="url" value="${facebook.url || ''}" 
                           onchange="updateFooterConnect('facebook', 'url', this.value)" 
                           placeholder="https://facebook.com/...">
                </div>
            </div>

            <div>
                <h5 style="margin-top: 0;">LinkedIn</h5>
                <div class="form-group">
                    <label>LinkedIn URL</label>
                    <input type="url" value="${linkedin.url || ''}" 
                           onchange="updateFooterConnect('linkedin', 'url', this.value)" 
                           placeholder="https://linkedin.com/company/...">
                </div>
            </div>
        </div>
    `;
}

window.updateFooterConnect = function (platform, field, value) {
    if (!appData.footer) appData.footer = {};
    if (!appData.footer.connect) appData.footer.connect = {};
    if (!appData.footer.connect[platform]) appData.footer.connect[platform] = {};

    appData.footer.connect[platform][field] = value;
};


// --- Legal Functions ---
window.renderLegalEditor = async function (type) {
    const containerBlocks = document.getElementById(`legal-${type}-blocks`);
    if (!containerBlocks) return;

    if (!appData.legalPages) {
        appData.legalPages = getDefaultAppData().legalPages;
    }

    // Auto-extract if empty
    if (!appData.legalPages[type].sections || appData.legalPages[type].sections.length === 0) {
        await extractLegalContent(type);
    }

    // Render Section Blocks
    renderLegalBlocks(type);
};

window.renderLegalBlocks = function (type) {
    const containerBlocks = document.getElementById(`legal-${type}-blocks`);
    if (!containerBlocks) return;
    containerBlocks.innerHTML = '';

    const sections = appData.legalPages[type].sections || [];

    sections.forEach((section, index) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'item-card';
        sectionDiv.style.background = 'white';
        sectionDiv.style.padding = '20px';
        sectionDiv.style.marginBottom = '20px';
        sectionDiv.style.position = 'relative';

        const editorId = `legal-editor-${type}-${index}`;

        sectionDiv.innerHTML = `
            <div class="block-controls" style="position: absolute; top: 10px; right: 10px; display: flex; gap: 5px;">
                <button class="block-btn" onclick="moveLegalBlock('${type}', ${index}, -1)" title="Move up">↑</button>
                <button class="block-btn" onclick="moveLegalBlock('${type}', ${index}, 1)" title="Move down">↓</button>
                <button class="block-btn remove-btn" onclick="removeLegalBlock('${type}', ${index})" title="Remove section">×</button>
            </div>
            <div class="form-group" style="padding-right: 80px;">
                <label>Section Title (Optional)</label>
                <input type="text" value="${section.title || ''}" onchange="updateLegalBlockField('${type}', ${index}, 'title', this.value)" placeholder="e.g., Your Rights and Your Preferences">
            </div>
            <div class="form-group">
                <label>Section Content</label>
                <div id="${editorId}" style="min-height: 200px; background: white;">${section.content || ''}</div>
            </div>
        `;

        containerBlocks.appendChild(sectionDiv);

        // Init Quill
        setTimeout(() => {
            const editorElement = document.getElementById(editorId);
            if (editorElement && !editorElement.classList.contains('ql-container')) {
                const quill = new Quill(`#${editorId}`, {
                    modules: {
                        toolbar: [
                            [{ 'header': [2, 3, false] }],
                            ['bold', 'italic', 'underline'],
                            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                            ['link', 'clean']
                        ]
                    },
                    theme: 'snow'
                });

                quill.on('text-change', () => {
                    sections[index].content = quill.root.innerHTML;
                });
            }
        }, 0);
    });
};

window.updateLegalBlockField = function (type, index, field, value) {
    appData.legalPages[type].sections[index][field] = value;
};

window.addLegalBlock = function (type) {
    if (!appData.legalPages[type].sections) appData.legalPages[type].sections = [];
    appData.legalPages[type].sections.push({ title: '', content: '' });
    renderLegalBlocks(type);
};

window.removeLegalBlock = function (type, index) {
    if (confirm('Are you sure you want to remove this section?')) {
        appData.legalPages[type].sections.splice(index, 1);
        renderLegalBlocks(type);
    }
};

window.moveLegalBlock = function (type, index, direction) {
    const list = appData.legalPages[type].sections;
    if (index + direction < 0 || index + direction >= list.length) return;
    const temp = list[index];
    list[index] = list[index + direction];
    list[index + direction] = temp;
    renderLegalBlocks(type);
};

async function extractLegalContent(type) {
    try {
        const url = type === 'terms' ? '../nav-pages/terms.html' : '../nav-pages/privacy.html';
        const response = await fetch(url);
        if (!response.ok) return;
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const page = appData.legalPages[type];

        // Extract Sections
        const sectionEls = doc.querySelectorAll('.terms-section');
        page.sections = [];

        sectionEls.forEach(el => {
            const h2 = el.querySelector('h2');
            const h3 = el.querySelector('h3');
            const title = (h2 || h3)?.textContent.trim() || '';

            // Clone the element to manipulate and extract content
            const clone = el.cloneNode(true);
            // Remove the title from content
            if (h2) {
                const h2el = clone.querySelector('h2');
                if (h2el) clone.removeChild(h2el);
            }
            if (h3) {
                const h3el = clone.querySelector('h3');
                if (h3el) clone.removeChild(h3el);
            }

            page.sections.push({
                title: title,
                content: clone.innerHTML.trim()
            });
        });
    } catch (err) {
        console.error(`Failed to extract ${type} content:`, err);
    }
}

// --- Mobile Sidebar Toggle ---
document.addEventListener('DOMContentLoaded', () => {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar-container');
    const overlay = document.getElementById('mobile-overlay');

    if (mobileBtn && sidebar && overlay) {
        // Toggle sidebar submenu
        // Toggle Legal sidebar section
        window.toggleLegalSidebar = function () {
            const section = document.getElementById('legal-sidebar-section');
            if (section) {
                const isActive = section.classList.toggle('active-tab');
                // Ensure the list expands (max-height transition is in CSS for product-list-sidebar)
            }
        };

        function toggleSidebar() {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        }

        function closeSidebar() {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');

            // Also close Main Header Nav
            const mainNav = document.querySelector('.main-nav');
            if (mainNav) mainNav.classList.remove('open');
            mobileBtn.classList.remove('open');
        }

        mobileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSidebar();

            // Also toggle Main Header Nav
            const mainNav = document.querySelector('.main-nav');
            if (mainNav) {
                mainNav.classList.toggle('open');
                mobileBtn.classList.toggle('open'); // For hamburger animation
            }
        });

        overlay.addEventListener('click', closeSidebar);

        // Close sidebar when clicking a nav item on mobile
        const navItems = document.querySelectorAll('.sidebar li');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            });
        });
    }

    // Logo Click -> Dashboard
    const logo = document.getElementById('admin-logo');
    if (logo) {
        logo.addEventListener('click', () => {
            // Trigger click on hidden dashboard tab or call switch function if accessible
            const dashboardTab = document.querySelector('li[data-main-tab="dashboard"]');
            if (dashboardTab) dashboardTab.click();
        });
    }


});


// Hook into existing tab switching or init logic
// We need to ensure loadSubscribers is called when the Subscriber tab is clicked.
// Finding the main tab event listener...
document.addEventListener('DOMContentLoaded', () => {
    // ... existing init ...
    // Add listener for main tabs if not already global
    const mainTabs = document.querySelectorAll('.main-nav li');
    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Close mobile menu if open
            if (window.innerWidth <= 768) {
                const mainNav = document.querySelector('.main-nav');
                const mobileBtn = document.getElementById('mobile-menu-btn');
                if (mainNav) mainNav.classList.remove('open');
                if (mobileBtn) mobileBtn.classList.remove('open');

                // Keep sidebar open so user can see sub-menu
                // But we need to make sure the overlay is still there if we want modal behavior?
                // Actually, if we close the blue nav, we see the white sidebar.
                // The white sidebar is `sidebar-container`. It should be `open` if it's not already.
                // The `toggleSidebar` in the hamburger click opens BOTH.
                // So if we just remove `open` from mainNav, the sidebar remains open.
            }

            const tabName = tab.getAttribute('data-main-tab');
            if (tabName === 'subscribers') {
                loadSubscribers();
                // Show subscribers section
                document.querySelectorAll('.editor-section').forEach(s => s.classList.remove('active'));
                const subSection = document.getElementById('subscribers');
                if (subSection) subSection.classList.add('active');
            }
        });
    });
});

// Custom Sections Management
window.currentCustomSectionPage = null;
window.currentCustomSectionPage = null;
window.currentCustomSectionIndex = null;

window.addCustomSection = function(pageKey) {
    if (!appData[pageKey]) appData[pageKey] = { customSections: [] };
    if (!appData[pageKey].customSections) appData[pageKey].customSections = [];
    if (!appData[pageKey].sectionOrder) {
        appData[pageKey].sectionOrder = [...DEFAULT_SECTION_ORDERS[pageKey]];
    }

    let initialBlocks = JSON.parse(JSON.stringify(VISUAL_TEMPLATES['split-image-left'].defaultBlocks));
    initialBlocks.forEach(b => b.id = 'block-' + Math.random().toString(36).substr(2, 9));

    const newSection = {
        title: "New Section",
        template: "split-image-left",
        blocks: initialBlocks,
        hidden: false
    };

    const newIndex = appData[pageKey].customSections.length;
    appData[pageKey].customSections.push(newSection);
    appData[pageKey].sectionOrder.push(`custom-${newIndex}`);

    renderAllSidebarSections(pageKey);
    selectCustomSection(pageKey, newIndex);
};


// ===== VISUAL BUILDER FOR CUSTOM SECTIONS =====

// Register abstract font sizes with Quill using rem values from the design system
const BUILTIN_SECTIONS = {
    'homePage': [
        { id: 'hero', name: 'Hero Section' },
        { id: 'stats', name: 'Stats' },
        { id: 'our-clients', name: 'Our Clients' },
        { id: 'homepage-problem-section', name: 'Problem Statement' },
        { id: 'solutions', name: 'Solutions' },
        { id: 'why-us', name: 'Why Us' },
        { id: 'testimonials', name: 'Testimonials' },
        { id: 'contact', name: 'Contact Form' }
    ],
    'companyPage': [
        { id: 'company-hero', name: 'Hero Section' },
        { id: 'timeline', name: 'Timeline Management' },
        { id: 'about-escience', name: 'Who We Are' },
        { id: 'family-culture', name: 'Family Culture' },
        { id: 'mission', name: 'Mission' },
        { id: 'vision', name: 'Vision' },
        { id: 'leaders', name: 'Our Leaders' },
        { id: 'company-careers-intro', name: 'Careers Intro' },
        { id: 'company-cta', name: 'CTA Section' }
    ],
    'careersPage': [
        { id: 'careers-hero', name: 'Hero Section' },
        { id: 'why-join', name: 'Why Join eScience' },
        { id: 'our-culture', name: 'Office Culture' },
        { id: 'perks', name: 'Perks & Benefits' },
        { id: 'team-culture', name: 'Team Culture' },
        { id: 'opportunities', name: 'Career Opportunities' },
        { id: 'careers-apply', name: 'Apply Section' }
    ]
};

const DEFAULT_SECTION_ORDERS = {
    'homePage': ['hero', 'stats', 'our-clients', 'homepage-problem-section', 'solutions', 'why-us', 'testimonials', 'contact'],
    'companyPage': ['company-hero', 'timeline', 'about-escience', 'family-culture', 'mission', 'vision', 'leaders', 'company-careers-intro', 'company-cta'],
    'careersPage': ['careers-hero', 'why-join', 'our-culture', 'perks', 'team-culture', 'opportunities', 'careers-apply']
};

window.renderAllSidebarSections = function(pageKey) {
    const listIdMap = {
        'homePage': 'home-sections-list',
        'companyPage': 'company-sections-list',
        'careersPage': 'careers-sections-list'
    };
    const listId = listIdMap[pageKey];
    const container = document.getElementById(listId);
    if (!container) return;

    container.innerHTML = '';
    
    // Ensure sectionOrder exists
    if (!appData[pageKey]) appData[pageKey] = {};
    if (!appData[pageKey].sectionOrder) {
        appData[pageKey].sectionOrder = [...DEFAULT_SECTION_ORDERS[pageKey]];
        // Append any existing custom sections that might not be in the order
        const customCount = (appData[pageKey].customSections || []).length;
        for (let i = 0; i < customCount; i++) {
            appData[pageKey].sectionOrder.push(`custom-${i}`);
        }
    }

    const order = appData[pageKey].sectionOrder;

    order.forEach((sectionId, index) => {
        const li = document.createElement('li');
        li.setAttribute('draggable', 'true');
        li.dataset.sectionId = sectionId;
        li.dataset.index = index;
        
        // Drag events
        li.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', index);
            li.classList.add('dragging');
        };
        li.ondragend = () => li.classList.remove('dragging');
        li.ondragover = (e) => e.preventDefault();
        li.ondrop = (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            if (fromIndex !== toIndex) {
                const movedItem = order.splice(fromIndex, 1)[0];
                order.splice(toIndex, 0, movedItem);
                renderAllSidebarSections(pageKey);
                // Also update any active selection to match new index if it was a custom section
                if (window.currentCustomSectionPage === pageKey) {
                    // Logic to maintain focus if needed
                }
            }
        };

        if (sectionId.startsWith('custom-')) {
            const customIndex = parseInt(sectionId.replace('custom-', ''));
            const section = appData[pageKey].customSections[customIndex];
            if (!section) return; // Should not happen if data is sync

            li.className = 'custom-section-item';
            if (window.currentCustomSectionPage === pageKey && window.currentCustomSectionIndex === customIndex) {
                li.classList.add('active-tab');
            }
            li.innerHTML = `
                <span style="font-size: 0.8rem; margin-right: 8px; cursor: grab;">::</span>
                <span>${section.hidden ? '<span style="color:#e67e22; font-size:0.8rem;">(Hidden)</span> ' : ''}${section.title || `Section #${customIndex + 1}`}</span>
            `;
            li.onclick = (e) => {
                e.stopPropagation();
                selectCustomSection(pageKey, customIndex);
            };
        } else {
            // Built-in section
            const builtin = BUILTIN_SECTIONS[pageKey].find(s => s.id === sectionId);
            if (!builtin) return;

            li.dataset.tab = builtin.id;
            li.innerHTML = `
                <span style="font-size: 0.8rem; margin-right: 8px; cursor: grab;">::</span>
                <span>${builtin.name}</span>
            `;
            li.onclick = () => window.handleSidebarItemClick(li);
        }
        
        container.appendChild(li);
    });
};

(function registerQuillFontSizes() {
    try {
        const SizeStyle = Quill.import('attributors/style/size');
        SizeStyle.allowedValues = ['0.75rem', '1.25rem', '1.5rem', '2rem', '3rem'];
        Quill.register(SizeStyle, true);
    } catch(e) { /* Quill not loaded yet — ok, will fall back to defaults */ }
})();

const VISUAL_TEMPLATES = {
    'split-image-left': {
        name: 'Split: Image Left',
        svg: `<svg viewBox="0 0 100 60"><rect x="5" y="5" width="40" height="50" rx="2" fill="#46C1A4" opacity="0.3"/><rect x="50" y="10" width="45" height="5" rx="1" fill="#fff"/><rect x="50" y="20" width="45" height="2" rx="0.5" fill="#888"/><rect x="50" y="25" width="45" height="2" rx="0.5" fill="#888"/><rect x="50" y="30" width="30" height="2" rx="0.5" fill="#888"/><rect x="50" y="40" width="20" height="6" rx="1" fill="#46C1A4"/></svg>`,
        defaultBlocks: [
            { id: 'b1', type: 'image', row: 0, col: 0, imageUrl: '' },
            { id: 'b2', type: 'text', row: 0, col: 1, content: '<h2>Heading</h2><p>Provide a description here.</p>' },
            { id: 'b3', type: 'button', row: 1, col: 1, buttonText: 'Learn More', buttonAlign: 'left', buttonBgColor: '#46C1A4', buttonTextColor: '#ffffff' }
        ]
    },
    'split-image-right': {
        name: 'Split: Image Right',
        svg: `<svg viewBox="0 0 100 60"><rect x="55" y="5" width="40" height="50" rx="2" fill="#46C1A4" opacity="0.3"/><rect x="5" y="10" width="45" height="5" rx="1" fill="#fff"/><rect x="5" y="20" width="45" height="2" rx="0.5" fill="#888"/><rect x="5" y="25" width="45" height="2" rx="0.5" fill="#888"/><rect x="5" y="30" width="30" height="2" rx="0.5" fill="#888"/><rect x="5" y="40" width="20" height="6" rx="1" fill="#46C1A4"/></svg>`,
        defaultBlocks: [
            { id: 'b1', type: 'text', row: 0, col: 0, content: '<h2>Heading</h2><p>Provide a description here.</p>' },
            { id: 'b2', type: 'image', row: 0, col: 1, imageUrl: '' },
            { id: 'b3', type: 'button', row: 1, col: 0, buttonText: 'Learn More', buttonAlign: 'left', buttonBgColor: '#46C1A4', buttonTextColor: '#ffffff' }
        ]
    },
    'full-width-text': {
        name: 'Full Width Text',
        svg: `<svg viewBox="0 0 100 60"><rect x="10" y="10" width="80" height="5" rx="1" fill="#fff"/><rect x="10" y="20" width="80" height="2" rx="0.5" fill="#888"/><rect x="10" y="25" width="80" height="2" rx="0.5" fill="#888"/><rect x="10" y="30" width="60" height="2" rx="0.5" fill="#888"/><rect x="40" y="40" width="20" height="6" rx="1" fill="#46C1A4"/></svg>`,
        defaultBlocks: [
            { id: 'b1', type: 'text', row: 0, col: 0, content: '<h2 style="text-align: center;">Section Heading</h2><p style="text-align: center;">Write your full-width text content here.</p>' },
            { id: 'b2', type: 'button', row: 1, col: 0, buttonText: 'Learn More', buttonAlign: 'center', buttonBgColor: '#46C1A4', buttonTextColor: '#ffffff' }
        ]
    },
    'centered-hero': {
        name: 'Centered Hero',
        svg: `<svg viewBox="0 0 100 60"><rect x="0" y="0" width="100" height="60" fill="#111"/><rect x="20" y="15" width="60" height="6" rx="1" fill="#fff"/><rect x="30" y="25" width="40" height="2" rx="0.5" fill="#888"/><rect x="40" y="35" width="20" height="6" rx="1" fill="#46C1A4"/></svg>`,
        defaultBlocks: [
            { id: 'b1', type: 'image', row: 0, col: 0, imageUrl: '' },
            { id: 'b2', type: 'text', row: 1, col: 0, content: '<h1 style="text-align: center; color: white;">Hero Title</h1><p style="text-align: center; color: white;">Engaging subtitle goes here.</p>' },
            { id: 'b3', type: 'button', row: 2, col: 0, buttonText: 'Learn More', buttonAlign: 'center', buttonBgColor: '#46C1A4', buttonTextColor: '#ffffff' }
        ]
    },
    'blank': {
        name: 'Customizable (Blank)',
        svg: `<svg viewBox="0 0 100 60"><rect x="5" y="5" width="90" height="50" rx="2" fill="none" stroke="#666" stroke-dasharray="3,3"/><text x="50" y="35" font-size="10" text-anchor="middle" fill="#666" font-family="sans-serif">BLANK</text></svg>`,
        defaultBlocks: []
    }
};

// Drop zone tracking
window.handleComponentDragStart = function(e) {
    e.dataTransfer.setData('componentType', e.currentTarget.dataset.type);
};

// ── Grid helpers ──────────────────────────────────────────────────────────────

/** Assign row/col defaults to any block that is missing them */
function normalizeBlockLayout(blocks) {
    // If every block already has a row, leave them alone
    const anyHasRow = blocks.some(b => b.row !== undefined);
    if (!anyHasRow) {
        // Legacy flat list → assign each its own row
        blocks.forEach((b, i) => { b.row = i; b.col = 0; });
    } else {
        // Fill blanks
        blocks.forEach((b, i) => {
            if (b.row === undefined) { b.row = i; b.col = 0; }
            if (b.col === undefined) b.col = 0;
        });
    }
}

/** Return sorted array of rows, each containing sorted array of {block, idx} */
function getRowGroups(blocks) {
    const rowMap = {};
    blocks.forEach((block, idx) => {
        const r = block.row;
        if (!rowMap[r]) rowMap[r] = [];
        rowMap[r].push({ block, idx });
    });
    return Object.keys(rowMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map(rowKey => ({
            rowKey,
            items: rowMap[rowKey].sort((a, b) => (a.block.col ?? 0) - (b.block.col ?? 0))
        }));
}

/** Compact row/col numbers so there are no gaps */
function compactLayout(blocks) {
    const groups = getRowGroups(blocks);
    groups.forEach((group, rIdx) => {
        group.items.forEach((item, cIdx) => {
            item.block.row = rIdx;
            item.block.col = cIdx;
        });
    });
}

// ── Drag event handlers ───────────────────────────────────────────────────────

window.handleBlockDragStart = function(e, bIdx) {
    const block = e.currentTarget.closest('.builder-block');
    e.dataTransfer.setData('blockIndex', String(bIdx));
    e.dataTransfer.setData('dragType', 'block-reorder');
    
    // Set the whole block as the drag image instead of just the handle
    if (block && e.dataTransfer.setDragImage) {
        // Offset so it feels like you're grabbing the handle
        e.dataTransfer.setDragImage(block, 20, 20);
    }
    
    if (block) block.style.opacity = '0.4';
    e.stopPropagation();
};

window.handleBlockDragEnd = function(e) {
    const block = e.currentTarget.closest('.builder-block');
    if (block) block.style.opacity = '';
    document.querySelectorAll('.block-drop-indicator').forEach(el => el.remove());
};

/**
 * Dragover on a block:
 *  left 33%  → vertical indicator on left  (beside-left)
 *  right 33% → vertical indicator on right (beside-right)
 *  middle    → horizontal indicator above/below (row-above / row-below)
 */
window.handleBlockDragOver = function(e, bIdx) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.block-drop-indicator').forEach(el => el.remove());

    const blockEl = e.currentTarget;
    const rect = blockEl.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const indicator = document.createElement('div');
    indicator.className = 'block-drop-indicator';

    if (relX < w * 0.33) {
        // Beside — to the left
        indicator.classList.add('vertical');
        indicator.dataset.insertType = 'beside-left';
        indicator.dataset.targetIdx = bIdx;
        blockEl.parentNode.insertBefore(indicator, blockEl);
    } else if (relX > w * 0.67) {
        // Beside — to the right
        indicator.classList.add('vertical');
        indicator.dataset.insertType = 'beside-right';
        indicator.dataset.targetIdx = bIdx;
        blockEl.parentNode.insertBefore(indicator, blockEl.nextSibling);
    } else if (relY < h / 2) {
        // New row above
        indicator.classList.add('horizontal');
        indicator.dataset.insertType = 'row-above';
        indicator.dataset.targetIdx = bIdx;
        blockEl.closest('.builder-row').parentNode.insertBefore(indicator, blockEl.closest('.builder-row'));
    } else {
        // New row below
        indicator.classList.add('horizontal');
        indicator.dataset.insertType = 'row-below';
        indicator.dataset.targetIdx = bIdx;
        const rowEl = blockEl.closest('.builder-row');
        rowEl.parentNode.insertBefore(indicator, rowEl.nextSibling);
    }
};

/** Canvas-level dragover (empty space below all rows) */
window.handleCanvasDragOver = function(e) {
    e.preventDefault();
    document.querySelectorAll('.block-drop-indicator').forEach(el => el.remove());
    const indicator = document.createElement('div');
    indicator.className = 'block-drop-indicator horizontal';
    indicator.dataset.insertType = 'append-row';
    e.currentTarget.appendChild(indicator);
};

window.handleCanvasDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();

    const dragType = e.dataTransfer.getData('dragType');
    const pageKey = window.currentCustomSectionPage;
    const index = window.currentCustomSectionIndex;
    if (index === undefined || index === null) return;
    const section = appData[pageKey].customSections[index];
    if (!section.blocks) section.blocks = [];

    const indicator = document.querySelector('.block-drop-indicator');
    const insertType = indicator ? indicator.dataset.insertType : 'append-row';
    const targetIdx = indicator ? parseInt(indicator.dataset.targetIdx) : NaN;
    document.querySelectorAll('.block-drop-indicator').forEach(el => el.remove());

    const blocks = section.blocks;
    normalizeBlockLayout(blocks);

    if (dragType === 'block-reorder') {
        const fromIdx = parseInt(e.dataTransfer.getData('blockIndex'));
        if (isNaN(fromIdx) || fromIdx === targetIdx) { renderBuilderBlocks(pageKey, index); return; }
        const movedBlock = blocks[fromIdx];
        const ref = blocks[targetIdx];
        if (!ref) { renderBuilderBlocks(pageKey, index); return; }

        if (insertType === 'beside-left') {
            // Insert moved into ref's row, just before ref's col
            blocks.forEach(b => { if (b.row === ref.row && b.col >= ref.col) b.col++; });
            movedBlock.row = ref.row;
            movedBlock.col = ref.col - 1; // will be compacted
            // Temporarily remove from position by assigning unused row
            // compactLayout will fix it
        } else if (insertType === 'beside-right') {
            blocks.forEach(b => { if (b.row === ref.row && b.col > ref.col) b.col++; });
            movedBlock.row = ref.row;
            movedBlock.col = ref.col + 1;
        } else if (insertType === 'row-above') {
            // Insert movedBlock as its own row above ref's row
            blocks.forEach(b => { if (b !== movedBlock && b.row >= ref.row) b.row += 2; });
            movedBlock.row = ref.row;
            movedBlock.col = 0;
        } else if (insertType === 'row-below') {
            blocks.forEach(b => { if (b !== movedBlock && b.row > ref.row) b.row += 2; });
            movedBlock.row = ref.row + 1;
            movedBlock.col = 0;
        }
        compactLayout(blocks);
    } else {
        // New component from sidebar
        const type = e.dataTransfer.getData('componentType');
        if (!type) return;
        const maxRow = blocks.reduce((max, b) => Math.max(max, b.row ?? 0), -1);
        let newRow = maxRow + 1, newCol = 0;

        if (!isNaN(targetIdx) && blocks[targetIdx]) {
            const ref = blocks[targetIdx];
            if (insertType === 'beside-left') {
                blocks.forEach(b => { if (b.row === ref.row && b.col >= ref.col) b.col++; });
                newRow = ref.row; newCol = ref.col - 1;
            } else if (insertType === 'beside-right') {
                blocks.forEach(b => { if (b.row === ref.row && b.col > ref.col) b.col++; });
                newRow = ref.row; newCol = ref.col + 1;
            } else if (insertType === 'row-above') {
                blocks.forEach(b => { if (b.row >= ref.row) b.row += 2; });
                newRow = ref.row; newCol = 0;
            } else if (insertType === 'row-below') {
                blocks.forEach(b => { if (b.row > ref.row) b.row += 2; });
                newRow = ref.row + 1; newCol = 0;
            }
        }

        blocks.push({
            id: 'block-' + Date.now(),
            type,
            content: type === 'text' ? '<p>Enter your text here...</p>' : '',
            imageUrl: '',
            buttonText: type === 'button' ? 'Click Me' : '',
            buttonLink: '#',
            buttonAlign: type === 'button' ? 'left' : '',
            buttonBgColor: type === 'button' ? '#46C1A4' : '',
            buttonTextColor: type === 'button' ? '#ffffff' : '',
            settings: {},
            row: newRow,
            col: newCol,
            height: null
        });
        compactLayout(blocks);
    }
    renderBuilderBlocks(pageKey, index);
};

// ── Canvas Renderer ───────────────────────────────────────────────────────────

window.renderBuilderBlocks = function(pageKey, sectionIndex) {
    const canvasEl = document.getElementById('section-builder-canvas');
    if (!canvasEl) return;

    const section = appData[pageKey].customSections[sectionIndex];
    const blocks = section.blocks || [];
    const template = section.template || 'full-width-text';
    const isCentered = template === 'centered-hero';

    normalizeBlockLayout(blocks);

    canvasEl.innerHTML = '';
    canvasEl.className = 'builder-canvas';
    if (isCentered) canvasEl.classList.add('canvas-centered');
    if (template === 'blank') canvasEl.classList.add('canvas-blank');

    // Canvas-level drop (empty area = append new row)
    canvasEl.setAttribute('ondragover', 'handleCanvasDragOver(event)');
    canvasEl.setAttribute('ondrop', 'handleCanvasDrop(event)');

    if (blocks.length === 0) {
        const ph = document.createElement('div');
        ph.className = 'canvas-placeholder';
        ph.innerHTML = `<div>⊞ Drag components here</div><small>Drop on the left/right edge of a block to add beside it<br>Drop on the center to create a new row</small>`;
        canvasEl.appendChild(ph);
        return;
    }

    const rowGroups = getRowGroups(blocks);

    rowGroups.forEach(({ items }) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'builder-row';

        items.forEach(({ block, idx: bIdx }) => {
            const blockEl = document.createElement('div');
            blockEl.className = 'builder-block';
            blockEl.setAttribute('ondragover', `handleBlockDragOver(event, ${bIdx})`);
            blockEl.setAttribute('ondrop', `handleCanvasDrop(event)`);
            if (block.height) blockEl.style.minHeight = block.height + 'px';

            blockEl.innerHTML = `
                <div class="block-header">
                    <div class="block-type">
                        <span class="block-handle" 
                              title="Drag to reorder" 
                              draggable="true" 
                              ondragstart="handleBlockDragStart(event, ${bIdx})"
                              ondragend="handleBlockDragEnd(event)">⠿</span>
                        ${block.type.toUpperCase()}
                    </div>
                    <div class="block-actions">
                        <button class="block-btn delete" onclick="deleteBlock(${bIdx})" title="Delete block">
                            <svg width="14" height="14" viewBox="0 0 24 24"><path fill="currentColor" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg>
                        </button>
                    </div>
                </div>
                <div class="block-content" style="min-height:${block.height || 80}px;">
                    ${renderBlockEditor(block, bIdx, pageKey, sectionIndex)}
                </div>
                <div class="block-resize-handle" onmousedown="startBlockResize(event, ${bIdx})" title="Drag to resize"></div>
            `;
            rowEl.appendChild(blockEl);

            // Init Quill if text
            if (block.type === 'text') {
                const qId = `quill-block-${block.id}`;
                setTimeout(() => {
                    const el = document.getElementById(qId);
                    if (!el || el.dataset.quillInit) return;
                    el.dataset.quillInit = '1';
                    const quill = new Quill(`#${qId}`, {
                        theme: 'snow',
                        modules: {
                            toolbar: [
                                [{ 'size': ['0.75rem', false, '1.25rem', '1.5rem', '2rem', '3rem'] }],
                                ['bold', 'italic', 'underline'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                ['link', 'clean']
                            ]
                        }
                    });
                    if (block.content) quill.root.innerHTML = block.content;
                    quill.on('text-change', () => { block.content = quill.root.innerHTML; });
                }, 0);
            }
        });

        canvasEl.appendChild(rowEl);
    });
};



function renderBlockEditor(block, bIdx, pageKey, sIdx) {
    switch (block.type) {
        case 'text':
            return `<div id="quill-block-${block.id}" style="height:120px; background:white; color:black;">${block.content || ''}</div>`;
        case 'image':
            return `
                <div style="display:flex; gap:10px; align-items:center;">
                    <img id="prev-block-${bIdx}" src="${block.imageUrl || '../assets/placeholder.png'}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid #444;">
                    <div style="flex:1;">
                        <input type="file" onchange="uploadBlockImage(${bIdx}, this.files[0])" style="font-size:0.75rem;">
                        <input type="text" value="${block.imageUrl || ''}" placeholder="Image URL" onchange="updateBlockField(${bIdx}, 'imageUrl', this.value); document.getElementById('prev-block-${bIdx}').src=this.value;" style="margin-top:5px; background:#111; color:white; border:1px solid #333; padding:5px; width:100%;">
                    </div>
                </div>
            `;
        case 'button':
            return `
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div>
                            <label style="font-size:0.7rem; color:#888;">Text</label>
                            <input type="text" value="${block.buttonText || ''}" onchange="updateBlockField(${bIdx}, 'buttonText', this.value)" style="width:100%; background:#111; color:white; border:1px solid #333; padding:5px;">
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:#888;">Link</label>
                            <input type="text" value="${block.buttonLink || ''}" onchange="updateBlockField(${bIdx}, 'buttonLink', this.value)" style="width:100%; background:#111; color:white; border:1px solid #333; padding:5px;">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; align-items:center;">
                        <div>
                            <label style="font-size:0.7rem; color:#888;">Align</label>
                            <select onchange="updateBlockField(${bIdx}, 'buttonAlign', this.value)" style="width:100%; background:#111; color:white; border:1px solid #333; padding:4px;">
                                <option value="left" ${block.buttonAlign === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${block.buttonAlign === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${block.buttonAlign === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:#888;">Bg Color</label>
                            <input type="color" value="${block.buttonBgColor || '#46C1A4'}" onchange="updateBlockField(${bIdx}, 'buttonBgColor', this.value)" style="width:100%; height:28px; background:none; border:none; padding:0; cursor:pointer;">
                        </div>
                        <div>
                            <label style="font-size:0.7rem; color:#888;">Text Color</label>
                            <input type="color" value="${block.buttonTextColor || '#ffffff'}" onchange="updateBlockField(${bIdx}, 'buttonTextColor', this.value)" style="width:100%; height:28px; background:none; border:none; padding:0; cursor:pointer;">
                        </div>
                    </div>
                </div>
            `;
        default:
            return `<div style="color:#666; font-size:0.8rem; font-style:italic;">Uses site data for ${block.type}</div>`;
    }
}

window.updateBlockField = function(bIdx, field, value) {
    const pageKey = window.currentCustomSectionPage;
    const sIdx = window.currentCustomSectionIndex;
    appData[pageKey].customSections[sIdx].blocks[bIdx][field] = value;
};

window.deleteBlock = function(bIdx) {
    if (!confirm('Remove this block?')) return;
    const pageKey = window.currentCustomSectionPage;
    const sIdx = window.currentCustomSectionIndex;
    appData[pageKey].customSections[sIdx].blocks.splice(bIdx, 1);
    renderBuilderBlocks(pageKey, sIdx);
};

window.uploadBlockImage = async function(bIdx, file) {
    if (!file) return;
    try {
        const filePath = await uploadFileToS3(file, 'custom-sections');
        updateBlockField(bIdx, 'imageUrl', filePath);
        document.getElementById(`prev-block-${bIdx}`).src = CONFIG.UPLOADS_BASE + '/' + filePath.replace(/^uploads\//, '');
    } catch (e) { console.error(e); }
};

window.renderTemplateSelector = function(selected) {
    const grid = document.getElementById('visual-template-grid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.entries(VISUAL_TEMPLATES).forEach(([id, config]) => {
        const opt = document.createElement('div');
        opt.className = `template-option ${selected === id ? 'selected' : ''}`;
        opt.onclick = () => {
            const success = updateCustomSectionField(window.currentCustomSectionPage, window.currentCustomSectionIndex, 'template', id);
            if (success !== false) renderTemplateSelector(id);
        };
        opt.innerHTML = `${config.svg}<span>${config.name}</span>`;
        grid.appendChild(opt);
    });
};

window.selectCustomSection = function(pageKey, index) {
    window.currentCustomSectionPage = pageKey;
    window.currentCustomSectionIndex = index;

    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active-tab'));
    renderAllSidebarSections(pageKey);

    document.querySelectorAll('.editor-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = '';
    });
    
    const editor = document.getElementById('custom-section-editor');
    if (editor) {
        editor.classList.add('active');
    }

    const section = appData[pageKey].customSections[index];
    document.getElementById('custom-section-title').textContent = section.title || 'New Section';
    document.getElementById('custom-section-input-title').value = section.title || '';

    // Update main editor header
    const editorTitle = document.getElementById('editor-title');
    if (editorTitle) {
        editorTitle.textContent = ':: ' + (section.title || 'New Section');
    }
    
    const hideBtn = document.getElementById('custom-section-hide-btn');
    if (hideBtn) {
        hideBtn.textContent = section.hidden ? 'Show' : 'Hide';
        hideBtn.style.backgroundColor = section.hidden ? '#27ae60' : '#607d8b';
    }

    renderTemplateSelector(section.template || 'split-image-left');
    renderBuilderBlocks(pageKey, index);
};

window.updateCustomSectionField = function(pageKey, index, field, value) {
    // Handle 2-arg call from oninput: updateCustomSectionField('field', value)
    if (field === undefined) {
        // Args are (field, value) — re-read from window state
        value = index;
        field = pageKey;
        index = window.currentCustomSectionIndex;
        pageKey = window.currentCustomSectionPage;
    }
    if (!pageKey || index === undefined) return false;

    if (field === 'template') {
        const section = appData[pageKey].customSections[index];
        if (section.blocks && section.blocks.length > 0) {
            if (!confirm('Changing the template will replace your current layout. Are you sure?')) {
                return false; // User cancelled
            }
        }
        
        appData[pageKey].customSections[index][field] = value;
        if (VISUAL_TEMPLATES[value] && VISUAL_TEMPLATES[value].defaultBlocks) {
            section.blocks = JSON.parse(JSON.stringify(VISUAL_TEMPLATES[value].defaultBlocks));
            section.blocks.forEach(b => b.id = 'block-' + Math.random().toString(36).substr(2, 9));
        } else {
            section.blocks = [];
        }
        renderBuilderBlocks(pageKey, index);
        return true;
    }

    appData[pageKey].customSections[index][field] = value;
    if (field === 'title') {
        renderAllSidebarSections(pageKey);
        document.getElementById('custom-section-title').textContent = value || 'New Section';
        
        // Sync main header in real-time
        const editorTitle = document.getElementById('editor-title');
        if (editorTitle) {
            editorTitle.textContent = ':: ' + (value || 'New Section');
        }
    }
    return true;
};

window.toggleCustomSectionVisibility = function() {
    const pageKey = window.currentCustomSectionPage;
    const index = window.currentCustomSectionIndex;
    const section = appData[pageKey].customSections[index];
    section.hidden = !section.hidden;
    
    const hideBtn = document.getElementById('custom-section-hide-btn');
    if (hideBtn) {
        hideBtn.textContent = section.hidden ? 'Show' : 'Hide';
        hideBtn.style.backgroundColor = section.hidden ? '#27ae60' : '#607d8b';
    }
    renderAllSidebarSections(pageKey);
};

window.deleteCustomSection = function() {
    const pageKey = window.currentCustomSectionPage;
    const index = window.currentCustomSectionIndex;
    if (index === null || !pageKey) return;
    if (!confirm('Permanently delete this section?')) return;

    // Remove from sectionOrder and re-index remaining custom- entries
    const sectionIdToRemove = `custom-${index}`;
    if (appData[pageKey].sectionOrder) {
        appData[pageKey].sectionOrder = appData[pageKey].sectionOrder
            .filter(id => id !== sectionIdToRemove)
            .map(id => {
                if (id.startsWith('custom-')) {
                    const idx = parseInt(id.replace('custom-', ''));
                    if (idx > index) return `custom-${idx - 1}`;
                }
                return id;
            });
    }

    appData[pageKey].customSections.splice(index, 1);
    window.currentCustomSectionIndex = null;
    // Hide via CSS class, not inline style
    const editor = document.getElementById('custom-section-editor');
    if (editor) {
        editor.classList.remove('active');
        editor.style.display = '';
    }
    renderAllSidebarSections(pageKey);
};

// Move a block to the opposite column
window.moveBlockColumn = function(bIdx) {
    const pageKey = window.currentCustomSectionPage;
    const sIdx = window.currentCustomSectionIndex;
    const block = appData[pageKey].customSections[sIdx].blocks[bIdx];
    block.column = (block.column ?? 0) === 0 ? 1 : 0;
    renderBuilderBlocks(pageKey, sIdx);
};

// Resize by dragging the bottom handle of a block
window.startBlockResize = function(e, bIdx) {
    e.preventDefault();
    const startY = e.clientY;
    const pageKey = window.currentCustomSectionPage;
    const sIdx = window.currentCustomSectionIndex;
    const block = appData[pageKey].customSections[sIdx].blocks[bIdx];
    const startHeight = block.height || 80;

    const blockEl = e.currentTarget.parentElement;
    if (!blockEl) return;

    function onMouseMove(ev) {
        const dy = ev.clientY - startY;
        const newH = Math.max(60, startHeight + dy);
        block.height = newH;
        blockEl.style.minHeight = newH + 'px';
        const content = blockEl.querySelector('.block-content');
        if (content) content.style.minHeight = newH + 'px';
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
};
