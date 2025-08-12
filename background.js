// Import config functions
importScripts('config.js');

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
// Track active stream controllers by requestId for cancellation
const streamControllers = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const DEBUG = false;
  if (DEBUG) console.log('Background received message:', message.type);
  
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
  
  // AI Insights feature removed: ignore chat-related message types
  
  if (message?.type === 'supabaseDbInsert') {
    supabaseDbInsert(message)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Unknown DB error' }));
    return true;
  }
  
  if (message?.type === 'getUserAnalyses') {
    getUserAnalysesBackground(message.options || {})
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Failed to get analyses' }));
    return true;
  }
  
  if (message?.type === 'saveAnalysis') {
    saveAnalysisToSupabaseBackground(message.analysisData)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Failed to save analysis' }));
    return true;
  }
  
  if (message?.type === 'updateAnalysis') {
    updateAnalysisBackground(message.id, message.updates)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Failed to update analysis' }));
    return true;
  }
  
  if (message?.type === 'deleteAnalysis') {
    deleteAnalysisBackground(message.id)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Failed to delete analysis' }));
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
  const DEBUG = false;
  if (DEBUG) console.log('Handling Supabase OAuth callback...');
  try {
    const { url: effectiveUrl, anonKey: effectiveAnon } = await getSupabaseConfig();

    const u = new URL(url);
    const hash = (u.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(hash || u.search?.replace(/^\?/, ''));
    const access_token = params.get('access_token') || params.get('accessToken');
    const refresh_token = params.get('refresh_token') || params.get('refreshToken');
    if (!access_token || !refresh_token) {
      // Not a token-carrying redirect; ignore silently
      return;
    }

    // Persist session
    await chrome.storage.local.set({ session: { access_token, refresh_token, expires_at: Math.floor(Date.now()/1000)+3600 } });

    // Optionally fetch user to validate
    try {
      if (effectiveUrl && effectiveAnon) {
        const res = await fetch(`${effectiveUrl}/auth/v1/user`, {
          headers: {
            'apikey': effectiveAnon,
            'Authorization': `Bearer ${access_token}`
          }
        });
        if (res.ok) {
          const user = await res.json();
          await chrome.storage.local.set({ supabase_user: user });
        }
      }
    } catch (_) {}

    // Redirect current tab to a friendly page
    try {
      await chrome.tabs.update(tabId, { url: 'https://supabase.com/thank-you' });
    } catch (_) {}

    // Notify popup/UI
    chrome.runtime.sendMessage({ type: 'authComplete', success: true });
    if (DEBUG) console.log('Supabase OAuth complete.');
  } catch (error) {
    console.error('finishUserOAuth error:', error);
    chrome.runtime.sendMessage({ type: 'authComplete', success: false, error: error?.message });
  }
}

async function startBackgroundAnalysis(payload) {
  const { tabId, jobId } = payload;

  chrome.runtime.sendMessage({ type: 'analysisProgress', jobId, message: 'Extracting page content...' });

  // Check if user is authenticated with Supabase
  const session = await getSupabaseSession();
  if (!session?.access_token) {
    throw new Error('Please log in to use AI analysis features.');
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
  // Build system instructions and incorporate user preferences so they have higher priority
  let systemContent = 'You are a feature extraction specialist. Your job is to quickly identify and summarize the key features, capabilities, and pricing information from competitor websites. Be concise and factual.';
  if (analysisPreferences) {
    const prefs = analysisPreferences || {};
    if (prefs.includeActionableInsights) {
      systemContent += ' Always include 3–5 concrete, prioritized, actionable recommendations tailored to the user\'s company context if provided.';
    } else {
      // Default behavior when not requesting actionable recs is to avoid strategy
      systemContent += ' Avoid strategic analysis or deep insights—focus on extracting the core information clearly.';
    }
    if (prefs.focusOnDifferentiators) {
      systemContent += ' Emphasize unique competitive differentiators and key distinguishing factors.';
    }
    if (prefs.includeMarketContext) {
      systemContent += ' When relevant, include brief broader market context and industry trends.';
    }
    if (prefs.prioritizeThreats) {
      systemContent += ' Prioritize identification of competitive threats and market opportunities.';
    }
  } else {
    // Preserve previous default if no preferences saved
    systemContent += ' Avoid strategic analysis or deep insights—focus on extracting the core information clearly.';
  }

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: systemContent
      },
      { role: 'user', content: prompt }
    ]
  };
  requestBody.max_tokens = 2000;
  requestBody.temperature = 0.3;

  chrome.runtime.sendMessage({ type: 'analysisProgress', jobId, message: `Contacting AI API (${model})...` });
  
  // Use Supabase Edge Function instead of direct OpenAI API call
  const data = await callOpenAIViaEdgeFunction({
    model,
    messages: requestBody.messages,
    max_tokens: requestBody.max_tokens,
    temperature: requestBody.temperature
  });
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

  // Auto-save to Supabase if user is authenticated
  try {
    const session = await chrome.storage.local.get('session');
    if (session?.session?.access_token) {
      const analysisData = {
        pageData,
        report,
        url: pageData.url,
        model_used: modelName
      };
      
      const savedAnalysis = await saveAnalysisToSupabaseBackground(analysisData);
      
      if (savedAnalysis) {
        console.log('Analysis auto-saved to Supabase:', savedAnalysis[0]?.id);
        chrome.runtime.sendMessage({ 
          type: 'analysisSaved', 
          jobId, 
          supabaseId: savedAnalysis[0]?.id 
        });
      }
    }
  } catch (error) {
    console.warn('Auto-save to Supabase failed:', error.message);
  }

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

