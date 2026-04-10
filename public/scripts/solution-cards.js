// ===== SOLUTION CARDS NAVIGATION =====

function initSolutionCardsNavigation() {
    const solutionCards = document.querySelectorAll('.solution-card[data-solution], .solution-card[data-href]');

    const solutionMap = {
        'crm-tools': '#crm-tools-for-salesforce',
        'inventory-management': '#inventory-management',
        'paperless-operations': '#paperless-operations',
        'mobile-pos': '#mobile-pos-solutions',
        'brand-loyalty': '#brand-loyalty-systems',
        'custom-solutions': '#custom'
    };

    solutionCards.forEach(card => {
        if (card.dataset.navBound === 'true') return;
        card.dataset.navBound = 'true';

        card.addEventListener('click', () => {
            const href = card.dataset.href;
            if (href) {
                window.location.href = href;
                return;
            }

            const solution = card.dataset.solution;
            const anchor = solutionMap[solution];
            if (!anchor) return;
            window.location.href = `nav-pages/solutions.html${anchor}`;
        });

        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'link');
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });
}

window.initSolutionCardsNavigation = initSolutionCardsNavigation;
document.addEventListener('DOMContentLoaded', initSolutionCardsNavigation);
