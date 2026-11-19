import { supabase } from './supabase';
const API_URL = (process.env.EXPO_PUBLIC_ATLAS_API_URL || 'https://amstreematlas.onrender.com').replace(/\/$/, '');
export async function atlasApi<T>(path: string, options: RequestInit = {}): Promise<T> {
 const { data: { session } } = await supabase.auth.getSession();
 const response = await fetch(API_URL + '/api' + path, { ...options, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}), ...(options.headers || {}) } });
 if (!response.ok) { let message = 'Atlas could not complete that request.'; try { const payload = await response.json(); if (typeof payload.error === 'string') message = payload.error; } catch {} throw new Error(message); }
 return response.json() as Promise<T>;
}
