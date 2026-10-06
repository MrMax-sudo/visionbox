import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const DashboardKanban = React.lazy(() => import('@/pages/DashboardKanban'));
const Clientes = React.lazy(() => import('@/pages/Clientes'));
const Receitas = React.lazy(() => import('@/pages/Receitas'));
const Catalogo = React.lazy(() => import('@/pages/Catalogo'));
const PDV = React.lazy(() => import('@/pages/PDV'));
const OSDetail = React.lazy(() => import('@/pages/OSDetail'));
const Financeiro = React.lazy(() => import('@/pages/Financeiro'));
const UserManagement = React.lazy(() => import('@/pages/UserManagement'));
const LabPortal = React.lazy(() => import('@/pages/LabPortal'));

function PageLoading() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
      Carregando tela...
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <React.Suspense fallback={<PageLoading />}>{children}</React.Suspense>
    </ErrorBoundary>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [checking, setChecking] = React.useState(!token);

  React.useEffect(() => {
    let alive = true;
    if (token) {
      setChecking(false);
      return;
    }
    setChecking(true);
    apiClient.post('/v1/auth/refresh', undefined, { headers: { 'X-Skip-Idempotency-Key': 'true' } })
      .then(({ data }) => {
        if (!alive) return;
        if (data.accessToken && data.usuario) {
          setAuth({ token: data.accessToken, user: data.usuario });
        } else {
          logout();
        }
      })
      .catch(() => {
        if (alive) logout();
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [logout, setAuth, token]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-page)] text-sm text-[var(--color-text-secondary)]">
        Abrindo VisionBox...
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/lab/:token" element={<LazyPage><LabPortal /></LazyPage>} />
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<LazyPage><DashboardKanban /></LazyPage>} />
          <Route path="clientes" element={<LazyPage><Clientes /></LazyPage>} />
          <Route path="receitas" element={<LazyPage><Receitas /></LazyPage>} />
          <Route path="catalogo" element={<LazyPage><Catalogo /></LazyPage>} />
          <Route path="pdv" element={<LazyPage><PDV /></LazyPage>} />
          <Route path="os" element={<LazyPage><DashboardKanban /></LazyPage>} />
          <Route path="os/:id" element={<LazyPage><OSDetail /></LazyPage>} />
          <Route path="financeiro" element={<LazyPage><Financeiro /></LazyPage>} />
          <Route path="usuarios" element={<LazyPage><UserManagement /></LazyPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
