// Analytics Tracking Script
(function () {
    try {
        // Debounce to prevent double firing on quirks or rapid navigation
        if (window.hasTrackedPageView) return;
        window.hasTrackedPageView = true;

        fetch(CONFIG.API_BASE + '/analytics/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: window.location.pathname,
                referrer: document.referrer
            })
        }).then(res => {
            if (!res.ok) console.warn('Analytics tracking failed');
        }).catch(err => console.error('Tracking error:', err));
    } catch (e) {
        console.error('Analytics script error:', e);
    }
})();
