import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Field, TextInput } from '../components/ui';

const schema = z.object({
  password: z.string().min(8, 'Use at least 8 characters.').regex(/[A-Za-z]/, 'Include a letter.').regex(/[0-9]/, 'Include a number.').regex(/[^A-Za-z0-9]/, 'Include a symbol.'),
  confirm: z.string()
}).refine(value => value.password === value.confirm, { path: ['confirm'], message: 'The passwords do not match.' });

type Values = z.infer<typeof schema>;

export function PasswordRecoveryPage() {
  const { updatePassword, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [message, setMessage] = useState('');
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  async function submit(values: Values) {
    setBusy(true); setMessage('');
    try { await updatePassword(values.password); setUpdated(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update your password.'); }
    finally { setBusy(false); }
  }

  async function returnToSignIn() {
    window.history.replaceState(null, '', window.location.pathname);
    await signOut();
  }

  return <main className="recovery-screen">
    <section className="recovery-card">
      <span className="brand-symbol-wrap"><img className="brand-symbol" src="/assets/brand/amstreem-symbol.svg" alt="" /></span>
      <span className="eyebrow">ACCOUNT SECURITY</span>
      <h1>{updated ? 'Password updated.' : 'Choose a new password.'}</h1>
      <p>{updated ? 'Your password has been changed. Return to sign in with your new credentials.' : 'Create a strong password for your private Atlas workspace.'}</p>
      {!updated ? <form className="form-stack" onSubmit={form.handleSubmit(submit)}>
        <Field label="New password"><TextInput type="password" autoComplete="new-password" {...form.register('password')} />{form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}</Field>
        <Field label="Confirm new password"><TextInput type="password" autoComplete="new-password" {...form.register('confirm')} />{form.formState.errors.confirm && <small className="field-error">{form.formState.errors.confirm.message}</small>}</Field>
        <Button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={16} /></Button>
      </form> : <Button onClick={() => void returnToSignIn()}>Return to sign in <ArrowRight size={16} /></Button>}
      {message && <div className="form-message" role="status">{message}</div>}
    </section>
  </main>;
}