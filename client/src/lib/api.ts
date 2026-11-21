import { supabase } from './supabase';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.access_token) headers.set('Authorization', 'Bearer ' + session.access_token);
  const response = await fetch('/api' + path, { ...init, headers });
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const payload = await response.json();
      if (payload?.error) message = payload.error;
    } catch { /* Keep the fallback message. */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});