/**
 * Central API client.
 * - Attaches the Bearer access token
 * - On 401, tries one refresh + retry, then forces logout
 * - Normalizes the { success, data | message, errorCode } envelope
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'fleet.tokens';

export interface Tokens { accessToken: string; refreshToken: string }

export function getTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null'); } catch { return null; }
}

export function setTokens(tokens: Tokens | null) {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public errorCode?: string, public details?: unknown) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    if (!res.ok) { setTokens(null); return false; }
    const body = await res.json();
    setTokens({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {},
): Promise<T> {
  const { params, ...init } = opts;
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const doFetch = async () => {
    const tokens = getTokens();
    return fetch(url.toString(), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  };

  const hadCreds = !!getTokens()?.accessToken;
  let res = await doFetch();
  if (res.status === 401 && getTokens()?.refreshToken) {
    refreshing ??= refreshTokens().finally(() => { refreshing = null; });
    if (await refreshing) res = await doFetch();
  }
  // Unrecoverable auth failure (e.g. session invalidated by a reseed) —
  // clear credentials and tell the app to drop back to the login screen
  // instead of rendering empty/error states on every page.
  if (res.status === 401 && hadCreds) {
    setTokens(null);
    window.dispatchEvent(new Event('fleet:unauthorized'));
  }

  // csv export returns raw text
  if ((res.headers.get('content-type') ?? '').includes('text/csv')) {
    return (await res.text()) as T;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`, body.errorCode, body.details);
  }
  return body;
}

/** Convenience: GET that unwraps data + meta for paginated endpoints. */
export async function apiList<T>(path: string, params?: Record<string, unknown>) {
  const body = await api<{ data: T[]; meta?: { total: number; page: number; totalPages: number } }>(
    path, { params: params as Record<string, string> },
  );
  return { items: body.data, meta: body.meta };
}
