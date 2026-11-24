import { createClient } from '@supabase/supabase-js';

const config = window.PERSONAL_OS_SUPABASE;

if (!config?.url || !config?.publishableKey) {
  throw new Error('Atlas could not load its public Supabase configuration.');
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

function isInvalidRefreshTokenMessage(message: string) {
  return /invalid refresh token|refresh token (not found|expired|invalid)|refresh_token_not_found/i.test(message);
}

const authFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status !== 400) return response;

  let requestUrl: URL;
  try {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requestUrl = new URL(rawUrl, window.location.origin);
  } catch {
    return response;
  }

  if (!requestUrl.pathname.endsWith('/auth/v1/token') || requestUrl.searchParams.get('grant_type') !== 'refresh_token') {
    return response;
  }

  try {
    const payload = await response.clone().json() as {
      message?: string;
      msg?: string;
      error?: string;
      error_description?: string;
    };
    const message = [payload.message, payload.msg, payload.error, payload.error_description].filter(Boolean).join(' ');
    if (isInvalidRefreshTokenMessage(message)) {
      // Supabase's local sign-out clears this browser's stored session first.
      // It does not revoke sessions on the user's other devices.
      queueMicrotask(() => {
        void supabaseClient?.auth.signOut({ scope: 'local' }).catch(() => {
          // Local storage is still cleared by signOut even if remote revocation fails.
        });
      });
    }
  } catch {
    // Ignore non-JSON or unrecognized 400 responses; don't sign users out on unrelated errors.
  }

  return response;
};

export const isInvalidRefreshTokenError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown; status?: unknown; code?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return isInvalidRefreshTokenMessage(message) ||
    (candidate.status === 400 && /refresh.?token/i.test(String(candidate.code || '') + ' ' + message));
};

supabaseClient = createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: authFetch }
});

export const supabase = supabaseClient;
