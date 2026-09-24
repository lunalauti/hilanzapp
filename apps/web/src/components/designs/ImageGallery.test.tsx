import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../../lib/apiClient', () => ({ api }));
const storage = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ getSupabase: () => ({ storage: { from: () => ({ uploadToSignedUrl: storage.upload }) } }) }));

import type { Design } from '../../lib/types';
import { ImageGallery } from './ImageGallery';

const img = (n: number) => ({ id: `i${n}`, filename: `foto${n}.png`, mime: 'image/png', sizeBytes: 2048 * n, url: `https://files.test/${n}.png` });
const design = (images = [img(1), img(2), img(3)]): Design => ({
  id: 'ds1', name: 'Aurora', notes: null, constructionDetails: null, neckline: null, sleeve: null, skirt: null, hasRuffle: false, isAsymmetric: false, createdAt: '', garments: [], specialMeasures: [], images,
});
const file = (name: string, type: string, size = 1000) => { const f = new File(['x'.repeat(10)], name, { type }); Object.defineProperty(f, 'size', { value: size }); return f; };
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText('Elegir imágenes'), { target: { files } });

describe('Galería de imágenes', () => {
  beforeEach(() => { vi.clearAllMocks(); storage.upload.mockResolvedValue({ error: null }); });

  it('muestra la imagen principal y permite elegir otra miniatura', async () => {
    renderApp(<ImageGallery design={design()} />);
    expect(screen.getByRole('img', { name: 'foto1.png' })).toHaveAttribute('src', 'https://files.test/1.png');
    await userEvent.click(screen.getByRole('button', { name: 'Ver foto3.png' }));
    expect(screen.getByRole('img', { name: 'foto3.png' })).toBeInTheDocument();
  });

  it('sin imágenes muestra el estado vacío', () => {
    renderApp(<ImageGallery design={design([])} />);
    expect(screen.getByText('Todavía no hay imágenes de referencia')).toBeInTheDocument();
  });

  it('rechaza formatos y tamaños no permitidos sin llamar a la API', async () => {
    renderApp(<ImageGallery design={design([])} />);
    pick([file('boceto.gif', 'image/gif'), file('enorme.png', 'image/png', 6 * 1024 * 1024), file('vacio.png', 'image/png', 0)]);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('boceto.gif: formato no permitido');
    expect(alert).toHaveTextContent('enorme.png: supera el máximo de 5 MB');
    expect(alert).toHaveTextContent('vacio.png: el archivo está vacío');
    expect(api.post).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('sube: pide la URL firmada, sube el archivo y lo registra', async () => {
    api.post.mockImplementation(async (p: string) => (p.endsWith('upload-url') ? { path: 'u/ds1/x.png', token: 'tok' } : { id: 'nuevo' }));
    renderApp(<ImageGallery design={design([])} />);
    pick([file('boceto.png', 'image/png', 5000)]);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/designs/ds1/images', { path: 'u/ds1/x.png', filename: 'boceto.png' }));
    expect(api.post).toHaveBeenCalledWith('/designs/ds1/images/upload-url', { filename: 'boceto.png', mime: 'image/png', size: 5000 });
    expect(storage.upload).toHaveBeenCalledWith('u/ds1/x.png', 'tok', expect.any(File), { contentType: 'image/png' });
    expect(await screen.findByText('Imagen subida')).toBeInTheDocument();
  });

  it('sube las válidas aunque otras se rechacen y muestra el error de la API', async () => {
    const { ApiError } = await import('../../lib/api');
    api.post.mockImplementation(async (p: string, body: { filename?: string }) => {
      if (p.endsWith('upload-url') && body.filename === 'mala.png') throw new ApiError(413, 'IMAGE_REJECTED', 'La imagen supera el máximo de 5 MB');
      return p.endsWith('upload-url') ? { path: 'u/ds1/ok.png', token: 't' } : { id: 'x' };
    });
    renderApp(<ImageGallery design={design([])} />);
    pick([file('buena.png', 'image/png'), file('mala.png', 'image/png'), file('otra.gif', 'image/gif')]);
    expect(await screen.findByText('Imagen subida')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('mala.png: La imagen supera el máximo de 5 MB');
    expect(storage.upload).toHaveBeenCalledTimes(1);
  });

  it('muestra un error si Storage rechaza la subida', async () => {
    api.post.mockResolvedValue({ path: 'p', token: 't' });
    storage.upload.mockResolvedValue({ error: new Error('cuota excedida') });
    renderApp(<ImageGallery design={design([])} />);
    pick([file('a.png', 'image/png')]);
    expect(await screen.findByRole('alert')).toHaveTextContent('a.png: no se pudo subir.');
    expect(api.post).not.toHaveBeenCalledWith('/designs/ds1/images', expect.anything());
  });

  it('el visor amplía, navega entre imágenes y elimina', async () => {
    api.delete.mockResolvedValue(undefined);
    renderApp(<ImageGallery design={design()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ampliar foto1.png' }));
    expect(await screen.findByText(/foto1.png · 1 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Imagen anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Imagen siguiente' }));
    expect(screen.getByText(/foto2.png · 2 de 3/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar imagen' })).toHaveAttribute('href', 'https://files.test/2.png');
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar imagen' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/designs/ds1/images/i2'));
    expect(await screen.findByText('Imagen eliminada')).toBeInTheDocument();
  });
});
