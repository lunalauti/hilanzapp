import { useEffect, useRef, useState } from 'react';
import { formatCm, parseDecimal } from '../../lib/format';
import type { ValueOrigin } from '../../lib/types';

const ORIGIN_TITLE: Record<ValueOrigin, string> = { source: 'Valor de la fuente', interpolated: 'Interpolado entre dos talles', extrapolated: 'Extrapolado: revisalo', user: 'Editado a mano' };

export function Cell({ label, measure, value, origin, onSave }: {
  label: string; measure: string; value: number | undefined; origin: ValueOrigin | undefined; onSave: (value: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) input.current?.select(); }, [editing]);

  const start = () => { setText(value === undefined ? '' : formatCm(value)); setError(null); setEditing(true); };

  async function commit() {
    const trimmed = text.trim();
    if (trimmed === (value === undefined ? '' : formatCm(value))) { setEditing(false); return; }
    let next: number | null = null;
    if (trimmed !== '') {
      next = parseDecimal(trimmed);
      if (next === null || next > 1000) { setError('Ingresá un número entre 0 y 1000'); return; }
    }
    setSaving(true);
    try { await onSave(next); setEditing(false); setError(null); }
    catch { setError('No se pudo guardar'); }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <span className="hz-cell editing">
        <input ref={input} aria-label={`${measure} del talle ${label}`} aria-invalid={Boolean(error)} inputMode="decimal" value={text} disabled={saving}
          onChange={(e) => setText(e.target.value)} onBlur={() => void commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setEditing(false); setError(null); } }} />
        {error && <span role="alert" className="hz-cell-error">{error}</span>}
      </span>
    );
  }
  const deco = origin === 'interpolated' ? <span className="hz-cell-mark">≈</span> : origin === 'extrapolated' ? <i className="bi bi-exclamation-triangle hz-cell-mark" /> : origin === 'user' ? <i className="bi bi-pencil-fill hz-cell-mark" /> : null;
  return (
    <button type="button" className={`hz-cell ${origin ?? 'empty'}`} title={origin ? ORIGIN_TITLE[origin] : 'Sin valor: tocá para cargarlo'} aria-label={`${measure} del talle ${label}: ${value === undefined ? 'sin valor' : formatCm(value)}`} onClick={start}>
      {deco}{value === undefined ? '—' : formatCm(value)}
    </button>
  );
}
