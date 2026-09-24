import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { DancerPage } from './pages/dancer/DancerPage';
import { GroupDancers } from './pages/GroupDancers';
import { GroupLayout } from './pages/GroupLayout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { MoldSheet } from './pages/MoldSheet';
import { Production } from './pages/Production';
import { Placeholder } from './pages/Placeholder';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="groups/:groupId" element={<GroupLayout />}>
            <Route index element={<GroupDancers />} />
            <Route path="production" element={<Production />} />
          </Route>
          <Route path="dancers/:dancerId" element={<DancerPage />} />
          <Route path="moldes" element={<MoldSheet />} />
          <Route path="disenos" element={<Placeholder eyebrow="Taller" title="Diseños" note="Llega con la tarea 30." />} />
          <Route path="inventario" element={<Placeholder eyebrow="Taller" title="Inventario y costos" note="Llega con la tarea 37." />} />
          <Route path="formulas" element={<Placeholder eyebrow="Ajustes" title="Fórmulas" note="Llega con la tarea 32." />} />
          <Route path="tablas" element={<Placeholder eyebrow="Ajustes" title="Tablas de talles" note="Llega con la tarea 34." />} />
          <Route path="ajustes" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
