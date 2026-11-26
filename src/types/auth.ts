// src/types/auth.ts
export type {
  SessionPayload,
  AuthUser,
  StoreContext,
  LoginResult,
} from '@/modules/auth/types';

import type { AuthUser, StoreContext } from '@/modules/auth/types';

export interface AuthMeResponse {
  authenticated: boolean;
  user: AuthUser;
  store: StoreContext | null;
}

export interface LoginCredentials {
  phone: string;
  pin: string;
}
