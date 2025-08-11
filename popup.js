document.addEventListener('DOMContentLoaded', function () {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const dashboardBtn = document.getElementById('dashboardBtn');
  const authStatus = document.getElementById('authStatus');
  const emailInput = document.getElementById('emailInput');
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  const verifyCodeBtn = document.getElementById('verifyCodeBtn');
  const codeInput = document.getElementById('codeInput');
  // Store the initial analysis and page data
  let currentAnalysis = '';
  let currentPageData = null;

  extractBtn.addEventListener('click', extractFeatures);
  copyBtn.addEventListener('click', copyToClipboard);
  saveBtn.addEventListener('click', saveAnalysis);
  settingsBtn.addEventListener('click', openDashboard);
  dashboardBtn.addEventListener('click', openDashboard);

  // Auth UI setup
  setupAuthUi();

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
  // ===== Supabase Auth (OAuth via new tab + background listener) =====
  function setupAuthUi() {
    refreshAuthUi();
    sendCodeBtn?.addEventListener('click', handleSendCode);
    verifyCodeBtn?.addEventListener('click', handleVerifyCode);
  }

  async function refreshAuthUi() {
    try {
      const sessionObj = await chrome.storage.local.get('session');
      const isLoggedIn = !!sessionObj.session?.access_token;
      const emailField = document.getElementById('emailInput');
      if (emailField) emailField.disabled = isLoggedIn;
      if (sendCodeBtn) sendCodeBtn.disabled = isLoggedIn;
      if (verifyCodeBtn) verifyCodeBtn.disabled = isLoggedIn;
      if (codeInput) codeInput.disabled = isLoggedIn;
      if (isLoggedIn) {
        authStatus.textContent = 'Signed in';
        authStatus.className = 'status success';
        authStatus.style.display = 'block';
      } else {
        authStatus.textContent = 'Not signed in';
        authStatus.className = 'status';
        authStatus.style.display = 'block';
      }
    } catch (_) {}
  }

  // Removed email/password sign-in and sign-up handlers

  async function handleSendCode() {
    const email = (emailInput?.value || '').trim();
    if (!email) {
      showStatus('Enter your email', 'error');
      return;
    }
    try {
      sendCodeBtn.disabled = true;
      await supabaseSendEmailOtp(email);
      showStatus('Code sent. Check your email.', 'success');
    } catch (e) {
      showStatus('Failed to send code: ' + (e?.message || 'Unknown'), 'error');
    } finally {
      sendCodeBtn.disabled = false;
    }
  }

  async function handleVerifyCode() {
    const email = (emailInput?.value || '').trim();
    const token = (codeInput?.value || '').trim();
    if (!email || !token) {
      showStatus('Enter email and 6-digit code', 'error');
      return;
    }
    try {
      verifyCodeBtn.disabled = true;
      await supabaseVerifyEmailOtp(email, token);
      await refreshAuthUi();
      showStatus('Signed in successfully!', 'success');
    } catch (e) {
      showStatus('Verification failed: ' + (e?.message || 'Unknown'), 'error');
    } finally {
      verifyCodeBtn.disabled = false;
    }
  }

  // Logout is handled in the dashboard

  

  async function extractFeatures() {
    try {
      extractBtn.disabled = true;
      showStatus('Starting analysis in background...', 'loading');

      // Check if user is logged in instead of API key
      const session = await getSupabaseSession();
      if (!session?.access_token) {
        showStatus('Please log in to use AI analysis features.', 'error');
        setTimeout(() => {
          openDashboard();
        }, 1500);
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
    copyBtn.style.display = 'block';
    saveBtn.style.display = 'block';
    dashboardBtn.style.display = 'block';
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(results.textContent).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
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

      saveBtn.textContent = 'Saved!';
      showStatus('Analysis saved to Supabase', 'success');

      setTimeout(() => {
        saveBtn.textContent = 'Save Analysis';
      }, 2000);

    } catch (error) {
      console.error('Error saving analysis:', error);
      showStatus('Error saving analysis: ' + error.message, 'error');
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

// API Key management functions
function openDashboard() {
  chrome.runtime.openOptionsPage();
}

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