// AI Insights removed
async function handleAiChat(payload) {
  const { message, referencedDocs, conversationHistory } = payload;
  
  // Check if user is authenticated with Supabase
  const session = await getSupabaseSession();
  if (!session?.access_token) {
    throw new Error('Please log in to use AI chat features.');
  }

  await updateUsageStats();
  
  // If no documents are referenced, try to find relevant documents automatically
  let docsToAnalyze = referencedDocs;
  if (!referencedDocs || referencedDocs.length === 0) {
    // Prefer Supabase-backed retrieval per authenticated user; fallback to local
    const { session } = await chrome.storage.local.get('session');
    if (session?.access_token) {
      docsToAnalyze = await findRelevantDocumentsSupabase(message).catch(() => []);
    }
    if (!docsToAnalyze || docsToAnalyze.length === 0) {
      docsToAnalyze = await findRelevantDocumentsLocal(message);
    }
  }
  
  // Get user preferences and custom prompts for chat
  const companyContext = await getCompanyContext();
  const customPrompts = await getCustomPrompts();
  const analysisPreferences = await getAnalysisPreferences();
  
  const DEBUG = false;
  if (DEBUG) {
    console.log('AI Chat Debug - Company Context:', companyContext);
    console.log('AI Chat Debug - Custom Prompts:', customPrompts);
    console.log('AI Chat Debug - Analysis Preferences:', analysisPreferences);
  }

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
  
  if (DEBUG) console.log('AI Chat Debug - Final System Prompt:', systemPrompt);

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
  
  if (DEBUG) {
    console.log('AI Chat Debug - Current Message:', currentMessage);
    console.log('AI Chat Debug - Full Messages Array:', JSON.stringify(messages, null, 2));
  }

  const model = await getInitialModel();
  const requestBody = {
    model,
    messages,
    max_tokens: 1500,
    temperature: 0.7
  };

  // Use Supabase Edge Function for secure API calls
  const data = await callOpenAIViaEdgeFunction({
    model,
    messages: requestBody.messages,
    max_tokens: requestBody.max_tokens,
    temperature: requestBody.temperature
  });
  
  return data.choices?.[0]?.message?.content || 'No response generated';
}

