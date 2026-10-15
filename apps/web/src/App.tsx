import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import GuardaModulo from '@/components/GuardaModulo';

const DashboardKanban = React.lazy(() => import('@/pages/DashboardKanban'));
const Clientes = React.lazy(() => import('@/pages/Clientes'));
const Receitas = React.lazy(() => import('@/pages/Receitas'));
const Catalogo = React.lazy(() => import('@/pages/Catalogo'));
const PDV = React.lazy(() => import('@/pages/PDV'));
const Vendas = React.lazy(() => import('@/pages/Vendas'));
const CaixaTurnos = React.lazy(() => import('@/pages/CaixaTurnos'));
const Compras = React.lazy(() => import('@/pages/Compras'));
const Maquininhas = React.lazy(() => import('@/pages/Maquininhas'));
const Comissoes = React.lazy(() => import('@/pages/Comissoes'));
const OSDetail = React.lazy(() => import('@/pages/OSDetail'));
const Financeiro = React.lazy(() => import('@/pages/Financeiro'));
const UserManagement = React.lazy(() => import('@/pages/UserManagement'));
const LabPortal = React.lazy(() => import('@/pages/LabPortal'));
const RastreioPortal = React.lazy(() => import('@/pages/RastreioPortal'));
const PainelDesenvolvedor = React.lazy(() => import('@/pages/PainelDesenvolvedor'));
const FiscalConfigPage = React.lazy(() => import('@/pages/FiscalConfigPage'));

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

function DevOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.perfil !== 'DESENVOLVEDOR') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

// Configuração Fiscal expõe credenciais (CSC, chave API) — mesmo gate da aba no diálogo.
function AdminOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user?.perfil !== 'ADMIN' && user?.perfil !== 'DESENVOLVEDOR') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/lab/:token" element={<LazyPage><LabPortal /></LazyPage>} />
        {/* Portal do Cliente (US17) — rotas públicas sem login, PWA de rastreio da OS */}
        <Route path="/rastreio" element={<LazyPage><RastreioPortal /></LazyPage>} />
        <Route path="/rastreio/:token" element={<LazyPage><RastreioPortal /></LazyPage>} />
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route index element={<LazyPage><DashboardKanban /></LazyPage>} />
          <Route path="clientes" element={<LazyPage><Clientes /></LazyPage>} />
          <Route path="receitas" element={<LazyPage><GuardaModulo modulo="RECEITAS_CLINICAS"><Receitas /></GuardaModulo></LazyPage>} />
          <Route path="catalogo" element={<LazyPage><Catalogo /></LazyPage>} />
          <Route path="pdv" element={<LazyPage><GuardaModulo modulo="PDV_BALCAO"><PDV /></GuardaModulo></LazyPage>} />
          <Route path="vendas" element={<LazyPage><GuardaModulo modulo="CENTRAL_VENDAS"><Vendas /></GuardaModulo></LazyPage>} />
          <Route path="caixas" element={<LazyPage><GuardaModulo modulo="CAIXA_TURNOS"><CaixaTurnos /></GuardaModulo></LazyPage>} />
          <Route path="compras" element={<LazyPage><GuardaModulo modulo="COMPRAS_XML"><Compras /></GuardaModulo></LazyPage>} />
          <Route path="maquininhas" element={<LazyPage><GuardaModulo modulo="FINANCEIRO_COMPLETO"><Maquininhas /></GuardaModulo></LazyPage>} />
          <Route path="comissoes" element={<LazyPage><GuardaModulo modulo="FINANCEIRO_COMPLETO"><Comissoes /></GuardaModulo></LazyPage>} />
          <Route path="os" element={<LazyPage><GuardaModulo modulo="ORDEM_SERVICO"><DashboardKanban /></GuardaModulo></LazyPage>} />
          <Route path="os/:id" element={<LazyPage><GuardaModulo modulo="ORDEM_SERVICO"><OSDetail /></GuardaModulo></LazyPage>} />
          <Route path="financeiro" element={<LazyPage><GuardaModulo modulo="FINANCEIRO_COMPLETO"><Financeiro /></GuardaModulo></LazyPage>} />
          <Route path="usuarios" element={<AdminOnly><LazyPage><UserManagement /></LazyPage></AdminOnly>} />
          <Route path="fiscal" element={<AdminOnly><LazyPage><FiscalConfigPage /></LazyPage></AdminOnly>} />
          <Route path="desenvolvedor" element={<DevOnly><LazyPage><PainelDesenvolvedor /></LazyPage></DevOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
