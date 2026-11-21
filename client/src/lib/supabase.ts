import { createClient } from '@supabase/supabase-js';

const config = window.PERSONAL_OS_SUPABASE;

if (!config?.url || !config?.publishableKey) {
  throw new Error('Atlas could not load its public Supabase configuration.');
}

export const supabase = createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});