import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadingScreen, SEWING_MESSAGES, SlowLoadingHint } from './LoadingMessage';

describe('LoadingMessage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('la pantalla de carga muestra una frase de taller y la rota', () => {
    render(<LoadingScreen />);
    expect(screen.getByRole('status')).toHaveTextContent(SEWING_MESSAGES[0]!);
    act(() => void vi.advanceTimersByTime(2700));
    expect(screen.getByRole('status')).toHaveTextContent(SEWING_MESSAGES[1]!);
  });

  it('el aviso de carga lenta aparece recién pasados unos segundos', () => {
    render(<SlowLoadingHint />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => void vi.advanceTimersByTime(2600));
    expect(screen.getByRole('status')).toHaveTextContent('puede tardar un poco');
  });
});
