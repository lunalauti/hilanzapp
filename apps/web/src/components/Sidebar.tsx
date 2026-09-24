import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useOnboarding } from './onboarding/Onboarding';
import { sidebarItems } from './nav';

export function Sidebar() {
  const onboarding = useOnboarding();
  const { signOut } = useAuth();
  return (
    <nav className="hz-sidebar hz-no-print" aria-label="Navegación principal">
      <div className="hz-brand">
        <span className="hz-brand-mark"><i className="bi bi-scissors" /></span>
        <span className="hz-brand-name">Hilanzapp</span>
      </div>
      {sidebarItems.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="hz-nav-link">
          <i className={it.icon} />
          {it.label}
        </NavLink>
      ))}
      <div style={{ flex: 1 }} />
      <NavLink to="/empezar" className="hz-nav-link"><i className="bi bi-flag" />Primeros pasos</NavLink>
      <button type="button" className="hz-nav-link border-0 bg-transparent text-start w-100" onClick={onboarding.open}><i className="bi bi-question-circle" />Ver tutorial</button>
      <button type="button" className="hz-nav-link border-0 bg-transparent text-start w-100" onClick={() => void signOut()}><i className="bi bi-box-arrow-right" />Salir</button>
      <div className="hz-saved"><i className="bi bi-cloud-check" />Todo guardado</div>
    </nav>
  );
}
