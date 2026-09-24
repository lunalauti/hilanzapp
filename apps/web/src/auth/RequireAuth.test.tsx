import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = { signedIn: false, loading: false };
vi.mock('./AuthProvider', () => ({ useAuth: () => authState }));

import { RequireAuth } from './RequireAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>pantalla de login</div>} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<div>inicio</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    authState.signedIn = false;
    authState.loading = false;
  });

  it('sin sesión redirige a /login', () => {
    renderAt('/');
    expect(screen.getByText('pantalla de login')).toBeInTheDocument();
  });

  it('con sesión muestra la ruta protegida', () => {
    authState.signedIn = true;
    renderAt('/');
    expect(screen.getByText('inicio')).toBeInTheDocument();
  });
});
