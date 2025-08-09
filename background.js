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
  // Start tab redirect listener for Supabase OAuth
  setupOAuthListener();
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
  console.log('Background received message:', message.type);
  
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
  
  if (message?.type === 'aiChat') {
    console.log('Processing aiChat message');
    handleAiChat(message)
      .then((result) => {
        console.log('aiChat completed successfully');
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        console.error('AI chat error:', error);
        sendResponse({ success: false, error: error?.message || 'Unknown error' });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message?.type === 'supabaseDbInsert') {
    supabaseDbInsert(message)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Unknown DB error' }));
    return true;
  }

});

// Listen for Supabase OAuth redirect and finalize session
function setupOAuthListener() {
  try {
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      try {
        if (!changeInfo.url) return;
        const redirectBase = (chrome && chrome.identity && typeof chrome.identity.getRedirectURL === 'function')
          ? chrome.identity.getRedirectURL()
          : `https://${chrome.runtime.id}.chromiumapp.org/`;
        if (!changeInfo.url.startsWith(redirectBase)) return;
        await finishUserOAuth(changeInfo.url, tabId);
      } catch (e) {
        console.error('OAuth finalize error:', e);
      }
    });
  } catch (e) {
    console.error('Failed to setup OAuth listener:', e);
  }
}

async function finishUserOAuth(url, tabId) {
  console.log('Handling Supabase OAuth callback...');
  try {
    const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
    if (!supabase_url || !supabase_anon_key) throw new Error('Supabase not configured');

    const hash = (new URL(url).hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) throw new Error('No Supabase tokens in redirect');

    // Persist session
    await chrome.storage.local.set({ session: { access_token, refresh_token, expires_at: Math.floor(Date.now()/1000)+3600 } });

    // Optionally fetch user to validate
    try {
      const res = await fetch(`${supabase_url}/auth/v1/user`, {
        headers: {
          'apikey': supabase_anon_key,
          'Authorization': `Bearer ${access_token}`
        }
      });
      if (res.ok) {
        const user = await res.json();
        await chrome.storage.local.set({ supabase_user: user });
      }
    } catch (_) {}

    // Redirect current tab to a friendly page
    try {
      await chrome.tabs.update(tabId, { url: 'https://supabase.com/thank-you' });
    } catch (_) {}

    // Notify popup/UI
    chrome.runtime.sendMessage({ type: 'authComplete', success: true });
    console.log('Supabase OAuth complete.');
  } catch (error) {
    console.error('finishUserOAuth error:', error);
    chrome.runtime.sendMessage({ type: 'authComplete', success: false, error: error?.message });
  }
}

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
  const customPrompts = await getCustomPrompts();
  const analysisPreferences = await getAnalysisPreferences();
  
  const companyContextSection = companyContext ? `\nYOUR COMPANY CONTEXT (For Comparison):\n${companyContext}\n` : '';
  const customPromptsSection = customPrompts ? `\nCUSTOM ANALYSIS INSTRUCTIONS:\n${customPrompts}\n` : '';
  const preferencesSection = buildPreferencesSection(analysisPreferences);

  const isPricingPage = pageData.url.toLowerCase().includes('pricing') ||
    pageData.title.toLowerCase().includes('pricing') ||
    (pageData.textContent.toLowerCase().includes('plan') && pageData.textContent.toLowerCase().includes('price'));

  let prompt;
  if (isPricingPage) {
    prompt = `Extract pricing information from this competitor's pricing page.\n\nPRICING PAGE ANALYSIS:\nCompany: ${pageData.title}\nURL: ${pageData.url}${companyContextSection}${customPromptsSection}${preferencesSection}\n\nPAGE CONTENT:\n${pageData.textContent.substring(0, 8000)}...\n\nPlease provide a simple pricing analysis:\n\n1. PRICING PLANS (list each plan with key details)\n2. PRICING STRUCTURE (monthly/annual, per user, etc.)\n3. KEY FEATURES BY PLAN\n4. FREE TRIAL/FREEMIUM OPTIONS\n5. ENTERPRISE/CUSTOM PRICING${companyContext ? '\n6. PRICING COMPARISON WITH YOUR COMPANY' : ''}\n\nKeep it concise and focused on pricing details only.`;
  } else {
    prompt = `Extract the key features and capabilities from this competitor's website.\n\nFEATURE EXTRACTION:\nCompany: ${pageData.title}\nURL: ${pageData.url}${companyContextSection}${customPromptsSection}${preferencesSection}\n\nKEY PAGE ELEMENTS:\nMain Headings: ${pageData.headings.map(h => h.text || h).slice(0, 15).join(', ')}\nCall-to-Actions: ${pageData.buttons.slice(0, 10).join(', ')}\n\nPAGE CONTENT:\n${pageData.textContent.substring(0, 8000)}...\n\nPlease provide a simple feature summary:\n\n1. CORE FEATURES (list main product features)\n2. KEY CAPABILITIES (what the product does)\n3. TARGET USERS (who it's for)\n4. INTEGRATIONS (if mentioned)\n5. UNIQUE SELLING POINTS${companyContext ? '\n6. FEATURE COMPARISON WITH YOUR COMPANY' : ''}\n\nKeep it simple and focused on features only. Avoid strategic analysis.`;
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

async function handleAiChat(payload) {
  const { message, referencedDocs, conversationHistory } = payload;
  
  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set your API key in the dashboard.');
  }

  await updateUsageStats();
  
  // If no documents are referenced, try to find relevant documents automatically
  let docsToAnalyze = referencedDocs;
  if (!referencedDocs || referencedDocs.length === 0) {
    docsToAnalyze = await findRelevantDocuments(message);
  }
  
  // Get user preferences and custom prompts for chat
  const companyContext = await getCompanyContext();
  const customPrompts = await getCustomPrompts();
  const analysisPreferences = await getAnalysisPreferences();
  
  console.log('AI Chat Debug - Company Context:', companyContext);
  console.log('AI Chat Debug - Custom Prompts:', customPrompts);
  console.log('AI Chat Debug - Analysis Preferences:', analysisPreferences);

  // Build context from documents to analyze
  let documentContext = '';
  if (docsToAnalyze && docsToAnalyze.length > 0) {
    documentContext = '\n\n=== REFERENCED DOCUMENTS FOR ANALYSIS ===\n';
    docsToAnalyze.forEach((doc, index) => {
      documentContext += `\n--- DOCUMENT ${index + 1}: "${doc.title}" ---\n`;
      documentContext += `• Company/Source: ${doc.domain}\n`;
      documentContext += `• URL: ${doc.url}\n`;
      documentContext += `• Analysis Type: ${doc.type.toUpperCase()}\n`;
      documentContext += `• Date Analyzed: ${new Date(doc.timestamp).toLocaleDateString()}\n`;
      
      // Extract key sections from the content and chunk if too large
      const content = doc.content;
      const maxContentLength = 3000; // Limit per document to avoid token issues
      
      if (content.length <= maxContentLength) {
        documentContext += `• Full Analysis Content:\n\n${content}\n\n`;
      } else {
        // Extract the most relevant parts
        const chunks = chunkContent(content, message, maxContentLength);
        documentContext += `• Relevant Content Sections:\n\n${chunks}\n\n`;
      }
      
      // Try to extract specific sections if they exist
      if (content.includes('CORE FEATURES') || content.includes('KEY FEATURES')) {
        const featuresMatch = content.match(/(?:CORE|KEY) FEATURES[:\s]*([^]*?)(?=\n\n|\d\.|[A-Z]{2,}|$)/);
        if (featuresMatch) {
          documentContext += `• Key Features Identified:\n${featuresMatch[1].trim()}\n\n`;
        }
      }
      
      if (content.includes('PRICING') || content.includes('PLANS')) {
        const pricingMatch = content.match(/PRICING[:\s]*([^]*?)(?=\n\n|\d\.|[A-Z]{2,}|$)/);
        if (pricingMatch) {
          documentContext += `• Pricing Information:\n${pricingMatch[1].trim()}\n\n`;
        }
      }
      
      documentContext += `--- END OF DOCUMENT ${index + 1} ---\n\n`;
    });
    
    documentContext += `\nIMPORTANT: Base your analysis ONLY on the content provided above. Reference specific details, quotes, or sections from these documents in your response.\n`;
    
    // Add company context to document analysis if available
    if (companyContext) {
      documentContext += `

CRITICAL: YOUR COMPANY INFORMATION FOR COMPETITIVE ANALYSIS:
${companyContext}

INSTRUCTIONS: When analyzing the documents above, you MUST:
1. Compare competitor features/pricing/strategies against YOUR company's offerings
2. Identify specific advantages or gaps relative to YOUR company
3. Provide recommendations tailored to YOUR company's context
4. Reference YOUR company information directly in your analysis

`;
    }
    
    // Add custom analysis instructions if available
    if (customPrompts) {
      documentContext += `\nCUSTOM ANALYSIS INSTRUCTIONS:\n${customPrompts}\n`;
    }
  } else {
    // No documents found or provided
    documentContext = '\n\nNOTE: No specific documents were referenced or found to be relevant to this query. Please provide general competitive intelligence guidance or ask the user to reference specific documents using @ mentions.\n';
  }

  // Add company context to the beginning if available for maximum visibility
  let companyContextSection = '';
  if (companyContext) {
    companyContextSection = `

IMPORTANT - YOUR COMPANY CONTEXT:
${companyContext}

This is critical information about the user's company. Always consider this context when providing competitive analysis and comparisons. Reference this information directly in your responses when relevant.

=====================================

`;
  }

  // Build enhanced system prompt with user preferences
  let systemPrompt = `${companyContextSection}You are an expert competitive intelligence analyst with deep expertise in business strategy, market analysis, and competitive positioning. Your role is to analyze competitive intelligence data and provide actionable strategic insights.

CORE RESPONSIBILITIES:
- Extract and analyze key information from competitive intelligence reports
- Compare competitors' strategies, features, pricing, and positioning against the user's company context
- Identify market trends, opportunities, and threats specific to the user's business
- Provide specific, actionable strategic recommendations tailored to the user's company
- Reference specific details from documents when available
- Always relate findings back to the user's company when context is provided

ANALYSIS APPROACH:
- When documents are provided: Always ground responses in the specific data provided
- Quote relevant sections from documents when making points
- Be specific about what you found in each document
- If comparing multiple documents, clearly differentiate between them
- If asked about something not in the provided documents, clearly state that
- When no documents are available: Provide general competitive intelligence best practices and guidance
- ALWAYS consider the user's company context in your analysis and recommendations

RESPONSE STYLE:
- Be direct and actionable
- Use bullet points and clear structure when analyzing multiple points
- When documents are available: Reference specific document sections or quotes
- When no documents are available: Provide educational content about competitive intelligence methods
- Always be honest about the availability of specific data
- If no relevant information is found, suggest how the user can get better results
- When user's company context is available: Always relate competitive insights back to their specific situation

DOCUMENT HANDLING:
- When documents are referenced with @[Document Name]: Focus exclusively on analyzing those specific documents
- When no documents are referenced: Automatically search for relevant documents from the user's saved analyses
- When no relevant documents exist: Provide general guidance and suggest ways to gather competitive intelligence
- Always cite specific information from documents rather than making general statements when data is available
- Frame all competitive analysis in terms of implications for the user's company`;

  // Add user preferences to system prompt
  if (analysisPreferences) {
    systemPrompt += `\n\nUSER PREFERENCES:`;
    if (analysisPreferences.includeActionableInsights) {
      systemPrompt += `\n- Always include specific, actionable recommendations in your responses`;
    }
    if (analysisPreferences.focusOnDifferentiators) {
      systemPrompt += `\n- Emphasize unique competitive differentiators and key distinguishing factors`;
    }
    if (analysisPreferences.includeMarketContext) {
      systemPrompt += `\n- When possible, include broader market context and industry trends`;
    }
    if (analysisPreferences.prioritizeThreats) {
      systemPrompt += `\n- Prioritize identification of competitive threats and market opportunities`;
    }
  }
  
  // Add custom prompts if available
  if (customPrompts) {
    systemPrompt += `\n\nCUSTOM ANALYSIS INSTRUCTIONS:\n${customPrompts}`;
  }
  
  console.log('AI Chat Debug - Final System Prompt:', systemPrompt);

  // Build messages array with conversation history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Add conversation history (limit to last 10 messages to avoid token limits)
  const recentHistory = conversationHistory.slice(-10);
  messages.push(...recentHistory);

  // Add current message with document context if needed
  let currentMessage = message;
  if (documentContext) {
    currentMessage += documentContext;
  }
  
  // Add explicit company context reminder if available
  if (companyContext && !documentContext.includes('CRITICAL: YOUR COMPANY INFORMATION')) {
    currentMessage += `

REMEMBER: My company context is: ${companyContext}

Please relate your response to my specific company situation.`;
  }
  
  messages.push({ role: 'user', content: currentMessage });
  
  console.log('AI Chat Debug - Current Message:', currentMessage);
  console.log('AI Chat Debug - Full Messages Array:', JSON.stringify(messages, null, 2));

  const model = await getInitialModel();
  const requestBody = {
    model,
    messages,
    max_tokens: 1500,
    temperature: 0.7
  };

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
  return data.choices?.[0]?.message?.content || 'No response generated';
}

