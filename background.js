// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  
  // Create context menu item for dashboard
  chrome.contextMenus.create({
    id: 'openDashboard',
    title: 'Open CI Feature Extractor Dashboard',
    contexts: ['action']
  });
  
  // Clean up any stale jobs on startup
  cleanupStaleJobs();
});

// Clean up jobs older than 10 minutes
async function cleanupStaleJobs() {
  try {
    const result = await chrome.storage.local.get(['current_job']);
    if (result.current_job && result.current_job.startedAt) {
      const jobAge = Date.now() - result.current_job.startedAt;
      if (jobAge > 10 * 60 * 1000) { // 10 minutes
        console.log('Cleaning up stale job:', result.current_job);
        await chrome.storage.local.remove('current_job');
      }
    }
  } catch (e) {
    console.error('Error cleaning up stale jobs:', e);
  }
}

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

// When user clicks notification, open dashboard to view/save
chrome.notifications?.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Listen for long-running analysis requests so work continues even if popup closes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'startAnalysis') {
    startBackgroundAnalysis(message)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Background analysis error:', error);
        chrome.runtime.sendMessage({
          type: 'analysisError',
          jobId: message.jobId,
          error: error?.message || 'Unknown error',
        });
        sendResponse({ success: false, error: error?.message });
      });
    return true; // Keep message channel open for async response
  }

});

async function startBackgroundAnalysis(payload) {
  const { tabId, jobId } = payload;

  chrome.runtime.sendMessage({ type: 'analysisProgress', jobId, message: 'Extracting page content...' });

  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set your API key in the dashboard.');
  }

  // Extract page data in the target tab with timeout
  let result;
  try {
    const scriptPromise = chrome.scripting.executeScript({
      target: { tabId },
      function: extractPageContent
    });
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Page content extraction timed out')), 30000)
    );
    
    [result] = await Promise.race([scriptPromise, timeoutPromise]);
  } catch (error) {
    throw new Error(`Failed to extract page content: ${error.message}`);
  }

  const pageData = result?.result;
  if (!pageData) {
    throw new Error('No page content extracted - the page may not be accessible');
  }

  await updateUsageStats();

  chrome.runtime.sendMessage({ type: 'analysisProgress', jobId, message: 'Building prompt...' });
  const companyContext = await getCompanyContext();
  const companyContextSection = companyContext ? `\nYOUR COMPANY CONTEXT (For Comparison):\n${companyContext}\n` : '';

  const isPricingPage = pageData.url.toLowerCase().includes('pricing') ||
    pageData.title.toLowerCase().includes('pricing') ||
    (pageData.textContent.toLowerCase().includes('plan') && pageData.textContent.toLowerCase().includes('price'));

  let prompt;
  if (isPricingPage) {
    prompt = `Extract pricing information from this competitor's pricing page.\n\nPRICING PAGE ANALYSIS:\nCompany: ${pageData.title}\nURL: ${pageData.url}${companyContextSection}\n\nPAGE CONTENT:\n${pageData.textContent.substring(0, 8000)}...\n\nPlease provide a simple pricing analysis:\n\n1. PRICING PLANS (list each plan with key details)\n2. PRICING STRUCTURE (monthly/annual, per user, etc.)\n3. KEY FEATURES BY PLAN\n4. FREE TRIAL/FREEMIUM OPTIONS\n5. ENTERPRISE/CUSTOM PRICING${companyContext ? '\n6. PRICING COMPARISON WITH YOUR COMPANY' : ''}\n\nKeep it concise and focused on pricing details only.`;
  } else {
    prompt = `Extract the key features and capabilities from this competitor's website.\n\nFEATURE EXTRACTION:\nCompany: ${pageData.title}\nURL: ${pageData.url}${companyContextSection}\n\nKEY PAGE ELEMENTS:\nMain Headings: ${pageData.headings.map(h => h.text || h).slice(0, 15).join(', ')}\nCall-to-Actions: ${pageData.buttons.slice(0, 10).join(', ')}\n\nPAGE CONTENT:\n${pageData.textContent.substring(0, 8000)}...\n\nPlease provide a simple feature summary:\n\n1. CORE FEATURES (list main product features)\n2. KEY CAPABILITIES (what the product does)\n3. TARGET USERS (who it's for)\n4. INTEGRATIONS (if mentioned)\n5. UNIQUE SELLING POINTS${companyContext ? '\n6. FEATURE COMPARISON WITH YOUR COMPANY' : ''}\n\nKeep it simple and focused on features only. Avoid strategic analysis.`;
  }

  const model = await getInitialModel();
  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a feature extraction specialist. Your job is to quickly identify and summarize the key features, capabilities, and pricing information from competitor websites. Be concise and factual. Avoid strategic analysis or deep insights - just extract the core information clearly.'
      },
      { role: 'user', content: prompt }
    ]
  };
  requestBody.max_tokens = 2000;
  requestBody.temperature = 0.3;

  chrome.runtime.sendMessage({ type: 'analysisProgress', jobId, message: `Contacting OpenAI (${model})...` });
  
  // Add timeout to OpenAI API call
  const fetchPromise = fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('OpenAI API request timed out')), 120000) // 2 minute timeout
  );
  
  const response = await Promise.race([fetchPromise, timeoutPromise]);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const analysis = data.choices?.[0]?.message?.content || '';
  const modelName = await getInitialModel();
  const reportType = isPricingPage ? 'PRICING ANALYSIS' : 'FEATURE EXTRACTION';
  const report = `📋 ${reportType} REPORT\nGenerated: ${new Date().toLocaleString()}\nSource: ${pageData.url}\n\n${analysis}\n\n---\nPowered by OpenAI ${modelName} | CI Feature Extractor`;

  const record = {
    id: jobId,
    status: 'complete',
    timestamp: new Date().toISOString(),
    pageData,
    report,
  };
  await chrome.storage.local.set({ last_analysis: record });

  chrome.runtime.sendMessage({ type: 'analysisComplete', jobId, pageData, report });

  // Notify user even if popup is closed
  try {
    await chrome.notifications.create(jobId, {
      type: 'basic',
      iconUrl: 'public/icon128.png',
      title: 'CI Feature Extractor',
      message: 'Analysis complete. Click to view the report.'
    });
  } catch (e) {
    // Ignore notification errors
  }
}


