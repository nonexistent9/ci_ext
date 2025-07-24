// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('CI Feature Extractor installed');
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Popup will handle the interaction
});