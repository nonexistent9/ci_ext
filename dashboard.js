document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const showKeyBtn = document.getElementById('showKeyBtn');
  const apiKeyDisplay = document.getElementById('apiKeyDisplay');
  const apiKeyText = document.getElementById('apiKeyText');
  const status = document.getElementById('status');
  const initialModelSelect = document.getElementById('initialModelSelect');
  const deepModelSelect = document.getElementById('deepModelSelect');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const apiCallsToday = document.getElementById('apiCallsToday');
  const apiCallsTotal = document.getElementById('apiCallsTotal');
  const lastUsed = document.getElementById('lastUsed');

  // Get company context element
  const companyContext = document.getElementById('companyContext');

  // Analyses elements
  const analysesContainer = document.getElementById('analysesContainer');
  const noAnalyses = document.getElementById('noAnalyses');
  const typeFilter = document.getElementById('typeFilter');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportAllBtn = document.getElementById('exportAllBtn');

  // Load saved API key and settings
  loadApiKey();
  loadSettings();
  loadUsageStats();
  loadSavedAnalyses();

  // Add event delegation for analysis actions
  analysesContainer.addEventListener('click', handleAnalysisAction);

  // Event listeners
  saveKeyBtn.addEventListener('click', saveApiKey);
  showKeyBtn.addEventListener('click', toggleApiKeyDisplay);
  saveSettingsBtn.addEventListener('click', saveSettings);
  typeFilter.addEventListener('change', filterAnalyses);
  clearAllBtn.addEventListener('click', clearAllAnalyses);
  exportAllBtn.addEventListener('click', exportAllAnalyses);

  // Save API key to Chrome storage
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
      loadApiKey(); // Reload to show masked key
    } catch (error) {
      showStatusMessage('Error saving API key: ' + error.message, 'error');
    }
  }

  // Load API key from Chrome storage
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

  // Toggle API key visibility
  async function toggleApiKeyDisplay() {
    if (apiKeyDisplay.classList.contains('hidden')) {
      apiKeyDisplay.classList.remove('hidden');
      
      // Check if we need to unmask
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
        // We're showing the key already, so mask it
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
      showKeyBtn.textContent = 'Show/Hide API Key';
    }
  }

  // Mask API key for display
  function maskApiKey(key) {
    if (!key) return '';
    return key.substring(0, 3) + '...' + key.substring(key.length - 4);
  }

  // Save settings
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

  // Load settings
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

  // Load usage statistics
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

  // Show status message
  function showStatusMessage(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
      status.classList.add('hidden');
    }, 3000);
  }

  // Load and display saved analyses
  async function loadSavedAnalyses() {
    try {
      const result = await chrome.storage.sync.get(['saved_analyses']);
      const savedAnalyses = result.saved_analyses || [];
      
      displayAnalyses(savedAnalyses);
    } catch (error) {
      console.error('Error loading saved analyses:', error);
    }
  }

  // Display analyses in the UI
  function displayAnalyses(analyses) {
    const container = analysesContainer;
    
    // Clear existing content
    container.innerHTML = '';
    
    if (analyses.length === 0) {
      container.appendChild(noAnalyses);
      return;
    }

    analyses.forEach(analysis => {
      const analysisElement = createAnalysisElement(analysis);
      container.appendChild(analysisElement);
    });
  }

  // Create HTML element for a single analysis
  function createAnalysisElement(analysis) {
    const div = document.createElement('div');
    div.className = 'analysis-item';
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
      <div class="analysis-header">
        <div class="analysis-title">${escapeHtml(analysis.title)}</div>
      </div>
      <div class="analysis-meta">
        <span class="analysis-type ${analysis.type}">${analysis.type.toUpperCase()}</span>
        <span>${escapeHtml(domain)} • ${date}</span>
      </div>
      <div class="analysis-content" style="display: none;">${escapeHtml(analysis.content)}</div>
      <div class="analysis-actions">
        <button class="btn-view" data-action="view">View</button>
        <button class="btn-copy" data-action="copy">Copy</button>
        <button class="btn-delete" data-action="delete">Delete</button>
      </div>
    `;
    
    div.id = 'analysis-' + analysis.id;
    return div;
  }

  // Filter analyses by type
  function filterAnalyses() {
    const filterValue = typeFilter.value;
    const analysisItems = document.querySelectorAll('.analysis-item');
    
    analysisItems.forEach(item => {
      if (filterValue === 'all' || item.dataset.type === filterValue) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
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

  // Handle analysis action clicks with event delegation
  function handleAnalysisAction(event) {
    const button = event.target;
    if (!button.matches('button[data-action]')) {
      return;
    }

    const analysisItem = button.closest('.analysis-item');
    const analysisId = analysisItem.dataset.analysisId;
    const action = button.dataset.action;

    switch (action) {
      case 'view':
        toggleAnalysisContent(analysisId, button);
        break;
      case 'copy':
        copyAnalysisToClipboard(analysisId, button);
        break;
      case 'delete':
        deleteAnalysis(analysisId);
        break;
    }
  }

  // Toggle analysis content visibility
  function toggleAnalysisContent(analysisId, button) {
    const content = document.querySelector(`#analysis-${analysisId} .analysis-content`);
    
    if (content.style.display === 'none' || content.style.display === '') {
      content.style.display = 'block';
      button.textContent = 'Hide';
    } else {
      content.style.display = 'none';
      button.textContent = 'View';
    }
  }

  // Copy analysis to clipboard
  async function copyAnalysisToClipboard(analysisId, button) {
    const content = document.querySelector(`#analysis-${analysisId} .analysis-content`);
    
    try {
      await navigator.clipboard.writeText(content.textContent);
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }

  // Delete analysis
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
});