// --- Shared helpers in background ---
async function getStoredApiKey() {
  try {
    const result = await chrome.storage.sync.get(['openai_api_key']);
    return result.openai_api_key || null;
  } catch (e) {
    console.error('Error getting API key:', e);
    return null;
  }
}

async function updateUsageStats() {
  try {
    const result = await chrome.storage.sync.get(['api_calls_today', 'api_calls_total', 'last_used', 'last_used_date']);
    const today = new Date().toDateString();
    let apiCallsToday = result.api_calls_today || 0;
    let apiCallsTotal = result.api_calls_total || 0;
    if (result.last_used_date !== today) {
      apiCallsToday = 0;
    }
    await chrome.storage.sync.set({
      api_calls_today: apiCallsToday + 1,
      api_calls_total: apiCallsTotal + 1,
      last_used: new Date().toISOString(),
      last_used_date: today
    });
  } catch (e) {
    console.error('Error updating usage stats:', e);
  }
}

async function getInitialModel(defaultModel = 'gpt-4o-mini') {
  try {
    const result = await chrome.storage.sync.get(['initial_model']);
    return result.initial_model || defaultModel;
  } catch (e) {
    console.error('Error getting initial model:', e);
    return defaultModel;
  }
}


async function getCompanyContext() {
  try {
    const result = await chrome.storage.sync.get(['company_context']);
    return result.company_context || '';
  } catch (e) {
    console.error('Error getting company context:', e);
    return '';
  }
}

// This function executes in the page context via chrome.scripting.executeScript
function extractPageContent() {
  const data = {
    title: document.title,
    url: window.location.href,
    htmlSource: document.documentElement.outerHTML,
    textContent: document.body.innerText,
    headings: [],
    buttons: [],
    forms: [],
    links: [],
    images: [],
    metadata: {}
  };

  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(h => {
    const text = h.textContent.trim();
    if (text && text.length < 200) {
      data.headings.push({ level: h.tagName.toLowerCase(), text });
    }
  });

  const buttons = document.querySelectorAll('button, .btn, [role="button"], input[type="submit"], a[class*="btn"]');
  buttons.forEach(btn => {
    const text = btn.textContent.trim() || btn.value || btn.getAttribute('aria-label');
    if (text && text.length < 100) {
      data.buttons.push(text);
    }
  });

  const forms = document.querySelectorAll('form');
  data.forms = Array.from(forms).map(form => ({ action: form.action, method: form.method, inputs: form.querySelectorAll('input').length }));

  const navLinks = document.querySelectorAll('nav a, .nav a, .menu a, .navigation a');
  navLinks.forEach(link => {
    const text = link.textContent.trim();
    if (text && text.length < 100) {
      data.links.push(text);
    }
  });

  const images = document.querySelectorAll('img[alt]');
  images.forEach(img => {
    if (img.alt && img.alt.length < 200) {
      data.images.push(img.alt);
    }
  });

  const metaTags = document.querySelectorAll('meta[name], meta[property]');
  metaTags.forEach(meta => {
    const name = meta.getAttribute('name') || meta.getAttribute('property');
    const content = meta.getAttribute('content');
    if (name && content) {
      data.metadata[name] = content;
    }
  });

  return data;
}