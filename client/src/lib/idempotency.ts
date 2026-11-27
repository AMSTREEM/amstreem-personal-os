let installed = false;

/**
 * Adds idempotency keys to mutating Atlas API requests without changing the
 * frozen shared API client or the protected Qur'an API surface.
 */
export function installApiIdempotency() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const request = input instanceof Request ? input : null;
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : request?.url || '';
    let pathname = rawUrl;
    try { pathname = new URL(rawUrl, window.location.origin).pathname; } catch { /* Non-URL fetch input. */ }
    const method = String(init.method || request?.method || 'GET').toUpperCase();
    const isAtlasApi = pathname.startsWith('/api/') && !pathname.startsWith('/api/quran/');
    if (!isAtlasApi || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return nativeFetch(input, init);
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has('Idempotency-Key')) headers.set('Idempotency-Key', crypto.randomUUID());
    return nativeFetch(input, { ...init, headers });
  };
}
