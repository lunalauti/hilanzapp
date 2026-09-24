import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../../lib/api';
import { api } from '../../lib/apiClient';
import { formatBytes, validateImage } from '../../lib/files';
import { useInvalidateDesigns } from '../../lib/queries';
import { getSupabase } from '../../lib/supabase';
import type { Design, DesignImage } from '../../lib/types';
import { useToast } from '../ui/Toast';

const BUCKET = 'design-images';

export function ImageGallery({ design }: { design: Design }) {
  const images = design.images;
  const [current, setCurrent] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const invalidate = useInvalidateDesigns();
  const toast = useToast();

  useEffect(() => { if (current >= images.length) setCurrent(Math.max(0, images.length - 1)); }, [images.length, current]);

  const upload = useCallback(async (files: File[]) => {
    const problems: string[] = [];
    const valid = files.filter((f) => { const p = validateImage(f); if (p) problems.push(p); return !p; });
    setErrors(problems);
    if (!valid.length) return;
    const supabase = getSupabase();
    setUploading({ done: 0, total: valid.length });
    let ok = 0;
    for (const file of valid) {
      try {
        const ticket = await api.post<{ path: string; token: string }>(`/designs/${design.id}/images/upload-url`, { filename: file.name, mime: file.type, size: file.size });
        const { error } = await supabase!.storage.from(BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
        if (error) throw error;
        await api.post(`/designs/${design.id}/images`, { path: ticket.path, filename: file.name });
        ok++;
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof ApiError ? e.message : 'no se pudo subir.'}`);
      }
      setUploading((u) => (u ? { ...u, done: u.done + 1 } : u));
    }
    setErrors(problems);
    setUploading(null);
    if (ok) { invalidate(design.id); toast.show(ok === 1 ? 'Imagen subida' : `${ok} imágenes subidas`); }
  }, [design.id, invalidate, toast]);

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); void upload([...e.dataTransfer.files]); };

  async function remove(img: DesignImage) {
    try {
      await api.delete(`/designs/${design.id}/images/${img.id}`);
      invalidate(design.id);
      toast.show('Imagen eliminada');
      setViewer(null);
    } catch { setErrors(['No pudimos eliminar la imagen.']); }
  }

  const main = images[current];
  return (
    <div className="hz-card hz-panel" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} data-dragging={dragging}>
      <div className="hz-gallery-main">
        {main?.url ? (
          <button type="button" className="hz-gallery-open" onClick={() => setViewer(current)} aria-label={`Ampliar ${main.filename}`}>
            <img src={main.url} alt={main.filename} />
            <span className="hz-gallery-caption">{main.filename} · clic para ampliar</span>
            <span className="hz-gallery-expand"><i className="bi bi-arrows-angle-expand" /></span>
          </button>
        ) : (
          <div className="hz-gallery-empty"><i className="bi bi-image" /><span>{images.length ? 'No se pudo cargar la imagen' : 'Todavía no hay imágenes de referencia'}</span></div>
        )}
      </div>

      <div className="hz-gallery-thumbs">
        {images.map((img, i) => (
          <button key={img.id} type="button" className={`hz-thumb ${i === current ? 'active' : ''}`} onClick={() => setCurrent(i)} aria-label={`Ver ${img.filename}`} aria-pressed={i === current}>
            {img.url ? <img src={img.url} alt="" /> : <i className="bi bi-image" />}
          </button>
        ))}
        <button type="button" className="hz-thumb hz-thumb-add" onClick={() => input.current?.click()} disabled={uploading !== null}>
          <i className="bi bi-cloud-arrow-up" /><span>Subir</span>
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden aria-label="Elegir imágenes" onChange={(e) => { void upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </div>

      {uploading && (
        <div role="status" aria-live="polite">
          <div className="hz-progress"><i className="done" style={{ width: `${(uploading.done / uploading.total) * 100}%` }} /></div>
          <span className="small text-secondary">Subiendo {Math.min(uploading.done + 1, uploading.total)} de {uploading.total}…</span>
        </div>
      )}
      {errors.length > 0 && <div className="hz-notice danger" role="alert" style={{ flexDirection: 'column' }}>{errors.map((m) => <span key={m}><i className="bi bi-exclamation-circle" /> {m}</span>)}</div>}
      <span className="small text-secondary">Arrastrá imágenes acá o hacé clic en Subir. JPG, PNG o WebP, hasta 5 MB.</span>

      <Modal show={viewer !== null} onHide={() => setViewer(null)} fullscreen contentClassName="hz-lightbox">
        {viewer !== null && images[viewer] && (
          <div className="hz-lightbox-body">
            <div className="hz-lightbox-bar">
              <span>{design.name} · {images[viewer]!.filename} · {viewer + 1} de {images.length} · {formatBytes(images[viewer]!.sizeBytes)}</span>
              <span className="d-flex gap-1">
                {images[viewer]!.url && <a className="hz-icon-btn text-white" href={images[viewer]!.url!} download={images[viewer]!.filename} aria-label="Descargar imagen"><i className="bi bi-download" /></a>}
                <button type="button" className="hz-icon-btn text-white" aria-label="Eliminar imagen" onClick={() => void remove(images[viewer]!)}><i className="bi bi-trash3" /></button>
                <button type="button" className="hz-icon-btn text-white" aria-label="Cerrar" onClick={() => setViewer(null)}><i className="bi bi-x-lg" /></button>
              </span>
            </div>
            <div className="hz-lightbox-stage">
              <button type="button" className="hz-icon-btn text-white" aria-label="Imagen anterior" disabled={viewer === 0} onClick={() => setViewer(viewer - 1)}><i className="bi bi-chevron-left" /></button>
              {images[viewer]!.url && <img src={images[viewer]!.url!} alt={images[viewer]!.filename} />}
              <button type="button" className="hz-icon-btn text-white" aria-label="Imagen siguiente" disabled={viewer === images.length - 1} onClick={() => setViewer(viewer + 1)}><i className="bi bi-chevron-right" /></button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
