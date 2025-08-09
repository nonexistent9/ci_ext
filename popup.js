document.addEventListener('DOMContentLoaded', function () {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const copyBtn = document.getElementById('copyBtn');
  const saveBtn = document.getElementById('saveBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const thinkMoreSection = document.getElementById('thinkMoreSection');
  const thinkMoreBtn = document.getElementById('thinkMoreBtn');
  const customPrompt = document.getElementById('customPrompt');

  // Store the initial analysis and page data for deeper analysis
  let currentAnalysis = '';
  let currentPageData = null;

  // Update the Think More button text based on the selected model
  updateThinkMoreButtonText();

  extractBtn.addEventListener('click', extractFeatures);
  copyBtn.addEventListener('click', copyToClipboard);
  saveBtn.addEventListener('click', saveAnalysis);
  settingsBtn.addEventListener('click', openDashboard);
  thinkMoreBtn.addEventListener('click', performDeeperAnalysis);

  // Recover any in-progress or last results when popup opens
  (async () => {
    try {
      const [{ current_job, last_analysis }, [tab]] = await Promise.all([
        chrome.storage.local.get(['current_job', 'last_analysis']),
        chrome.tabs.query({ active: true, currentWindow: true })
      ]);

      if (current_job && current_job.jobId) {
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
          if (message.type === 'deepAnalysisComplete') {
            displayResults(message.report);
            showStatus('Deeper analysis completed!', 'success');
            chrome.storage.local.remove('current_job');
            chrome.runtime.onMessage.removeListener(onMessage);
            thinkMoreBtn.disabled = false;
          }
          if (message.type === 'deepAnalysisError') {
            showStatus('Error: ' + message.error, 'error');
            chrome.storage.local.remove('current_job');
            chrome.runtime.onMessage.removeListener(onMessage);
            thinkMoreBtn.disabled = false;
          }
        };
        chrome.runtime.onMessage.addListener(onMessage);
        extractBtn.disabled = true;
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
  
  // Update the Think More button text when the popup is opened
  async function updateThinkMoreButtonText() {
    const model = await getDeepModel();
    thinkMoreBtn.textContent = `🧠 Think More (${model})`;
  }

  async function extractFeatures() {
    try {
      extractBtn.disabled = true;
      showStatus('Starting analysis in background...', 'loading');

      const apiKey = await getStoredApiKey();
      if (!apiKey) return; // getStoredApiKey already surfaced error + opened settings

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
    thinkMoreSection.style.display = 'block';
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

      // Create analysis object
      const analysisData = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        url: currentPageData.url,
        title: currentPageData.title,
        content: currentAnalysis,
        domain: new URL(currentPageData.url).hostname,
        type: currentAnalysis.includes('PRICING ANALYSIS') ? 'pricing' : 'feature'
      };

      // Get existing analyses
      const result = await chrome.storage.sync.get(['saved_analyses']);
      const savedAnalyses = result.saved_analyses || [];

      // Add new analysis to the beginning of the array
      savedAnalyses.unshift(analysisData);

      // Keep only the last 50 analyses to avoid storage limits
      const limitedAnalyses = savedAnalyses.slice(0, 50);

      // Save back to storage
      await chrome.storage.sync.set({ saved_analyses: limitedAnalyses });

      // Update button and show success
      saveBtn.textContent = 'Saved!';
      showStatus('Analysis saved successfully', 'success');
      
      setTimeout(() => {
        saveBtn.textContent = 'Save Analysis';
      }, 2000);

    } catch (error) {
      console.error('Error saving analysis:', error);
      showStatus('Error saving analysis: ' + error.message, 'error');
    }
  }

  // Removed in-popup AI call; now handled by background

  // Deeper analysis with o3 models only
  async function performDeeperAnalysis() {
    try {
      thinkMoreBtn.disabled = true;
      const model = await getDeepModel();
      showStatus(`Starting deeper analysis with ${model} in background...`, 'loading');

      const apiKey = await getStoredApiKey();
      if (!apiKey) return;

      const userPrompt = customPrompt.value.trim() || 'Provide deeper strategic insights and actionable recommendations based on this competitive analysis.';

      const jobId = `deep_${Date.now()}`;
      await chrome.storage.local.set({ current_job: { jobId, type: 'deep', startedAt: Date.now() } });

      const onMessage = (message) => {
        if (!message || message.jobId !== jobId) return;
        if (message.type === 'analysisProgress') {
          showStatus(message.message, 'loading');
        }
        if (message.type === 'deepAnalysisComplete') {
          displayResults(message.report);
          showStatus('Deeper analysis completed!', 'success');
          chrome.storage.local.remove('current_job');
          chrome.runtime.onMessage.removeListener(onMessage);
          thinkMoreBtn.disabled = false;
        }
        if (message.type === 'deepAnalysisError') {
          showStatus('Error: ' + message.error, 'error');
          chrome.storage.local.remove('current_job');
          chrome.runtime.onMessage.removeListener(onMessage);
          thinkMoreBtn.disabled = false;
        }
      };
      chrome.runtime.onMessage.addListener(onMessage);

      chrome.runtime.sendMessage({
        type: 'startDeepAnalysis',
        jobId,
        initialAnalysis: currentAnalysis,
        pageData: currentPageData,
        userPrompt
      });

    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
      thinkMoreBtn.disabled = false;
    }
  }

  // Process with o3 models only for deeper analysis
  async function processWithO3Mini(initialAnalysis, pageData, userPrompt, apiKey) {
    // Update usage statistics
    await updateUsageStats();
    const systemPrompt = `You are an expert competitive intelligence strategist with deep expertise in business strategy, market analysis, and competitive positioning. You excel at extracting actionable insights from competitive data and providing strategic recommendations.

Your task is to perform deeper analysis on the provided competitive intelligence report and respond to the user's specific analytical request.`;

    // Get company context if available
    const companyContext = await getCompanyContext();
    const companyContextSection = companyContext ?
      `\nYOUR COMPANY CONTEXT (For Comparison):
${companyContext}\n` : '';

    const analysisPrompt = `INITIAL COMPETITIVE ANALYSIS:
${initialAnalysis}

ADDITIONAL CONTEXT:
Company: ${pageData.title}
URL: ${pageData.url}
Page Content Sample: ${pageData.textContent.substring(0, 3000)}...${companyContextSection}

USER REQUEST FOR DEEPER ANALYSIS:
${userPrompt}

Please provide a comprehensive deeper analysis that builds upon the initial report. Focus on:
- Strategic implications and recommendations
- Market positioning insights
- Competitive threats and opportunities
- Business model analysis
- Go-to-market strategy insights
- Potential vulnerabilities or strengths
- Actionable next steps for competitive response

Format your response as a strategic analysis memo with clear sections and actionable recommendations.`;

    const model = await getDeepModel();
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ]
    };

    // o3 models always use max_completion_tokens (no temperature)
    requestBody.max_completion_tokens = 3000;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const deeperAnalysis = data.choices[0].message.content;

    const modelName = await getDeepModel();

    return `🧠 DEEPER STRATEGIC ANALYSIS
Generated: ${new Date().toLocaleString()}
Model: OpenAI ${modelName}
Source: ${pageData.url}

USER PROMPT: "${userPrompt}"

${deeperAnalysis}

📋 ORIGINAL ANALYSIS REFERENCE:
${initialAnalysis}

---
Powered by OpenAI ${modelName} | Advanced CI Analysis`;
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
async function getInitialModel(defaultModel = 'gpt-4o-mini') {
  try {
    const result = await chrome.storage.sync.get(['initial_model']);
    return result.initial_model || defaultModel; // Default if not set
  } catch (error) {
    console.error('Error getting initial model:', error);
    return defaultModel; // Fallback
  }
}

// Get deep analysis model from settings
async function getDeepModel(defaultModel = 'o3-mini') {
  try {
    const result = await chrome.storage.sync.get(['deep_model']);
    return result.deep_model || defaultModel; // Default if not set
  } catch (error) {
    console.error('Error getting deep model:', error);
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