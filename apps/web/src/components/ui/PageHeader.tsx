import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface Crumb { label: string; to?: string }

export function PageHeader({ eyebrow, title, subtitle, crumbs, actions }: {
  eyebrow?: string; title: string; subtitle?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode;
}) {
  return (
    <header className="hz-header">
      {crumbs && (
        <nav aria-label="Ruta" className="hz-crumbs">
          {crumbs.map((c, i) => (
            <span key={i} className="d-inline-flex align-items-center gap-2">
              {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <i className="bi bi-chevron-right" style={{ fontSize: 11 }} />}
            </span>
          ))}
        </nav>
      )}
      <div className="hz-header-row">
        <div className="d-flex flex-column gap-1 min-w-0">
          {eyebrow && <span className="hz-eyebrow">{eyebrow}</span>}
          <h1 className="hz-page-title">{title}</h1>
          {subtitle && <span className="hz-eyebrow">{subtitle}</span>}
        </div>
        {actions && <div className="hz-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
