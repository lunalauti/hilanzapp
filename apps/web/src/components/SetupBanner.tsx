import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dismissSetup, isSetupDismissed, useSetup } from '../lib/setup';

/** Invitación a seguir la guía de primeros pasos mientras haya pasos sin hacer. */
export function SetupBanner() {
  const [hidden, setHidden] = useState(isSetupDismissed);
  return hidden ? null : <Banner onHide={() => { dismissSetup(); setHidden(true); }} />;
}

function Banner({ onHide }: { onHide: () => void }) {
  const { doneCount, total, complete, loading } = useSetup();
  if (loading || complete) return null;
  return (
    <div className="hz-setup-banner" role="region" aria-label="Primeros pasos">
      <i className="bi bi-flag" aria-hidden="true" />
      <div className="flex-grow-1">
        <strong>Terminá de armar tu taller</strong>
        <div className="small text-secondary">Llevás {doneCount} de {total} pasos.</div>
      </div>
      <Link to="/empezar" className="hz-btn primary">Continuar</Link>
      <button type="button" className="btn-close" aria-label="Ocultar por ahora" onClick={onHide} />
    </div>
  );
}
