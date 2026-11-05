export interface SessionPayload {
  userId: string;
  storeId: string;
  phone: string;
}

export interface AuthUser {
  id: string;
  phone: string;
}

export interface StoreContext {
  id: string;
  name: string;
}

export interface LoginResult {
  success: boolean;
  user: AuthUser;
  store: StoreContext;
}
