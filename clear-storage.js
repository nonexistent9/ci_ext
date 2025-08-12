// Debug utility to clear extension storage
// Run this in the extension's popup console or background console

async function clearExtensionStorage() {
  try {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    console.log('✅ Extension storage cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
    return false;
  }
}

// Clear specific auth-related items
async function clearAuthStorage() {
  try {
    await chrome.storage.local.remove(['session', 'supabase_user']);
    console.log('✅ Auth storage cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing auth storage:', error);
    return false;
  }
}

// Check current storage contents
async function checkStorage() {
  try {
    const localStorage = await chrome.storage.local.get();
    const syncStorage = await chrome.storage.sync.get();
    
    console.log('📦 Local Storage:', localStorage);
    console.log('📦 Sync Storage:', syncStorage);
    
    return { localStorage, syncStorage };
  } catch (error) {
    console.error('❌ Error checking storage:', error);
    return null;
  }
}

// Export functions to global scope for console access
if (typeof window !== 'undefined') {
  window.clearExtensionStorage = clearExtensionStorage;
  window.clearAuthStorage = clearAuthStorage;
  window.checkStorage = checkStorage;
}

console.log('🔧 Debug utilities loaded. Available functions:');
console.log('- clearExtensionStorage() - Clear all storage');
console.log('- clearAuthStorage() - Clear only auth data');
console.log('- checkStorage() - View current storage contents');