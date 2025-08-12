"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) setMessage(error.message); else setMessage('Code sent');
  }

  const verify = async () => {
    setMessage(null);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Signed in successfully! Your extension is now connected.');
      // Redirect to dashboard after successful login
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Login</h1>
      {message && <p>{message}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <button onClick={sendCode}>Send code</button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input value={code} onChange={e => setCode(e.target.value)} placeholder="6-digit code" />
        <button onClick={verify}>Verify</button>
      </div>
    </main>
  )
}


