import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { api } from '../lib/apiClient';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

const BOOTSTRAP_KEY = 'hz-bootstrapped';

export function AppShell() {
  useEffect(() => {
    try {
      if (localStorage.getItem(BOOTSTRAP_KEY)) return;
    } catch {
      return;
    }
    api
      .post('/me/bootstrap')
      .then(() => localStorage.setItem(BOOTSTRAP_KEY, '1'))
      .catch(() => undefined);
  }, []);

  return (
    <div className="hz-shell">
      <Sidebar />
      <main className="hz-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
