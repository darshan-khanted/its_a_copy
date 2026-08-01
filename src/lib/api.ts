// Typed fetch to the Express API with a Firebase ID token + retry (design §G.2/§G.7).
import { auth } from './firebase';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function robustFetch(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 800,
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('network error');
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the caller's Firebase ID token (required for every mutating route). */
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth: withAuth = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (withAuth) {
    const token = await getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await robustFetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const err = (data ?? {}) as { code?: string; error?: string; message?: string };
    throw new ApiError(res.status, err.code ?? 'REQUEST_FAILED', err.error ?? err.message ?? res.statusText);
  }

  return data as T;
}
