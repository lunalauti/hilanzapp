import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { FormulaEditor } from './FormulaEditor';

const inputs = [
  { key: 'pecho', label: 'Contorno de pecho', source: 'measure', measureKey: 'pecho' },
  { key: 'cintura', label: 'Contorno de cintura', source: 'measure', measureKey: 'cintura' },
];
const orig = { key: 'ancho_delantero', label: 'Ancho de delantero', operandA: 'pecho', op: 'div', operandB: '4' };
const cuerpo = () => ({
  id: 'm1', key: 'cuerpo_base', name: 'Cuerpo base', category: 'cuerpo', sizePriority: 'pecho', templateKey: 'cuerpo_base', inputs,
  formulas: [
    { ...orig, adjustmentCm: 0.5, original: orig },
    { key: 'ancho_cintura', label: 'Ancho de cintura', operandA: 'cintura', op: 'div', operandB: '4', adjustmentCm: 0, original: { key: 'ancho_cintura', label: 'Ancho de cintura', operandA: 'cintura', op: 'div', operandB: '4' } },
  ],
});
const propio = () => ({ id: 'm2', key: 'chaleco', name: 'Chaleco', category: 'otro', sizePriority: 'pecho', templateKey: null, inputs: [inputs[0]], formulas: [{ key: 'ancho', label: 'Ancho', operandA: 'pecho', op: 'direct', adjustmentCm: 0, original: null }] });

const calc = (rows: object[]) => ({ dancer: { id: 'd1', name: 'M', age: 1 }, mold: { id: 'm1', key: 'c', name: 'C', sizePriority: 'pecho' }, table: null, size: { label: null, origin: null, suggested: null }, inputs: [], manualInputs: {}, choices: {}, rows });

function setup(molds = [cuerpo(), propio()], route = '/formulas') {
  api.get.mockImplementation(async (p: string) => {
    if (p === '/mold-types') return molds;
    if (p === '/groups') return [{ id: 'g1', name: 'Ágata', created_at: '', dancerCount: 2, complete: 1, partial: 0, none: 1 }];
    if (p === '/groups/g1/dancers') return [{ id: 'd1', name: 'Martina López', age: 16, groupId: 'g1', measureStatus: 'complete', requiredDone: 1, requiredTotal: 1, size: {}, garments: [] }, { id: 'd2', name: 'Sofía Ferreyra', age: 16, groupId: 'g1', measureStatus: 'none', requiredDone: 0, requiredTotal: 1, size: {}, garments: [] }];
    if (p === '/measure-definitions') return [{ id: 'x1', key: 'pecho', name: 'Contorno de pecho', kind: 'body', isBase: true, required: true }, { id: 'x2', key: 'cintura', name: 'Contorno de cintura', kind: 'body', isBase: true, required: true }, { id: 'x3', key: 'brazo', name: 'Contorno de brazo', kind: 'body', isBase: true, required: false }, { id: 'x4', key: 'altura_tiro', name: 'Altura de tiro', kind: 'standard', isBase: false, required: false }];
    throw new Error(`GET inesperado ${p}`);
  });
  api.post.mockImplementation(async (p: string, body: { dancerId: string }) => {
    if (p === '/mold-preview') {
      if (body.dancerId === 'd2') throw new ApiError(422, 'MISSING_MEASUREMENTS', 'Faltan datos', { missing: [] });
      return calc([{ key: 'ancho_delantero', label: 'Ancho de delantero', section: null, realLabel: 'Contorno de pecho', realValue: 88, formula: '÷ 4 + 0,5', result: 22.5, display: '22,5' }]);
    }
    return { id: 'nuevo' };
  });
  return renderApp(<FormulaEditor />, { route, path: '/formulas' });
}

