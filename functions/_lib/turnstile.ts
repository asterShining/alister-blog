/**
 * Minimal Cloudflare Turnstile server-side verification.
 * Never sends remoteip. Never exposes secret or Cloudflare error internals.
 */

export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  action?: string;
  cdata?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export interface TurnstileResult {
  success: boolean;
  error?: string;
}

export interface VerifyTurnstileOptions {
  fetchFn?: typeof fetch;
  expectedAction?: string;
  expectedHostname?: string;
  allowLocalhost?: boolean;
}

/**
 * Verify a Turnstile token against Cloudflare's siteverify endpoint.
 *
 * @param secret  - TURNSTILE_SECRET from env (never from client)
 * @param token   - The turnstileToken from the client request body
 * @param options - Optional verification parameters: fetchFn, expectedAction, expectedHostname, allowLocalhost
 */
export async function verifyTurnstile(
  secret: string,
  token: string,
  options: VerifyTurnstileOptions = {},
): Promise<TurnstileResult> {
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const body = new URLSearchParams({ secret, response: token });
    // Never include remoteip — we do not track or store user IPs.
    const response = await fetchFn(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) return { success: false, error: 'Comment verification failed' };

    const data: SiteverifyResponse = await response.json();
    if (!data.success) return { success: false, error: 'Comment verification failed' };

    if (options.expectedAction && data.action && data.action !== options.expectedAction) {
      return { success: false, error: 'Comment verification failed' };
    }
    if (options.expectedHostname && data.hostname) {
      const allowed =
        data.hostname === options.expectedHostname ||
        (options.allowLocalhost &&
          ['localhost', '127.0.0.1', 'example.com', 'example.test'].includes(data.hostname));
      if (!allowed) {
        return { success: false, error: 'Comment verification failed' };
      }
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Comment verification failed' };
  }
}
