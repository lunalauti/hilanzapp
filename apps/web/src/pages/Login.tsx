import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const { signedIn, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (signedIn) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!emailRe.test(email)) next.email = 'Revisá el email: falta algo.';
    if (!password) next.password = 'Ingresá tu contraseña.';
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    timer.current = window.setTimeout(() => setWaking(true), 4000);
    const error = await signIn(email.trim(), password);
    window.clearTimeout(timer.current);
    setBusy(false);
    setWaking(false);
    if (error) setErrors({ form: error });
  }

  return (
    <div className="d-flex flex-column justify-content-center mx-auto px-4 py-5" style={{ minHeight: '100vh', maxWidth: 440, gap: 32 }}>
      <div className="d-flex flex-column gap-2">
        <div className="hz-brand-mark" style={{ width: 56, height: 56, borderRadius: 16 }}>
          <i className="bi bi-scissors" style={{ fontSize: 26 }} />
        </div>
        <h1 className="hz-brand-name mt-3" style={{ fontSize: 44, letterSpacing: '-.02em' }}>Hilanzapp</h1>
        <p className="mb-0 fs-6 text-secondary">Tu taller de vestuario, a mano.</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="d-flex flex-column gap-3">
        <div className="d-flex flex-column gap-1">
          <label htmlFor="email" className="hz-label">Email</label>
          <div className={`hz-field ${errors.email ? 'is-invalid' : ''}`}>
            <i className="bi bi-envelope" />
            <input id="email" type="email" autoComplete="email" placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
          </div>
          {errors.email && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.email}</span>}
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
          {errors.password && <span className="hz-field-error"><i className="bi bi-exclamation-circle" />{errors.password}</span>}
        </div>

        {errors.form && <div className="hz-notice danger" role="alert"><i className="bi bi-exclamation-triangle" />{errors.form}</div>}
        {waking && <div className="hz-notice warning" role="status"><i className="bi bi-hourglass-split" />El servidor está despertando, puede tardar hasta 30 segundos. No cierres la pantalla.</div>}

        <button type="submit" className="hz-btn-primary mt-1" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
