import { BrandMark } from '../components/ui/BrandMark';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const WAKING_AFTER_S = 4;
const RETRY_AFTER_S = 30;

export function Login() {
  const { signedIn, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const attempt = useRef(0);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  if (signedIn) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const next: typeof errors = {};
    if (!email.includes('@')) next.email = 'Falta la @ en el email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Revisá el email: no parece válido.';
    if (!password) next.password = 'Ingresá tu contraseña.';
    setErrors(next);
    if (next.email || next.password) return;

    const mine = ++attempt.current;
    setBusy(true);
    const error = await signIn(email.trim(), password);
    if (mine !== attempt.current) return;
    setBusy(false);
    if (error) setErrors({ form: error });
  }

  const waking = busy && elapsed >= WAKING_AFTER_S;

  return (
    <div className="hz-login">
      <aside className="hz-login-brand" aria-hidden="true">
        <div className="d-flex align-items-center gap-3">
          <BrandMark size={48} inverse />
          <span className="name">Hilanzapp</span>
        </div>
        <div className="d-flex flex-column gap-3">
          <span className="headline">Tu taller de vestuario, a mano.</span>
          <span className="sub">Medidas reales para construir el molde; talles para organizar la producción.</span>
        </div>
        <span className="small">Hilanza · Estudio de danza</span>
      </aside>

      <main className="hz-login-form">
        <div className="d-lg-none d-flex flex-column gap-2 mb-2">
          <BrandMark size={56} />
          <h1 className="hz-brand-name mt-3" style={{ fontSize: 44, letterSpacing: '-.02em' }}>Hilanzapp</h1>
          <p className="mb-0 fs-6 text-secondary">Tu taller de vestuario, a mano.</p>
        </div>

        <form onSubmit={submit} noValidate className="d-flex flex-column gap-3" aria-label="Iniciar sesión">
          <h2 className="hz-login-title d-none d-lg-block">Entrar</h2>
          {errors.form && <div className="hz-notice danger" role="alert"><i className="bi bi-x-octagon" />{errors.form}</div>}

          <div className="d-flex flex-column gap-1">
            <label htmlFor="email" className="hz-label" style={errors.email ? { color: 'var(--hz-danger)' } : undefined}>Email</label>
            <div className={`hz-field ${errors.email ? 'is-invalid' : ''}`}>
              <i className="bi bi-envelope" />
              <input id="email" type="email" autoComplete="email" placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
            </div>
            {errors.email && <span className="hz-field-error"><i className="bi bi-x-circle" />{errors.email}</span>}
          </div>

          <div className="d-flex flex-column gap-1">
            <label htmlFor="password" className="hz-label">Contraseña</label>
            <div className={`hz-field ${errors.password ? 'is-invalid' : ''}`} style={{ paddingRight: 4 }}>
              <i className="bi bi-lock" />
              <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={Boolean(errors.password)} />
              <button type="button" className="btn border-0 d-flex align-items-center justify-content-center text-secondary" style={{ width: 44, height: 44 }} onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'} />
              </button>
            </div>
            {errors.password && <span className="hz-field-error"><i className="bi bi-x-circle" />{errors.password}</span>}
          </div>

          {waking && (
            <div className="hz-waking" role="status" aria-live="polite">
              <div className="d-flex align-items-center gap-3"><span className="hz-spinner" aria-hidden="true" /><span className="title">Enhebrando la aguja…</span></div>
              <span>El servidor estaba dormido y se está despertando. Puede tardar hasta {RETRY_AFTER_S} segundos. Tus datos están a salvo.</span>
              <div className="d-flex flex-column gap-1">
                <div className="hz-progress"><i className="done" style={{ width: `${Math.min(100, (elapsed / RETRY_AFTER_S) * 100)}%` }} /></div>
                <div className="d-flex justify-content-between small text-secondary"><span>Conectando</span><strong className="text-body">{elapsed} s de ~{RETRY_AFTER_S} s</strong></div>
              </div>
              {elapsed >= RETRY_AFTER_S && <button type="button" className="hz-btn align-self-start" onClick={() => void submit()}><i className="bi bi-arrow-clockwise" />Reintentar</button>}
            </div>
          )}

          <button type="submit" className="hz-btn-primary mt-1" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </main>
    </div>
  );
}
