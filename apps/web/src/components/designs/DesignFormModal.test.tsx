import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));

import { DesignFormModal } from './DesignFormModal';

const catalog = [
  { id: 'n1', category: 'neckline', label: 'Corazón', isCustom: false }, { id: 'n2', category: 'neckline', label: 'Halter', isCustom: false },
  { id: 's1', category: 'sleeve', label: 'Corta', isCustom: false }, { id: 'k1', category: 'skirt', label: 'Campana', isCustom: false },
  { id: 'k2', category: 'skirt', label: 'Falda con godets', isCustom: true },
];
const molds = [{ id: 'm1', key: 'pantalon', name: 'Pantalón', inputs: [] }, { id: 'm2', key: 'vestido', name: 'Vestido', inputs: [] }];
const defs = [{ id: 'd1', key: 'brazo', name: 'Contorno de brazo', kind: 'body', isBase: true, required: false }, { id: 'd2', key: 'altura_tiro', name: 'Altura de tiro', kind: 'standard', isBase: false, required: false },
  { id: 'd3', key: 'muneca', name: 'Contorno de muñeca', kind: 'body', isBase: false, required: false }];

const design = {
  id: 'ds1', name: 'Aurora', notes: 'Hombro descubierto', constructionDetails: 'Cierre invisible', neckline: { id: 'n1', label: 'Corazón', isCustom: false }, sleeve: null, skirt: { id: 'k1', label: 'Campana', isCustom: false },
  hasRuffle: true, isAsymmetric: false, createdAt: '', images: [],
  garments: [{ id: 'g1', moldTypeId: 'm2', moldKey: 'vestido', moldName: 'Vestido', laborCost: 15000 }], specialMeasures: [{ definitionId: 'd1', key: 'brazo', name: 'Contorno de brazo' }],
};

function setup(props: { design?: typeof design } = {}) {
  const onSaved = vi.fn(); const onClose = vi.fn();
  renderApp(<DesignFormModal show design={props.design as never} onClose={onClose} onSaved={onSaved} />);
  return { onSaved, onClose };
}

