import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/apiClient', () => ({ api: { post: vi.fn().mockResolvedValue({}) } }));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('muestra barra lateral y navegación inferior con la ruta activa marcada', () => {
    render(
      <MemoryRouter initialEntries={['/disenos']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="disenos" element={<div>contenido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('contenido')).toBeInTheDocument();
    const activos = screen.getAllByRole('link', { name: /Diseños/ });
    expect(activos).toHaveLength(2);
    activos.forEach((a) => expect(a).toHaveClass('active'));
    expect(screen.getAllByLabelText('Navegación principal')).toHaveLength(2);
  });
});
