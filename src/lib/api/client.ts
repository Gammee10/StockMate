// src/lib/api/client.ts
export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export async function parseErrorPayload(
  response: Response
): Promise<ApiErrorEnvelope | null> {
  try {
    return (await response.json()) as ApiErrorEnvelope;
  } catch (err) {
    void err;
    return null;
  }
}

export async function throwApiError(
  response: Response,
  fallbackMessage: string
): Promise<never> {
  const payload = await parseErrorPayload(response);
  throw new ApiClientError(
    payload?.error?.message || fallbackMessage,
    response.status,
    payload?.error?.code
  );
}
