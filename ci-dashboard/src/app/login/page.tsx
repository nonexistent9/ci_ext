"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          router.replace('/dashboard');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    };

    checkAuth();
  }, [router]);

  const sendCode = async () => {
    if (!email) return;
    setMessage(null);
    setIsLoading(true);
    
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({ 
      email, 
      options: { shouldCreateUser: true } 
    });
    
    setIsLoading(false);
    
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('🎯 Code sent! Check your email.');
      setStep('code');
    }
  }

  const verify = async () => {
    if (!code) return;
    setMessage(null);
    setIsLoading(true);
    
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ 
      email, 
      token: code, 
      type: 'email' 
    });
    
    setIsLoading(false);
    
    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('🚀 Welcome aboard! Redirecting...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !isLoading) {
      action();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.1) 2px,
            rgba(255,255,255,0.1) 4px
          )`
        }}></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Main container with 90s styling */}
        <div className="bg-gray-100 border-4 border-gray-400 shadow-2xl" style={{
          borderStyle: 'outset',
          borderWidth: '4px'
        }}>
          {/* Header bar */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 border-b-2 border-gray-400" style={{
            borderBottomStyle: 'inset'
          }}>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full border border-red-700"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full border border-yellow-700"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full border border-green-700"></div>
              </div>
              <span className="text-sm font-mono">CI_HQ_LOGIN.exe</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 bg-gray-200">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2" style={{ 
                textShadow: '2px 2px 0px #ffffff',
                fontFamily: 'system-ui, monospace'
              }}>
                Welcome to CI HQ
              </h1>
              <p className="text-lg text-gray-700 font-mono">
                The no bullsh*t CI tool
              </p>
              <div className="mt-4 text-sm text-gray-600">
                ━━━━━━━━━━━━━━━━━━━━━━━━━━
              </div>
            </div>

            {/* Status message */}
            {message && (
              <div className={`mb-4 p-3 border-2 font-mono text-sm ${
                message.includes('Error') 
                  ? 'bg-red-100 border-red-400 text-red-700' 
                  : 'bg-green-100 border-green-400 text-green-700'
              }`} style={{
                borderStyle: message.includes('Error') ? 'inset' : 'outset'
              }}>
                {message}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              {step === 'email' ? (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 font-mono">
                      EMAIL ADDRESS:
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyPress={e => handleKeyPress(e, sendCode)}
                      placeholder="your.email@company.com"
                      className="w-full p-3 border-2 border-gray-400 font-mono text-sm"
                      style={{ borderStyle: 'inset' }}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={sendCode}
                    disabled={!email || isLoading}
                    className="w-full p-3 bg-blue-500 text-white font-bold border-2 border-gray-400 font-mono text-sm hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    style={{ borderStyle: 'outset' }}
                  >
                    {isLoading ? '⏳ SENDING...' : '📧 SEND LOGIN CODE'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 font-mono">
                      VERIFICATION CODE:
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      onKeyPress={e => handleKeyPress(e, verify)}
                      placeholder="123456"
                      className="w-full p-3 border-2 border-gray-400 font-mono text-sm text-center tracking-widest"
                      style={{ borderStyle: 'inset' }}
                      maxLength={6}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-gray-600 mt-1 font-mono">
                      Check your email for the 6-digit code
                    </p>
                  </div>
                  <button
                    onClick={verify}
                    disabled={!code || isLoading}
                    className="w-full p-3 bg-green-500 text-white font-bold border-2 border-gray-400 font-mono text-sm hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    style={{ borderStyle: 'outset' }}
                  >
                    {isLoading ? '⏳ VERIFYING...' : '🚀 LAUNCH CI HQ'}
                  </button>
                  <button
                    onClick={() => {
                      setStep('email');
                      setCode('');
                      setMessage(null);
                    }}
                    className="w-full p-2 bg-gray-400 text-gray-700 font-bold border-2 border-gray-400 font-mono text-xs hover:bg-gray-500"
                    style={{ borderStyle: 'outset' }}
                  >
                    ← BACK TO EMAIL
                  </button>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-xs text-gray-500 font-mono">
              <div>━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
              <div className="mt-2">
                Powered by 90s nostalgia & modern tech
              </div>
            </div>
          </div>
        </div>

        {/* Terminal-style footer */}
        <div className="mt-4 bg-black text-green-400 p-3 font-mono text-xs border-2 border-gray-600">
          <div>C:\CI_HQ&gt; status: {isLoading ? 'processing...' : 'ready'}</div>
          <div className="flex">
            <span>C:\CI_HQ&gt; _</span>
            <div className="ml-1 w-2 h-4 bg-green-400 animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  )
}


