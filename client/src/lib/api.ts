import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(message: string, public readonly code: string | undefined, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  const method = (init.method || 'GET').toUpperCase();
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const pathOnly = path.split('?')[0];
  const retrySafe = isMutation && !/^\/(?:admin(?:\/|$)|welcome(?:\/|$)|feedback(?:\/|$)|announcements(?:\/|$)|import(?:\/|$)|auth(?:\/|$))/.test(pathOnly);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.access_token) headers.set('Authorization', 'Bearer ' + session.access_token);

  if (isMutation && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', crypto.randomUUID());
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('/api' + path, { ...init, headers });
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    let payload: { error?: string; code?: string } | null = null;
    try {
      payload = await response.json();
    } catch { /* Keep the fallback message. */ }

    if (response.status === 409 && payload?.code === 'version_conflict' && retrySafe && attempt < 2) {
      continue;
    }
    throw new ApiError(payload?.error || 'Something went wrong. Please try again.', payload?.code, response.status);
  }

  throw new Error('Your workspace changed repeatedly while saving. Please retry.');
}

export const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
