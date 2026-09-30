import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { ApiError } from '../lib/api';
import { api } from '../lib/apiClient';
import { useGroupCategories, useInvalidateGroupCategories } from '../lib/queries';
import { useToast } from './ui/Toast';

/** Administrar categorías de grupo: crear, renombrar, eliminar (los grupos quedan sin categoría, nunca se borran). */
export function GroupCategoryModal({ show, onClose }: { show: boolean; onClose: () => void }) {
  const categories = useGroupCategories();
  const invalidate = useInvalidateGroupCategories();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Poné un nombre para la categoría.');
    setBusy(true);
    setError(null);
    try {
      await api.post('/group-categories', { name: name.trim() });
      invalidate();
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos crear la categoría.');
    } finally {
      setBusy(false);
    }
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    setBusy(true);
    try {
      await api.patch(`/group-categories/${editing.id}`, { name: editing.name.trim() });
      invalidate();
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos renombrar la categoría.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/group-categories/${deleting.id}`);
      invalidate();
      toast.show(`Categoría ${deleting.name} eliminada. Los grupos quedaron sin categoría.`);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <Modal.Header closeButton><Modal.Title as="h2" className="h4">Categorías de grupo</Modal.Title></Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <span className="small text-secondary">Agrupá tus grupos por temporada o nivel. Si borrás una categoría, los grupos no se borran: quedan sin categoría.</span>

        {categories.data && categories.data.length > 0 && (
          <div className="hz-list">
            {categories.data.map((c) =>
              editing?.id === c.id ? (
                <form key={c.id} onSubmit={rename} className="hz-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  <input className="hz-input" value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} autoFocus aria-label={`Renombrar ${c.name}`} />
                  <button type="submit" className="hz-icon-btn" aria-label="Guardar" disabled={busy}><i className="bi bi-check-lg" /></button>
                  <button type="button" className="hz-icon-btn" aria-label="Cancelar edición" onClick={() => setEditing(null)}><i className="bi bi-x-lg" /></button>
                </form>
              ) : (
                <div key={c.id} className="hz-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                  <span className="who"><span>{c.name}</span></span>
                  <button type="button" className="hz-icon-btn" aria-label={`Renombrar ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}><i className="bi bi-pencil" /></button>
                  <button type="button" className="hz-icon-btn danger" aria-label={`Eliminar ${c.name}`} onClick={() => setDeleting({ id: c.id, name: c.name })}><i className="bi bi-trash3" /></button>
                </div>
              ),
            )}
          </div>
        )}
        {categories.data && categories.data.length === 0 && <span className="text-secondary small">Todavía no creaste ninguna categoría.</span>}

        <form onSubmit={create} className="d-flex flex-column gap-1">
          <label htmlFor="cat-name" className="hz-label">Nueva categoría</label>
          <div className="d-flex gap-2">
            <input id="cat-name" className={`hz-input ${error ? 'is-invalid' : ''}`} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="Temporada 2026" aria-invalid={Boolean(error)} />
            <button type="submit" className="hz-btn primary" disabled={busy}><i className="bi bi-plus-lg" />Crear</button>
          </div>
          {error && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{error}</span>}
        </form>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="hz-btn primary" onClick={onClose}>Listo</button>
      </Modal.Footer>

      {deleting && (
        <Modal show centered onHide={() => setDeleting(null)}>
          <Modal.Header closeButton><Modal.Title as="h2" className="h4">¿Eliminar {deleting.name}?</Modal.Title></Modal.Header>
          <Modal.Body><p className="mb-0">Los grupos de esta categoría no se borran: quedan sin categoría.</p></Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setDeleting(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Eliminando…' : 'Eliminar categoría'}</button>
          </Modal.Footer>
        </Modal>
      )}
    </Modal>
  );
}
