# Authentication Sync Debugging Guide

This guide helps debug authentication issues between the web app and extension.

## Current Issue
Extension shows "Please sign in via web app" even when the user is logged into the web app at localhost:3000.

## Debugging Steps

### 1. Check Web App Authentication
1. Open localhost:3000 in browser
2. Make sure you're logged in and can see the dashboard
3. Open browser developer tools (F12)
4. Go to Console tab
5. Run this command to see localStorage contents:
   ```javascript
   console.log('All localStorage keys:', Object.keys(localStorage));
   Object.keys(localStorage).forEach(key => {
     if (key.toLowerCase().includes('supabase') || key.toLowerCase().includes('auth')) {
       console.log(`${key}:`, localStorage.getItem(key));
     }
   });
   ```

### 2. Check Extension Content Script
1. With web app open at localhost:3000, open browser developer tools
2. Look for console messages starting with "Content script loaded on:"
3. You should see auth detection logs every 5 seconds
4. If no messages appear, the content script isn't running

### 3. Manual Auth Check
1. Open the extension popup
2. If you see "Please sign in via web app", click "🔄 Check Auth Status"
3. This will force the content script to check again
4. Check browser console for debugging output

### 4. Check Extension Storage
1. Go to chrome://extensions
2. Find "CI HQ" extension
3. Click "Service worker" (or "background page" in older Chrome)
4. In the console that opens, run:
   ```javascript
   chrome.storage.local.get(['session']).then(console.log);
   ```

### 5. Debug localStorage Manually
1. On localhost:3000, open browser console
2. Copy and paste the debug utility:
   ```javascript
   // This is the same as the debug-localStorage.js file
   console.log('=== LocalStorage Debug ===');
   const allKeys = Object.keys(localStorage);
   console.log('All keys:', allKeys);
   
   const authKeys = allKeys.filter(key => 
     key.toLowerCase().includes('supabase') || 
     key.toLowerCase().includes('auth') ||
     key.toLowerCase().includes('session')
   );
   
   authKeys.forEach(key => {
     const value = localStorage.getItem(key);
     console.log(`${key}:`, value);
     try {
       const parsed = JSON.parse(value);
       console.log(`${key} parsed:`, parsed);
     } catch(e) {}
   });
   ```

## Expected Results

### Working State
- Web app localStorage should contain Supabase auth data
- Content script should log "Found valid session, syncing to extension"
- Extension popup should show "✅ Signed in - Ready for analysis"

### Troubleshooting
- If no Supabase keys in localStorage: Authentication method may have changed
- If content script doesn't run: Check manifest.json content_scripts configuration
- If session found but not synced: Check background.js WEBAPP_AUTH_SUCCESS handler

## Files Involved
- `content-auth.js` - Detects auth in web app localStorage
- `background.js` - Handles WEBAPP_AUTH_SUCCESS message
- `popup.js` - Checks auth status and shows UI
- `manifest.json` - Configures content script permissions