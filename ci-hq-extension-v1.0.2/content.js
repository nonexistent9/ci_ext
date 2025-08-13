// Content script for additional page interaction if needed

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFeatures') {
    // Additional content script functionality can be added here
    sendResponse({ success: true });
  }
});