import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Modal } from 'react-bootstrap';
import { getCookie, setCookie } from '../../lib/cookies';
import { STEPS } from './steps';

export const ONBOARDING_COOKIE = 'hz_onboarding_done';
const COOKIE_DAYS = 365;

interface OnboardingApi { open: () => void }
const OnboardingContext = createContext<OnboardingApi>({ open: () => undefined });
export const useOnboarding = () => useContext(OnboardingContext);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(() => getCookie(ONBOARDING_COOKIE) === null);
  const [step, setStep] = useState(0);

  const close = useCallback(() => {
    setCookie(ONBOARDING_COOKIE, '1', COOKIE_DAYS);
    setShow(false);
    setStep(0);
  }, []);
  const api = useMemo<OnboardingApi>(() => ({ open: () => { setStep(0); setShow(true); } }), []);

  const last = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <OnboardingContext.Provider value={api}>
      {children}
      <Modal show={show} onHide={close} centered size="lg" aria-labelledby="onb-title" contentClassName="hz-onb">
        <Modal.Body className="hz-onb-body">
          <div className="hz-onb-top">
            <span className="hz-onb-count" aria-live="polite">Paso {step + 1} de {STEPS.length}</span>
            <button type="button" className="btn-close" aria-label="Cerrar tutorial" onClick={close} />
          </div>
          <div className="hz-onb-icon" aria-hidden="true"><i className={`bi ${current.icon}`} /></div>
          <h2 id="onb-title" className="hz-onb-title">{current.title}</h2>
          <div className="hz-onb-content">{current.body}</div>
          <div className="hz-onb-dots" role="tablist" aria-label="Pasos del tutorial">
            {STEPS.map((s, i) => (
              <button key={s.title} type="button" role="tab" aria-selected={i === step} aria-label={`Ir al paso ${i + 1}: ${s.title}`} className={`hz-onb-dot ${i === step ? 'active' : ''}`} onClick={() => setStep(i)} />
            ))}
          </div>
          <div className="hz-onb-actions">
            {!last ? <button type="button" className="btn btn-link text-secondary" onClick={close}>Saltar</button> : <span />}
            <div className="d-flex gap-2">
              {step > 0 && <button type="button" className="hz-btn" onClick={() => setStep(step - 1)}>Anterior</button>}
              {last
                ? <button type="button" className="hz-btn primary" onClick={close}>Empezar</button>
                : <button type="button" className="hz-btn primary" onClick={() => setStep(step + 1)}>Siguiente</button>}
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </OnboardingContext.Provider>
  );
}
