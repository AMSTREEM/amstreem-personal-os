import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserProfile = { id: string; email: string; name: string; username: string };
type AuthState = {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, username: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrate = useCallback(async (next: Session | null) => {
    if (!next) { setUser(null); return; }
    try {
      const response = await fetch('/api/session', { headers: { Authorization: 'Bearer ' + next.access_token } });
      if (!response.ok) throw new Error('Session profile unavailable.');
      const result = await response.json();
      setUser({ id: result.user.id, email: result.user.email || '', name: result.user.name || '', username: result.user.username || '' });
    } catch {
      setUser({ id: next.user.id, email: next.user.email || '', name: String(next.user.user_metadata?.full_name || ''), username: String(next.user.user_metadata?.username || '') });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await hydrate(data.session);
      if (mounted) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setUser(null);
      else queueMicrotask(() => { void hydrate(next); });
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [hydrate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Sign-in did not return an active session.');
    await hydrate(data.session);
  }, [hydrate]);

  const signUp = useCallback(async (name: string, username: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, username, religion: 'none', onboarding_completed: false }, emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    if (data.session) { await hydrate(data.session); return true; }
    return false;
  }, [hydrate]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({ session, user, loading, signIn, signUp, signOut }), [session, user, loading, signIn, signUp, signOut]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}