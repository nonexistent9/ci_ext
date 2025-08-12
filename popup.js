document.addEventListener('DOMContentLoaded', function () {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const sendToWebBtn = document.getElementById('sendToWebBtn');
  const authStatus = document.getElementById('authStatus');
  // Store the initial analysis and page data
  let currentAnalysis = '';
  let currentPageData = null;

  extractBtn.addEventListener('click', extractFeatures);
  copyBtn.addEventListener('click', copyToClipboard);
  saveBtn.addEventListener('click', saveAnalysis);
  sendToWebBtn.addEventListener('click', sendToWebApp);

  // Check auth status on load and set up refresh listener
  checkAuthStatus();
  

  // Listen for storage changes (when user logs in via web app)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.session) {
      checkAuthStatus();
    }
  });

  // Recover any in-progress or last results when popup opens
  (async () => {
    try {
      const [{ current_job, last_analysis }, [tab]] = await Promise.all([
        chrome.storage.local.get(['current_job', 'last_analysis']),
        chrome.tabs.query({ active: true, currentWindow: true })
      ]);

      if (current_job && current_job.jobId) {
        // Check if job is stale (older than 10 minutes)
        const jobAge = Date.now() - (current_job.startedAt || 0);
        if (jobAge > 10 * 60 * 1000) {
          console.log('Removing stale job from popup:', current_job);
          await chrome.storage.local.remove('current_job');
          showStatus('Previous analysis timed out', 'error');
        } else {
          showStatus('Analysis running in background...', 'loading');
          const onMessage = (message) => {
            if (!message || message.jobId !== current_job.jobId) return;
            if (message.type === 'analysisProgress') showStatus(message.message, 'loading');
            if (message.type === 'analysisComplete') {
              currentPageData = message.pageData;
              displayResults(message.report);
              showStatus('Analysis completed successfully!', 'success');
              chrome.storage.local.remove('current_job');
              chrome.runtime.onMessage.removeListener(onMessage);
              extractBtn.disabled = false;
            }
            if (message.type === 'analysisError') {
              showStatus('Error: ' + message.error, 'error');
              chrome.storage.local.remove('current_job');
              chrome.runtime.onMessage.removeListener(onMessage);
              extractBtn.disabled = false;
            }
          };
          chrome.runtime.onMessage.addListener(onMessage);
          extractBtn.disabled = true;
          
          // Set a timeout to clean up if no response after 5 minutes
          setTimeout(() => {
            chrome.runtime.onMessage.removeListener(onMessage);
            chrome.storage.local.remove('current_job');
            showStatus('Analysis timed out', 'error');
            extractBtn.disabled = false;
          }, 5 * 60 * 1000);
        }
      } else if (last_analysis && last_analysis.report) {
        // Only auto-show if it matches current tab URL
        if (tab && last_analysis.pageData && last_analysis.pageData.url === tab.url) {
          currentPageData = last_analysis.pageData;
          displayResults(last_analysis.report);
          showStatus('Loaded last completed analysis for this page.', 'success');
        }
      }
    } catch (e) {
      // Ignore recovery issues
    }
  })();
  // Simple auth status check
  async function checkAuthStatus() {
    try {
      const sessionObj = await chrome.storage.local.get('session');
      const session = sessionObj.session;
      
      // Check if session exists and is not expired
      let isLoggedIn = false;
      if (session?.access_token && session?.expires_at) {
        const now = Math.floor(Date.now() / 1000);
        isLoggedIn = session.expires_at > now;
        
        // If session is expired, clear it
        if (!isLoggedIn) {
          console.log('Session expired, clearing storage');
          await chrome.storage.local.remove('session');
        }
      }
      
      if (isLoggedIn) {
        authStatus.textContent = '✅ Signed in - Ready for analysis';
        authStatus.className = 'status success';
        authStatus.style.display = 'block';
      } else {
        authStatus.innerHTML = '⚠️ Please <a href="#" id="loginLink" style="color: #007cba; text-decoration: underline;">sign in via web app</a> for AI features';
        authStatus.className = 'status error';
        authStatus.style.display = 'block';
        
        // Add click handler for login link
        document.getElementById('loginLink')?.addEventListener('click', (e) => {
          e.preventDefault();
          const url = (typeof WEB_DASHBOARD_URL !== 'undefined' && WEB_DASHBOARD_URL) || 'http://localhost:3000';
          chrome.tabs.create({ url });
        });
      }
    } catch (e) {
      authStatus.textContent = '⚠️ Authentication check failed';
      authStatus.className = 'status error';
      authStatus.style.display = 'block';
    }
  }

  

  async function extractFeatures() {
    try {
      extractBtn.disabled = true;
      showStatus('Starting analysis in background...', 'loading');

      // Check if user is logged in instead of API key
      const session = await getSupabaseSession();
      if (!session?.access_token) {
        showStatus('Please sign in via web app to use AI analysis features.', 'error');
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const jobId = `job_${Date.now()}`;

      // Persist job state so we can recover after popup closes
      await chrome.storage.local.set({ current_job: { jobId, tabId: tab.id, startedAt: Date.now() } });

      // Subscribe to background progress and completion
      const onMessage = (message) => {
        if (!message || message.jobId !== jobId) return;
        if (message.type === 'analysisProgress') {
          showStatus(message.message, 'loading');
        }
        if (message.type === 'analysisComplete') {
          currentPageData = message.pageData;
          displayResults(message.report);
          showStatus('Analysis completed successfully!', 'success');
          chrome.storage.local.remove('current_job');
          chrome.runtime.onMessage.removeListener(onMessage);
          extractBtn.disabled = false;
        }
        if (message.type === 'analysisError') {
          showStatus('Error: ' + message.error, 'error');
          chrome.storage.local.remove('current_job');
          chrome.runtime.onMessage.removeListener(onMessage);
          extractBtn.disabled = false;
        }
      };
      chrome.runtime.onMessage.addListener(onMessage);

      // Kick off background analysis
      chrome.runtime.sendMessage({ type: 'startAnalysis', jobId, tabId: tab.id });

    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
      extractBtn.disabled = false;
    }
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
  }

  function displayResults(features) {
    currentAnalysis = features;
    results.textContent = features;
    results.style.display = 'block';
    sendToWebBtn.style.display = 'block';
    saveBtn.style.display = 'block';
    copyBtn.style.display = 'block';
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(results.textContent).then(() => {
      copyBtn.textContent = '✅ Copied!';
      setTimeout(() => {
        copyBtn.textContent = '📋 Copy to Clipboard';
      }, 2000);
    });
  }

  async function saveAnalysis() {
    try {
      if (!currentAnalysis || !currentPageData) {
        showStatus('No analysis to save', 'error');
        return;
      }

      // Save directly to Supabase through background script
      const analysisData = {
        pageData: currentPageData,
        report: currentAnalysis,
        url: currentPageData.url
      };

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'saveAnalysis', analysisData }, resolve);
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to save analysis');
      }

      saveBtn.textContent = '✅ Saved!';
      showStatus('Quick save to Supabase completed', 'success');

      setTimeout(() => {
        saveBtn.textContent = '💾 Quick Save';
      }, 2000);

    } catch (error) {
      console.error('Error saving analysis:', error);
      showStatus('Error saving analysis: ' + error.message, 'error');
    }
  }

  async function sendToWebApp() {
    try {
      if (!currentPageData) {
        showStatus('No page data to send', 'error');
        return;
      }

      // Check if user is logged in
      const session = await getSupabaseSession();
      if (!session?.access_token) {
        showStatus('Please sign in via web app first.', 'error');
        return;
      }

      sendToWebBtn.textContent = 'Sending...';
      showStatus('Sending page data to web app for analysis...', 'loading');

      // Send page data to web app for analysis
      const webAppUrl = (typeof WEB_DASHBOARD_URL !== 'undefined' && WEB_DASHBOARD_URL) || 'http://localhost:3000';
      const response = await fetch(`${webAppUrl}/api/extension-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageData: currentPageData,
          accessToken: session.access_token
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send to web app');
      }

      const result = await response.json();
      
      sendToWebBtn.textContent = '✅ Sent!';
      showStatus('Analysis sent to web app successfully!', 'success');
      
      // Open the web app to view the analysis
      setTimeout(() => {
        chrome.tabs.create({ url: webAppUrl });
      }, 1000);

      setTimeout(() => {
        sendToWebBtn.textContent = '📤 Send to Web App';
      }, 3000);

    } catch (error) {
      console.error('Error sending to web app:', error);
      showStatus('Error sending to web app: ' + error.message, 'error');
      sendToWebBtn.textContent = '📤 Send to Web App';
    }
  }


  // This function is no longer used as we're using AI for feature extraction
  // Keeping it for reference or future use
  /*
  function analyzeFeatures(pageData) {
    const features = [];

    // Analyze headings for features
    pageData.headings.forEach(heading => {
      const text = heading.text || heading;
      if (text.toLowerCase().includes('feature') ||
        text.toLowerCase().includes('solution') ||
        text.toLowerCase().includes('service') ||
        text.toLowerCase().includes('product') ||
        text.toLowerCase().includes('benefit') ||
        text.toLowerCase().includes('capability')) {
        features.push(`• ${text}`);
      }
    });

    // Analyze buttons for key actions
    pageData.buttons.forEach(button => {
      if (button.length > 3 && button.length < 50) {
        const lowerButton = button.toLowerCase();
        if (lowerButton.includes('try') || lowerButton.includes('demo') ||
          lowerButton.includes('start') || lowerButton.includes('get') ||
          lowerButton.includes('sign up') || lowerButton.includes('learn')) {
          features.push(`• Call-to-action: ${button}`);
        }
      }
    });

    // Analyze navigation for service areas
    pageData.links.forEach(link => {
      const lowerLink = link.toLowerCase();
      if (lowerLink.includes('pricing') || lowerLink.includes('features') ||
        lowerLink.includes('solutions') || lowerLink.includes('products') ||
        lowerLink.includes('services') || lowerLink.includes('platform')) {
        features.push(`• Service area: ${link}`);
      }
    });

    // Analyze meta description for key features
    if (pageData.metadata.description) {
      const desc = pageData.metadata.description.toLowerCase();
      const keywords = ['ai', 'automation', 'analytics', 'dashboard', 'api', 'integration', 'cloud', 'saas', 'platform'];
      keywords.forEach(keyword => {
        if (desc.includes(keyword)) {
          features.push(`• Technology: ${keyword.toUpperCase()}`);
        }
      });
    }

    // Add generic features if none found
    if (features.length === 0) {
      features.push('• Web-based platform');
      features.push('• User interface available');
      features.push('• Online service offering');
    }

    return features.slice(0, 15); // Limit to 15 features
  }
  */
});

// Removed page-context extractor from popup; background owns it

async function getStoredApiKey() {
  try {
    const result = await chrome.storage.sync.get(['openai_api_key']);
    if (!result.openai_api_key) {
      showStatus('API key not found. Please set your API key in the dashboard.', 'error');
      setTimeout(() => {
        openDashboard();
      }, 1500);
      return null;
    }
    return result.openai_api_key;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

// Update usage statistics
async function updateUsageStats() {
  try {
    // Get current stats
    const result = await chrome.storage.sync.get(['api_calls_today', 'api_calls_total', 'last_used', 'last_used_date']);

    const today = new Date().toDateString();
    let apiCallsToday = result.api_calls_today || 0;
    let apiCallsTotal = result.api_calls_total || 0;

    // Reset daily counter if it's a new day
    if (result.last_used_date !== today) {
      apiCallsToday = 0;
    }

    // Update stats
    await chrome.storage.sync.set({
      api_calls_today: apiCallsToday + 1,
      api_calls_total: apiCallsTotal + 1,
      last_used: new Date().toISOString(),
      last_used_date: today
    });
  } catch (error) {
    console.error('Error updating usage stats:', error);
  }
}

// Get initial analysis model from settings
async function getInitialModel(defaultModel = 'gpt-5-mini') {
  try {
    const result = await chrome.storage.sync.get(['initial_model']);
    return result.initial_model || defaultModel; // Default if not set
  } catch (error) {
    console.error('Error getting initial model:', error);
    return defaultModel; // Fallback
  }
}


// Get company context from settings
async function getCompanyContext() {
  try {
    const result = await chrome.storage.sync.get(['company_context']);
    return result.company_context || ''; // Return empty string if not set
  } catch (error) {
    console.error('Error getting company context:', error);
    return ''; // Fallback to empty string
  }
}


// Get Supabase session from extension storage
async function getSupabaseSession() {
  try {
    const result = await chrome.storage.local.get(['session']);
    if (result.session && result.session.access_token) {
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (result.session.expires_at && result.session.expires_at > now) {
        return result.session;
      } else {
        // Clear expired session
        await chrome.storage.local.remove('session');
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting Supabase session:', error);
    return null;
  }
}