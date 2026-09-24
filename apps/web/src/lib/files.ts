export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: { name: string; type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: formato no permitido. Usá JPG, PNG o WebP.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: supera el máximo de 5 MB.`;
  if (file.size === 0) return `${file.name}: el archivo está vacío.`;
  return null;
}

export function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Abre un PDF en una pestaña nueva; si el navegador lo bloquea, lo descarga. */
export function openPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
