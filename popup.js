document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const copyBtn = document.getElementById('copyBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const thinkMoreSection = document.getElementById('thinkMoreSection');
  const thinkMoreBtn = document.getElementById('thinkMoreBtn');
  const customPrompt = document.getElementById('customPrompt');

  // Store the initial analysis and page data for deeper analysis
  let currentAnalysis = '';
  let currentPageData = null;

  // Load saved API key
  loadApiKey();

  extractBtn.addEventListener('click', extractFeatures);
  copyBtn.addEventListener('click', copyToClipboard);
  saveKeyBtn.addEventListener('click', saveApiKey);
  thinkMoreBtn.addEventListener('click', performDeeperAnalysis);

  async function extractFeatures() {
    try {
      extractBtn.disabled = true;
      showStatus('Extracting features...', 'loading');
      
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
      
      // Process with AI (mock implementation - replace with actual AI service)
      const features = await processWithAI(pageData);
      
      displayResults(features);
      showStatus('Features extracted successfully!', 'success');
      
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
      throw new Error('OpenAI API key not found. Please enter your API key.');
    }

    const prompt = `Analyze this competitor's website and extract comprehensive competitive intelligence.

WEBSITE ANALYSIS REQUEST:
Company: ${pageData.title}
URL: ${pageData.url}
Meta Description: ${pageData.metadata.description || 'N/A'}

KEY PAGE ELEMENTS:
Navigation: ${pageData.links.slice(0, 10).join(', ')}
Main Headings: ${pageData.headings.map(h => h.text || h).slice(0, 10).join(', ')}
Call-to-Actions: ${pageData.buttons.slice(0, 10).join(', ')}

FULL PAGE CONTENT:
${pageData.textContent.substring(0, 8000)}...

Please provide a comprehensive competitive intelligence analysis including:

1. CORE PRODUCT FEATURES & CAPABILITIES
2. TARGET MARKET & USE CASES  
3. PRICING MODEL INDICATORS
4. TECHNOLOGY STACK CLUES
5. COMPETITIVE POSITIONING
6. UNIQUE VALUE PROPOSITIONS
7. BUSINESS MODEL INSIGHTS
8. CUSTOMER SEGMENTS
9. INTEGRATION CAPABILITIES
10. GROWTH & SCALING FEATURES

Format as a structured, actionable competitive intelligence report.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a competitive intelligence analyst specializing in SaaS and technology companies. Analyze websites to extract key business features, competitive positioning, and strategic insights. Provide actionable intelligence in a structured format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    return `🔍 COMPETITIVE INTELLIGENCE REPORT
Generated: ${new Date().toLocaleString()}
Source: ${pageData.url}

${analysis}

📊 TECHNICAL METRICS:
• Page Sections: ${pageData.headings.length}
• Interactive Elements: ${pageData.buttons.length}  
• Forms: ${pageData.forms.length}
• Images: ${pageData.images.length}
• Content Size: ${Math.round(pageData.textContent.length / 1024)}KB
• HTML Size: ${Math.round(pageData.htmlSource.length / 1024)}KB

🔗 KEY NAVIGATION:
${pageData.links.slice(0, 8).map(link => `• ${link}`).join('\n')}

---
Powered by OpenAI GPT-4o-mini | CI Feature Extractor`;
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
    const systemPrompt = `You are an expert competitive intelligence strategist with deep expertise in business strategy, market analysis, and competitive positioning. You excel at extracting actionable insights from competitive data and providing strategic recommendations.

Your task is to perform deeper analysis on the provided competitive intelligence report and respond to the user's specific analytical request.`;

    const analysisPrompt = `INITIAL COMPETITIVE ANALYSIS:
${initialAnalysis}

ADDITIONAL CONTEXT:
Company: ${pageData.title}
URL: ${pageData.url}
Page Content Sample: ${pageData.textContent.substring(0, 3000)}...

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'o3-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_completion_tokens: 3000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const deeperAnalysis = data.choices[0].message.content;
    
    return `🧠 DEEPER STRATEGIC ANALYSIS
Generated: ${new Date().toLocaleString()}
Model: OpenAI o3-mini
Source: ${pageData.url}

USER PROMPT: "${userPrompt}"

${deeperAnalysis}

📋 ORIGINAL ANALYSIS REFERENCE:
${initialAnalysis}

---
Powered by OpenAI o3-mini | Advanced CI Analysis`;
  }

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
async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }
    
    try {
      await chrome.storage.sync.set({ openai_api_key: apiKey });
      apiKeyInput.value = '';
      showStatus('API key saved successfully', 'success');
    } catch (error) {
      showStatus('Error saving API key', 'error');
    }
  }

async function loadApiKey() {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      if (result.openai_api_key) {
        apiKeyInput.placeholder = 'API key saved ✓';
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

async function getStoredApiKey() {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      return result.openai_api_key;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }