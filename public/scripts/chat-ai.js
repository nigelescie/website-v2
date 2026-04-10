// ===== CHAT AI FUNCTIONALITY =====
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatMessages = document.getElementById('chatMessages');



    // UI Toggle Logic
    const chatToggle = document.getElementById('chatToggle');
    const chatWidget = document.getElementById('chatWidget');

    if (chatToggle && chatWidget) { // Check if elements exist
        const chatIcon = chatToggle.querySelector('.chat-icon');
        const closeIcon = chatToggle.querySelector('.close-icon');

        chatToggle.addEventListener('click', () => {
            chatWidget.classList.toggle('open');
            const isOpen = chatWidget.classList.contains('open');

            if (chatIcon) chatIcon.style.display = isOpen ? 'none' : 'block';
            if (closeIcon) closeIcon.style.display = isOpen ? 'block' : 'none';
        });

        // Close chat when clicking outside
        document.addEventListener('click', (e) => {
            if (!chatWidget.contains(e.target) && chatWidget.classList.contains('open')) {
                chatWidget.classList.remove('open');
                if (chatIcon) chatIcon.style.display = 'block';
                if (closeIcon) closeIcon.style.display = 'none';
            }
        });
    }

    // Dynamic pathing for links depending on whether we are in root or nav-pages
    const baseNavPath = window.location.pathname.includes('/nav-pages/') ? '' : 'nav-pages/';

    // Knowledge Base derived from website content
    let knowledgeBase = {
        products: [],
        general: {
            greeting: ["Hello! How can I help you today?", "Hi there! What can I assist you with?", "Welcome to eScience support! how can I help?"],
            contact: {
                keywords: ["contact", "email", "phone", "call", "reach", "address", "location"],
                response: "How can we direct your inquiry? <br><br><b>Sales:</b> sales@electronicscience.net<br><b>Support:</b> support@electronicscience.net<br><b>HR:</b> hrd@electronicscience.net<br><br>You can also call us at 02-8850-1324."
            },
            sales: {
                keywords: ["sales", "buy", "purchase", "quote", "marketing"],
                response: "For Sales & Marketing inquiries, please email <a href='mailto:sales@electronicscience.net'>sales@electronicscience.net</a> or call 02-8850-1324."
            },
            support: {
                keywords: ["support", "help", "issue", "technical", "problem", "broken", "fix"],
                response: "For Customer Support, you can reach us via:<br><b>Globe:</b> (+63) 977 8364 867 / (+63) 917 8842 975<br><b>Smart:</b> (+63) 908 8107 057 / (+63) 998 8495 159<br><b>IMS Support:</b> (+63) 917 636 9606 / (+63) 998 970 1129<br><b>Facebook:</b> <a href='https://facebook.com/esciencesupport' target='_blank'>@esciencesupport</a>"
            },
            hr: {
                keywords: ["hr", "human resources", "hrd", "job", "career", "hiring", "work", "apply"],
                response: `For Careers and HR inquiries, please email <a href='mailto:hrd@electronicscience.net'>hrd@electronicscience.net</a>. Check out our <a href='${baseNavPath}careers.html'>Careers page</a> for open positions.`
            },
            pricing: {
                keywords: ["price", "cost", "pricing", "quote", "payment"],
                response: "Our pricing varies based on your specific needs. Please contact our Sales team at <a href='mailto:sales@electronicscience.net'>sales@electronicscience.net</a> for a tailored quote."
            },
            careers: {
                keywords: ["career", "job", "hiring", "work", "join", "team"],
                response: `We are always looking for talented individuals! Check out our <a href='${baseNavPath}careers.html'>Careers page</a> or contact HR at <a href='mailto:hrd@electronicscience.net'>hrd@electronicscience.net</a>.`
            },
            about: {
                keywords: ["about", "company", "who are you", "what do you do", "history"],
                response: "eScience is a pioneer in mobile solutions in the Philippines, established in 2000. We have over 20 years of experience and maintain 100+ clients worldwide."
            },
            news: {
                keywords: ["news", "blog", "update", "latest", "events"],
                response: `Check out our latest blog posts! We recently had a team getaway to Vietnam and launched a new modular block editor for our site. Visit the <a href='${baseNavPath}blog.html'>Blog page</a> for more.`
            },
            default: ["I'm here to help! You can ask me about our products, services, contact info, or careers.", "I'm not sure I understand. Is your inquiry about Sales, Support, or HR?", "I can help with product info, contact details, or general inquiries. Do you need Sales, Support, or HR?"]
        }
    };

    // Original hardcoded product responses to preserve
    const originalProductResponses = {
        "sfe": `PocketWiSE SFE is an integrated mobile CRM solution designed for the pharmaceutical industry. It automates customer coverage, planning, and presentations, providing real-time field data to head office.<br><br><b>Features:</b> KPIs & Dashboard, Call Reports, Coverage Monitoring.<br><br><a href='${baseNavPath}product-detail.html?id=sfe'>Learn more about PocketWiSE SFE</a>`,
        "pm-app": `The PM App is designed for district managers to oversee the customer coverage and KPIs of their field personnel, allowing for real-time coaching and monitoring.<br><br><b>Features:</b> Manager's Dashboard, Actual Call and Itinerary, Development Plan.<br><br><a href='${baseNavPath}product-detail.html?id=pm-app'>Learn more about PM App</a>`,
        "sole": `SOLE is a handheld CRM that manages sales pipelines, leads, and customer engagements on the go. It ensures you never miss an opportunity with comprehensive tracking tools.<br><br><b>Features:</b> Deals Monitoring, Calendar & Itinerary, Web-based Activity Reports.<br><br><a href='${baseNavPath}product-detail.html?id=sole'>Learn more about SOLE</a>`,
        "swiftpoint": `SwiftPoint tracks attendance, trade activities, and complete inventory monitoring, allowing you to capture vital field data from your workforce across all stores and branches.<br><br><b>Features:</b> Attendance Tracking, Trade Activities, Inventory Monitoring.<br><br><a href='${baseNavPath}product-detail.html?id=swiftpoint'>Learn more about SwiftPoint</a>`,
        "ims": `Built for the Bureau of Customs and warehouses, IMS automates all cargo operations from stripping and billing to final release, ensuring absolute transparency.<br><br><b>Features:</b> Cargo Operations, Billing & Stripping, Customer Release.<br><br><a href='${baseNavPath}product-detail.html?id=ims'>Learn more about IMS</a>`,
        "pats": `PATS centralizes inventory and stock movement data for promo materials in the FMCG industry, from supplier agreements to specific physical store locations.<br><br><b>Features:</b> Promo Inventory, Stock Movement, Supplier Agreements.<br><br><a href='${baseNavPath}product-detail.html?id=pats'>Learn more about PATS</a>`,
        "bayanibox": `BayaniBox streamlines the processing of balikbayan boxes, providing a seamless and highly convenient way of sending and tracking overseas shipments.<br><br><b>Features:</b> Box Processing, Shipment Tracking, Overseas Logistics.<br><br><a href='${baseNavPath}product-detail.html?id=bayanibox'>Learn more about BayaniBox</a>`,
        "swift-forms": `Swift-Forms is a digital forms platform with offline support and real-time syncing. It eliminates paperwork, waiting times, and promotes contactless transactions.<br><br><b>Features:</b> Digital Signatures, Real-time Sync, Offline Data Capture.<br><br><a href='${baseNavPath}product-detail.html?id=swift-forms'>Learn more about Swift-Forms</a>`,
        "retail": `PocketWiSE Retail is a complete retail POS solution with inventory and payment integration, allowing you to seamlessly monitor transactions across all outlet locations.<br><br><b>Features:</b> Payment Processing, Inventory Sync, Sales Reporting.<br><br><a href='${baseNavPath}product-detail.html?id=retail'>Learn more about PocketWiSE Retail</a>`,
        "pocketventa": `Pocket Venta is a complete mobile sales solution for field representatives, supporting mobile ordering, route optimization, and customer management.<br><br><b>Features:</b> Mobile Ordering, Route Optimization, Customer Management.<br><br><a href='${baseNavPath}product-detail.html?id=pocketventa'>Learn more about Pocket Venta</a>`,
        "swift-rewards": `Swift Rewards is a comprehensive brand loyalty program system designed to handle points management, custom tiered programs, and automated rewards.<br><br><b>Features:</b> Points Management, Tiered Programs, Automated Rewards.<br><br><a href='${baseNavPath}product-detail.html?id=swift-rewards'>Learn more about Swift Rewards</a>`,
        "swift-care": `Swift Care is a robust customer care and discount management system, facilitating quick campaign management and automated coupon generation.<br><br><b>Features:</b> Coupon Generation, Discount Approval, Campaign Management.<br><br><a href='${baseNavPath}product-detail.html?id=swift-care'>Learn more about Swift Care</a>`,
        "custom-development": `We offer custom mobile and web application development tailored to your specific business requirements, ensuring the technology perfectly fits your operations.<br><br><b>Features:</b> API Integrations, Cloud Deployment, Bespoke Web/Mobile Apps.<br><br><a href='${baseNavPath}product-detail.html?id=custom-development'>Learn more about Custom Development</a>`
    };

    // Fetch dynamic products from the content API
    async function loadDynamicKnowledgeBase() {
        try {
            const response = await fetch('/api/content');
            const data = await response.json();

            if (data && data.productsPage && data.productsPage.sections) {
                const dynamicProducts = [];
                data.productsPage.sections.forEach(section => {
                    if (section.products && Array.isArray(section.products)) {
                        section.products.forEach(prod => {
                            const name = prod.title || "Product";
                            const id = prod.id || name.toLowerCase().replace(/\s+/g, '-');

                            // Check if this is an original product
                            if (originalProductResponses[id]) {
                                dynamicProducts.push({
                                    name: name,
                                    keywords: [name.toLowerCase(), id.toLowerCase()],
                                    response: originalProductResponses[id]
                                });
                                return;
                            }

                            // Generate new intro for NEW products
                            const keywords = [name.toLowerCase(), id.toLowerCase()];
                            if (section.title) keywords.push(section.title.toLowerCase());

                            // Build response string dynamically for NEW products
                            let responseText = `${prod.description || prod.longDescription || "Learn more about our solutions here."}`;

                            if (prod.features && prod.features.length > 0) {
                                const featureList = prod.features
                                    .slice(0, 3)
                                    .map(f => (typeof f === 'object' && f.title) ? f.title : (typeof f === 'string' ? f : ''))
                                    .filter(f => f)
                                    .join(', ');
                                if (featureList) {
                                    responseText += `<br><br><b>Features:</b> ${featureList}.`;
                                }
                            }

                            // Link to product detail page
                            const detailLink = `${baseNavPath}product-detail.html?id=${id}`;
                            responseText += `<br><br><a href='${detailLink}'>Learn more about ${name}</a>`;

                            dynamicProducts.push({
                                name: name,
                                keywords: [...new Set(keywords)],
                                response: responseText
                            });
                        });
                    }
                });

                if (dynamicProducts.length > 0) {
                    knowledgeBase.products = dynamicProducts;
                }
            }
        } catch (err) {
            console.error("Chatbot: Failed to load dynamic product data", err);
        }
    }

    // Call dynamic load immediately
    loadDynamicKnowledgeBase();


    // FAQ Buttons Configuration
    const initialFaqOptions = [
        { label: "Our Products", action: "Tell me about your products" },
        { label: "Sales Inquiry", action: "I want to buy something" },
        { label: "Customer Support", action: "I need technical support" },
        { label: "Careers / HR", action: "I'm looking for a job" }
    ];

    function addMessage(text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user-message' : 'bot-message'}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Sanitize user input, allow safe HTML for bot responses
        if (isUser) {
            contentDiv.textContent = text;
        } else {
            // Parse and sanitize bot HTML responses
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            doc.querySelectorAll('script').forEach(el => el.remove());
            ['onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'].forEach(attr => {
                doc.querySelectorAll(`[${attr}]`).forEach(el => el.removeAttribute(attr));
            });
            contentDiv.innerHTML = doc.body.innerHTML;
        }

        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addOptions(options) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'chat-faq-container';

        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'chat-faq-btn';
            btn.textContent = option.label;
            btn.onclick = () => {
                handleUserAction(option.action, option.label);
            };
            buttonsContainer.appendChild(btn);
        });

        chatMessages.appendChild(buttonsContainer);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getBotResponse(userMessage) {
        const msg = userMessage.toLowerCase();

        // Helper to return standard response object
        const respond = (text, options = null) => ({ text, options });

        // Check for specific product query first (exact match logic)
        for (const product of knowledgeBase.products) {
            if (product.keywords.some(k => msg.includes(k))) {
                return respond(product.response);
            }
        }

        // PRODUCTS OVERVIEW / MENU
        if (msg.includes('product') || msg.includes('solution') || msg.includes('apps') || msg.includes('feature')) {
            const productOptions = knowledgeBase.products.map(p => ({
                label: p.name,
                action: `Tell me about ${p.name}`
            }));
            return respond("We offer a range of solutions. Which one would you like to know more about?", productOptions);
        }

        // check general keywords
        for (const key in knowledgeBase.general) {
            if (key === 'default' || key === 'greeting') continue;
            const item = knowledgeBase.general[key];
            if (item.keywords.some(k => msg.includes(k))) {
                return respond(item.response);
            }
        }

        // check greetings
        if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
            return respond(knowledgeBase.general.greeting[Math.floor(Math.random() * knowledgeBase.general.greeting.length)]);
        }

        // Default
        return respond(knowledgeBase.general.default[Math.floor(Math.random() * knowledgeBase.general.default.length)]);
    }

    function handleUserAction(messageText, labelText = null) {
        // labelText is optional, can be used if we want to show the button label as the user message instead of the full action text
        // For now, let's use the messageText (action) or just the label if provided to keep chat clean?
        // Let's use labelText if available for the user bubble, passed as messageText to logic
        const displayUserMessage = labelText || messageText;

        addMessage(displayUserMessage, true);

        // Simulate typing delay
        setTimeout(() => {
            const responseData = getBotResponse(messageText);
            addMessage(responseData.text, false);

            if (responseData.options) {
                addOptions(responseData.options);
            } else {
                // If no specific options returned, maybe show main menu again after a pause?
                // Or just leave it. Let's leave it for now to avoid clutter, 
                // but maybe we can add a "Back to Menu" button?
            }
        }, 500);
    }

    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        handleUserAction(message);
        chatInput.value = '';
    }

    // Send message on button click
    chatSend.addEventListener('click', sendMessage);

    // Send message on Enter key
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Initialize with FAQ buttons
    setTimeout(() => {
        if (chatMessages.children.length === 1) {
            addOptions(initialFaqOptions);
        }
    }, 1000);
});
