// Configuration for AI services
const CONFIG = {
  OPENAI_API_URL: 'https://api.openai.com/v1/chat/completions',
  DEFAULT_MODEL: 'gpt-4o-mini', // Cost-effective model for feature extraction
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.3 // Lower temperature for more consistent analysis
};

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'openai_api_key',
  DEFAULT_MODEL: 'default_model',
  EXTRACTION_HISTORY: 'extraction_history',
  API_CALLS_TODAY: 'api_calls_today',
  API_CALLS_TOTAL: 'api_calls_total',
  LAST_USED: 'last_used',
  LAST_USED_DATE: 'last_used_date'
};