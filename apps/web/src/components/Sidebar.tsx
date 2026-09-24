import { NavLink } from 'react-router-dom';
import { useOnboarding } from './onboarding/Onboarding';
import { sidebarItems } from './nav';

export function Sidebar() {
  const onboarding = useOnboarding();
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
      <button type="button" className="hz-nav-link border-0 bg-transparent text-start w-100" onClick={onboarding.open}><i className="bi bi-question-circle" />Ver tutorial</button>
      <div className="hz-saved"><i className="bi bi-cloud-check" />Todo guardado</div>
    </nav>
  );
}
