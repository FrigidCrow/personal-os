import type { ApiEnvelope, ApiErrorEnvelope } from "@personal-os/vnext-contracts";

export class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly details?: unknown) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v2${path}`, {
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers }
  });
  const payload = await response.json() as ApiEnvelope<T> | ApiErrorEnvelope;
  if (!response.ok || !payload.success) {
    const error = payload as ApiErrorEnvelope;
    throw new ApiError(error.error.code, error.error.message, error.error.details);
  }
  return payload.data;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

export function patch<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
