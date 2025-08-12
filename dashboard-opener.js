// Dashboard opener functionality
document.getElementById('openWebDashboardBtn')?.addEventListener('click', function() {
  const url = (typeof WEB_DASHBOARD_URL !== 'undefined' && WEB_DASHBOARD_URL) || 'http://localhost:3000';
  chrome.tabs.create({ url });
});