// Configuration for AI services
const CONFIG = {
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  MODEL: 'gpt-4o-mini', // Cost-effective model for feature extraction
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.3 // Lower temperature for more consistent analysis
};

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'openai_api_key',
  EXTRACTION_HISTORY: 'extraction_history'
};