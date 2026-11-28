import { FormEvent, useState } from 'react';
import { ArrowUpRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Props = { client: SupabaseClient; };

export default function AuthScreen({ client }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (authError) throw authError;
        if (!data.session) {
          setMessage('Your account is created. Check your email for the confirmation link, then return here to sign in.');
        } else {
          setMessage('Your Amstreem account is ready.');
        }
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="wordmark-symbol">a<span>.</span></span><span className="wordmark-name">amstreem</span></div>
        <div className="auth-orb"><Sparkles size={25} strokeWidth={1.4} /></div>
        <span className="kicker">YOUR SPACE, YOURS ALONE</span>
        <h1>{mode === 'signup' ? <>A life, <em>understood.</em></> : <>Welcome <em>back.</em></>}</h1>
        <p className="auth-copy">{mode === 'signup' ? 'Create your private space. Your memories belong to your account and are protected by individual access controls.' : 'Sign in to continue to your personal environment.'}</p>
        <form onSubmit={submit} className="auth-form">
          <label>Email address</label>
          <div className="auth-input"><Mail size={16} /><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
          <label>Password</label>
          <div className="auth-input"><LockKeyhole size={16} /><input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="begin-button auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create my account' : 'Sign in'} <ArrowUpRight size={16} /></button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setMessage(''); }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New to Amstreem? Create an account'}
        </button>
        <div className="auth-foot">PRIVATE BY DESIGN <i /> BUILT AROUND YOUR LIFE</div>
      </div>
    </main>
  );
}