// Streaming variant: emits tokens via runtime.sendMessage events
// AI Insights removed
async function handleAiChatStream(payload) {
  const { message, referencedDocs, conversationHistory, requestId } = payload;
  
  // Check if user is authenticated with Supabase
  const session = await getSupabaseSession();
  if (!session?.access_token) {
    throw new Error('Please log in to use AI chat features.');
  }
  await updateUsageStats();
  let docsToAnalyze = referencedDocs;
  if (!referencedDocs || referencedDocs.length === 0) {
    const { session } = await chrome.storage.local.get('session');
    if (session?.access_token) {
      docsToAnalyze = await findRelevantDocumentsSupabase(message).catch(() => []);
    }
    if (!docsToAnalyze || docsToAnalyze.length === 0) {
      docsToAnalyze = await findRelevantDocumentsLocal(message);
    }
  }
  const companyContext = await getCompanyContext();
  const customPrompts = await getCustomPrompts();
  const analysisPreferences = await getAnalysisPreferences();
  let documentContext = '';
  if (docsToAnalyze && docsToAnalyze.length > 0) {
    documentContext = '\n\n=== REFERENCED DOCUMENTS FOR ANALYSIS ===\n';
    docsToAnalyze.forEach((doc, index) => {
      documentContext += `\n--- DOCUMENT ${index + 1}: "${doc.title}" ---\n`;
      documentContext += `• Company/Source: ${doc.domain}\n`;
      documentContext += `• URL: ${doc.url}\n`;
      documentContext += `• Analysis Type: ${doc.type.toUpperCase()}\n`;
      documentContext += `• Date Analyzed: ${new Date(doc.timestamp).toLocaleDateString()}\n`;
      const content = doc.content || '';
      const maxContentLength = 3000;
      if (content.length <= maxContentLength) {
        documentContext += `• Full Analysis Content:\n\n${content}\n\n`;
      } else {
        const chunks = chunkContent(content, message, maxContentLength);
        documentContext += `• Relevant Content Sections:\n\n${chunks}\n\n`;
      }
      documentContext += `--- END OF DOCUMENT ${index + 1} ---\n\n`;
    });
  }
  let systemPrompt = `You are an expert competitive intelligence analyst. Provide concise, well-structured insights grounded in the provided documents and the user's company context.`;
  if (analysisPreferences) {
    systemPrompt += `\n\nUSER PREFERENCES:`;
    if (analysisPreferences.includeActionableInsights) systemPrompt += `\n- Include actionable recommendations`;
    if (analysisPreferences.focusOnDifferentiators) systemPrompt += `\n- Emphasize differentiators`;
    if (analysisPreferences.includeMarketContext) systemPrompt += `\n- Include market context when relevant`;
    if (analysisPreferences.prioritizeThreats) systemPrompt += `\n- Prioritize threats and opportunities`;
  }
  if (customPrompts) systemPrompt += `\n\nCUSTOM INSTRUCTIONS:\n${customPrompts}`;
  const messages = [ { role: 'system', content: systemPrompt }, ...conversationHistory.slice(-10) ];
  let current = message + (documentContext || '');
  if (companyContext) current += `\n\nREMEMBER: My company context is: ${companyContext}`;
  messages.push({ role: 'user', content: current });

  const model = await getInitialModel();
  // For now, use non-streaming via Edge Function (streaming can be added later)
  chrome.runtime.sendMessage({ type: 'aiChatStreamStart', requestId });
  try {
    // Use Supabase Edge Function for secure API calls
    const data = await callOpenAIViaEdgeFunction({
      model,
      messages,
      max_tokens: 1500,
      temperature: 0.6
    });
    
    const fullResponse = data.choices?.[0]?.message?.content || 'No response generated';
    // Simulate streaming by sending the full response
    chrome.runtime.sendMessage({ type: 'aiChatStreamEnd', requestId, full: fullResponse });
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'aiChatStreamError', requestId, error: e?.message || 'Stream failed' });
  }
  if (requestId) {
    try { streamControllers.delete(requestId); } catch (_) {}
  }
}

