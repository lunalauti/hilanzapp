import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatBytes, openPdf, validateImage } from './files';

const img = (name: string, type: string, size: number) => ({ name, type, size });

describe('validateImage', () => {
  it('acepta JPG, PNG y WebP de hasta 5 MB', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp']) expect(validateImage(img('a', t, 1000))).toBeNull();
    expect(validateImage(img('a.png', 'image/png', 5 * 1024 * 1024))).toBeNull();
  });
  it('rechaza otros formatos, archivos vacíos y demasiado grandes', () => {
    expect(validateImage(img('a.gif', 'image/gif', 10))).toMatch(/formato no permitido/);
    expect(validateImage(img('a.pdf', 'application/pdf', 10))).toMatch(/formato no permitido/);
    expect(validateImage(img('a.png', 'image/png', 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
    expect(validateImage(img('a.png', 'image/png', 0))).toMatch(/vacío/);
  });
});

describe('formatBytes', () => {
  it('usa KB o MB con coma', () => {
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });
});

describe('openPdf', () => {
  afterEach(() => vi.restoreAllMocks());

  it('abre el PDF en una pestaña nueva', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    openPdf(new Blob(['x']), 'a.pdf');
    expect(open).toHaveBeenCalledWith('blob:x', '_blank', 'noopener');
  });

  it('si el navegador bloquea la pestaña, descarga el archivo', () => {
    URL.createObjectURL = vi.fn(() => 'blob:y');
    vi.spyOn(window, 'open').mockReturnValue(null);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    openPdf(new Blob(['x']), 'hoja.pdf');
    expect(click).toHaveBeenCalled();
  });
});
