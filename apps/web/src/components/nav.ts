export interface NavItem {
  to: string;
  label: string;
  icon: string;
  iconActive?: string;
  end?: boolean;
}

export const sidebarItems: NavItem[] = [
  { to: '/', label: 'Grupos', icon: 'bi bi-people', end: true },
  { to: '/moldes', label: 'Hojas de molde', icon: 'bi bi-scissors' },
  { to: '/disenos', label: 'Diseños', icon: 'bi bi-brush' },
  { to: '/inventario', label: 'Inventario y costos', icon: 'bi bi-box-seam' },
  { to: '/formulas', label: 'Fórmulas', icon: 'bi bi-calculator' },
  { to: '/tablas', label: 'Tablas de talles', icon: 'bi bi-table' },
];

export const bottomItems: NavItem[] = [
  { to: '/', label: 'Grupos', icon: 'bi bi-people', iconActive: 'bi bi-people-fill', end: true },
  { to: '/moldes', label: 'Moldes', icon: 'bi bi-scissors' },
  { to: '/disenos', label: 'Diseños', icon: 'bi bi-brush', iconActive: 'bi bi-brush-fill' },
  { to: '/inventario', label: 'Inventario', icon: 'bi bi-box-seam', iconActive: 'bi bi-box-seam-fill' },
  { to: '/ajustes', label: 'Ajustes', icon: 'bi bi-sliders2' },
];
