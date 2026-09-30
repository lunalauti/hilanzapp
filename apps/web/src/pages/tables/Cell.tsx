import { useEffect, useRef, useState } from 'react';
import { formatCm, parseDecimal } from '../../lib/format';
import type { ValueOrigin } from '../../lib/types';

const ORIGIN_TITLE: Record<ValueOrigin, string> = { source: 'Valor de la fuente', interpolated: 'Interpolado entre dos talles', extrapolated: 'Extrapolado: revisalo', user: 'Editado a mano' };

export function Cell({ label, measure, value, origin, min, max, onSave }: {
  label: string; measure: string; value: number | undefined; origin: ValueOrigin | undefined; min: number | null; max: number | null;
  onSave: (patch: { value?: number | null; minCm?: number | null; maxCm?: number | null }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [ranged, setRanged] = useState(false);
  const [text, setText] = useState('');
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) input.current?.select(); }, [editing, ranged]);

  const start = () => {
    setText(value === undefined ? '' : formatCm(value));
    setMinText(min === null ? '' : formatCm(min));
    setMaxText(max === null ? '' : formatCm(max));
    setRanged(min !== null || max !== null);
    setError(null);
    setEditing(true);
  };

  function parseCm(raw: string): number | null | undefined {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = parseDecimal(trimmed);
    if (n === null || n > 1000) return undefined;
    return n;
  }

  async function commit() {
    if (ranged) {
      const minCm = parseCm(minText);
      const maxCm = parseCm(maxText);
      if (minCm === undefined || maxCm === undefined) { setError('Ingresá un número entre 0 y 1000'); return; }
      if (minCm !== null && maxCm !== null && minCm > maxCm) { setError('El mínimo no puede ser mayor al máximo'); return; }
      setSaving(true);
      try { await onSave({ minCm, maxCm }); setEditing(false); setError(null); }
      catch { setError('No se pudo guardar'); }
      finally { setSaving(false); }
      return;
    }
    const trimmed = text.trim();
    if (trimmed === (value === undefined ? '' : formatCm(value)) && min === null && max === null) { setEditing(false); return; }
    let next: number | null = null;
    if (trimmed !== '') {
      next = parseDecimal(trimmed);
      if (next === null || next > 1000) { setError('Ingresá un número entre 0 y 1000'); return; }
    }
    setSaving(true);
    try { await onSave({ value: next, minCm: null, maxCm: null }); setEditing(false); setError(null); }
    catch { setError('No se pudo guardar'); }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <span className="hz-cell editing hz-cell-range-editor">
        <label className="hz-cell-range-toggle">
          <input type="checkbox" checked={ranged} disabled={saving} onChange={(e) => setRanged(e.target.checked)} />
          Intervalo
        </label>
        {ranged ? (
          <span className="d-flex gap-1">
            <input ref={input} aria-label={`${measure} del talle ${label}, mínimo`} aria-invalid={Boolean(error)} inputMode="decimal" value={minText} disabled={saving}
              onChange={(e) => setMinText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setEditing(false); setError(null); } }} />
            <span aria-hidden>–</span>
            <input aria-label={`${measure} del talle ${label}, máximo`} aria-invalid={Boolean(error)} inputMode="decimal" value={maxText} disabled={saving}
              onChange={(e) => setMaxText(e.target.value)} onBlur={() => void commit()}
              onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setEditing(false); setError(null); } }} />
          </span>
        ) : (
          <input ref={input} aria-label={`${measure} del talle ${label}`} aria-invalid={Boolean(error)} inputMode="decimal" value={text} disabled={saving}
            onChange={(e) => setText(e.target.value)} onBlur={() => void commit()}
            onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setEditing(false); setError(null); } }} />
        )}
        {error && <span role="alert" className="hz-cell-error">{error}</span>}
      </span>
    );
  }
  const deco = origin === 'interpolated' ? <span className="hz-cell-mark">≈</span> : origin === 'extrapolated' ? <i className="bi bi-exclamation-triangle hz-cell-mark" /> : origin === 'user' ? <i className="bi bi-pencil-fill hz-cell-mark" /> : null;
  const display = min !== null && max !== null ? `${formatCm(min)}–${formatCm(max)}` : value === undefined ? '—' : formatCm(value);
  const title = min !== null && max !== null ? `Intervalo ${formatCm(min)}–${formatCm(max)} cm (punto medio ${value === undefined ? '' : formatCm(value)})` : origin ? ORIGIN_TITLE[origin] : 'Sin valor: tocá para cargarlo';
  return (
    <button type="button" className={`hz-cell ${origin ?? 'empty'}`} title={title} aria-label={`${measure} del talle ${label}: ${display === '—' ? 'sin valor' : display}`} onClick={start}>
      {deco}{display}
    </button>
  );
}
