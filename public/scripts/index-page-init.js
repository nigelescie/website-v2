// ===== SCROLL RESTORATION =====
window.addEventListener('beforeunload', () => {
    window.scrollTo(0, 0);
});

if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

// ===== CONTACT FORM (mailto fallback) =====
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const company = document.getElementById('company').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const message = document.getElementById('message').value.trim();

        const subject = encodeURIComponent('Website Inquiry from ' + (name || 'Visitor'));

        const body = encodeURIComponent(
            'Name: ' + name + '\n' +
            'Email: ' + email + '\n' +
            (company ? 'Company: ' + company + '\n' : '') +
            (phone ? 'Phone: ' + phone + '\n' : '') +
            '\nMessage:\n' + message
        );

        window.location.href = 'mailto:sales@electronicscience.net?subject=' + subject + '&body=' + body;
    });
}

document.addEventListener('DOMContentLoaded', initContactForm);
