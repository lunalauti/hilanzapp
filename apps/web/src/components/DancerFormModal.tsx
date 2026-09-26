import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { NeededMeasures } from './measures/NeededMeasures';
import { api } from '../lib/apiClient';
import { ApiError } from '../lib/api';
import type { GroupDancer } from '../lib/types';
import { useDesigns, useInvalidateDancerData } from '../lib/queries';
import { useToast } from './ui/Toast';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function DancerFormModal({ show, groupId, groupName, siblings = [], dancer, onClose }: {
  show: boolean; groupId: string; groupName?: string; siblings?: { id: string; name: string }[]; dancer?: GroupDancer; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [contact, setContact] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<{ name?: string; age?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const designs = useDesigns();
  const invalidate = useInvalidateDancerData();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (show) { setCreated(null); setName(dancer?.name ?? ''); setAge(dancer?.age?.toString() ?? ''); setContact(dancer?.contact ?? ''); setPicked(new Set()); setErrors({}); }
  }, [show, dancer]);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const assignable = (designs.data ?? []).filter((d) => d.garments.length > 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) next.name = 'El nombre es obligatorio.';
    else if (siblings.some((s) => s.id !== dancer?.id && norm(s.name) === norm(clean))) next.name = `Ya hay una ${clean} en ${groupName ?? 'este grupo'}. Sumá un segundo apellido o apodo.`;
    const ageNum = age.trim() === '' ? null : Number(age);
    if (ageNum !== null && (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120)) next.age = 'La edad debe ser un número entre 0 y 120.';
    setErrors(next);
    if (next.name || next.age) return;

    setBusy(true);
    try {
      const body = { name: clean, age: ageNum, contact: contact.trim() || null };
      let failed = 0;
      let newId: string | null = null;
      let assigned = 0;
      if (dancer) await api.patch(`/dancers/${dancer.id}`, body);
      else {
        const made = await api.post<{ id: string }>('/dancers', { groupId, ...body });
        newId = made.id;
        const jobs = assignable.filter((d) => picked.has(d.id)).flatMap((d) => d.garments.map((g) => { assigned++; return api.post('/assignments', { dancerId: made.id, moldTypeId: g.moldTypeId, designId: d.id }).catch(() => { failed++; }); }));
        await Promise.all(jobs);
      }
      invalidate(dancer?.id ?? newId ?? undefined, groupId);
      void qc.invalidateQueries({ queryKey: ['group-dancers', groupId] });
      toast.show(failed ? `${clean} guardada, pero ${failed} prendas no se pudieron asignar` : `${clean} guardada`);
      // Con vestuario asignado, se le dice enseguida qué medidas necesita y se ofrece tomarlas.
      if (newId && assigned - failed > 0) setCreated({ id: newId, name: clean });
      else onClose();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'No pudimos guardar la bailarina.' });
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal show={show} onHide={onClose} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h4 d-flex flex-column">Nueva bailarina<span className="fs-6 fw-normal text-secondary">{created.name} guardada{groupName ? ` en ${groupName}` : ''}.</span></Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3"><NeededMeasures dancerId={created.id} /></Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Después</button>
          <button type="button" className="hz-btn primary" onClick={() => { onClose(); navigate(`/dancers/${created.id}/medir?volver=${encodeURIComponent(`/groups/${groupId}`)}`); }}><i className="bi bi-rulers" />Tomar medidas ahora</button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={submit} noValidate>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h4 d-flex flex-column">
            {dancer ? 'Editar bailarina' : 'Nueva bailarina'}
            {(groupName || !dancer) && <span className="fs-6 fw-normal text-secondary">{groupName ? `En ${groupName}.` : ''}{!dancer ? ' Las medidas se cargan después, en su ficha.' : ''}</span>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <div className="d-flex flex-column gap-1">
            <label htmlFor="dancer-name" className="hz-label">Nombre y apellido</label>
            <input id="dancer-name" className={`hz-input ${errors.name ? 'is-invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-invalid={Boolean(errors.name)} placeholder="Martina López" />
            {errors.name && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.name}</span>}
          </div>
          <div className="row g-3">
            <div className="col-5 d-flex flex-column gap-1">
              <label htmlFor="dancer-age" className="hz-label">Edad</label>
              <div className={`hz-field ${errors.age ? 'is-invalid' : ''}`} style={{ height: 48 }}>
                <input id="dancer-age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} aria-invalid={Boolean(errors.age)} />
                <span className="small text-secondary">años</span>
              </div>
              {errors.age && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.age}</span>}
            </div>
            <div className="col-7 d-flex flex-column gap-1">
              <label htmlFor="dancer-contact" className="hz-label">Contacto <span className="fw-normal text-secondary text-lowercase">· opcional</span></label>
              <input id="dancer-contact" className="hz-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Teléfono o email" />
            </div>
          </div>
          <span className="small text-secondary" style={{ marginTop: -8 }}>La edad define qué tabla de talles se usa.</span>

          {!dancer && assignable.length > 0 && (
            <fieldset className="d-flex flex-column gap-2">
              <legend className="hz-label mb-1">Vestuario asignado</legend>
              <div className="d-flex flex-wrap gap-2">
                {assignable.map((d) => <button key={d.id} type="button" className={`hz-pill ${picked.has(d.id) ? 'active' : ''}`} aria-pressed={picked.has(d.id)} onClick={() => toggle(d.id)}>{d.name}</button>)}
              </div>
              <span className="small text-secondary">Se le agregan todas las prendas del diseño. Podés cambiarlo después.</span>
            </fieldset>
          )}
          {errors.form && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{errors.form}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="hz-btn primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
