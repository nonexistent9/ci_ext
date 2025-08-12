// Debug utility to inspect localStorage in web app
// Run this in the browser console on localhost:3000 to see what Supabase stores

console.log('=== LocalStorage Debug Utility ===');

// Get all localStorage keys
const allKeys = Object.keys(localStorage);
console.log('Total localStorage keys:', allKeys.length);
console.log('All keys:', allKeys);

// Filter for potential auth keys
const authKeys = allKeys.filter(key => 
  key.toLowerCase().includes('supabase') || 
  key.toLowerCase().includes('auth') ||
  key.toLowerCase().includes('session') ||
  key.toLowerCase().includes('clerk') ||
  key.toLowerCase().includes('token')
);

console.log('\n=== Potential Auth Keys ===');
authKeys.forEach(key => {
  const value = localStorage.getItem(key);
  console.log(`Key: ${key}`);
  console.log(`Type: ${typeof value}`);
  console.log(`Length: ${value ? value.length : 0}`);
  
  try {
    if (value && (value.startsWith('{') || value.startsWith('['))) {
      const parsed = JSON.parse(value);
      console.log(`Parsed structure:`, Object.keys(parsed));
      if (parsed.access_token) {
        console.log('✅ Found access_token in', key);
      }
      if (parsed.session && parsed.session.access_token) {
        console.log('✅ Found nested session.access_token in', key);
      }
      if (parsed.currentSession && parsed.currentSession.access_token) {
        console.log('✅ Found nested currentSession.access_token in', key);
      }
    } else {
      console.log(`Raw value preview: ${value ? value.substring(0, 50) + '...' : 'null'}`);
    }
  } catch (e) {
    console.log(`Parse error: ${e.message}`);
  }
  console.log('---');
});

console.log('\n=== SessionStorage Check ===');
const sessionKeys = Object.keys(sessionStorage);
console.log('SessionStorage keys:', sessionKeys);

console.log('\n=== Cookie Check ===');
console.log('Document cookies:', document.cookie);