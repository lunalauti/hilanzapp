import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export interface MenuAction {
  label: string;
  icon?: string;
  /** Ruta interna (se renderiza como enlace). */
  to?: string;
  onSelect?: () => void;
  danger?: boolean;
}

/** Menú "⋯" accesible: reemplaza filas de íconos sueltos por una sola puerta. */
export function ActionMenu({ label, actions, className = '' }: { label: string; actions: MenuAction[]; className?: string }) {
  return (
    <Dropdown align="end" className={`hz-menu-wrap ${className}`}>
      <Dropdown.Toggle as="button" type="button" className="hz-icon-btn hz-menu-toggle" aria-label={label} bsPrefix="hz-menu-btn">
        <i className="bi bi-three-dots" aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="hz-menu" renderOnMount={false}>
        {actions.map((a) => {
          const body = <>{a.icon && <i className={`bi ${a.icon}`} aria-hidden="true" />}{a.label}</>;
          return a.to
            ? <Dropdown.Item key={a.label} as={Link} to={a.to} role="menuitem" className={a.danger ? 'danger' : ''}>{body}</Dropdown.Item>
            : <Dropdown.Item key={a.label} as="button" type="button" role="menuitem" className={a.danger ? 'danger' : ''} onClick={a.onSelect}>{body}</Dropdown.Item>;
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
}
