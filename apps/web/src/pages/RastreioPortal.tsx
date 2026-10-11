import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortalFooter, PortalHeader } from '@/components/portal/PortalChrome';
import { BuscaOS, RastreioErro, RastreioSkeleton } from '@/components/portal/RastreioBusca';
import { RastreioView } from '@/components/portal/RastreioView';
import { fetchRastreioPorToken } from '@/lib/rastreioApi';
import { registerPortalServiceWorker, syncThemeColorMeta } from '@/lib/pwa';
import { useOnline } from '@/hooks/useOnline';

/**
 * Portal do Cliente (US17) — rastreio público da OS + 2ª via de garantia.
 *
 * Rota pública fora do layout autenticado (padrão /lab/:token), lazy-loaded no App.tsx.
 * Mobile-first, auto-refresh do status (60s com aba visível), PWA (sw.js + install).
 * Estados completos: idle/busca, loading, vazio (OS não encontrada), erro, offline.
 * Cores apenas via tokens / kit (R5) — sem hex, sem CSS legado.
 */

/** Intervalo de auto-refresh do status (pausa com aba oculta — default do react-query). */
const REFRESH_MS = 60_000;

function RastreioPorToken({ token }: { token: string }) {
  const navigate = useNavigate();
  const online = useOnline();

  const query = useQuery({
    queryKey: ['rastreio-token', token],
    queryFn: () => fetchRastreioPorToken(token),
    retry: 1,
    staleTime: 15_000,
    refetchInterval: REFRESH_MS,
    refetchOnReconnect: true,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {!online && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
        >
          <span className="font-medium">
            Sem conexão — exibindo a última atualização carregada.
          </span>
        </div>
      )}

      {query.isLoading && <RastreioSkeleton />}

      {!query.isLoading && query.isError && (
        <RastreioErro
          error={query.error}
          onRetry={() => void query.refetch()}
          onNovaBusca={() => navigate('/rastreio', { replace: true })}
        />
      )}

      {!query.isLoading && !query.isError && query.data && (
        <>
          <RastreioView dados={query.data} />
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="text-xs text-muted">
              Atualização automática do status a cada 1 min enquanto esta aba estiver aberta.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              aria-label="Atualizar status agora"
            >
              <RefreshCw className={query.isFetching ? 'mr-1.5 h-4 w-4 animate-spin' : 'mr-1.5 h-4 w-4'} />
              Atualizar agora
            </Button>
          </div>
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => navigate('/rastreio', { replace: true })}>
              <Search className="mr-2 h-4 w-4" /> Consultar outra OS
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function RastreioPortal() {
  const { token } = useParams<{ token: string }>();

  React.useEffect(() => {
    const prev = document.title;
    document.title = 'Rastreio de OS — Portal do Cliente VisionBox';
    const cleanupMeta = syncThemeColorMeta();
    registerPortalServiceWorker();
    return () => {
      document.title = prev;
      cleanupMeta();
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <PortalHeader
        titulo="Portal do Cliente"
        subtitulo="Rastreio da sua Ordem de Serviço"
        instalar
      />
      <main className="flex-1">
        {token ? <RastreioPorToken token={token} /> : <BuscaOS />}
      </main>
      <PortalFooter />
    </div>
  );
}
