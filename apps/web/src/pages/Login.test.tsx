import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signedIn: false, signIn: vi.fn() }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }));

import { Login } from './Login';

function view() {
  return render(
    <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/login" element={<Login />} /><Route path="/" element={<div>inicio</div>} /></Routes>
    </MemoryRouter>,
  );
}
const fill = async (email: string, password: string) => {
  if (email) await userEvent.type(screen.getByLabelText('Email'), email);
  if (password) await userEvent.type(screen.getByLabelText('Contraseña'), password);
};

describe('Login', () => {
  beforeEach(() => { vi.clearAllMocks(); auth.signedIn = false; });

  it('valida el email con mensajes específicos y exige la contraseña', async () => {
    view();
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Falta la @ en el email.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu contraseña.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'nombre@correo');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Revisá el email: no parece válido.')).toBeInTheDocument();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('con datos válidos inicia sesión con el email sin espacios', async () => {
    auth.signIn.mockResolvedValue(null);
    view();
    await fill('  modista@taller.com ', 'secreto');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('modista@taller.com', 'secreto'));
  });

  it('muestra el error de credenciales del servidor', async () => {
    auth.signIn.mockResolvedValue('El email o la contraseña no coinciden. Probá de nuevo.');
    view();
    await fill('a@b.co', 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El email o la contraseña no coinciden. Probá de nuevo.');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('se puede mostrar y ocultar la contraseña', async () => {
    view();
    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('con sesión iniciada redirige al inicio', () => {
    auth.signedIn = true;
    view();
    expect(screen.getByText('inicio')).toBeInTheDocument();
  });

  describe('servidor dormido', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('tras unos segundos muestra "Enhebrando la aguja…" con el progreso y luego ofrece reintentar', async () => {
      let finish: (v: string | null) => void = () => undefined;
      auth.signIn.mockImplementation(() => new Promise((r) => { finish = r; }));
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      view();
      await user.type(screen.getByLabelText('Email'), 'a@b.co');
      await user.type(screen.getByLabelText('Contraseña'), 'x');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));
      expect(screen.getByRole('button', { name: 'Entrando…' })).toBeDisabled();
      expect(screen.queryByText('Enhebrando la aguja…')).not.toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(screen.getByText('Enhebrando la aguja…')).toBeInTheDocument();
      expect(screen.getByText('5 s de ~30 s')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(26000); });
      const retry = screen.getByRole('button', { name: /Reintentar/ });
      await user.click(retry);
      expect(auth.signIn).toHaveBeenCalledTimes(2);

      await act(async () => { finish('No pudimos conectar.'); await vi.advanceTimersByTimeAsync(10); });
      expect(screen.queryByText('Enhebrando la aguja…')).not.toBeInTheDocument();
    });
  });
});
