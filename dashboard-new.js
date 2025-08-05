document.addEventListener('DOMContentLoaded', function() {
  // Get all the elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const showKeyBtn = document.getElementById('showKeyBtn');
  const apiKeyDisplay = document.getElementById('apiKeyDisplay');
  const apiKeyText = document.getElementById('apiKeyText');
  const status = document.getElementById('status');
  const initialModelSelect = document.getElementById('initialModelSelect');
  const deepModelSelect = document.getElementById('deepModelSelect');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const companyContext = document.getElementById('companyContext');
  
  // Usage stats elements
  const apiCallsToday = document.getElementById('apiCallsToday');
  const apiCallsTotal = document.getElementById('apiCallsTotal');
  const lastUsed = document.getElementById('lastUsed');
  
  // Analysis elements
  const analysesContainer = document.getElementById('analysesContainer');
  const noAnalyses = document.getElementById('noAnalyses');
  const typeFilter = document.getElementById('typeFilter');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');
  
  // Sidebar elements
  const analysisSidebar = document.getElementById('analysisSidebar');
  const analysisOverlay = document.getElementById('analysisOverlay');
  const closeSidebar = document.getElementById('closeSidebar');
  const sidebarTitle = document.getElementById('sidebarTitle');
  const sidebarMeta = document.getElementById('sidebarMeta');
  const sidebarContent = document.getElementById('sidebarContent');
  const sidebarCopyBtn = document.getElementById('sidebarCopyBtn');
  
  // Stats elements
  const totalAnalyses = document.getElementById('totalAnalyses');
  const featureReports = document.getElementById('featureReports');
  const pricingReports = document.getElementById('pricingReports');
  const thisMonth = document.getElementById('thisMonth');
  
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
  typeFilter.addEventListener('change', filterAnalyses);
  clearAllBtn.addEventListener('click', clearAllAnalyses);
  exportAllBtn.addEventListener('click', exportAllAnalyses);
  analysesContainer.addEventListener('click', handleAnalysisAction);
  
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
    const deepModel = deepModelSelect.value;
    const context = companyContext.value.trim();
    
    try {
      await chrome.storage.sync.set({ 
        initial_model: initialModel,
        deep_model: deepModel,
        company_context: context
      });
      showStatusMessage('Settings saved successfully', 'success');
    } catch (error) {
      showStatusMessage('Error saving settings: ' + error.message, 'error');
    }
  }
  
  async function loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['initial_model', 'deep_model', 'company_context']);
      
      if (result.initial_model) {
        initialModelSelect.value = result.initial_model;
      }
      
      if (result.deep_model) {
        deepModelSelect.value = result.deep_model;
      }
      
      if (result.company_context) {
        companyContext.value = result.company_context;
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
      
      updateStats(savedAnalyses);
      displayAnalyses(savedAnalyses);
    } catch (error) {
      console.error('Error loading saved analyses:', error);
    }
  }
  
  function updateStats(analyses) {
    const total = analyses.length;
    const featureCount = analyses.filter(a => a.type === 'feature').length;
    const pricingCount = analyses.filter(a => a.type === 'pricing').length;
    
    // Calculate this month's analyses
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    
    const thisMonthCount = analyses.filter(a => {
      const analysisDate = new Date(a.timestamp);
      return analysisDate >= thisMonthStart;
    }).length;
    
    totalAnalyses.textContent = total;
    featureReports.textContent = featureCount;
    pricingReports.textContent = pricingCount;
    thisMonth.textContent = thisMonthCount;
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
  
  // Filter analyses
  function filterAnalyses() {
    const filterValue = typeFilter.value;
    const analysisCards = document.querySelectorAll('.analysis-card');
    
    analysisCards.forEach(card => {
      if (filterValue === 'all' || card.dataset.type === filterValue) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  // Clear all analyses
  async function clearAllAnalyses() {
    if (!confirm('Are you sure you want to delete all saved analyses? This action cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.sync.set({ saved_analyses: [] });
      loadSavedAnalyses();
      showStatusMessage('All analyses cleared', 'success');
    } catch (error) {
      showStatusMessage('Error clearing analyses: ' + error.message, 'error');
    }
  }
  
  // Export all analyses
  async function exportAllAnalyses() {
    try {
      const result = await chrome.storage.sync.get(['saved_analyses']);
      const savedAnalyses = result.saved_analyses || [];
      
      if (savedAnalyses.length === 0) {
        showStatusMessage('No analyses to export', 'error');
        return;
      }
      
      const exportData = {
        exportDate: new Date().toISOString(),
        totalAnalyses: savedAnalyses.length,
        analyses: savedAnalyses
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `ci-analyses-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showStatusMessage(`Exported ${savedAnalyses.length} analyses`, 'success');
    } catch (error) {
      showStatusMessage('Error exporting analyses: ' + error.message, 'error');
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