describe('Formulario de diseño', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (p: string) => (p === '/catalog-options' ? catalog : p === '/mold-types' ? molds : p === '/measure-definitions' ? defs : []));
  });

  it('ofrece los catálogos, las prendas y solo las medidas corporales', async () => {
    setup();
    const neck = await screen.findByLabelText('Escote');
    await waitFor(() => expect(neck).toHaveTextContent('Corazón'));
    expect(neck).toHaveTextContent('Otro…');
    expect(screen.getByLabelText('Falda')).toHaveTextContent('Falda con godets (propio)');
    expect(await screen.findByRole('checkbox', { name: 'Pantalón' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Contorno de brazo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Largo hombro a rodilla' })).not.toBeInTheDocument();
  });

  it('exige el nombre antes de guardar', async () => {
    setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByText('El nombre del diseño es obligatorio.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('"Otro" pide el valor, lo guarda en el catálogo y lo usa en el diseño', async () => {
    api.post.mockImplementation(async (p: string) => (p === '/catalog-options' ? { id: 'nuevo', label: 'Barco' } : { ...design, id: 'ds9' }));
    const { onSaved } = setup();
    await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'Nuevo');
    await userEvent.selectOptions(screen.getByLabelText('Escote'), '__other__');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByText('Escribí cuál es el escote.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Otro escote'), 'Barco');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/catalog-options', { category: 'neckline', label: 'Barco' }));
    expect(api.post).toHaveBeenCalledWith('/designs', expect.objectContaining({ name: 'Nuevo', necklineId: 'nuevo', sleeveId: null, skirtId: null, garments: [], specialMeasureIds: [] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('ds9'));
  });

  it('valida el monto de mano de obra y envía prendas y medidas especiales', async () => {
    api.post.mockResolvedValue({ id: 'ds9' });
    setup();
    await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'Con prendas');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Vestido' }));
    await userEvent.type(screen.getByLabelText('Mano de obra de Vestido'), 'mucho');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByText(/Ingresá un monto/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Mano de obra de Vestido'));
    await userEvent.type(screen.getByLabelText('Mano de obra de Vestido'), '15000,5');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pantalón' }));
    await userEvent.click(screen.getByRole('button', { name: 'Contorno de brazo' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Tiene volado/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/designs', expect.objectContaining({
      hasRuffle: true, isAsymmetric: false, specialMeasureIds: ['d1'],
      garments: expect.arrayContaining([{ moldTypeId: 'm2', laborCost: 15000.5 }, { moldTypeId: 'm1', laborCost: null }]),
    })));
  });

  it('al editar carga los datos actuales y guarda con PATCH', async () => {
    api.patch.mockResolvedValue({ id: 'ds1' });
    setup({ design });
    expect(await screen.findByDisplayValue('Aurora')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Escote')).toHaveValue('n1'));
    expect(screen.getByRole('checkbox', { name: /Tiene volado/ })).toBeChecked();
    expect(await screen.findByRole('checkbox', { name: 'Vestido' })).toBeChecked();
    expect(screen.getByLabelText('Mano de obra de Vestido')).toHaveValue('15000');
    expect(await screen.findByRole('button', { name: 'Contorno de brazo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.clear(screen.getByLabelText('Nombre del diseño'));
    await userEvent.type(screen.getByLabelText('Nombre del diseño'), 'Aurora II');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/designs/ds1', expect.objectContaining({ name: 'Aurora II', necklineId: 'n1', hasRuffle: true })));
  });

  it('muestra el error de la API', async () => {
    const { ApiError } = await import('../../lib/api');
    api.post.mockRejectedValue(new ApiError(409, 'INVALID_REFERENCE', 'Una de las prendas ya no existe'));
    setup();
    await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Una de las prendas ya no existe');
  });

  it('busca medidas especiales sin importar tildes ni mayúsculas y conserva las elegidas', async () => {
    setup();
    const search = await screen.findByLabelText('Buscar medida especial');
    await userEvent.click(await screen.findByRole('button', { name: 'Contorno de brazo' }));
    await userEvent.type(search, 'MUNECA');
    expect(screen.getByRole('button', { name: 'Contorno de muñeca' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Contorno de brazo' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.clear(search);
    await userEvent.type(search, 'zzz');
    expect(screen.getByText(/Ninguna medida coincide con “zzz”/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Contorno de muñeca' })).not.toBeInTheDocument();
  });

  describe('prendas sin molde', () => {
    const modal = () => within(screen.getByRole('heading', { name: 'Prenda sin molde' }).closest('form')!);
    const openModal = async () => {
      await userEvent.click(await screen.findByRole('button', { name: /Prenda sin molde/ }));
      return screen.findByRole('heading', { name: 'Prenda sin molde' });
    };

    it('crea una prenda sin molde con categoría, talle según y medidas en orden, y la envía al guardar', async () => {
      api.post.mockResolvedValue({ ...design, id: 'ds9' });
      setup();
      await userEvent.type(await screen.findByLabelText('Nombre del diseño'), 'Jardín');
      await openModal();
      await userEvent.type(screen.getByLabelText('Nombre'), 'Vestido evasé');
      await userEvent.click(screen.getByRole('button', { name: 'Falda' }));
      expect(screen.getByRole('button', { name: 'Cadera' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText(/Todavía no elegiste medidas/)).toBeInTheDocument();
      await userEvent.type(screen.getAllByLabelText('Buscar medida').at(-1)!, 'MUNECA');
      await userEvent.click(modal().getByRole('button', { name: /Contorno de muñeca/ }));
      expect(screen.getByText(/· 1 elegida/)).toBeInTheDocument();
      await userEvent.clear(screen.getAllByLabelText('Buscar medida').at(-1)!);
      await userEvent.click(modal().getByRole('button', { name: /Contorno de brazo/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Guardar prenda' }));

      const row = await screen.findByTestId('custom-garment');
      expect(row).toHaveTextContent('Vestido evasé');
      expect(row).toHaveTextContent('SIN MOLDE');
      expect(row).toHaveTextContent('Talle según cadera · 2 medidas');
      await userEvent.type(screen.getByLabelText('Mano de obra de Vestido evasé'), '14000');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/designs', expect.objectContaining({
        garments: [{ laborCost: 14000, custom: { name: 'Vestido evasé', category: 'falda', sizePriority: 'cadera', measureIds: expect.arrayContaining(['d1', 'd3']) } }],
      })));
    });

    it('permite reordenar y quitar medidas elegidas', async () => {
      setup();
      await openModal();
      await userEvent.click(modal().getByRole('button', { name: /Contorno de brazo/ }));
      await userEvent.click(modal().getByRole('button', { name: /Contorno de muñeca/ }));
      const list = screen.getByRole('list', { name: 'Medidas elegidas, en orden' });
      expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('brazo'), expect.stringContaining('muñeca')]));
      const before = within(list).getAllByRole('listitem')[0]!.textContent;
      await userEvent.click(within(list).getAllByRole('button', { name: /Bajar/ })[0]!);
      expect(within(list).getAllByRole('listitem')[0]!.textContent).not.toBe(before);
      await userEvent.click(within(list).getAllByRole('button', { name: /Quitar/ })[0]!);
      expect(screen.getByText(/· 1 elegida/)).toBeInTheDocument();
    });

    it('cada medida elegida tiene un asa de arrastre accesible por teclado', async () => {
      setup();
      await openModal();
      await userEvent.click(modal().getByRole('button', { name: /Contorno de brazo/ }));
      const list = screen.getByRole('list', { name: 'Medidas elegidas, en orden' });
      const handle = within(list).getByRole('button', { name: /Reordenar.*brazo/ });
      expect(handle).toHaveAttribute('tabIndex', '0');
      handle.focus();
      expect(handle).toHaveFocus();
    });

    it('subir/bajar con los botones anuncia la nueva posición para lectores de pantalla', async () => {
      setup();
      await openModal();
      await userEvent.click(modal().getByRole('button', { name: /Contorno de brazo/ }));
      await userEvent.click(modal().getByRole('button', { name: /Contorno de muñeca/ }));
      const list = screen.getByRole('list', { name: 'Medidas elegidas, en orden' });
      await userEvent.click(within(list).getAllByRole('button', { name: /Bajar/ })[0]!);
      expect(screen.getByText(/Contorno de brazo: posición 2 de 2\./)).toBeInTheDocument();
    });

    it('rechaza un nombre vacío o repetido en el diseño', async () => {
      setup();
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Pantalón' }));
      await openModal();
      await userEvent.click(screen.getByRole('button', { name: 'Guardar prenda' }));
      expect(await screen.findByText('Poné un nombre para la prenda.')).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Nombre'), 'pantalón');
      expect(await screen.findByText('Ya hay una prenda “pantalón” en este diseño. Elegí otro nombre.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Guardar prenda' }));
      expect(screen.queryByTestId('custom-garment')).not.toBeInTheDocument();
    });

    it('al editar un diseño muestra la prenda sin molde y avisa cuántas asignaciones se pierden al quitarla', async () => {
      api.patch.mockResolvedValue({ ...design });
      const withPlaceholder = {
        ...design,
        garments: [...design.garments, { id: 'g9', moldTypeId: 'p1', moldKey: 'propia_evase', moldName: 'Vestido evasé', laborCost: 14000, hasPattern: false, category: 'vestido', sizePriority: 'cadera', assignedCount: 12, requiredMeasures: [{ definitionId: 'd1', key: 'brazo', name: 'Contorno de brazo' }] }],
      };
      setup({ design: withPlaceholder as never });
      const row = await screen.findByTestId('custom-garment');
      expect(row).toHaveTextContent('Vestido evasé');
      expect(row).toHaveTextContent('Talle según cadera · 1 medida');
      expect(screen.getByLabelText('Mano de obra de Vestido evasé')).toHaveValue('14000');
      await userEvent.click(within(row).getByRole('button', { name: /Quitar/ }));
      expect(await screen.findByText('¿Quitar Vestido evasé del diseño?')).toBeInTheDocument();
      expect(screen.getByText(/Se pierden 12 asignaciones/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Quitar prenda' }));
      expect(screen.queryByTestId('custom-garment')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Guardar diseño' }));
      await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/designs/ds1', expect.objectContaining({ garments: [{ moldTypeId: 'm2', laborCost: 15000 }] })));
    });

    it('vincular una prenda sin molde no cierra el formulario, y la pasa a la lista de prendas con molde', async () => {
      const withPlaceholder = {
        ...design,
        garments: [...design.garments, { id: 'g9', moldTypeId: 'p1', moldKey: 'propia_evase', moldName: 'Vestido evasé', laborCost: 14000, hasPattern: false, category: 'vestido', sizePriority: 'cadera', assignedCount: 12, requiredMeasures: [{ definitionId: 'd1', key: 'brazo', name: 'Contorno de brazo' }] }],
      };
      const withLink = [
        { id: 'm2', key: 'vestido', name: 'Vestido', inputs: [] },
        { id: 'p1', key: 'propia_evase', name: 'Vestido evasé', hasPattern: false, inputs: [] },
        { id: 'm3', key: 'vestido_a', name: 'Vestido línea A', hasPattern: true, inputs: [], formulas: [{ key: 'f1', label: 'f1' }] },
      ];
      api.get.mockImplementation(async (p: string) => {
        if (p === '/catalog-options') return catalog;
        if (p === '/mold-types') return withLink;
        if (p === '/measure-definitions') return defs;
        if (p.startsWith('/mold-types/p1/link-preview')) return { newMeasures: [], assignments: 12, garments: 1, dancersMissing: 0, dancerNames: [] };
        return [];
      });
      api.post.mockImplementation(async (p: string) => (p === '/mold-types/p1/link' ? {} : {}));
      const { onClose } = setup({ design: withPlaceholder as never });

      const row = await screen.findByTestId('custom-garment');
      await userEvent.click(within(row).getByRole('button', { name: 'Vincular a molde' }));
      const linkModal = await screen.findByRole('heading', { name: /Vincular “Vestido evasé”/ });
      await userEvent.click(screen.getByRole('radio', { name: /Vestido línea A/ }));
      await screen.findByText(/Se conservan 12 asignaciones/);
      await userEvent.click(screen.getByLabelText('Entiendo que no se puede deshacer'));
      await userEvent.click(screen.getByRole('button', { name: 'Vincular' }));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/mold-types/p1/link', { targetMoldTypeId: 'm3' }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: /Vincular/ })).not.toBeInTheDocument();
      expect(screen.queryByTestId('custom-garment')).not.toBeInTheDocument();
      expect(await screen.findByLabelText('Mano de obra de Vestido línea A')).toHaveValue('14000');
      void linkModal;
    });
  });
});
