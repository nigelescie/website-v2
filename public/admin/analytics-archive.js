// Analytics Archive Management

function toggleArchivesSidebar() {
    const list = document.getElementById('archives-sidebar-list');
    const section = document.getElementById('archives-sidebar-section');
    const arrow = section.querySelector('.dropdown-arrow');

    if (list.classList.contains('open') || list.style.display === 'block') {
        list.classList.remove('open');
        list.style.display = 'none';
        section.classList.remove('active-tab');
        if (arrow) arrow.textContent = '▶';
    } else {
        list.classList.add('open');
        list.style.display = 'block';
        section.classList.add('active-tab');
        if (arrow) arrow.textContent = '▼';
    }
}

function toggleYearArchivesSidebar(year) {
    event.stopPropagation(); // Prevent closing the parent dropdown
    const yearList = document.getElementById(`archives-year-list-${year}`);
    const yearSection = document.getElementById(`archives-year-section-${year}`);
    const arrow = yearSection.querySelector('.dropdown-arrow');

    if (yearList.classList.contains('open') || yearList.style.display === 'block') {
        yearList.classList.remove('open');
        yearList.style.display = 'none';
        yearSection.classList.remove('active-tab');
        if (arrow) arrow.textContent = '▶';
    } else {
        yearList.classList.add('open');
        yearList.style.display = 'block';
        yearSection.classList.add('active-tab');
        if (arrow) arrow.textContent = '▼';
    }
}

async function loadArchivesList() {
    console.log('Loading archives list...');
    try {
        const res = await fetch('/api/analytics/archives', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });

        if (!res.ok) {
            console.error('Archives fetch failed:', res.status, res.statusText);
            return;
        }

        const archives = await res.json();
        console.log('Archives loaded:', archives);

        const list = document.getElementById('archives-sidebar-list');
        if (!list) {
            console.error('archives-sidebar-list element not found!');
            return;
        }

        if (archives && archives.length > 0) {
            // Group archives by year
            const archivesByYear = {};
            archives.forEach(archive => {
                // Assuming format "Month Year" (e.g., "March 2026")
                const parts = archive.label.split(' ');
                // Extract year from the end of the string
                const year = parts.length > 1 ? parts[parts.length - 1] : 'Unknown';

                if (!archivesByYear[year]) {
                    archivesByYear[year] = [];
                }
                archivesByYear[year].push(archive);
            });

            // Generate HTML for grouped archives
            let html = '';

            // Sort years descending
            const years = Object.keys(archivesByYear).sort((a, b) => b.localeCompare(a));

            years.forEach(year => {
                html += `
                    <div class="section-item" id="archives-year-section-${year}" style="border-bottom: 1px dotted #e0e0e0;">
                        <div class="product-item-sidebar" onclick="toggleYearArchivesSidebar('${year}')" style="display: flex; justify-content: space-between; align-items: center; border-bottom: none; font-weight: 600;">
                            <span>${year}</span>
                            <span class="dropdown-arrow">▶</span>
                        </div>
                        <ul class="product-list-sidebar" id="archives-year-list-${year}" style="display: none; max-height: 200px; overflow-y: auto; padding-left: 0; background: #fdfdfd; margin: 0;">
                            ${archivesByYear[year].map(archive =>
                    `<li class="product-item-sidebar" data-archive="${archive.id}" onclick="viewArchive('${archive.id}'); event.stopPropagation();" style="padding-left: 4.5rem;">${archive.label}</li>`
                ).join('')}
                        </ul>
                    </div>
                `;
            });

            list.innerHTML = html;
            console.log('Archives rendered by year:', years.length, 'years total');
        } else {
            list.innerHTML = '<li style="padding: 8px; color: #999; font-size: 0.9rem;">No archives yet</li>';
            console.log('No archives found');
        }
    } catch (err) {
        console.error('Failed to load archives:', err);
    }
}

