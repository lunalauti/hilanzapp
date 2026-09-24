import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Loading } from '../components/ui/States';
import { PHASES, useSetup } from '../lib/setup';

export function GettingStarted() {
  const { steps, doneCount, total, complete, loading, toggle } = useSetup();
  const pct = Math.round((doneCount / total) * 100);

  return (
    <>
      <PageHeader eyebrow="Guía" title="Primeros pasos" />
      <p className="text-secondary" style={{ maxWidth: 640 }}>
        Seguí estos pasos en orden para dejar tu taller listo. Lo que la app puede detectar se tilda solo; el resto lo marcás vos.
      </p>
      <div className="hz-card p-3 d-flex flex-column gap-2 mb-4" style={{ maxWidth: 640 }}>
        <div className="d-flex justify-content-between align-items-baseline">
          <strong>{complete ? '¡Tu taller está listo!' : `${doneCount} de ${total} pasos`}</strong>
          <span className="small text-secondary">{pct} %</span>
        </div>
        <div className="hz-progress" role="img" aria-label={`${pct}% completado`}><i className="done" style={{ width: `${pct}%` }} /></div>
      </div>

      {loading && <Loading rows={4} />}
      {!loading && PHASES.map((phase) => (
        <section key={phase.id} className="mb-4" aria-labelledby={`phase-${phase.id}`}>
          <h2 id={`phase-${phase.id}`} className="hz-setup-phase">{phase.title}<span>{phase.note}</span></h2>
          <ol className="hz-setup-list">
            {steps.filter((s) => s.phase === phase.id).map((s) => (
              <li key={s.id} className={`hz-setup-step ${s.done ? 'done' : ''}`}>
                <span className="check" aria-hidden="true"><i className={`bi ${s.done ? 'bi-check-lg' : ''}`} /></span>
                <div className="body">
                  <strong>{s.title}</strong>
                  <span className="small text-secondary">{s.why}</span>
                  <div className="d-flex flex-wrap gap-2 mt-1">
                    <Link to={s.to} className="hz-btn">{s.action}<i className="bi bi-arrow-right ms-1" /></Link>
                    {s.manual && (
                      <button type="button" className="btn btn-link btn-sm text-secondary" aria-pressed={s.done} onClick={() => toggle(s.id)}>
                        {s.done ? 'Desmarcar' : 'Marcar como hecho'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
