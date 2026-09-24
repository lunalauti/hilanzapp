import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function Settings() {
  const { signOut } = useAuth();
  return (
    <div className="d-flex flex-column gap-4">
      <h1 className="hz-page-title">Ajustes</h1>
      <div className="d-flex flex-column gap-2">
        <Link to="/formulas" className="hz-nav-link"><i className="bi bi-calculator" />Fórmulas</Link>
        <Link to="/tablas" className="hz-nav-link"><i className="bi bi-table" />Tablas de talles</Link>
        <button type="button" className="hz-nav-link border-0 bg-transparent text-start" onClick={() => void signOut()}><i className="bi bi-box-arrow-right" />Salir</button>
      </div>
    </div>
  );
}
