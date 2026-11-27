import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { initialAuthFlowType, isInvalidRefreshTokenError, supabase } from '../lib/supabase';

type UserProfile = { id: string; email: string; name: string; username: string };
type BootstrapResponse = {
  user: Omit<UserProfile, 'email'> & { email: string | null };
  role: 'user' | 'admin';
  today: string;
  settings: Record<string, string>;
  navigationBadges: Record<string, number>;
};
type AuthState = {
  session: Session | null;
  user: UserProfile | null;
  role: string | null;
  loading: boolean;
  signupConfirmationPending: boolean;
  continueAfterSignup: () => void;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (name: string, username: string, email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupConfirmationPending, setSignupConfirmationPending] = useState(initialAuthFlowType === 'signup');
  const continueAfterSignup = useCallback(() => {
    setSignupConfirmationPending(false);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const hydrate = useCallback(async (next: Session | null) => {
    if (!next) { setUser(null); setRole(null); return; }
    try {
      const response = await fetch('/api/v1/bootstrap', { headers: { Authorization: 'Bearer ' + next.access_token } });
      if (!response.ok) throw new Error('Session profile unavailable.');
      const result = await response.json() as BootstrapResponse;
      setUser({ id: result.user.id, email: result.user.email || '', name: result.user.name || '', username: result.user.username || '' });
      setRole(result.role || 'user');
    } catch {
      setUser({ id: next.user.id, email: next.user.email || '', name: String(next.user.user_metadata?.full_name || ''), username: String(next.user.user_metadata?.username || '') });
      setRole('user');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('Session restore:', error.message);
        if (isInvalidRefreshTokenError(error)) {
          // Clear only this browser's stale session; other devices remain signed in.
          await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
          if (!mounted) return;
          setSession(null);
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      await hydrate(data.session);
      if (mounted) setLoading(false);
    }).catch(async (error: unknown) => {
      if (!mounted) return;
      if (isInvalidRefreshTokenError(error)) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setRole(null);
      } else {
        console.error('Session restore failed:', error);
      }
      if (mounted) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) { setUser(null); setRole(null); }
      else { queueMicrotask(() => { void hydrate(next); }); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [hydrate]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    if (identifier.includes('@')) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: identifier, password });
      if (error) throw error;
      if (!data.session) throw new Error('Sign-in did not return an active session.');
      await hydrate(data.session);
      return;
    }
    const response = await fetch('/api/v1/auth/username-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || payload.error || 'Invalid username or password.');
    const { data, error } = await supabase.auth.setSession({ access_token: payload.access_token, refresh_token: payload.refresh_token });
    if (error) throw error;
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

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const completeOnboarding = useCallback(async () => {
    const { error } = await supabase.auth.updateUser({ data: { onboarding_completed: true, onboarding_version: 2 } });
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({ session, user, role, loading, signupConfirmationPending, continueAfterSignup, signIn, signUp, signOut, requestPasswordReset, updatePassword, completeOnboarding }), [session, user, role, loading, signupConfirmationPending, continueAfterSignup, signIn, signUp, signOut, requestPasswordReset, updatePassword, completeOnboarding]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}