async function viewArchive(archiveId) {
    try {
        const res = await fetch(`/api/analytics/archive/${archiveId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });

        if (!res.ok) throw new Error('Failed to load');

        const data = await res.json();

        document.querySelectorAll('.editor-section').forEach(s => s.classList.remove('active'));
        document.getElementById('archive-viewer').classList.add('active');
        document.getElementById('editor-title').textContent = `Archive: ${data.label}`;
        let totalPageViews = 0;
        if (data.pageViews) {
            Object.values(data.pageViews).forEach(count => totalPageViews += count);
        }

        const content = document.getElementById('archive-content');
        content.innerHTML = `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
                <button onclick="deleteArchive('${archiveId}')" style="background-color: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.3s;">
                    Delete Archive
                </button>
            </div>
            <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="stat-card" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 10px; color: #666; font-size: 0.9rem;">Total Visitors</h3>
                    <div style="font-size: 2rem; font-weight: bold; color: #0f3460;">${data.totalVisitors || 0}</div>
                </div>
                <div class="stat-card" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 10px; color: #666; font-size: 0.9rem;">Total Page Views</h3>
                    <div style="font-size: 2rem; font-weight: bold; color: #e94560;">${data.totalPageViews || 0}</div>
                </div>
            </div>
            
            <div class="charts-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">
                <div class="chart-container" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="margin-top: 0; margin-bottom: 20px; color: #333;">Device Breakdown</h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #666;">Mobile</span>
                            <strong style="color: #3498db;">${data.deviceStats?.mobile || 0}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #666;">Desktop</span>
                            <strong style="color: #95a5a6;">${data.deviceStats?.desktop || 0}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="chart-container" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="margin-top: 0; margin-bottom: 20px; color: #333;">Traffic Sources</h3>
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #666;">Direct</span>
                            <strong style="color: #e74c3c;">${data.trafficSources?.direct || 0}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #666;">Search</span>
                            <strong style="color: #f1c40f;">${data.trafficSources?.search || 0}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #666;">Social</span>
                            <strong style="color: #2ecc71;">${data.trafficSources?.social || 0}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #666;">Referral</span>
                            <strong style="color: #9b59b6;">${data.trafficSources?.referral || 0}</strong>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="top-pages-container" style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h3 style="margin-top: 0; margin-bottom: 20px; color: #333;">Most Visited Pages</h3>
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #eee;">
                            <th style="padding: 12px; color: #666;">Page Path</th>
                            <th style="padding: 12px; color: #666;">Views</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(data.pageViews || {}).length > 0
                ? Object.entries(data.pageViews).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([page, views]) =>
                    `<tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 12px; color: #333;">${page === '/' ? 'Home /' : page}</td>
                                    <td style="padding: 12px; color: #333; font-weight: bold;">${views}</td>
                                </tr>`
                ).join('')
                : '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #999;">No data</td></tr>'
            }
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load archive:', err);
        alert('Failed to load archive');
    }
}

async function deleteArchive(archiveId) {
    if (!confirm('Are you sure you want to delete this archive? This action cannot be undone.')) {
        return;
    }

    try {
        const res = await fetch(`/api/analytics/archive/${archiveId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
        });

        if (!res.ok) throw new Error('Failed to delete');

        const data = await res.json();

        if (data.success) {
            alert('Archive deleted successfully');
            // Hide the archive viewer since the data is gone
            document.getElementById('archive-viewer').classList.remove('active');
            document.getElementById('editor-title').textContent = 'Dashboard';
            // Show overview instead
            document.getElementById('dashboard-overview').classList.add('active');

            // Reload the sidebar list to remove the deleted archive
            loadArchivesList();
        } else {
            alert(data.message || 'Error deleting archive');
        }
    } catch (err) {
        console.error('Failed to delete archive:', err);
        alert('Failed to delete archive');
    }
}

// Initialize on page load
if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('archives-sidebar-list')) {
            loadArchivesList();
        }
    });
}
