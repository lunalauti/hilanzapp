import { useState } from 'react';
import { slugKey } from '../../lib/formulas';
import { useMeasureDefs } from '../../lib/queries';
import type { MoldInput } from '../../lib/types';

const SOURCE: Record<MoldInput['source'], string> = { measure: 'medida', standard: 'de la tabla', manual: 'dato manual', choice: 'opción' };

export function InputsPanel({ inputs, onChange }: { inputs: MoldInput[]; onChange: (next: MoldInput[]) => void }) {
  const defs = useMeasureDefs();
  const [pick, setPick] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const used = new Set(inputs.map((i) => i.measureKey ?? i.key));
  const free = (defs.data ?? []).filter((d) => !used.has(d.key));

  function addMeasure() {
    const d = defs.data?.find((x) => x.key === pick);
    if (!d) return;
    onChange([...inputs, { key: d.key, label: d.name, source: d.kind === 'standard' ? 'standard' : 'measure', measureKey: d.key }]);
    setPick('');
  }
  function addManual() {
    const label = manualLabel.trim();
    if (!label) return;
    onChange([...inputs, { key: slugKey(label, new Set(inputs.map((i) => i.key))), label, source: 'manual' }]);
    setManualLabel('');
  }

  return (
    <section className="hz-card hz-panel" aria-label="Datos que pide el molde">
      <h2 className="hz-panel-title">Datos que pide este molde</h2>
      <div className="d-flex flex-wrap gap-2">
        {inputs.map((i) => (
          <span key={i.key} className="hz-req hz-real" style={{ alignItems: 'center' }}>
            {i.label}<span className="small">· {SOURCE[i.source]}</span>
            <button type="button" className="btn-close btn-close-sm ms-1" style={{ fontSize: 9 }} aria-label={`Quitar ${i.label}`} onClick={() => onChange(inputs.filter((x) => x.key !== i.key))} />
          </span>
        ))}
        {inputs.length === 0 && <span className="text-secondary">Este molde todavía no pide ninguna medida.</span>}
      </div>
      <div className="d-flex flex-wrap gap-2">
        <select className="hz-input" style={{ flex: '1 1 200px' }} aria-label="Medida a agregar" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Agregar una medida…</option>
          {free.map((d) => <option key={d.id} value={d.key}>{d.name}{d.kind === 'standard' ? ' (de la tabla de talles)' : ''}</option>)}
        </select>
        <button type="button" className="hz-btn" disabled={!pick} onClick={addMeasure}><i className="bi bi-plus-lg" />Medida</button>
      </div>
      <div className="d-flex flex-wrap gap-2">
        <input className="hz-input" style={{ flex: '1 1 200px' }} aria-label="Nombre del dato manual" placeholder="Dato manual, por ejemplo: Sisa dibujada" value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} />
        <button type="button" className="hz-btn" disabled={!manualLabel.trim()} onClick={addManual}><i className="bi bi-plus-lg" />Dato manual</button>
      </div>
    </section>
  );
}
