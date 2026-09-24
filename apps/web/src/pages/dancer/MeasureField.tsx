import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { formatCm, parseDecimal } from '../../lib/format';
import type { MeasureItem } from '../../lib/types';

export function MeasureField({ item, onSave }: { item: MeasureItem; onSave: (item: MeasureItem, value: number) => Promise<void> }) {
  const [text, setText] = useState(item.valueCm === null ? '' : formatCm(item.valueCm));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setText(item.valueCm === null ? '' : formatCm(item.valueCm)); setError(null); }, [item.valueCm]);

  async function commit() {
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === formatCm(item.valueCm)) { setError(null); return; }
    const value = parseDecimal(trimmed);
    if (value === null) { setError('Ingresá un número, por ejemplo 88 o 88,5.'); return; }
    if (value > 1000) { setError('El valor es demasiado grande.'); return; }
    setSaving(true);
    try {
      await onSave(item, value);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos guardar la medida.');
    } finally {
      setSaving(false);
    }
  }

  const id = `m-${item.definitionId}`;
  const filled = item.valueCm !== null;
  return (
    <div className="hz-measure">
      <label htmlFor={id} className="hz-label">{item.name}{item.required && <span title="Requerida para el estado completo"> *</span>}</label>
      <div className={`hz-measure-box ${filled ? 'hz-real' : 'empty'} ${error ? 'is-invalid' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="Cargar"
          value={text}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          disabled={saving}
        />
        <span className="unit">cm</span>
      </div>
      {error ? <span id={`${id}-err`} className="hz-field-error" role="alert"><i className="bi bi-exclamation-circle" />{error}</span>
        : item.note ? <span className="hz-measure-note"><span><i className="bi bi-chat-left-text" /> {item.note}</span></span> : null}
    </div>
  );
}