async function findRelevantDocuments(query) {
  try {
    const result = await chrome.storage.sync.get(['saved_analyses']);
    const allDocs = result.saved_analyses || [];
    
    if (allDocs.length === 0) {
      return [];
    }
    
    // Simple keyword-based relevance scoring
    const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    const scoredDocs = allDocs.map(doc => {
      let score = 0;
      const docText = (doc.title + ' ' + doc.content + ' ' + doc.domain).toLowerCase();
      
      keywords.forEach(keyword => {
        // Higher score for title matches
        if (doc.title.toLowerCase().includes(keyword)) score += 5;
        if (doc.domain.toLowerCase().includes(keyword)) score += 3;
        // Count occurrences in content
        const contentMatches = (docText.match(new RegExp(keyword, 'g')) || []).length;
        score += contentMatches;
      });
      
      return { doc, score };
    });
    
    // Return top 3 most relevant documents with score > 0
    return scoredDocs
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.doc);
      
  } catch (error) {
    console.error('Error finding relevant documents:', error);
    return [];
  }
}

function chunkContent(content, query, maxLength) {
  // Split content into paragraphs/sections
  const sections = content.split(/\n\n+/);
  const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  
  // Score each section based on query relevance
  const scoredSections = sections.map(section => {
    let score = 0;
    const sectionLower = section.toLowerCase();
    
    keywords.forEach(keyword => {
      const matches = (sectionLower.match(new RegExp(keyword, 'g')) || []).length;
      score += matches;
    });
    
    return { section: section.trim(), score };
  }).filter(item => item.section.length > 20); // Filter out very short sections
  
  // Sort by relevance and build result within length limit
  scoredSections.sort((a, b) => b.score - a.score);
  
  let result = '';
  let currentLength = 0;
  
  for (const item of scoredSections) {
    if (currentLength + item.section.length + 2 <= maxLength) {
      result += item.section + '\n\n';
      currentLength += item.section.length + 2;
    } else {
      // Try to fit a truncated version
      const remaining = maxLength - currentLength - 50; // Leave space for truncation message
      if (remaining > 100) {
        result += item.section.substring(0, remaining) + '...\n\n';
      }
      break;
    }
  }
  
  return result.trim() || content.substring(0, maxLength) + '...';
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

// Minimal DB insert via Supabase REST routed through background (avoids CORS in popup)
async function supabaseDbInsert({ table, rows }) {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  if (!supabase_url || !supabase_anon_key) throw new Error('Supabase not configured');
  const { session } = await chrome.storage.local.get('session');
  const token = session?.access_token || supabase_anon_key;
  const res = await fetch(`${supabase_url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Insert failed: ${res.status} ${txt}`);
  }
  return res.json();
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

async function getCustomPrompts() {
  try {
    const result = await chrome.storage.sync.get(['custom_prompts']);
    return result.custom_prompts || '';
  } catch (e) {
    console.error('Error getting custom prompts:', e);
    return '';
  }
}

async function getAnalysisPreferences() {
  try {
    const result = await chrome.storage.sync.get(['analysis_preferences']);
    return result.analysis_preferences || {};
  } catch (e) {
    console.error('Error getting analysis preferences:', e);
    return {};
  }
}

function buildPreferencesSection(preferences) {
  if (!preferences || Object.keys(preferences).length === 0) {
    return '';
  }
  
  let section = '\n\nANALYSIS PREFERENCES:\n';
  if (preferences.includeActionableInsights) {
    section += '- Include specific actionable recommendations\n';
  }
  if (preferences.focusOnDifferentiators) {
    section += '- Emphasize competitive differentiators\n';
  }
  if (preferences.includeMarketContext) {
    section += '- Include broader market context when possible\n';
  }
  if (preferences.prioritizeThreats) {
    section += '- Prioritize competitive threats and opportunities\n';
  }
  
  return section;
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