async function findRelevantDocumentsLocal(query) {
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

// Prefer per-user retrieval from Supabase using the user's session (isolation via bearer + optional user_id filter)
async function findRelevantDocumentsSupabase(query) {
  try {
    const user = await getCurrentUser();
    if (!user) return [];
    const analyses = await getUserAnalysesBackground({ limit: 100, orderBy: 'created_at', order: 'desc', userId: user.id });
    if (!Array.isArray(analyses) || analyses.length === 0) return [];
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scored = analyses.map(a => {
      let score = 0;
      const hay = `${a.title || ''} ${a.content || ''} ${a.domain || ''}`.toLowerCase();
      keywords.forEach(k => {
        if ((a.title || '').toLowerCase().includes(k)) score += 5;
        if ((a.domain || '').toLowerCase().includes(k)) score += 3;
        const matches = (hay.match(new RegExp(k, 'g')) || []).length;
        score += matches;
      });
      return { a, score };
    });
    const top = scored
      .filter(x => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 5)
      .map(x => x.a)
      .map(a => ({
        id: a.id,
        title: a.title,
        domain: a.domain,
        url: a.url,
        content: a.content,
        type: a.analysis_type,
        timestamp: a.created_at
      }));
    return top;
  } catch (e) {
    console.warn('findRelevantDocumentsSupabase failed:', e?.message || e);
    return [];
  }
}

async function getCurrentUser() {
  const { url: effectiveUrl, anonKey: effectiveAnon } = await getSupabaseConfig();
  const { session, supabase_user } = await chrome.storage.local.get(['session', 'supabase_user']);
  if (supabase_user?.id) return supabase_user;
  if (!session?.access_token) return null;
  try {
    const res = await fetch(`${effectiveUrl}/auth/v1/user`, {
      headers: { 'apikey': effectiveAnon, 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) return null;
    const user = await res.json();
    await chrome.storage.local.set({ supabase_user: user });
    return user;
  } catch (_) { return null; }
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

// Helicone settings removed from background to avoid shipping secrets in code.
// Edge Function handles routing/observability.

// Minimal DB insert via Supabase REST routed through background (avoids CORS in popup)
async function supabaseDbInsert({ table, rows }) {
  const { url: effectiveUrl, anonKey: effectiveAnon } = await getSupabaseConfig();
  const { session } = await chrome.storage.local.get('session');
  if (!effectiveUrl || !effectiveAnon || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }
  const token = session.access_token;
  const res = await fetch(`${effectiveUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: effectiveAnon,
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

async function getInitialModel(defaultModel = 'gpt-5-mini') {
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

// -------- Supabase Integration Functions --------

// Save analysis to Supabase from background script
async function saveAnalysisToSupabaseBackground(analysisData) {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get('session');
  
  if (!effectiveUrl || !effectiveAnon) {
    throw new Error('Supabase not configured');
  }
  
  if (!session?.access_token) {
    throw new Error('User not authenticated');
  }

  // Get current user
  const userRes = await fetch(`${effectiveUrl}/auth/v1/user`, {
    headers: {
      'apikey': effectiveAnon,
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  if (!userRes.ok) {
    throw new Error('Unable to get current user');
  }
  
  const user = await userRes.json();

  // Prepare analysis data for database
  const analysis = {
    user_id: user.id,
    title: analysisData.title || analysisData.pageData?.title || 'Untitled Analysis',
    url: analysisData.url || analysisData.pageData?.url,
    domain: extractDomainFromUrl(analysisData.url || analysisData.pageData?.url),
    analysis_type: determineAnalysisType(analysisData.report || analysisData.content),
    content: analysisData.report || analysisData.content,
    page_data: analysisData.pageData,
    model_used: analysisData.model_used || await getInitialModel('gpt-4o-mini'),
    token_count: estimateTokenCount(analysisData.report || analysisData.content),
    tags: analysisData.tags || [],
    category: analysisData.category || null,
    is_favorite: analysisData.is_favorite || false
  };

  // Upsert on (user_id, url) to avoid duplicate errors if the same page is saved again
  const res = await fetch(`${effectiveUrl}/rest/v1/analyses?on_conflict=user_id,url`, {
    method: 'POST',
    headers: {
      'apikey': effectiveAnon,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation,resolution=merge-duplicates'
    },
    body: JSON.stringify(analysis)
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to save analysis: ${res.status} ${error}`);
  }

  return await res.json();
}

// Retrieve user's analyses from Supabase in background
async function getUserAnalysesBackground(options = {}) {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get('session');
  
  if (!effectiveUrl || !effectiveAnon || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  // Build query parameters
  const queryParams = new URLSearchParams();
  
  // Ordering
  if (options.orderBy) {
    queryParams.append('order', `${options.orderBy}.${options.order || 'desc'}`);
  } else {
    queryParams.append('order', 'created_at.desc');
  }
  
  // Limit
  if (options.limit) {
    queryParams.append('limit', options.limit);
  }
  
  // Filtering
  if (options.userId) {
    queryParams.append('user_id', `eq.${options.userId}`);
  }
  if (options.domain) {
    queryParams.append('domain', `eq.${options.domain}`);
  }
  
  if (options.analysis_type) {
    queryParams.append('analysis_type', `eq.${options.analysis_type}`);
  }
  
  if (options.is_favorite) {
    queryParams.append('is_favorite', `eq.true`);
  }
  
  // Search in title or content
  if (options.search) {
    queryParams.append('or', `title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
  }

  const url = `${effectiveUrl}/rest/v1/analyses?${queryParams.toString()}`;
  
  const res = await fetch(url, {
    headers: {
      'apikey': effectiveAnon,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to retrieve analyses: ${res.status} ${error}`);
  }

  return await res.json();
}

// --- Chat persistence (per-user) ---
// AI Insights removed
async function saveChatTurnBackground({ role, content }) {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get(['session', 'chat_thread_id']);
  const token = session?.access_token;
  if (!effectiveUrl || !effectiveAnon || !token) throw new Error('Not authenticated');
  const user = await getCurrentUser();
  if (!user?.id) throw new Error('User not available');

  // Ensure a chat thread exists (chat_threads)
  let threadId = (await chrome.storage.local.get('chat_thread_id'))?.chat_thread_id;
  if (!threadId) {
    // Create thread named "AI Insights Chat"
    const res = await fetch(`${effectiveUrl}/rest/v1/chat_threads`, {
      method: 'POST',
      headers: { 'apikey': effectiveAnon, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ name: 'AI Insights Chat', user_id: user.id })
    });
    if (!res.ok) throw new Error('Failed to create chat thread');
    const created = await res.json();
    threadId = created[0]?.id;
    await chrome.storage.local.set({ chat_thread_id: threadId });
  }

  // Insert into chat_messages
  const payload = { role, content, thread_id: threadId, user_id: user.id };
  const resIns = await fetch(`${effectiveUrl}/rest/v1/chat_messages`, {
    method: 'POST',
    headers: { 'apikey': effectiveAnon, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(payload)
  });
  if (!resIns.ok) throw new Error('Failed to save chat message');
  const saved = await resIns.json();
  return { threadId, messageId: saved[0]?.id };
}

// AI Insights removed
async function loadChatThreadBackground() {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session, chat_thread_id } = await chrome.storage.local.get(['session', 'chat_thread_id']);
  if (!session?.access_token) throw new Error('Not authenticated');
  if (!chat_thread_id) return [];
  // Pull chat messages for this thread id
  const url = `${effectiveUrl}/rest/v1/chat_messages?thread_id=eq.${chat_thread_id}&order=created_at.asc`;
  const res = await fetch(url, { headers: { 'apikey': effectiveAnon, 'Authorization': `Bearer ${session.access_token}` } });
  if (!res.ok) throw new Error('Failed to load chat');
  const rows = await res.json();
  return rows.map(r => ({ role: r.role, content: r.content, created_at: r.created_at }));
}

// AI Insights removed
async function listThreadsBackground() {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get(['session']);
  if (!session?.access_token) throw new Error('Not authenticated');
  const url = `${effectiveUrl}/rest/v1/chat_threads?order=updated_at.desc`;
  const res = await fetch(url, { headers: { 'apikey': effectiveAnon, 'Authorization': `Bearer ${session.access_token}` } });
  if (!res.ok) throw new Error('Failed to list threads');
  return res.json();
}

// AI Insights removed
async function newThreadBackground() {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get(['session']);
  if (!session?.access_token) throw new Error('Not authenticated');
  const user = await getCurrentUser();
  if (!user?.id) throw new Error('User not available');
  const res = await fetch(`${effectiveUrl}/rest/v1/chat_threads`, {
    method: 'POST',
    headers: { 'apikey': effectiveAnon, 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ name: 'New Chat', user_id: user.id })
  });
  if (!res.ok) throw new Error('Failed to create thread');
  const created = await res.json();
  const threadId = created[0]?.id;
  await chrome.storage.local.set({ chat_thread_id: threadId });
  return created[0];
}

// AI Insights removed
async function selectThreadBackground(threadId) {
  if (!threadId) throw new Error('threadId required');
  await chrome.storage.local.set({ chat_thread_id: threadId });
}

// Update analysis in Supabase from background
async function updateAnalysisBackground(id, updates) {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get('session');
  
  if (!effectiveUrl || !effectiveAnon || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  // Only allow certain fields to be updated
  const allowedUpdates = {
    tags: updates.tags,
    category: updates.category,
    is_favorite: updates.is_favorite
  };

  // Remove undefined values
  const cleanUpdates = Object.fromEntries(
    Object.entries(allowedUpdates).filter(([_, value]) => value !== undefined)
  );

  if (Object.keys(cleanUpdates).length === 0) {
    throw new Error('No valid updates provided');
  }

  const res = await fetch(`${effectiveUrl}/rest/v1/analyses?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': effectiveAnon,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(cleanUpdates)
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to update analysis: ${res.status} ${error}`);
  }

  return await res.json();
}

// Delete analysis from Supabase in background
async function deleteAnalysisBackground(id) {
  const { supabase_url, supabase_anon_key } = await chrome.storage.sync.get(['supabase_url', 'supabase_anon_key']);
  const SUPABASE_DEFAULT_URL = 'https://vznrzhawfqxytmasgzho.supabase.co';
  const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6bnJ6aGF3ZnF4eXRtYXNnemhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTcxMzIsImV4cCI6MjA3MDI5MzEzMn0.PrAXIwD4Bb-sslWUbEMCJrBAgZtCprRkXixbQeYmnaI';
  const effectiveUrl = supabase_url || SUPABASE_DEFAULT_URL;
  const effectiveAnon = supabase_anon_key || SUPABASE_DEFAULT_ANON_KEY;
  const { session } = await chrome.storage.local.get('session');
  
  if (!effectiveUrl || !effectiveAnon || !session?.access_token) {
    throw new Error('Not authenticated or Supabase not configured');
  }

  const res = await fetch(`${effectiveUrl}/rest/v1/analyses?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': effectiveAnon,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to delete analysis: ${res.status} ${error}`);
  }

  return true;
}

// Helper functions for background script
function extractDomainFromUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function determineAnalysisType(content) {
  if (!content) return 'general';
  
  const contentLower = content.toLowerCase();
  
  // Check for pricing indicators
  if (contentLower.includes('pricing') || 
      contentLower.includes('plan') && contentLower.includes('price') ||
      contentLower.includes('subscription') ||
      contentLower.includes('billing')) {
    return 'pricing_analysis';
  }
  
  // Check for feature indicators
  if (contentLower.includes('feature') || 
      contentLower.includes('capability') ||
      contentLower.includes('functionality')) {
    return 'feature_extraction';
  }
  
  return 'general';
}

function estimateTokenCount(text) {
  if (!text) return 0;
  // Rough estimation: 4 characters per token on average
  return Math.ceil(text.length / 4);
}

// -------- End Supabase Functions --------

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