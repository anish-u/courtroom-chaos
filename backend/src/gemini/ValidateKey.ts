import { GoogleGenAI } from '@google/genai';

const TIMEOUT_MS = 5000;
const GENERIC_ERROR =
  'Invalid Gemini API key. Double-check the key from aistudio.google.com.';

/**
 * Lightweight authentication probe for a Gemini API key.
 *
 * Calls `models.list()` (zero-token) and races it against a timeout. We treat
 * clear authentication failures (401/403/PERMISSION_DENIED/etc.) as a hard
 * "no" and reject room creation. Any other failure (network blip, timeout,
 * 5xx) is logged server-side and we fail open — a transient outage shouldn't
 * block hosts, and the actual game-start path will surface a real error if
 * the key turns out to be unusable.
 */
export async function validateApiKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!apiKey?.trim()) {
    return { ok: false, error: 'API key is required' };
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    await Promise.race([
      ai.models.list(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
      ),
    ]);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    const isAuthFail =
      lower.includes('api key') ||
      lower.includes('api_key') ||
      lower.includes('permission_denied') ||
      lower.includes('unauthenticated') ||
      lower.includes('invalid_argument') ||
      lower.includes(' 400 ') ||
      lower.includes(' 401 ') ||
      lower.includes(' 403 ');

    if (isAuthFail) {
      return { ok: false, error: GENERIC_ERROR };
    }

    console.warn(
      '[ValidateKey] non-auth failure during validation, allowing room creation:',
      msg
    );
    return { ok: true };
  }
}
