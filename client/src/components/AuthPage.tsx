import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, TextInput } from './ui';

const loginSchema = z.object({ email: z.string().min(3, 'Enter your email address.'), password: z.string().min(1, 'Enter your password.') });
const signupSchema = z.object({
  name: z.string().min(2, 'Enter your name.').max(40),
  username: z.string().regex(/^[A-Za-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers or underscores.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').regex(/[A-Za-z]/, 'Include a letter.').regex(/[0-9]/, 'Include a number.').regex(/[^A-Za-z0-9]/, 'Include a symbol.')
});
type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const signup = useForm<SignupValues>({ resolver: zodResolver(signupSchema), defaultValues: { name: '', username: '', email: '', password: '' } });

  async function submitLogin(values: LoginValues) {
    setBusy(true); setMessage('');
    try { await signIn(values.email.trim(), values.password); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  async function submitSignup(values: SignupValues) {
    setBusy(true); setMessage('');
    try {
      const active = await signUp(values.name, values.username, values.email, values.password);
      setMessage(active ? 'Your workspace is ready.' : 'Your account has been created. Check your inbox to confirm your email, then sign in.');
      if (!active) setMode('login');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Account creation failed.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen">
    <div className="auth-visual">
      <div className="auth-brand"><span className="brand-symbol">a</span><span>AMSTREEM <b>ATLAS</b></span></div>
      <div className="auth-message-block">
        <span className="eyebrow">A PRIVATE OPERATING SYSTEM</span>
        <h1>Make room for<br /><em>what matters.</em></h1>
        <p>A quieter place to think clearly, move with intention, and build a life that feels like yours.</p>
        <div className="auth-principle"><span>✳</span><span>Direction before distraction.</span></div>
      </div>
      <div className="auth-footnote">YOUR SPACE. YOUR PACE. YOUR DIRECTION.</div>
    </div>
    <section className="auth-panel"><div className="auth-panel__inner">
      <div className="auth-mobile-brand"><span className="brand-symbol">a</span> AMSTREEM ATLAS</div>
      <div className="auth-panel__top"><span className="eyebrow">{mode === 'signup' ? 'BEGIN WITH INTENTION' : 'WELCOME BACK'}</span><span className="secure-label"><LockKeyhole size={13} /> PRIVATE WORKSPACE</span></div>
      <h2>{mode === 'signup' ? 'Create your space.' : 'Pick up where you left off.'}</h2>
      <p className="auth-subtitle">{mode === 'signup' ? 'A personal space for the things you want to make meaningful.' : 'Sign in to return to your personal operating system.'}</p>
      {mode === 'login' ? <form className="form-stack" onSubmit={login.handleSubmit(submitLogin)}>
        <Field label="Email address"><TextInput type="email" autoComplete="username" placeholder="you@example.com" {...login.register('email')} />{login.formState.errors.email && <small className="field-error">{login.formState.errors.email.message}</small>}</Field>
        <Field label="Password"><div className="password-field"><TextInput type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" {...login.register('password')} /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{login.formState.errors.password && <small className="field-error">{login.formState.errors.password.message}</small>}</Field>
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Enter Atlas'} <ArrowRight size={16} /></Button>
      </form> : <form className="form-stack" onSubmit={signup.handleSubmit(submitSignup)}>
        <Field label="Full name"><TextInput autoComplete="name" placeholder="Your name" {...signup.register('name')} />{signup.formState.errors.name && <small className="field-error">{signup.formState.errors.name.message}</small>}</Field>
        <Field label="Username"><TextInput autoComplete="username" placeholder="Choose a username" {...signup.register('username')} />{signup.formState.errors.username && <small className="field-error">{signup.formState.errors.username.message}</small>}</Field>
        <Field label="Email address"><TextInput type="email" autoComplete="email" placeholder="you@example.com" {...signup.register('email')} />{signup.formState.errors.email && <small className="field-error">{signup.formState.errors.email.message}</small>}</Field>
        <Field label="Password" hint="At least 8 characters, with a letter, number and symbol."><div className="password-field"><TextInput type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Create a secure password" {...signup.register('password')} /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{signup.formState.errors.password && <small className="field-error">{signup.formState.errors.password.message}</small>}</Field>
        <Button type="submit" disabled={busy}>{busy ? 'Creating your space…' : 'Create account'} <ArrowRight size={16} /></Button>
      </form>}
      {message && <div className="form-message" role="status">{message}</div>}
      <div className="auth-switch">{mode === 'login' ? 'New to Atlas?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></div>
      <div className="auth-legal">Your records remain private to your account.</div>
    </div></section>
  </main>;
}