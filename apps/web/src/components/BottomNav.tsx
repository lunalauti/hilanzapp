import { NavLink } from 'react-router-dom';
import { bottomItems } from './nav';

export function BottomNav() {
  return (
    <nav className="hz-bottom-nav hz-no-print" aria-label="Navegación principal">
      {bottomItems.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="hz-bottom-link">
          {({ isActive }) => (
            <>
              <span className="pill"><i className={isActive ? (it.iconActive ?? it.icon) : it.icon} /></span>
              <span>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
