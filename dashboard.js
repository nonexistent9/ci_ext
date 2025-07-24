document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const showKeyBtn = document.getElementById('showKeyBtn');
  const apiKeyDisplay = document.getElementById('apiKeyDisplay');
  const apiKeyText = document.getElementById('apiKeyText');
  const status = document.getElementById('status');
  const modelSelect = document.getElementById('modelSelect');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const apiCallsToday = document.getElementById('apiCallsToday');
  const apiCallsTotal = document.getElementById('apiCallsTotal');
  const lastUsed = document.getElementById('lastUsed');

  // Get company context element
  const companyContext = document.getElementById('companyContext');

  // Load saved API key and settings
  loadApiKey();
  loadSettings();
  loadUsageStats();

  // Event listeners
  saveKeyBtn.addEventListener('click', saveApiKey);
  showKeyBtn.addEventListener('click', toggleApiKeyDisplay);
  saveSettingsBtn.addEventListener('click', saveSettings);

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
    const model = modelSelect.value;
    const context = companyContext.value.trim();
    
    try {
      await chrome.storage.sync.set({ 
        default_model: model,
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
      const result = await chrome.storage.sync.get(['default_model', 'company_context']);
      
      if (result.default_model) {
        modelSelect.value = result.default_model;
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
});