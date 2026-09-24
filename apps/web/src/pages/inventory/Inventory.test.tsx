import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { formatMoney, formatQty } from '../../lib/format';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { Inventory } from './Inventory';

const groups = [{ id: 'g1', name: 'Ágata', created_at: '', dancerCount: 4, complete: 4, partial: 0, none: 0 }, { id: 'g2', name: 'Jade', created_at: '', dancerCount: 2, complete: 2, partial: 0, none: 0 }];
const materials = [
  { id: 'm1', name: 'Lycra negra', description: 'Ancho 1,5 m', unit: 'm', unitCost: 1000, stockQty: 10 },
  { id: 'm2', name: 'Tul ilusión', description: null, unit: 'm', unitCost: 500, stockQty: 1.5 },
];
const designs = [{ id: 'ds1', name: 'Aurora', images: [], garments: [{ id: 'gm1', moldTypeId: 'p', moldKey: 'pantalon', moldName: 'Pantalón', laborCost: 1000 }] }];
const costs = (over = {}) => ({
  dancerCount: 4, totalUnits: 4, unassignedUnits: 0, materialsCost: 5100, laborCost: 4000, totalCost: 9100, costPerDancer: 2275, shortages: [{ materialId: 'm2', name: 'Tul ilusión', unit: 'm', shortfall: 0.5 }],
  materials: [
    { materialId: 'm1', name: 'Lycra negra', description: 'Ancho 1,5 m', unit: 'm', unitCost: 1000, stock: 10, need: 4.1, remaining: 5.9, shortfall: 0, cost: 4100 },
    { materialId: 'm2', name: 'Tul ilusión', description: null, unit: 'm', unitCost: 500, stock: 1.5, need: 2, remaining: -0.5, shortfall: 0.5, cost: 1000 },
  ],
  perGarment: [], consumption: [{ materialId: 'm1', name: 'Lycra negra', unit: 'm', byGarment: [{ designName: 'Aurora', moldName: 'Pantalón', sizes: [{ label: '40', quantity: 0.8 }, { label: '44', quantity: 1 }, { label: '48', quantity: 1.3 }] }] }],
  ...over,
});
const stats = { groups: 2, dancers: 6, totalCost: 9100, dancersBySize: [{ label: '42', count: 6 }], garmentsBySize: [{ moldName: 'Pantalón', total: 4, sizes: [{ label: '40', count: 1 }, { label: '44', count: 3 }] }], costByGroup: [{ groupId: 'g1', name: 'Ágata', dancers: 4, units: 4, materialsCost: 5100, laborCost: 4000, totalCost: 9100 }, { groupId: 'g2', name: 'Jade', dancers: 2, units: 0, materialsCost: 0, laborCost: 0, totalCost: 0 }] };

function setup(over: { materials?: unknown[]; costs?: unknown } = {}) {
  api.get.mockImplementation(async (p: string) => {
    if (p === '/groups') return groups;
    if (p === '/materials') return over.materials ?? materials;
    if (p === '/designs') return designs;
    if (p.startsWith('/groups/') && p.includes('/costs')) return over.costs ?? costs();
    if (p === '/stats') return stats;
    if (p.startsWith('/materials/') && p.endsWith('/movements')) return [{ id: 'mv1', delta: 10, reason: 'manual', note: 'Stock inicial', groupId: null, designId: null, createdAt: '2026-09-01T10:00:00Z' }, { id: 'mv2', delta: -4.1, reason: 'production', note: null, groupId: 'g1', designId: null, createdAt: '2026-09-10T10:00:00Z' }];
    if (p.startsWith('/consumption-rules')) return [{ id: 'r1', designGarmentId: 'gm1', designId: 'ds1', designName: 'Aurora', moldTypeId: 'p', moldName: 'Pantalón', materialId: 'm1', sizeLabel: null, quantity: 1 }, { id: 'r2', designGarmentId: 'gm1', designId: 'ds1', designName: 'Aurora', moldTypeId: 'p', moldName: 'Pantalón', materialId: 'm1', sizeLabel: '48', quantity: 1.3 }];
    throw new Error(`GET inesperado ${p}`);
  });
  return renderApp(<Inventory />, { route: '/inventario', path: '/inventario' });
}
const table = () => screen.findByRole('table', { name: 'Materiales' });

