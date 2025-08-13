CI HQ Chrome Extension Package
==============================

FILES INCLUDED:
- manifest.json     - Extension configuration
- popup.html        - Extension popup interface  
- popup.js          - Popup functionality
- background.js     - Background service worker
- config.js         - Configuration and API handling
- content-auth.js   - Authentication content script
- public/           - Directory for icons (empty - needs icons)

MISSING ICONS:
You need to add these PNG icon files to the public/ directory:
- public/icon16.png  (16x16 pixels)
- public/icon48.png  (48x48 pixels)  
- public/icon128.png (128x128 pixels)

INSTALLATION:
1. Add the icon files mentioned above
2. Go to chrome://extensions/
3. Enable "Developer mode" 
4. Click "Load unpacked"
5. Select this folder

OR for Chrome Web Store:
1. Add the icon files
2. Zip the entire folder
3. Upload to Chrome Web Store Developer Console

BRANDING:
Use CI HQ themed icons with your brand colors.
Consider using a target 🎯 or similar competitive intelligence imagery.

Version: 1.0.0
Author: CI HQ
Homepage: https://dashboard.getcihq.com
