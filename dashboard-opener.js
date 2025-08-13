// Dashboard opener functionality
document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('openWebDashboardBtn');
  if (btn) {
    btn.addEventListener('click', function() {
      const url = (typeof WEB_DASHBOARD_URL !== 'undefined' && WEB_DASHBOARD_URL) || 'http://localhost:3000';
      chrome.tabs.create({ url });
    });
  } else {
    console.error('Dashboard button not found');
  }
});