import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCookie } from '../lib/cookies';
import { SETUP_COOKIE } from '../lib/setup';
import { renderApp } from '../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../lib/apiClient', () => ({ api }));

import { GettingStarted } from './GettingStarted';

const answers = (over: Record<string, unknown> = {}) => {
  const data: Record<string, unknown> = { '/groups': [], '/materials': [], '/designs': [], '/stats': { groups: 0, dancers: 0, dancersBySize: [] }, ...over };
  api.get.mockImplementation((path: string) => Promise.resolve(data[path]));
};

describe('Primeros pasos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra las tres fases y el avance en cero para una cuenta nueva', async () => {
    answers();
    renderApp(<GettingStarted />);
    expect(await screen.findByText('0 de 12 pasos')).toBeInTheDocument();
    for (const t of ['Armá tu taller', 'Tu primer grupo', 'A producir']) expect(await screen.findByRole('heading', { name: new RegExp(t) })).toBeInTheDocument();
  });

  it('tilda solos los pasos que detecta con datos', async () => {
    answers({ '/groups': [{ id: 'g1' }], '/materials': [{ id: 'm1' }], '/stats': { groups: 1, dancers: 3, dancersBySize: [{ label: '40', count: 3 }] } });
    renderApp(<GettingStarted />);
    expect(await screen.findByText('4 de 12 pasos')).toBeInTheDocument();
  });

  it('permite marcar a mano un paso y lo recuerda en una cookie', async () => {
    answers();
    renderApp(<GettingStarted />);
    await screen.findByRole('heading', { name: /Armá tu taller/ });
    await userEvent.click(screen.getAllByRole('button', { name: 'Marcar como hecho' })[0]!);
    expect(screen.getByText('1 de 12 pasos')).toBeInTheDocument();
    expect(getCookie(SETUP_COOKIE)).toBe('tablas');
  });
});
