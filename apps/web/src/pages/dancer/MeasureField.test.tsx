import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import type { MeasureItem } from '../../lib/types';
import { MeasureField } from './MeasureField';

const item = (over: Partial<MeasureItem> = {}): MeasureItem => ({ definitionId: 'd1', key: 'pecho', name: 'Contorno de pecho', isBase: true, required: true, valueCm: null, note: null, takenOn: null, versionId: null, ...over });

describe('MeasureField', () => {
  it('rechaza valores que no son números sin llamar a la API', async () => {
    const onSave = vi.fn();
    render(<MeasureField item={item()} onSave={onSave} />);
    const input = screen.getByLabelText(/Contorno de pecho/);
    await userEvent.type(input, 'ochenta');
    await userEvent.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá un número');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rechaza negativos', async () => {
    const onSave = vi.fn();
    render(<MeasureField item={item()} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Contorno de pecho/), '-5');
    await userEvent.tab();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('guarda un valor con coma decimal al salir del campo', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MeasureField item={item()} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Contorno de pecho/), '88,5');
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ key: 'pecho' }), 88.5);
  });

  it('con Enter guarda y no vuelve a guardar si no cambió', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<MeasureField item={item({ valueCm: 88 })} onSave={onSave} />);
    const input = screen.getByLabelText(/Contorno de pecho/);
    expect(input).toHaveValue('88');
    await userEvent.click(input);
    await userEvent.tab();
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.clear(input);
    await userEvent.type(input, '90{Enter}');
    expect(onSave).toHaveBeenCalledWith(expect.anything(), 90);
  });

  it('muestra el error que devuelve la API', async () => {
    const onSave = vi.fn().mockRejectedValue(new ApiError(422, 'VALIDATION_ERROR', 'El valor no puede ser negativo'));
    render(<MeasureField item={item()} onSave={onSave} />);
    await userEvent.type(screen.getByLabelText(/Contorno de pecho/), '5');
    await userEvent.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('El valor no puede ser negativo');
  });

  it('muestra la observación de una medida personalizada', () => {
    render(<MeasureField item={item({ valueCm: 52, note: 'con malla', required: false, name: 'Contorno de muslo' })} onSave={vi.fn()} />);
    expect(screen.getByText(/con malla/)).toBeInTheDocument();
  });
});
