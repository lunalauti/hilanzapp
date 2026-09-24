import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { DancerPage } from './pages/dancer/DancerPage';
import { DesignPage } from './pages/designs/DesignPage';
import { DesignsList } from './pages/designs/DesignsList';
import { FormulaEditor } from './pages/formulas/FormulaEditor';
import { GroupDancers } from './pages/GroupDancers';
import { GroupLayout } from './pages/GroupLayout';
import { GettingStarted } from './pages/GettingStarted';
import { Home } from './pages/Home';
import { Inventory } from './pages/inventory/Inventory';
import { Login } from './pages/Login';
import { MoldSheet } from './pages/MoldSheet';
import { Production } from './pages/Production';
import { Placeholder } from './pages/Placeholder';
import { Settings } from './pages/Settings';
import { SizeTables } from './pages/tables/SizeTables';

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
          <Route path="disenos" element={<DesignsList />} />
          <Route path="disenos/:designId" element={<DesignPage />} />
          <Route path="inventario" element={<Inventory />} />
          <Route path="formulas" element={<FormulaEditor />} />
          <Route path="tablas" element={<SizeTables />} />
          <Route path="empezar" element={<GettingStarted />} />
          <Route path="ajustes" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