describe('formatos', () => {
  it('moneda en pesos con punto de miles y cantidades con coma', () => {
    const flat = (v: string) => v.replace(/\s/g, ' ');
    expect(flat(formatMoney(312480))).toBe('$ 312.480');
    expect(flat(formatMoney(2275.4))).toBe('$ 2.275');
    expect(formatMoney(1000)).toContain('\u00a0');
    expect(formatQty(4.1)).toBe('4,1');
    expect(formatQty(0.30000000000000004)).toBe('0,3');
  });
});

describe('Inventario y costos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra materiales con costo, stock, lo que necesita el grupo y lo que queda', async () => {
    setup();
    const t = await table();
    const lycra = within(t).getByText('Lycra negra').closest('[role=row]') as HTMLElement;
    expect(lycra).toHaveTextContent('$ 1.000/m');
    expect(lycra).toHaveTextContent('10 m');
    expect(lycra).toHaveTextContent('4,1 m');
    expect(lycra).toHaveTextContent('5,9 m');
    expect(lycra).not.toHaveClass('low');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/costs');
  });

  it('resalta los faltantes en la fila y los lista con la cantidad que falta', async () => {
    setup();
    const t = await table();
    const tul = within(t).getByText('Tul ilusión').closest('[role=row]') as HTMLElement;
    expect(tul).toHaveClass('low');
    expect(within(tul).getByLabelText('Falta stock')).toBeInTheDocument();
    expect(tul).toHaveTextContent('−0,5 m');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Faltan materiales para esta producción');
    expect(alert).toHaveTextContent('Tul ilusión: faltan 0,5 m');
  });

  it('resume el costo del grupo: materiales, mano de obra, total y por bailarina', async () => {
    setup();
    const card = await screen.findByLabelText('Costo de la producción');
    expect(card).toHaveTextContent('Costo de materiales · Ágata');
    expect(card).toHaveTextContent('$ 5.100');
    expect(card).toHaveTextContent('≈ $ 1.275 por bailarina · 4 prendas');
    expect(card).toHaveTextContent('Mano de obra$ 4.000');
    expect(card).toHaveTextContent('Total$ 9.100');
    const bars = screen.getByLabelText('Costo por material');
    expect(bars).toHaveTextContent('Lycra negra$ 4.100');
    expect(bars).toHaveTextContent('Tul ilusión$ 1.000');
  });

  it('muestra el consumo por talle del material que más se necesita', async () => {
    setup();
    const card = await screen.findByLabelText('Consumo por talle');
    expect(card).toHaveTextContent('Lycra negra por talle');
    expect(card).toHaveTextContent('T400,8 m');
    expect(card).toHaveTextContent('T481,3 m');
  });

  it('cambiar de grupo y de diseño recalcula', async () => {
    setup();
    await table();
    await userEvent.selectOptions(screen.getByLabelText('Calcular para'), 'g2');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/groups/g2/costs'));
    await userEvent.selectOptions(screen.getByLabelText('Diseño'), 'ds1');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/groups/g2/costs?design_id=ds1'));
  });

  it('avisa cuando hay prendas sin diseño que no entran en el cálculo', async () => {
    setup({ costs: costs({ unassignedUnits: 3 }) });
    expect(await screen.findByText(/3 prendas no tienen un diseño asignado y no entran en el cálculo/)).toBeInTheDocument();
  });

  it('el resumen general muestra bailarinas por talle, prendas por talle y costo por grupo', async () => {
    setup();
    const overview = await screen.findByLabelText('Resumen general');
    expect(overview).toHaveTextContent('T426');
    expect(overview).toHaveTextContent('Pantalón');
    expect(overview).toHaveTextContent('T443');
    expect(overview).toHaveTextContent('Ágata$ 9.100');
    expect(overview).toHaveTextContent('Total$ 9.100');
  });

  describe('materiales', () => {
    it('crea un material validando los datos', async () => {
      api.post.mockResolvedValue({});
      setup();
      await userEvent.click(await screen.findByRole('button', { name: /^Material$/ }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      expect(await within(dialog).findByText('El nombre es obligatorio.')).toBeInTheDocument();
      await userEvent.type(within(dialog).getByLabelText('Nombre'), 'Lentejuela');
      await userEvent.type(within(dialog).getByLabelText(/Costo por unidad/), 'caro');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      expect(await within(dialog).findByText(/Ingresá un monto/)).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
      await userEvent.clear(within(dialog).getByLabelText(/Costo por unidad/));
      await userEvent.type(within(dialog).getByLabelText(/Costo por unidad/), '200,5');
      await userEvent.type(within(dialog).getByLabelText('Stock inicial'), '40');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/materials', { name: 'Lentejuela', description: null, unit: 'm', unitCost: 200.5, stockQty: 40 }));
    });

    it('edita un material sin tocar el stock', async () => {
      api.patch.mockResolvedValue({});
      setup();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar Lycra negra' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Lycra negra');
      expect(within(dialog).queryByLabelText('Stock inicial')).not.toBeInTheDocument();
      await userEvent.clear(within(dialog).getByLabelText(/Costo por unidad/));
      await userEvent.type(within(dialog).getByLabelText(/Costo por unidad/), '1200');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/materials/m1', expect.objectContaining({ unitCost: 1200 })));
    });

    it('registra un egreso de stock y muestra los últimos movimientos', async () => {
      api.post.mockResolvedValue({});
      setup();
      await userEvent.click(await screen.findByRole('button', { name: 'Stock de Lycra negra' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Hay 10 m en stock');
      expect(await within(dialog).findByText(/Stock inicial/)).toBeInTheDocument();
      expect(dialog).toHaveTextContent('−4,1');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Egreso' }));
      await userEvent.type(within(dialog).getByLabelText(/Cantidad/), '2,5');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar movimiento' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/materials/m1/stock', { delta: -2.5, note: null }));
    });

    it('rechaza cantidades inválidas y muestra el error de stock insuficiente', async () => {
      api.post.mockRejectedValue(new ApiError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente de Lycra negra'));
      setup();
      await userEvent.click(await screen.findByRole('button', { name: 'Stock de Lycra negra' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Cantidad/), '0');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar movimiento' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ingresá una cantidad mayor a cero');
      expect(api.post).not.toHaveBeenCalled();
      await userEvent.clear(within(dialog).getByLabelText(/Cantidad/));
      await userEvent.type(within(dialog).getByLabelText(/Cantidad/), '99');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Egreso' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar movimiento' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Stock insuficiente de Lycra negra');
    });

    it('eliminar pide confirmación y, si tiene consumos, los elimina con confirm=true', async () => {
      api.delete.mockRejectedValueOnce(new ApiError(409, 'HAS_DEPENDENTS', 'Se usa en reglas')).mockResolvedValueOnce(undefined);
      setup();
      await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Lycra negra' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar material' }));
      await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/materials/m1?confirm=true'));
      expect(api.delete).toHaveBeenCalledWith('/materials/m1');
    });

    it('sin materiales muestra el estado vacío', async () => {
      setup({ materials: [], costs: costs({ materials: [], shortages: [], consumption: [] }) });
      expect(await screen.findByText('Todavía no cargaste materiales')).toBeInTheDocument();
    });
  });

  describe('consumo por prenda y talle', () => {
    it('carga las reglas actuales y las guarda reemplazando', async () => {
      api.put.mockResolvedValue({});
      setup();
      await userEvent.click(await screen.findByRole('button', { name: /Consumo/ }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.selectOptions(within(dialog).getByLabelText('Diseño'), 'ds1');
      await userEvent.selectOptions(within(dialog).getByLabelText('Material'), 'm1');
      await waitFor(() => expect(within(dialog).getByLabelText('Cantidad de la fila 1')).toHaveValue('1'));
      expect(within(dialog).getByLabelText('Talle de la fila 2')).toHaveValue('48');
      expect(within(dialog).getByLabelText('Cantidad de la fila 2')).toHaveValue('1,3');
      await userEvent.click(within(dialog).getByRole('button', { name: /Agregar talle/ }));
      await userEvent.type(within(dialog).getByLabelText('Talle de la fila 3'), '40');
      await userEvent.type(within(dialog).getByLabelText('Cantidad de la fila 3'), '0,8');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar consumo' }));
      await waitFor(() => expect(api.put).toHaveBeenCalledWith('/consumption-rules', {
        designGarmentId: 'gm1', materialId: 'm1', rules: [{ sizeLabel: null, quantity: 1 }, { sizeLabel: '48', quantity: 1.3 }, { sizeLabel: '40', quantity: 0.8 }],
      }));
    });

    it('valida cantidades y talles repetidos', async () => {
      setup();
      await userEvent.click(await screen.findByRole('button', { name: /Consumo/ }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.selectOptions(within(dialog).getByLabelText('Diseño'), 'ds1');
      await userEvent.selectOptions(within(dialog).getByLabelText('Material'), 'm2');
      await userEvent.type(await within(dialog).findByLabelText('Cantidad de la fila 1'), 'mucho');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar consumo' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cada consumo necesita una cantidad mayor a cero');
      expect(api.put).not.toHaveBeenCalled();
      await userEvent.clear(within(dialog).getByLabelText('Cantidad de la fila 1'));
      await userEvent.type(within(dialog).getByLabelText('Cantidad de la fila 1'), '1');
      await userEvent.click(within(dialog).getByRole('button', { name: /Agregar talle/ }));
      await userEvent.type(within(dialog).getByLabelText('Cantidad de la fila 2'), '2');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar consumo' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Hay talles repetidos');
    });
  });

  describe('confirmar producción', () => {
    it('descuenta el stock y avisa qué se descontó', async () => {
      api.post.mockResolvedValue({ deducted: true, items: 2 });
      setup({ costs: costs({ shortages: [] }) });
      await userEvent.click(await screen.findByRole('button', { name: /Confirmar producción/ }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Vas a producir 4 prendas de Ágata');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar y descontar' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/groups/g1/production/confirm', { designId: null, deductStock: true }));
      expect(await screen.findByText(/se descontaron 2 materiales del stock/)).toBeInTheDocument();
    });

    it('advierte si falta stock y muestra el error de la API sin cerrar', async () => {
      api.post.mockRejectedValue(new ApiError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente de Tul ilusión'));
      setup();
      await userEvent.click(await screen.findByRole('button', { name: /Confirmar producción/ }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Falta stock de Tul ilusión');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar y descontar' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Stock insuficiente de Tul ilusión');
    });

    it('se puede confirmar sin descontar', async () => {
      api.post.mockResolvedValue({ deducted: false, items: 0 });
      setup();
      await userEvent.click(await screen.findByRole('button', { name: /Confirmar producción/ }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('checkbox', { name: /Descontar los materiales/ }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/groups/g1/production/confirm', { designId: null, deductStock: false }));
    });

    it('sin prendas para producir el botón está deshabilitado', async () => {
      setup({ costs: costs({ totalUnits: 0, shortages: [] }) });
      await table();
      expect(screen.getByRole('button', { name: /Confirmar producción/ })).toBeDisabled();
    });
  });
});
