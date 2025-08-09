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
  
  // Sidebar elements
  const analysisSidebar = document.getElementById('analysisSidebar');
  const analysisOverlay = document.getElementById('analysisOverlay');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarTitle = document.getElementById('sidebarTitle');
  const sidebarMeta = document.getElementById('sidebarMeta');
  const sidebarContent = document.getElementById('sidebarContent');
  const sidebarCopyBtn = document.getElementById('sidebarCopyBtn');
  
  // Chat elements
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const mentionDropdown = document.getElementById('mentionDropdown');
  const chatMessages = document.getElementById('chatMessages');
  const clearChatBtn = document.getElementById('clearChatBtn');
  
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  
  // Initialize
  loadApiKey();
  loadSettings();
  loadUsageStats();
  loadSavedAnalyses();
  setupNavigation();
  
  // Event listeners
  saveKeyBtn.addEventListener('click', saveApiKey);
  showKeyBtn.addEventListener('click', toggleApiKeyDisplay);
  saveSettingsBtn.addEventListener('click', saveSettings);
  analysesContainer.addEventListener('click', handleAnalysisAction);
  
  // Chat event listeners
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('input', handleChatInput);
  chatInput.addEventListener('keydown', handleChatKeydown);
  clearChatBtn.addEventListener('click', clearChat);
  
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
      });
    });
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
      
      if (result.api_calls_today) {
        apiCallsToday.textContent = result.api_calls_today;
      }
      
      if (result.api_calls_total) {
        apiCallsTotal.textContent = result.api_calls_total;
      }
      
      if (result.last_used) {
        lastUsed.textContent = new Date(result.last_used).toLocaleString();
      }
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  }
  
  // Analyses management
  async function loadSavedAnalyses() {
    try {
      const result = await chrome.storage.sync.get(['saved_analyses']);
      const savedAnalyses = result.saved_analyses || [];
      
      displayAnalyses(savedAnalyses);
    } catch (error) {
      console.error('Error loading saved analyses:', error);
    }
  }
  
  // AI Chat functionality
  let availableDocuments = [];
  let selectedMentionIndex = -1;
  let currentMentions = [];
  let conversationHistory = [];
  
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    try {
      // Add user message to chat
      addUserMessage(message);
      
      // Clear input and disable send button
      chatInput.value = '';
      updateSendButtonState();
      
      // Show typing indicator
      const typingIndicator = addTypingIndicator();
      
      const referencedDocs = extractMentions(message);
      const apiKey = await getStoredApiKey();
      
      if (!apiKey) {
        removeTypingIndicator(typingIndicator);
        addAiMessage('Please set your OpenAI API key in the settings first.');
        return;
      }
      
      // Send message to background script with conversation history
      const response = await chrome.runtime.sendMessage({
        type: 'aiChat',
        message: message,
        referencedDocs: referencedDocs,
        conversationHistory: conversationHistory
      });
      
      // Remove typing indicator
      removeTypingIndicator(typingIndicator);
      
      if (response.success) {
        addAiMessage(response.result);
        // Add to conversation history
        conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: response.result }
        );
      } else {
        addAiMessage('Sorry, I encountered an error: ' + response.error);
      }
      
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
      <div class="message-content">
        <p>${escapeHtml(message).replace(/\n/g, '</p><p>')}</p>
      </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
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
    const hasMessage = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasMessage;
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
      case 'delete':
        deleteAnalysis(analysisData.id);
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