describe('Editor de fórmulas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista las fórmulas del molde con su texto y marca las modificadas', async () => {
    setup();
    const list = await screen.findByRole('complementary', { name: 'Fórmulas del molde' });
    const first = within(list).getByRole('button', { name: /Ancho de delantero/ });
    expect(first).toHaveTextContent('Contorno de pecho ÷ 4 + 0,5 cm');
    expect(within(first).getByLabelText('modificada')).toBeInTheDocument();
    expect(within(within(list).getByRole('button', { name: /Ancho de cintura/ })).queryByLabelText('modificada')).not.toBeInTheDocument();
  });

  it('cambiar operación, operando y ajuste actualiza el resumen y habilita Guardar', async () => {
    setup();
    await screen.findByLabelText('Editor de la fórmula');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toBeDisabled();
    expect(screen.getByText('Original: Contorno de pecho ÷ 4 + 0 cm')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Multiplicar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sumar 1 al operando' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restar 0,5 al ajuste' }));
    const summary = screen.getByLabelText('Editor de la fórmula').querySelector('.hz-formula-summary')!;
    expect(summary.textContent).toBe('Contorno de pecho × 5');
    expect(save).toBeEnabled();
  });

  it('guarda las fórmulas y los datos del molde', async () => {
    api.put.mockResolvedValue({});
    setup();
    await screen.findByLabelText('Editor de la fórmula');
    await userEvent.click(screen.getByRole('button', { name: 'Sumar 0,5 al ajuste' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/mold-types/m1/formulas', expect.objectContaining({
      inputs, formulas: expect.arrayContaining([expect.objectContaining({ key: 'ancho_delantero', op: 'div', operandB: '4', adjustmentCm: 1 })]),
    })));
    expect(await screen.findByText('Fórmulas guardadas')).toBeInTheDocument();
  });

  it('"Restaurar original" devuelve la fórmula a su versión de plantilla', async () => {
    setup();
    await screen.findByLabelText('Editor de la fórmula');
    await userEvent.click(screen.getByRole('button', { name: /Restaurar original/ }));
    const summary = screen.getByLabelText('Editor de la fórmula').querySelector('.hz-formula-summary')!;
    expect(summary.textContent).toBe('Contorno de pecho ÷ 4');
    expect(screen.queryByRole('button', { name: /Restaurar original/ })).not.toBeInTheDocument();
  });

  it('explica en castellano los errores de validación de la API', async () => {
    api.put.mockRejectedValue(new ApiError(422, 'FORMULA_INVALID', 'Las fórmulas tienen errores', {
      errors: [{ formulaKey: 'ancho_delantero', reason: 'DIVISION_BY_ZERO' }, { formulaKey: 'ancho_cintura', reason: 'UNKNOWN_REFERENCE', detail: 'nada' }], extra: ['La medida "x" no existe'],
    }));
    setup();
    await screen.findByLabelText('Editor de la fórmula');
    await userEvent.click(screen.getByRole('button', { name: 'Sumar 0,5 al ajuste' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Ancho de delantero: No se puede dividir por cero');
    expect(alert).toHaveTextContent('Ancho de cintura: Usa una medida o fórmula que no existe en este molde (nada)');
    expect(alert).toHaveTextContent('La medida "x" no existe');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('la vista previa muestra el resultado por bailarina y avisa cuando faltan medidas', async () => {
    setup();
    const preview = await screen.findByLabelText('Vista previa en vivo');
    await waitFor(() => expect(within(preview).getByText('22,5')).toBeInTheDocument());
    expect(within(preview).getByText('Martina López')).toBeInTheDocument();
    expect(await within(preview).findByText('Faltan medidas o datos de esta bailarina')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/mold-preview', expect.objectContaining({ dancerId: 'd1', moldTypeId: 'm1', definition: expect.objectContaining({ formulas: expect.any(Array) }) }));
  });

  it('un molde precargado se restaura; uno propio se elimina', async () => {
    api.post.mockResolvedValue({});
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Restaurar molde/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/mold-types/m1/restore-defaults'));
  });

  it('un molde propio permite eliminarlo con confirmación y no muestra "modificada"', async () => {
    api.delete.mockResolvedValue(undefined);
    setup([cuerpo(), propio()], '/formulas?mold=m2');
    const list = await screen.findByRole('complementary', { name: 'Fórmulas del molde' });
    expect(within(list).queryByLabelText('modificada')).not.toBeInTheDocument();
    expect(screen.getByText('Fórmula propia, sin versión original.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restaurar molde/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Eliminar molde/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar molde' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/mold-types/m2?confirm=true'));
  });

  it('duplicar crea un molde propio con las fórmulas actuales', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Duplicar molde/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Cuerpo base (copia)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/mold-types', expect.objectContaining({ name: 'Cuerpo base (copia)', sizePriority: 'pecho', inputs, formulas: expect.any(Array) })));
    const sent = api.post.mock.calls.find((c) => c[0] === '/mold-types')![1];
    expect(sent.formulas[0]).not.toHaveProperty('original');
  });

  it('agrega una fórmula nueva y permite quitarla', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /Agregar fórmula/ }));
    expect(screen.getByLabelText('Nombre de la pieza')).toHaveValue('Nueva fórmula');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Quitar fórmula' }));
    expect(screen.queryByRole('button', { name: /Nueva fórmula/ })).not.toBeInTheDocument();
  });

  it('agrega y quita datos que pide el molde', async () => {
    setup();
    const panel = await screen.findByLabelText('Datos que pide el molde');
    await userEvent.selectOptions(within(panel).getByLabelText('Medida a agregar'), 'brazo');
    await userEvent.click(within(panel).getByRole('button', { name: /^Medida$/ }));
    expect(within(panel).getByText('Contorno de brazo')).toBeInTheDocument();
    await userEvent.type(within(panel).getByLabelText('Nombre del dato manual'), 'Sisa dibujada');
    await userEvent.click(within(panel).getByRole('button', { name: /Dato manual/ }));
    expect(within(panel).getByText('Sisa dibujada')).toBeInTheDocument();
    expect(within(panel).getByText('· dato manual')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Quitar Sisa dibujada' }));
    expect(within(panel).queryByText('Sisa dibujada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });
});
