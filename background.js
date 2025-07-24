// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  
  // Create context menu item for dashboard
  chrome.contextMenus.create({
    id: 'openDashboard',
    title: 'Open CI Feature Extractor Dashboard',
    contexts: ['action']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openDashboard') {
    chrome.runtime.openOptionsPage();
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Popup will handle the interaction
});