export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type TokenGetter = () => Promise<string | null>;

export function createApiClient(baseUrl: string, getToken: TokenGetter, fetchImpl: typeof fetch = fetch) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const res = await fetchImpl(`${baseUrl}/api/v1${path}`, { ...init, headers });
    if (res.status === 204) return undefined as T;

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const e = body?.error;
      throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? 'Error inesperado', e?.details);
    }
    return body as T;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, data?: unknown) => request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
    put: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
    patch: <T>(path: string, data?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  };
}
