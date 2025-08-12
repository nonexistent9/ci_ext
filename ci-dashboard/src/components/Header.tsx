"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);
  const router = useRouter();
  const supabaseRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabaseRef.current = supabase;
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setLoggedIn(!!data.session);
      })
      .catch((err) => {
        console.error('Failed to get session', err);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setLoggedIn(!!s);
    });
    return () => {
      mounted = false;
      try {
        if (sub && sub.subscription) {
          sub.subscription.unsubscribe();
        }
      } catch (err) {
        console.error('Failed to unsubscribe from auth changes', err);
      }
    };
  }, []);

  const logout = async () => {
    try {
      const client = supabaseRef.current ?? getSupabaseClient();
      const { error } = await client.auth.signOut();
      if (error) {
        console.error('Failed to sign out', error);
        return;
      }
      router.replace('/login');
    } catch (err) {
      console.error('Unexpected error during sign out', err);
    }
  };

  return (
    <header className="flex gap-4 py-3 px-6 border-b border-gray-200">
      <Link href="/">CI HQ</Link>
      <nav className="flex gap-3">
        <Link href="/dashboard">Dashboard</Link>
      </nav>
      <div className="ml-auto">
        {loggedIn ? (
          <button onClick={logout}>Log out</button>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </div>
    </header>
  );
}


