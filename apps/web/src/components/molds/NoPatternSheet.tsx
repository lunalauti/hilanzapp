import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/apiClient';
import { openPdf } from '../../lib/files';
import { formatCm } from '../../lib/format';
import { useMeasurements, useSizing } from '../../lib/queries';
import type { Mold } from '../../lib/types';
import { NoPatternBadge } from '../ui/NoPatternBadge';
import { SizeChip } from '../ui/SizeChip';
import { useToast } from '../ui/Toast';

const BASIS = { pecho: 'pecho', cadera: 'cadera', both: 'pecho y cadera' } as const;

/** Hoja de molde de una prenda sin molde: medidas para trazar a mano y salidas para crear o vincular el molde. */
export function NoPatternSheet({ dancerId, dancerName, mold, designId, backTo, onLink }: {
  dancerId: string; dancerName: string; mold: Mold; designId: string | null; backTo: string; onLink: () => void;
}) {
  const measures = useMeasurements(dancerId);
  const sizing = useSizing(dancerId, mold.id);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const inputs = mold.inputs.filter((i) => i.source === 'measure');
  const byKey = new Map((measures.data ?? []).map((m) => [m.key, m]));
  const rows = inputs.map((i) => ({ input: i, item: byKey.get(i.measureKey ?? i.key) }));
  const missing = rows.filter((r) => !r.item || r.item.valueCm === null);
  const missingKeys = missing.map((r) => r.input.measureKey ?? r.input.key);

  async function exportPdf() {
    setExporting(true);
    try {
      const qs = `mold_type_id=${mold.id}${designId ? `&design_id=${designId}` : ''}`;
      openPdf(await api.getBlob(`/dancers/${dancerId}/garment-sheet/pdf?${qs}`), `hoja-prenda-${dancerName}.pdf`);
      toast.show('PDF generado');
    } catch { toast.show('No pudimos generar el PDF'); }
    finally { setExporting(false); }
  }

  return (
    <div className="hz-nopattern">
      <div className="hz-nopattern-hero">
        <i className="bi bi-scissors" aria-hidden="true" />
        <h2>Esta prenda todavía no tiene molde</h2>
        <p>Igual podés tomar medidas, asignar talles y planificar la producción.</p>
      </div>

      <section className="hz-card hz-panel" aria-label="Para trazar a mano">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2"><h2 className="hz-panel-title mb-0">{mold.name}</h2><NoPatternBadge /></div>
          <div className="d-flex align-items-center gap-2 small text-secondary">Talle según {BASIS[mold.sizePriority]}{sizing.data && <SizeChip label={sizing.data.effective.label} origin={sizing.data.effective.origin} small />}</div>
        </div>
        <span className="hz-tm-kicker">Para trazar a mano</span>
        {rows.length === 0 && <span className="text-secondary">Esta prenda no tiene medidas requeridas.</span>}
        <div className="hz-plan-list">
          {rows.map(({ input, item }) => (
            <div key={input.key} className="hz-plan-row" style={{ pointerEvents: 'none' }}>
              <span className="flex-grow-1 n">{input.label}</span>
              {item && item.valueCm !== null
                ? <span className="hz-real-chip"><strong>{formatCm(item.valueCm)}</strong> cm</span>
                : <span className="hz-missing-chip">Falta</span>}
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <Link className="hz-btn primary align-self-start" to={`/dancers/${dancerId}/medir?solo=${missingKeys.join(',')}&volver=${encodeURIComponent(backTo)}`}>
            <i className="bi bi-rulers" />Tomar medidas ({missing.length} {missing.length === 1 ? 'falta' : 'faltan'})
          </Link>
        )}
      </section>

      <div className="d-flex flex-wrap gap-2 hz-no-print">
        <Link className="hz-btn primary" to={`/formulas?mold=${mold.id}`}><i className="bi bi-magic" />Crear molde con esta prenda</Link>
        <button type="button" className="hz-btn" onClick={onLink}><i className="bi bi-link-45deg" />Vincular a un molde existente</button>
        <button type="button" className="hz-btn" disabled={exporting} onClick={() => void exportPdf()}><i className="bi bi-file-earmark-pdf" />{exporting ? 'Generando…' : 'Exportar PDF'}</button>
      </div>
    </div>
  );
}
