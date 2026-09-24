import request from 'supertest';
import type { Express } from 'express';
import type { TestUser } from './supabase';

export function client(app: Express, u: TestUser) {
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${u.token}`);
  return {
    get: (p: string) => auth(request(app).get(`/api/v1${p}`)),
    post: (p: string, body?: object) => auth(request(app).post(`/api/v1${p}`)).send(body),
    put: (p: string, body?: object) => auth(request(app).put(`/api/v1${p}`)).send(body),
    patch: (p: string, body?: object) => auth(request(app).patch(`/api/v1${p}`)).send(body),
    del: (p: string) => auth(request(app).delete(`/api/v1${p}`)),
  };
}
