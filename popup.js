document.addEventListener('DOMContentLoaded', function () {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const copyBtn = document.getElementById('copyBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const thinkMoreSection = document.getElementById('thinkMoreSection');
  const thinkMoreBtn = document.getElementById('thinkMoreBtn');
  const customPrompt = document.getElementById('customPrompt');

  // Store the initial analysis and page data for deeper analysis
  let currentAnalysis = '';
  let currentPageData = null;

  extractBtn.addEventListener('click', extractFeatures);
  copyBtn.addEventListener('click', copyToClipboard);
  settingsBtn.addEventListener('click', openDashboard);
  thinkMoreBtn.addEventListener('click', performDeeperAnalysis);

  async function extractFeatures() {
    try {
      extractBtn.disabled = true;
      showStatus('Analyzing page content...', 'loading');

      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Inject content script and extract page data
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPageContent
      });

      if (!result.result) {
        throw new Error('Failed to extract page content');
      }

      const pageData = result.result;
      currentPageData = pageData; // Store for deeper analysis

      // Process with AI
      const features = await processWithAI(pageData);

      displayResults(features);
      showStatus('Analysis completed successfully!', 'success');

    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
    } finally {
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

  // Real AI processing with OpenAI
  async function processWithAI(pageData) {
    const apiKey = await getStoredApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set your API key in the dashboard.');
    }

    // Update usage statistics
    await updateUsageStats();

    // Get company context if available
    const companyContext = await getCompanyContext();
    const companyContextSection = companyContext ?
      `\nYOUR COMPANY CONTEXT (For Comparison):
${companyContext}\n` : '';

    // Determine if this is a pricing page
    const isPricingPage = pageData.url.toLowerCase().includes('pricing') ||
      pageData.title.toLowerCase().includes('pricing') ||
      pageData.textContent.toLowerCase().includes('plan') && pageData.textContent.toLowerCase().includes('price');

    let prompt;
    if (isPricingPage) {
      prompt = `Extract pricing information from this competitor's pricing page.

PRICING PAGE ANALYSIS:
Company: ${pageData.title}
URL: ${pageData.url}${companyContextSection}

PAGE CONTENT:
${pageData.textContent.substring(0, 8000)}...

Please provide a simple pricing analysis:

1. PRICING PLANS (list each plan with key details)
2. PRICING STRUCTURE (monthly/annual, per user, etc.)
3. KEY FEATURES BY PLAN
4. FREE TRIAL/FREEMIUM OPTIONS
5. ENTERPRISE/CUSTOM PRICING${companyContext ? '\n6. PRICING COMPARISON WITH YOUR COMPANY' : ''}

Keep it concise and focused on pricing details only.`;
    } else {
      prompt = `Extract the key features and capabilities from this competitor's website.

FEATURE EXTRACTION:
Company: ${pageData.title}
URL: ${pageData.url}${companyContextSection}

KEY PAGE ELEMENTS:
Main Headings: ${pageData.headings.map(h => h.text || h).slice(0, 15).join(', ')}
Call-to-Actions: ${pageData.buttons.slice(0, 10).join(', ')}

PAGE CONTENT:
${pageData.textContent.substring(0, 8000)}...

Please provide a simple feature summary:

1. CORE FEATURES (list main product features)
2. KEY CAPABILITIES (what the product does)
3. TARGET USERS (who it's for)
4. INTEGRATIONS (if mentioned)
5. UNIQUE SELLING POINTS${companyContext ? '\n6. FEATURE COMPARISON WITH YOUR COMPANY' : ''}

Keep it simple and focused on features only. Avoid strategic analysis.`;
    }

    const model = await getDefaultModel();
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are a feature extraction specialist. Your job is to quickly identify and summarize the key features, capabilities, and pricing information from competitor websites. Be concise and factual. Avoid strategic analysis or deep insights - just extract the core information clearly.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // Use appropriate parameters based on model
    if (model.includes('o3')) {
      requestBody.max_completion_tokens = 2000;
    } else {
      requestBody.max_tokens = 2000;
      requestBody.temperature = 0.3;
    }

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
    const analysis = data.choices[0].message.content;

    const modelName = await getDefaultModel();

    const reportType = isPricingPage ? 'PRICING ANALYSIS' : 'FEATURE EXTRACTION';

    return `📋 ${reportType} REPORT
Generated: ${new Date().toLocaleString()}
Source: ${pageData.url}

${analysis}

---
Powered by OpenAI ${modelName} | CI Feature Extractor
💡 Use "Think More" for deeper strategic analysis`;
  }

  // Deeper analysis with o3-mini
  async function performDeeperAnalysis() {
    try {
      thinkMoreBtn.disabled = true;
      showStatus('Performing deeper analysis with o3-mini...', 'loading');

      const apiKey = await getStoredApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please enter your API key.');
      }

      const userPrompt = customPrompt.value.trim() || 'Provide deeper strategic insights and actionable recommendations based on this competitive analysis.';

      const deeperAnalysis = await processWithO3Mini(currentAnalysis, currentPageData, userPrompt, apiKey);

      displayResults(deeperAnalysis);
      showStatus('Deeper analysis completed!', 'success');

    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
    } finally {
      thinkMoreBtn.disabled = false;
    }
  }

  // Process with o3-mini for deeper analysis
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

    const model = await getDefaultModel('o3-mini');
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

    // Use appropriate parameters based on model
    if (model.includes('o3')) {
      requestBody.max_completion_tokens = 3000;
    } else {
      requestBody.max_tokens = 3000;
      requestBody.temperature = 0.3;
    }

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

    const modelName = await getDefaultModel('o3-mini');

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

// This function runs in the page context
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

  // Extract headings
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headings.forEach(h => {
    const text = h.textContent.trim();
    if (text && text.length < 200) {
      data.headings.push({
        level: h.tagName.toLowerCase(),
        text: text
      });
    }
  });

  // Extract button text
  const buttons = document.querySelectorAll('button, .btn, [role="button"], input[type="submit"], a[class*="btn"]');
  buttons.forEach(btn => {
    const text = btn.textContent.trim() || btn.value || btn.getAttribute('aria-label');
    if (text && text.length < 100) {
      data.buttons.push(text);
    }
  });

  // Extract forms
  const forms = document.querySelectorAll('form');
  data.forms = Array.from(forms).map(form => ({
    action: form.action,
    method: form.method,
    inputs: form.querySelectorAll('input').length
  }));

  // Extract navigation links
  const navLinks = document.querySelectorAll('nav a, .nav a, .menu a, .navigation a');
  navLinks.forEach(link => {
    const text = link.textContent.trim();
    if (text && text.length < 100) {
      data.links.push(text);
    }
  });

  // Extract images with alt text
  const images = document.querySelectorAll('img[alt]');
  images.forEach(img => {
    if (img.alt && img.alt.length < 200) {
      data.images.push(img.alt);
    }
  });

  // Extract meta tags
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

// Get default model from settings
async function getDefaultModel(defaultModel = 'gpt-4o-mini') {
  try {
    const result = await chrome.storage.sync.get(['default_model']);
    return result.default_model || defaultModel; // Default if not set
  } catch (error) {
    console.error('Error getting default model:', error);
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