// src/lib/api/auth.ts
import type { AuthMeResponse, LoginCredentials, LoginResult } from '@/types/auth';
import { ApiClientError, parseErrorPayload } from './client';

export async function fetchCurrentSession(): Promise<AuthMeResponse | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthMeResponse;
}

export async function loginWithPin(credentials: LoginCredentials): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new ApiClientError(
      payload?.error?.message || 'Invalid credentials',
      response.status,
      payload?.error?.code
    );
  }

  return (await response.json()) as LoginResult;
}

export async function logoutSession(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
