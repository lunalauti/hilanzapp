import { useEffect, useState } from 'react';

export const SEWING_MESSAGES = [
  'Enhebrando la aguja…',
  'Tomando medidas…',
  'Marcando el molde…',
  'Cortando la tela…',
  'Planchando los pliegues…',
  'Prendiendo los alfileres…',
  'Repasando las costuras…',
  'Buscando la cinta métrica…',
];

/** Rota una frase de taller cada `everyMs`. */
export function useRotatingMessage(messages: string[] = SEWING_MESSAGES, everyMs = 2600): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % messages.length), everyMs);
    return () => clearInterval(id);
  }, [messages.length, everyMs]);
  return messages[i]!;
}

/** Pantalla de carga completa: spinner + frases de taller. Para arranques lentos (servidor dormido). */
export function LoadingScreen({ note = 'Un momento, estamos preparando tu taller.' }: { note?: string }) {
  const message = useRotatingMessage();
  return (
    <div className="hz-loading-screen" role="status" aria-live="polite">
      <div className="d-flex align-items-center gap-2">
        <span className="hz-brand-mark" aria-hidden="true"><i className="bi bi-scissors" /></span>
        <span className="hz-brand-name">Hilanzapp</span>
      </div>
      <span className="hz-spinner" aria-hidden="true" />
      <span className="hz-loading-message">{message}</span>
      <span className="small text-secondary">{note}</span>
    </div>
  );
}

/** Línea de estado bajo los esqueletos: aparece recién si la carga tarda. */
export function SlowLoadingHint({ afterMs = 2500 }: { afterMs?: number }) {
  const [show, setShow] = useState(false);
  const message = useRotatingMessage();
  useEffect(() => {
    const id = setTimeout(() => setShow(true), afterMs);
    return () => clearTimeout(id);
  }, [afterMs]);
  if (!show) return null;
  return (
    <div className="hz-loading-hint" role="status">
      <span className="hz-spinner sm" aria-hidden="true" />
      <span>{message} <span className="text-secondary">Si el servidor estaba dormido puede tardar un poco.</span></span>
    </div>
  );
}
