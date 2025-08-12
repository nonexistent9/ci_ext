'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          // User is logged in, redirect to dashboard
          router.replace('/dashboard');
        } else {
          // User is not logged in, redirect to login
          router.replace('/login');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        router.replace('/login');
      }
    };

    checkAuth();
  }, [router]);

  // Show loading while redirecting
  return (
    <main className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">CI HQ</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </main>
  );
}


