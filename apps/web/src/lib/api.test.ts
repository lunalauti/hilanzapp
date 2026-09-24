import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './api';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createApiClient', () => {
  it('adjunta el token de la sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const api = createApiClient('http://api.test', async () => 'jwt-123', fetchMock);
    await api.get('/groups');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://api.test/api/v1/groups');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt-123');
  });

  it('no manda Authorization sin sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const api = createApiClient('http://api.test', async () => null, fetchMock);
    await api.get('/groups');
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).has('Authorization')).toBe(false);
  });

  it('convierte el envelope de error en ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { error: { code: 'HAS_DEPENDENTS', message: 'Tiene bailarinas', details: { count: 12 } } }));
    const api = createApiClient('http://api.test', async () => 't', fetchMock);
    await expect(api.delete('/groups/1')).rejects.toMatchObject({ status: 409, code: 'HAS_DEPENDENTS', details: { count: 12 } });
    await expect(api.delete('/groups/1')).rejects.toBeInstanceOf(ApiError);
  });
});
