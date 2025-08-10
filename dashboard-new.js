document.addEventListener('DOMContentLoaded', function() {
  // Get all the elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const showKeyBtn = document.getElementById('showKeyBtn');
  const apiKeyDisplay = document.getElementById('apiKeyDisplay');
  const apiKeyText = document.getElementById('apiKeyText');
  const status = document.getElementById('status');
  const initialModelSelect = document.getElementById('initialModelSelect');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  // Removed Supabase settings UI
  const companyContext = document.getElementById('companyContext');
  const customPrompts = document.getElementById('customPrompts');
  const includeActionableInsights = document.getElementById('includeActionableInsights');
  const focusOnDifferentiators = document.getElementById('focusOnDifferentiators');
  const includeMarketContext = document.getElementById('includeMarketContext');
  const prioritizeThreats = document.getElementById('prioritizeThreats');
  
  // Usage stats elements
  const apiCallsToday = document.getElementById('apiCallsToday');
  const apiCallsTotal = document.getElementById('apiCallsTotal');
  const lastUsed = document.getElementById('lastUsed');
  
  // Analysis elements
  const analysesContainer = document.getElementById('analysesContainer');
  const noAnalyses = document.getElementById('noAnalyses');
  const analysisSearchInput = document.getElementById('analysisSearchInput');
  const analysisTypeFilter = document.getElementById('analysisTypeFilter');
  const favoritesOnly = document.getElementById('favoritesOnly');
  const competitorsContainer = document.getElementById('competitorsContainer');
  
  // Sidebar elements
  const analysisSidebar = document.getElementById('analysisSidebar');
  const analysisOverlay = document.getElementById('analysisOverlay');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarTitle = document.getElementById('sidebarTitle');
  const sidebarMeta = document.getElementById('sidebarMeta');
  const sidebarContent = document.getElementById('sidebarContent');
  const sidebarCopyBtn = document.getElementById('sidebarCopyBtn');
  
  // Chat elements (may not exist if chat UI is removed)
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const mentionDropdown = document.getElementById('mentionDropdown');
  const chatMessages = document.getElementById('chatMessages');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const starterPrompts = document.getElementById('starterPrompts');
  const threadsPanel = document.getElementById('threadsPanel');
  const threadsList = document.getElementById('threadsList');
  const newThreadBtn = document.getElementById('newThreadBtn');
  const dashboardLogoutBtn = document.getElementById('dashboardLogoutBtn');
  
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  
  // Initialize
  loadApiKey();
  loadSettings();
  // Usage stats section was removed; keep call guarded
  if (apiCallsToday || apiCallsTotal || lastUsed) {
    loadUsageStats();
  }
  loadSavedAnalyses();
  setupNavigation();
  
  // Event listeners
  saveKeyBtn.addEventListener('click', saveApiKey);
  showKeyBtn.addEventListener('click', toggleApiKeyDisplay);
  saveSettingsBtn.addEventListener('click', saveSettings);
  // Supabase settings removed
  analysesContainer.addEventListener('click', handleAnalysisAction);
  if (analysisSearchInput) analysisSearchInput.addEventListener('input', applyFilters);
  if (analysisTypeFilter) analysisTypeFilter.addEventListener('change', applyFilters);
  if (favoritesOnly) favoritesOnly.addEventListener('change', applyFilters);
  if (competitorsContainer) {
    competitorsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-domain]');
      if (!chip) return;
      const domain = chip.dataset.domain;
      // Toggle selection
      selectedDomainFilter = selectedDomainFilter === domain ? null : domain;
      renderCompetitorChips(currentAnalysesRaw);
      applyFilters();
    });
  }
  
  // Chat event listeners (guarded)
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (chatInput) chatInput.addEventListener('input', handleChatInput);
  if (chatInput) chatInput.addEventListener('keydown', handleChatKeydown);
  if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
  const stopStreamBtn = document.getElementById('stopStreamBtn');
  if (stopStreamBtn) {
    stopStreamBtn.addEventListener('click', () => {
      if (currentStreamId) {
        chrome.runtime.sendMessage({ type: 'aiChatStream', stop: true, requestId: currentStreamId });
      }
    });
  }
  if (starterPrompts) {
    starterPrompts.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-prompt]');
      if (!btn || !chatInput) return;
      chatInput.value = btn.dataset.prompt || '';
      chatInput.focus();
      updateSendButtonState();
    });
  }
  if (newThreadBtn) {
    newThreadBtn.addEventListener('click', () => createNewThread());
  }
  if (dashboardLogoutBtn) {
    dashboardLogoutBtn.addEventListener('click', async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        try {
          await supabaseLogout();
          showStatusMessage('Signed out', 'success');
        } catch (e) {
          showStatusMessage('Error during logout: ' + (e?.message || 'Unknown'), 'error');
        } finally {
          refreshAuthControls();
        }
      } else {
        await handleDashboardLogin();
      }
    });
    // Initialize button state
    refreshAuthControls();
    // React to session changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.session) refreshAuthControls();
    });
  }

  async function isLoggedIn() {
    try {
      const { session } = await chrome.storage.local.get('session');
      return !!session?.access_token;
    } catch (_) { return false; }
  }

  async function refreshAuthControls() {
    const loggedIn = await isLoggedIn();
    if (!dashboardLogoutBtn) return;
    dashboardLogoutBtn.textContent = loggedIn ? 'Log out' : 'Log in';
    // swap classes for visual cue
    dashboardLogoutBtn.classList.remove('btn-destructive', 'btn-primary');
    dashboardLogoutBtn.classList.add(loggedIn ? 'btn-destructive' : 'btn-primary');
  }

  async function handleDashboardLogin() {
    // Minimal inline login using prompts to avoid heavy UI changes
    const email = prompt('Enter your email to receive a login code:');
    if (!email) {
      showStatusMessage('Email is required to log in', 'error');
      return;
    }
    try {
      await supabaseSendEmailOtp(email.trim());
    } catch (e) {
      showStatusMessage('Failed to send code: ' + (e?.message || 'Unknown'), 'error');
      return;
    }
    const token = prompt('Enter the 6-digit code sent to your email:');
    if (!token) {
      showStatusMessage('Verification code is required', 'error');
      return;
    }
    try {
      await supabaseVerifyEmailOtp(email.trim(), token.trim());
      showStatusMessage('Signed in successfully', 'success');
      refreshAuthControls();
    } catch (e) {
      showStatusMessage('Verification failed: ' + (e?.message || 'Unknown'), 'error');
    }
  }
  
  // Sidebar event listeners
  closeSidebar.addEventListener('click', closeSidebarPanel);
  analysisOverlay.addEventListener('click', closeSidebarPanel);
  sidebarCopyBtn.addEventListener('click', copySidebarContent);
  
  // Keyboard support for sidebar
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && analysisSidebar.classList.contains('open')) {
      closeSidebarPanel();
    }
  });
  
  // Navigation setup
  function setupNavigation() {
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetPage = item.dataset.page;
        showPage(targetPage);
        
        // Update active state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        if (targetPage === 'insights') {
          // On first open, try to load past thread messages
          if (chatMessages && chatMessages.dataset.loaded !== '1') {
            // Load threads list first
            chrome.runtime.sendMessage({ type: 'chatListThreads' }, (tresp) => {
              if (tresp && tresp.success && Array.isArray(tresp.result)) {
                renderThreads(tresp.result);
              }
            });
            // Then load last-opened thread
            chrome.runtime.sendMessage({ type: 'chatLoadThread' }, (resp) => {
              if (resp && resp.success && Array.isArray(resp.result) && resp.result.length) {
                // Render existing messages quickly
                resp.result.forEach(m => {
                  if (m.role === 'user') addUserMessage(m.content);
                  else addAiMessage(m.content);
                  conversationHistory.push({ role: m.role, content: m.content });
                });
              }
              if (chatMessages) chatMessages.dataset.loaded = '1';
            });
          }
        }
      });
    });
  }

  function renderThreads(threads) {
    if (!threadsList) return;
    threadsList.innerHTML = '';
    if (!threads || threads.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p style="margin:8px 0;">No chats yet</p>';
      threadsList.appendChild(empty);
      return;
    }
    threads.forEach(t => {
      const item = document.createElement('button');
      item.className = 'btn btn-secondary btn-sm';
      item.style.cssText = 'display:flex; width:100%; justify-content:flex-start; margin-bottom:8px;';
      item.textContent = t.name || 'Untitled Chat';
      item.addEventListener('click', () => switchThread(t.id));
      threadsList.appendChild(item);
    });
  }

  function createNewThread() {
    chrome.runtime.sendMessage({ type: 'chatNewThread' }, (resp) => {
      if (resp && resp.success) {
        // Refresh list and clear current chat
        chrome.runtime.sendMessage({ type: 'chatListThreads' }, (tresp) => {
          if (tresp && tresp.success) renderThreads(tresp.result);
        });
        resetChatUI();
      }
    });
  }

  function switchThread(threadId) {
    // Set current thread id in background then load messages
    chrome.runtime.sendMessage({ type: 'chatSelectThread', threadId }, (resp) => {
      if (resp && resp.success) {
        resetChatUI();
        chrome.runtime.sendMessage({ type: 'chatLoadThread' }, (mresp) => {
          if (mresp && mresp.success) {
            (mresp.result || []).forEach(m => {
              if (m.role === 'user') addUserMessage(m.content);
              else addAiMessage(m.content);
              conversationHistory.push({ role: m.role, content: m.content });
            });
          }
        });
      }
    });
  }

  function resetChatUI() {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    conversationHistory = [];
  }
  
  function showPage(pageId) {
    pages.forEach(page => page.classList.add('hidden'));
    document.getElementById(`${pageId}-page`).classList.remove('hidden');
  }
  
  // API Key management
  async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatusMessage('Please enter an API key', 'error');
      return;
    }
    
    try {
      await chrome.storage.sync.set({ openai_api_key: apiKey });
      apiKeyInput.value = '';
      showStatusMessage('API key saved successfully', 'success');
      loadApiKey();
    } catch (error) {
      showStatusMessage('Error saving API key: ' + error.message, 'error');
    }
  }
  
  async function loadApiKey() {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      if (result.openai_api_key) {
        apiKeyInput.placeholder = 'API key saved ✓';
        apiKeyText.textContent = maskApiKey(result.openai_api_key);
      } else {
        apiKeyInput.placeholder = 'Enter your OpenAI API Key';
        apiKeyText.textContent = 'No API key saved';
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }
  
  async function toggleApiKeyDisplay() {
    if (apiKeyDisplay.classList.contains('hidden')) {
      apiKeyDisplay.classList.remove('hidden');
      
      if (apiKeyText.textContent.includes('*')) {
        try {
          const result = await chrome.storage.sync.get(['openai_api_key']);
          if (result.openai_api_key) {
            apiKeyText.textContent = result.openai_api_key;
            showKeyBtn.textContent = 'Hide API Key';
          }
        } catch (error) {
          console.error('Error loading API key:', error);
        }
      } else {
        try {
          const result = await chrome.storage.sync.get(['openai_api_key']);
          if (result.openai_api_key) {
            apiKeyText.textContent = maskApiKey(result.openai_api_key);
            showKeyBtn.textContent = 'Show API Key';
          }
        } catch (error) {
          console.error('Error loading API key:', error);
        }
      }
    } else {
      apiKeyDisplay.classList.add('hidden');
      showKeyBtn.textContent = 'Show/Hide Key';
    }
  }
  
  function maskApiKey(key) {
    if (!key) return '';
    return key.substring(0, 3) + '...' + key.substring(key.length - 4);
  }

  // Supabase settings removed
  
  // Settings management
  async function saveSettings() {
    const initialModel = initialModelSelect.value;
    const context = companyContext.value.trim();
    const customPromptsValue = customPrompts.value.trim();
    
    const preferences = {
      includeActionableInsights: includeActionableInsights.checked,
      focusOnDifferentiators: focusOnDifferentiators.checked,
      includeMarketContext: includeMarketContext.checked,
      prioritizeThreats: prioritizeThreats.checked
    };
    
    try {
      await chrome.storage.sync.set({ 
        initial_model: initialModel,
        company_context: context,
        custom_prompts: customPromptsValue,
        analysis_preferences: preferences
      });
      showStatusMessage('Settings saved successfully', 'success');
    } catch (error) {
      showStatusMessage('Error saving settings: ' + error.message, 'error');
    }
  }

  // Helicone settings removed (hardcoded in background)
  
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'initial_model', 
        'company_context', 
        'custom_prompts',
        'analysis_preferences'
      ]);
      
      if (result.initial_model) {
        initialModelSelect.value = result.initial_model;
      }
      
      if (result.company_context) {
        companyContext.value = result.company_context;
      }
      
      if (result.custom_prompts) {
        customPrompts.value = result.custom_prompts;
      }
      
      if (result.analysis_preferences) {
        const prefs = result.analysis_preferences;
        includeActionableInsights.checked = prefs.includeActionableInsights || false;
        focusOnDifferentiators.checked = prefs.focusOnDifferentiators || false;
        includeMarketContext.checked = prefs.includeMarketContext || false;
        prioritizeThreats.checked = prefs.prioritizeThreats || false;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  
  // Usage stats
  async function loadUsageStats() {
    try {
      const result = await chrome.storage.sync.get(['api_calls_today', 'api_calls_total', 'last_used']);
      
      if (apiCallsToday && result.api_calls_today) {
        apiCallsToday.textContent = result.api_calls_today;
      }
      if (apiCallsTotal && result.api_calls_total) {
        apiCallsTotal.textContent = result.api_calls_total;
      }
      if (lastUsed && result.last_used) {
        lastUsed.textContent = new Date(result.last_used).toLocaleString();
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  }
  
  // Analyses management
  let dataSource = 'local'; // 'local' | 'supabase'
  let currentAnalysesRaw = [];
  let selectedDomainFilter = null;
  async function loadSavedAnalyses() {
    try {
      // First try to load from Supabase
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'getUserAnalyses', options: { limit: 50, orderBy: 'created_at', order: 'desc' } },
          resolve
        );
      });
      
      if (response.success && response.result.length > 0) {
        dataSource = 'supabase';
        currentAnalysesRaw = response.result;
        renderCompetitorChips(currentAnalysesRaw);
        applyFilters();
        return;
      }
    } catch (error) {
      console.warn('Could not load from Supabase:', error);
    }
    
    // Fallback to local storage
    try {
      const result = await chrome.storage.sync.get(['saved_analyses']);
      const savedAnalyses = result.saved_analyses || [];
      dataSource = 'local';
      currentAnalysesRaw = savedAnalyses;
      renderCompetitorChips(currentAnalysesRaw);
      applyFilters();
    } catch (error) {
      console.error('Error loading saved analyses:', error);
    }
  }
  
  // AI Chat functionality
  let availableDocuments = [];
  let selectedMentionIndex = -1;
  let currentMentions = [];
  let conversationHistory = [];
  let currentStreamId = null;
  
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    try {
      // Add user message to chat
      addUserMessage(message);
      // persist user turn
      chrome.runtime.sendMessage({ type: 'chatSaveTurn', role: 'user', content: message });
      
      // Clear input and disable send button
      chatInput.value = '';
      updateSendButtonState();
      
      const referencedDocs = extractMentions(message);
      const apiKey = await getStoredApiKey();
      if (!apiKey) {
        addAiMessage('Please set your OpenAI API key in the settings first.');
        return;
      }

      // Start streaming
      const requestId = 'stream_' + Date.now();
      currentStreamId = requestId;
      toggleStreamingUI(true);
      addAiStreamMessageStart();

      chrome.runtime.sendMessage({
        type: 'aiChatStream',
        message: message,
        referencedDocs: referencedDocs,
        conversationHistory: conversationHistory,
        requestId
      });
      
    } catch (error) {
      console.error('Chat error:', error);
      addAiMessage('Sorry, I encountered an error while processing your message.');
    }
  }
  
  function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-message';
    messageDiv.innerHTML = `
      <div class="message-avatar">👤</div>
      <div class="message-content">
        <p>${escapeHtml(message)}</p>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
  }
  
  function addAiMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message';
    messageDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">${renderMarkdownSafe(message)}</div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
  }

  // Streaming rendering
  let liveMessageContainer = null;
  let liveMessageWrapper = null;
  function addAiStreamMessageStart() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-message';
    messageDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content"><p id="liveMessage"></p></div>
    `;
    chatMessages.appendChild(messageDiv);
    liveMessageContainer = messageDiv.querySelector('#liveMessage');
    liveMessageWrapper = messageDiv.querySelector('.message-content');
    scrollToBottom();
  }
  function appendAiStreamToken(token) {
    if (!liveMessageContainer) return;
    liveMessageContainer.textContent += token;
    scrollToBottom();
  }
  function finalizeAiStream(full) {
    toggleStreamingUI(false);
    if (liveMessageWrapper) {
      liveMessageWrapper.innerHTML = renderMarkdownSafe(full);
    }
    liveMessageContainer = null;
    liveMessageWrapper = null;
    // Add to conversation history last user prompt already added earlier
    conversationHistory.push({ role: 'assistant', content: full });
  }
  function toggleStreamingUI(isStreaming) {
    const stopBtn = document.getElementById('stopStreamBtn');
    if (!stopBtn) return;
    stopBtn.style.display = isStreaming ? 'inline-flex' : 'none';
  }
  
  function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message typing-indicator';
    typingDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-content">
        <p>Thinking...</p>
      </div>
    `;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
  }
  
  function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
    }
  }
  
  function scrollToBottom() {
    if (!chatMessages) return;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  function clearChat() {
    if (confirm('Clear all chat messages?')) {
      // Keep welcome message, clear the rest
      const welcomeMessage = chatMessages.querySelector('.welcome-message');
      chatMessages.innerHTML = '';
      if (welcomeMessage) {
        chatMessages.appendChild(welcomeMessage);
      }
      conversationHistory = [];
    }
  }
  
  function handleChatInput(event) {
    updateSendButtonState();
    
    const input = event.target;
    const cursorPos = input.selectionStart;
    const textBeforeCursor = input.value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const mentionText = textBeforeCursor.substring(lastAtIndex + 1);
      if (mentionText.length >= 0) {
        showMentionDropdown(mentionText);
      } else {
        hideMentionDropdown();
      }
    } else {
      hideMentionDropdown();
    }
  }
  
  function handleChatKeydown(event) {
    if (mentionDropdown.style.display !== 'none') {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedMentionIndex = Math.min(selectedMentionIndex + 1, currentMentions.length - 1);
        updateMentionSelection();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedMentionIndex = Math.max(selectedMentionIndex - 1, -1);
        updateMentionSelection();
      } else if (event.key === 'Enter' && selectedMentionIndex >= 0) {
        event.preventDefault();
        selectMention(currentMentions[selectedMentionIndex]);
      } else if (event.key === 'Escape') {
        hideMentionDropdown();
      }
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  function updateSendButtonState() {
    if (!chatInput || !sendBtn) return;
    const hasMessage = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasMessage;
  }

  // Lightweight safe Markdown renderer for chat bubbles
  function renderMarkdownSafe(markdown) {
    if (!markdown) return '';
    const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let inUl = false;
    let inOl = false;
    let inP = false;
    let inCode = false;
    let codeBuffer = [];
    const flushP = () => { if (inP) { html += '</p>'; inP = false; } };
    const openUl = () => { if (!inUl) { flushP(); html += '<ul>'; inUl = true; } };
    const closeUl = () => { if (inUl) { html += '</ul>'; inUl = false; } };
    const openOl = () => { if (!inOl) { flushP(); html += '<ol>'; inOl = true; } };
    const closeOl = () => { if (inOl) { html += '</ol>'; inOl = false; } };
    const flushCode = () => {
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
        codeBuffer = [];
        inCode = false;
      }
    };
    const renderInline = (text) => {
      let t = escapeHtml(text);
      t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
      return t;
    };
    for (const raw of lines) {
      const line = raw;
      if (line.trim().startsWith('```')) {
        if (!inCode) { flushP(); closeUl(); closeOl(); inCode = true; codeBuffer = []; continue; }
        else { flushCode(); continue; }
      }
      if (inCode) { codeBuffer.push(line); continue; }
      if (line.trim() === '') { flushP(); closeUl(); closeOl(); continue; }
      const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        flushP(); closeUl(); closeOl();
        const level = Math.min(hMatch[1].length, 4);
        html += `<h${level}>${renderInline(hMatch[2])}</h${level}>`;
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        openOl(); closeUl();
        const content = line.replace(/^\d+\.\s+/, '');
        html += `<li>${renderInline(content)}</li>`;
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        openUl(); closeOl();
        const content = line.replace(/^[-*]\s+/, '');
        html += `<li>${renderInline(content)}</li>`;
        continue;
      }
      if (!inP) { html += '<p>'; inP = true; }
      html += `${renderInline(line)} `;
    }
    flushCode(); flushP(); closeUl(); closeOl();
    return html;
  }
  
  async function showMentionDropdown(searchText) {
    if (availableDocuments.length === 0) {
      await loadAvailableDocuments();
    }
    
    const filteredDocs = availableDocuments.filter(doc =>
      doc.title.toLowerCase().includes(searchText.toLowerCase()) ||
      doc.domain.toLowerCase().includes(searchText.toLowerCase())
    );
    
    if (filteredDocs.length === 0) {
      hideMentionDropdown();
      return;
    }
    
    currentMentions = filteredDocs.slice(0, 5); // Limit to 5 results
    selectedMentionIndex = -1;
    
    mentionDropdown.innerHTML = '';
    currentMentions.forEach((doc, index) => {
      const item = document.createElement('div');
      item.className = 'mention-item';
      item.innerHTML = `
        <div class="mention-badge badge-${doc.type}">${doc.type}</div>
        <div>
          <div class="mention-item-title">${escapeHtml(doc.title)}</div>
          <div class="mention-item-meta">${escapeHtml(doc.domain)} • ${new Date(doc.timestamp).toLocaleDateString()}</div>
        </div>
      `;
      item.addEventListener('click', () => selectMention(doc));
      mentionDropdown.appendChild(item);
    });
    
    mentionDropdown.style.display = 'block';
  }

  // Listen for streaming events
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'aiChatStreamStart') {
      // nothing to do, already started
    } else if (msg.type === 'aiChatStreamChunk') {
      appendAiStreamToken(msg.token || '');
    } else if (msg.type === 'aiChatStreamEnd') {
      finalizeAiStream(msg.full || '');
      // persist assistant turn
      if (msg.full) {
        chrome.runtime.sendMessage({ type: 'chatSaveTurn', role: 'assistant', content: msg.full });
      }
      currentStreamId = null;
    } else if (msg.type === 'aiChatStreamError') {
      toggleStreamingUI(false);
      currentStreamId = null;
      addAiMessage('Stream error: ' + (msg.error || 'Unknown'));
    } else if (msg.type === 'aiChatStreamAborted') {
      toggleStreamingUI(false);
      currentStreamId = null;
      addAiMessage('Stopped.');
    }
  });
  
  function hideMentionDropdown() {
    mentionDropdown.style.display = 'none';
    currentMentions = [];
    selectedMentionIndex = -1;
  }
  
  function updateMentionSelection() {
    const items = mentionDropdown.querySelectorAll('.mention-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === selectedMentionIndex);
    });
  }
  
  function selectMention(doc) {
    const input = chatInput;
    const cursorPos = input.selectionStart;
    const textBeforeCursor = input.value.substring(0, cursorPos);
    const textAfterCursor = input.value.substring(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const newText = textBeforeCursor.substring(0, lastAtIndex) + 
                   `@[${doc.title}]` + 
                   textAfterCursor;
    
    input.value = newText;
    input.focus();
    
    const newCursorPos = lastAtIndex + `@[${doc.title}]`.length;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    hideMentionDropdown();
    updateSendButtonState();
  }
  
  function extractMentions(text) {
    const mentions = [];
    const mentionRegex = /@\[([^\]]+)\]/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionTitle = match[1];
      const doc = availableDocuments.find(d => d.title === mentionTitle);
      if (doc) {
        mentions.push(doc);
      }
    }
    
    return mentions;
  }
  
  async function loadAvailableDocuments() {
    try {
      const result = await chrome.storage.sync.get(['saved_analyses']);
      availableDocuments = result.saved_analyses || [];
    } catch (error) {
      console.error('Error loading available documents:', error);
      availableDocuments = [];
    }
  }
  
  
  async function getStoredApiKey() {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      return result.openai_api_key || null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }
  
  // Utility function
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function displayAnalyses(analyses) {
    analysesContainer.innerHTML = '';
    if (analyses.length === 0) {
      analysesContainer.appendChild(noAnalyses);
      return;
    }
    analyses.forEach(analysis => {
      const analysisElement = createAnalysisElement(analysis);
      analysesContainer.appendChild(analysisElement);
    });
  }
  
  function displaySupabaseAnalyses(analyses) {
    analysesContainer.innerHTML = '';
    if (analyses.length === 0) {
      analysesContainer.appendChild(noAnalyses);
      return;
    }
    analyses.forEach(analysis => {
      const analysisElement = createSupabaseAnalysisElement(analysis);
      analysesContainer.appendChild(analysisElement);
    });
    // Update available documents for chat
    availableDocuments = analyses.map(analysis => ({
      id: analysis.id,
      title: analysis.title,
      domain: analysis.domain,
      url: analysis.url,
      content: analysis.content,
      type: analysis.analysis_type,
      timestamp: analysis.created_at
    }));
  }

  // Filtering + competitors rendering
  function applyFilters() {
    const q = (analysisSearchInput?.value || '').toLowerCase().trim();
    const type = analysisTypeFilter?.value || 'all';
    const favOnly = !!(favoritesOnly && favoritesOnly.checked);
    let list = currentAnalysesRaw.slice();
    if (dataSource === 'supabase') {
      list = list.filter(a => {
        const matchesType = type === 'all' ||
          (type === 'feature' && a.analysis_type === 'feature_extraction') ||
          (type === 'pricing' && a.analysis_type === 'pricing_analysis') ||
          (type === 'general' && a.analysis_type === 'general');
        const matchesFav = !favOnly || !!a.is_favorite;
        const hay = `${a.title || ''} ${a.domain || ''} ${a.content || ''}`.toLowerCase();
        const matchesQ = !q || hay.includes(q);
        const matchesDomain = !selectedDomainFilter || a.domain === selectedDomainFilter;
        return matchesType && matchesFav && matchesQ && matchesDomain;
      });
      displaySupabaseAnalyses(list);
    } else {
      list = list.filter(a => {
        const matchesType = type === 'all' || a.type === type;
        const hay = `${a.title || ''} ${a.domain || ''} ${a.content || ''}`.toLowerCase();
        const matchesQ = !q || hay.includes(q);
        const matchesDomain = !selectedDomainFilter || a.domain === selectedDomainFilter;
        return matchesType && matchesQ && matchesDomain;
      });
      displayAnalyses(list);
    }
  }

  function renderCompetitorChips(list) {
    if (!competitorsContainer) return;
    const counts = new Map();
    list.forEach(a => {
      const domain = (dataSource === 'supabase') ? a.domain : a.domain;
      if (!domain) return;
      counts.set(domain, (counts.get(domain) || 0) + 1);
    });
    const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    competitorsContainer.innerHTML = '';
    if (items.length === 0) {
      competitorsContainer.innerHTML = '<div style="color: var(--muted-foreground)">No competitors yet</div>';
      return;
    }
    items.forEach(([domain, count]) => {
      const chip = document.createElement('button');
      chip.className = 'btn btn-secondary btn-sm';
      chip.style.margin = '4px 0';
      chip.dataset.domain = domain;
      chip.innerHTML = `${domain} <span style="opacity:0.7">(${count})</span>`;
      if (selectedDomainFilter === domain) {
        chip.classList.remove('btn-secondary');
        chip.classList.add('btn-primary');
      }
      competitorsContainer.appendChild(chip);
    });
  }
  
  function createAnalysisElement(analysis) {
    const div = document.createElement('div');
    div.className = 'analysis-card';
    div.dataset.type = analysis.type;
    div.dataset.analysisId = analysis.id;
    
    const date = new Date(analysis.timestamp).toLocaleString();
    const domain = analysis.domain;
    
    // Escape HTML content to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    div.innerHTML = `
      <div class="analysis-card-header">
        <div class="analysis-title">${escapeHtml(analysis.title)}</div>
        <div class="analysis-badge badge-${analysis.type}">${analysis.type}</div>
      </div>
      <div class="analysis-meta">
        <span>${escapeHtml(domain)}</span>
        <span>•</span>
        <span>${date}</span>
      </div>
      <div class="analysis-actions">
        <button class="btn btn-secondary btn-sm" data-action="view">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
          View
        </button>
        <button class="btn btn-secondary btn-sm" data-action="copy">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Copy
        </button>
        <button class="btn btn-destructive btn-sm" data-action="delete">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Delete
        </button>
      </div>
    `;
    
    div.id = 'analysis-' + analysis.id;
    
    // Store full analysis data on the element for sidebar access
    div._analysisData = {
      id: analysis.id,
      title: analysis.title,
      content: analysis.content,
      url: analysis.url,
      domain: analysis.domain,
      timestamp: analysis.timestamp,
      type: analysis.type
    };
    
    return div;
  }
  
  function createSupabaseAnalysisElement(analysis) {
    const div = document.createElement('div');
    div.className = 'analysis-card';
    div.dataset.type = analysis.analysis_type;
    div.dataset.analysisId = analysis.id;
    div.dataset.source = 'supabase';
    
    const date = new Date(analysis.created_at).toLocaleString();
    const domain = analysis.domain;
    
    // Escape HTML content to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    const badgeClass = analysis.analysis_type === 'pricing_analysis' ? 'badge-pricing' : 
                      analysis.analysis_type === 'feature_extraction' ? 'badge-feature' : 'badge-general';
    
    const typeDisplay = analysis.analysis_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    div.innerHTML = `
      <div class="analysis-card-header">
        <div class="analysis-title">${escapeHtml(analysis.title)}</div>
        <div class="analysis-badge ${badgeClass}">${typeDisplay}</div>
      </div>
      <div class="analysis-meta">
        <span>${escapeHtml(domain)}</span>
        <span>•</span>
        <span>${date}</span>
        ${analysis.is_favorite ? '<span>•</span><span style="color: gold;">★ Favorite</span>' : ''}
        ${analysis.tags && analysis.tags.length > 0 ? `<span>•</span><span>${analysis.tags.slice(0, 2).join(', ')}</span>` : ''}
      </div>
      <div class="analysis-actions">
        <button class="btn btn-secondary btn-sm" data-action="view">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
          </svg>
          View
        </button>
        <button class="btn btn-secondary btn-sm" data-action="copy">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          Copy
        </button>
        <button class="btn btn-secondary btn-sm" data-action="favorite" title="${analysis.is_favorite ? 'Remove from favorites' : 'Add to favorites'}">
          ${analysis.is_favorite ? '★' : '☆'}
        </button>
        <button class="btn btn-destructive btn-sm" data-action="delete">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Delete
        </button>
      </div>
    `;
    
    div.id = 'analysis-' + analysis.id;
    
    // Store full analysis data on the element for sidebar access
    div._analysisData = {
      id: analysis.id,
      title: analysis.title,
      content: analysis.content,
      url: analysis.url,
      domain: analysis.domain,
      timestamp: analysis.created_at,
      type: analysis.analysis_type,
      is_favorite: analysis.is_favorite,
      tags: analysis.tags || []
    };
    
    return div;
  }
  
  // Handle analysis actions
  function handleAnalysisAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    
    const analysisItem = button.closest('.analysis-card');
    const analysisData = analysisItem._analysisData;
    const action = button.dataset.action;
    
    switch (action) {
      case 'view':
        openSidebarWithAnalysis(analysisData);
        break;
      case 'copy':
        copyAnalysisToClipboard(analysisData, button);
        break;
      case 'favorite':
        toggleFavoriteAnalysis(analysisData.id, !analysisData.is_favorite, analysisItem);
        break;
      case 'delete':
        if (analysisItem.dataset.source === 'supabase') {
          deleteSupabaseAnalysis(analysisData.id);
        } else {
          deleteAnalysis(analysisData.id);
        }
        break;
    }
  }
  
  // Sidebar functions
  function openSidebarWithAnalysis(analysisData) {
    // Populate sidebar content
    sidebarTitle.textContent = analysisData.title;
    sidebarMeta.innerHTML = `
      <span class="analysis-badge badge-${analysisData.type}">${analysisData.type.toUpperCase()}</span>
      <span>${analysisData.domain}</span>
      <span>•</span>
      <span>${new Date(analysisData.timestamp).toLocaleString()}</span>
    `;
    sidebarContent.textContent = analysisData.content;
    
    // Store current analysis data for copying
    sidebarCopyBtn._currentAnalysis = analysisData.content;
    
    // Show sidebar
    analysisSidebar.classList.add('open');
    analysisOverlay.classList.add('open');
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }
  
  function closeSidebarPanel() {
    analysisSidebar.classList.remove('open');
    analysisOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  async function copySidebarContent() {
    const content = sidebarCopyBtn._currentAnalysis;
    if (!content) return;
    
    try {
      await navigator.clipboard.writeText(content);
      const originalHTML = sidebarCopyBtn.innerHTML;
      sidebarCopyBtn.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 8px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        sidebarCopyBtn.innerHTML = originalHTML;
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }
  
  async function copyAnalysisToClipboard(analysisData, button) {
    try {
      await navigator.clipboard.writeText(analysisData.content);
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 4px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Copied!
      `;
      setTimeout(() => {
        button.innerHTML = originalHTML;
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }
  
  async function deleteAnalysis(analysisId) {
    if (!confirm('Are you sure you want to delete this analysis?')) {
      return;
    }
    
    try {
      const result = await chrome.storage.sync.get(['saved_analyses']);
      const savedAnalyses = result.saved_analyses || [];
      
      const updatedAnalyses = savedAnalyses.filter(analysis => analysis.id !== analysisId);
      
      await chrome.storage.sync.set({ saved_analyses: updatedAnalyses });
      loadSavedAnalyses();
      showStatusMessage('Analysis deleted', 'success');
    } catch (error) {
      showStatusMessage('Error deleting analysis: ' + error.message, 'error');
    }
  }
  
  async function deleteSupabaseAnalysis(analysisId) {
    if (!confirm('Are you sure you want to delete this analysis from your Supabase database?')) {
      return;
    }
    
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'deleteAnalysis', id: analysisId },
          resolve
        );
      });
      
      if (response.success) {
        loadSavedAnalyses();
        showStatusMessage('Analysis deleted from database', 'success');
      } else {
        showStatusMessage('Error deleting analysis: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      showStatusMessage('Error deleting analysis: ' + error.message, 'error');
    }
  }
  
  async function toggleFavoriteAnalysis(analysisId, newFavoriteState, analysisElement) {
    try {
      // Update via background script (this would need to be implemented)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { 
            type: 'updateAnalysis', 
            id: analysisId, 
            updates: { is_favorite: newFavoriteState } 
          },
          resolve
        );
      });
      
      if (response && response.success) {
        // Update the UI immediately
        const favoriteBtn = analysisElement.querySelector('button[data-action="favorite"]');
        favoriteBtn.textContent = newFavoriteState ? '★' : '☆';
        favoriteBtn.title = newFavoriteState ? 'Remove from favorites' : 'Add to favorites';
        
        // Update stored data
        analysisElement._analysisData.is_favorite = newFavoriteState;
        
        // Update meta display
        const metaElement = analysisElement.querySelector('.analysis-meta');
        const currentMeta = metaElement.innerHTML;
        if (newFavoriteState && !currentMeta.includes('★ Favorite')) {
          metaElement.innerHTML = currentMeta.replace('</span>', '</span><span>•</span><span style="color: gold;">★ Favorite</span>');
        } else if (!newFavoriteState) {
          metaElement.innerHTML = currentMeta.replace('<span>•</span><span style="color: gold;">★ Favorite</span>', '');
        }
        
        showStatusMessage(`Analysis ${newFavoriteState ? 'added to' : 'removed from'} favorites`, 'success');
      } else {
        showStatusMessage('Error updating favorite status: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      showStatusMessage('Error updating favorite status: ' + error.message, 'error');
    }
  }
  
  
  // Show status message
  function showStatusMessage(message, type) {
    status.textContent = message;
    status.className = type;
    status.classList.remove('hidden');
    
    // Apply appropriate styling based on type
    if (type === 'success') {
      status.style.backgroundColor = 'hsl(142 76% 36% / 0.1)';
      status.style.color = 'hsl(142 76% 36%)';
      status.style.border = '1px solid hsl(142 76% 36% / 0.2)';
    } else if (type === 'error') {
      status.style.backgroundColor = 'hsl(0 84% 60% / 0.1)';
      status.style.color = 'hsl(0 84% 60%)';
      status.style.border = '1px solid hsl(0 84% 60% / 0.2)';
    }
    
    // Hide after 3 seconds
    setTimeout(() => {
      status.classList.add('hidden');
    }, 3000);
  }
});