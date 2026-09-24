import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCookie, getCookie } from '../../lib/cookies';
import { ONBOARDING_COOKIE, OnboardingProvider, useOnboarding } from './Onboarding';
import { STEPS } from './steps';

function Reopen() {
  const { open } = useOnboarding();
  return <button type="button" onClick={open}>Ver tutorial</button>;
}
const view = () => render(<MemoryRouter><OnboardingProvider><Reopen /></OnboardingProvider></MemoryRouter>);

describe('Tutorial de bienvenida', () => {
  beforeEach(() => deleteCookie(ONBOARDING_COOKIE));

  it('aparece la primera vez, cuando no hay cookie', async () => {
    view();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(`Paso 1 de ${STEPS.length}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bienvenida a Hilanzapp' })).toBeInTheDocument();
    expect(getCookie(ONBOARDING_COOKIE)).toBeNull();
  });

  it('no aparece si la cookie de cerrado ya existe', () => {
    document.cookie = `${ONBOARDING_COOKIE}=1; Path=/`;
    view();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('avanza y retrocede entre pasos', async () => {
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('heading', { name: 'Grupos y bailarinas' })).toBeInTheDocument();
    expect(screen.getByText(`Paso 2 de ${STEPS.length}`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByRole('heading', { name: 'Bienvenida a Hilanzapp' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anterior' })).not.toBeInTheDocument();
  });

  it('se puede saltar a un paso con los puntos', async () => {
    view();
    await userEvent.click(await screen.findByRole('tab', { name: /Ir al paso 4/ }));
    expect(screen.getByRole('heading', { name: 'Talle sugerido, siempre editable' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Ir al paso 4/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('al terminar con "Empezar" se guarda la cookie y se cierra', async () => {
    view();
    await screen.findByRole('dialog');
    for (let i = 1; i < STEPS.length; i++) await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.queryByRole('button', { name: 'Saltar' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Empezar/ }));
    expect(getCookie(ONBOARDING_COOKIE)).toBe('1');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('al saltar se guarda la cookie', async () => {
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }));
    expect(getCookie(ONBOARDING_COOKIE)).toBe('1');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('al cerrar con la X o con Escape también se guarda la cookie', async () => {
    const first = view();
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar tutorial' }));
    expect(getCookie(ONBOARDING_COOKIE)).toBe('1');
    first.unmount();

    deleteCookie(ONBOARDING_COOKIE);
    view();
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(getCookie(ONBOARDING_COOKIE)).toBe('1'));
  });

  it('la cookie dura un año y no expone datos personales', async () => {
    view();
    await userEvent.click(await screen.findByRole('button', { name: 'Saltar' }));
    expect(document.cookie).toContain(`${ONBOARDING_COOKIE}=1`);
    expect(document.cookie).not.toMatch(/@|token/i);
  });

  it('se puede volver a abrir desde el botón "Ver tutorial" empezando por el primer paso', async () => {
    view();
    await userEvent.click(await screen.findByRole('tab', { name: /Ir al paso 3/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar tutorial' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Ver tutorial' }));
    expect(await screen.findByRole('heading', { name: 'Bienvenida a Hilanzapp' })).toBeInTheDocument();
  });
});
