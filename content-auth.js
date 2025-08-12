// Content script to sync auth state from web app to extension
// This runs on the CI dashboard domain to detect login events

console.log('Content script loaded on:', window.location.href);

// Check if we're on the CI dashboard domain
if (window.location.hostname === 'localhost' || window.location.hostname.includes('vercel.app')) {
  
  function syncAuthToExtension() {
    try {
      // Check multiple possible Supabase storage patterns
      const supabasePatterns = [
        'supabase.auth.token',
        'sb-auth-token',
        'supabase-auth-token',
      ];
      
      // Also check for any keys containing 'supabase' and 'auth'
      const allKeys = Object.keys(localStorage);
      console.log('All localStorage keys:', allKeys);
      
      // More comprehensive search patterns for Supabase
      const authKeys = allKeys.filter(key => {
        const keyLower = key.toLowerCase();
        return (
          keyLower.includes('supabase') || 
          keyLower.includes('sb-') ||
          (keyLower.includes('auth') && (
            keyLower.includes('token') || 
            keyLower.includes('session') || 
            keyLower.includes('user')
          )) ||
          keyLower.startsWith('supabase.') ||
          keyLower.includes('clerk') ||
          keyLower === 'session' ||
          keyLower === 'auth-token'
        );
      });
      
      console.log('Found potential auth keys:', authKeys);
      
      // Also log a sample of keys to help debug
      if (allKeys.length > 0) {
        console.log('Sample localStorage keys (first 10):', allKeys.slice(0, 10));
      }
      
      for (const key of authKeys) {
        try {
          const rawValue = localStorage.getItem(key);
          console.log(`Checking key: ${key}`, rawValue);
          
          if (rawValue) {
            const authData = JSON.parse(rawValue);
            
            // Handle different Supabase auth data structures
            let session = null;
            if (authData.access_token) {
              // Direct token structure
              session = authData;
            } else if (authData.session && authData.session.access_token) {
              // Nested session structure
              session = authData.session;
            } else if (authData.currentSession && authData.currentSession.access_token) {
              // Alternative nested structure
              session = authData.currentSession;
            } else if (authData.user && authData.session) {
              // Supabase v2 structure with user and session
              session = authData.session;
            } else if (authData.data && authData.data.session) {
              // Another Supabase auth structure
              session = authData.data.session;
            } else if (typeof authData === 'string' && authData.startsWith('Bearer ')) {
              // Raw bearer token
              session = {
                access_token: authData.replace('Bearer ', ''),
                expires_at: Math.floor(Date.now() / 1000) + 3600
              };
            }
            
            if (session && session.access_token) {
              // Ensure we have refresh_token for proper session management
              if (session.refresh_token) {
                console.log('Found valid session with refresh token, syncing to extension');
                chrome.runtime.sendMessage({
                  type: 'WEBAPP_AUTH_SUCCESS',
                  session: {
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                    expires_at: session.expires_at || (Math.floor(Date.now()/1000) + 3600),
                    user: session.user
                  }
                });
                return true; // Found and synced
              } else {
                console.warn('Found session but no refresh_token - this may cause auth desyncs');
                // Still sync but note the limitation
                chrome.runtime.sendMessage({
                  type: 'WEBAPP_AUTH_SUCCESS',
                  session: {
                    access_token: session.access_token,
                    refresh_token: session.refresh_token || null,
                    expires_at: session.expires_at || (Math.floor(Date.now()/1000) + 3600),
                    user: session.user
                  }
                });
                return true;
              }
            }
          }
        } catch (e) {
          console.log('Error parsing auth key:', key, e);
        }
      }
      
      // If no auth found, try checking if user is authenticated via DOM
      // Look for signs of authentication in the page
      const body = document.body;
      if (body && (body.textContent.includes('Dashboard') || body.textContent.includes('Sign out'))) {
        console.log('User appears to be logged in based on page content, but no session found');
      }
      
    } catch (e) {
      console.error('Error syncing auth:', e);
    }
    return false;
  }
  
  // Listen for storage events from Supabase client
  window.addEventListener('storage', (event) => {
    console.log('Storage event:', event.key, event.newValue);
    if (event.key && event.key.toLowerCase().includes('supabase') && event.key.toLowerCase().includes('auth')) {
      syncAuthToExtension();
    }
  });

  // Check immediately on load
  syncAuthToExtension();
  
  // Also check periodically in case we miss events
  setInterval(() => {
    syncAuthToExtension();
  }, 5000);

  // Listen for page navigation/changes
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(syncAuthToExtension, 1000);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for force auth check messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FORCE_AUTH_CHECK') {
      console.log('Forced auth check requested from popup');
      syncAuthToExtension();
      sendResponse({ success: true });
    }
  });
}