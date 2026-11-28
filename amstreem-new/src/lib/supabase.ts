import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      db: { schema: 'amstreem' },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type MemoryRow = {
  id: string;
  user_id: string;
  content: string;
  memory_type: 'fact' | 'preference' | 'goal' | 'project' | 'experience' | 'other';
  sensitivity: 'ordinary' | 'sensitive';
  source: 'user_created' | 'user_confirmed' | 'imported';
  created_at: string;
  updated_at: string;
};
