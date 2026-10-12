import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarDays,
  Factory,
  PackageCheck,
  Plus,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyKanban } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PageResponse, OrdemServicoDTO } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';
import { useAuthStore } from '@/stores/authStore';
import { MetricCard } from '@/components/os/MetricCard';
import { OrdersChart } from '@/components/os/OrdersChart';
import { LatestOrdersTable } from '@/components/os/LatestOrdersTable';
import { PilotReadinessPanel } from '@/components/os/PilotReadinessPanel';
import { KanbanBoard, KanbanSkeleton } from '@/components/os/KanbanBoard';
import { AlertaAtrasadas, FiltrosOS, PromoPanel } from '@/components/os/QueueFilters';
import {
  KANBAN_COLUMNS,
  computeStats,
  filtrarOrdens,
  podeMovimentarOS,
  statusText,
} from '@/components/os/osDomain';

type OrdensPage = PageResponse<OrdemServicoDTO>;

const SIZE_KANBAN = 100; // kanban precisa de volume maior por página

export default function DashboardKanban() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const perfil = useAuthStore((s) => s.user?.perfil);

  const [q, setQ] = React.useState('');
  const [statusFiltro, setStatusFiltro] = React.useState('ALL');
  const [apenasAtrasadas, setApenasAtrasadas] = React.useState(false);
  const debouncedQ = useDebounce(q, 350);
  const [page] = React.useState(0);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const isDashboard = location.pathname === '/';

  /* ---- Query 1: fila de OS (GET /ordens-servico) ---- */
  const ordensQuery = useQuery({
    queryKey: ['ordens-servico', { q: debouncedQ, page, size: SIZE_KANBAN }],
    queryFn: async () => {
      const res = await apiClient.get<OrdensPage | OrdemServicoDTO[]>('/v1/ordens-servico', {
        params: { page, size: SIZE_KANBAN, search: debouncedQ || undefined, q: debouncedQ || undefined },
      });
      return res.data;
    },
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  /* ---- Query 2: SLA do servidor (GET /ordens-servico/atrasadas) ---- */
  const atrasadasQuery = useQuery({
    queryKey: ['ordens-servico', 'atrasadas', { size: 1 }],
    queryFn: async () => {
      const res = await apiClient.get<OrdensPage | OrdemServicoDTO[]>('/v1/ordens-servico/atrasadas', {
        params: { page: 0, size: 1 },
      });
      return res.data;
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const ordens = React.useMemo(
    () => unwrapPage(ordensQuery.data as OrdensPage | OrdemServicoDTO[]),
    [ordensQuery.data],
  );

  const stats = React.useMemo(() => computeStats(ordens), [ordens]);

  /** Total de atrasadas: fonte do servidor quando disponível (conta > 100 itens). */
  const atrasadasTotal = React.useMemo(() => {
    const server = atrasadasQuery.data as OrdensPage | OrdemServicoDTO[] | undefined;
    if (!server) return stats.atrasadas;
    if (!Array.isArray(server) && typeof server.totalElements === 'number') return server.totalElements;
    return Math.max(stats.atrasadas, unwrapPage(server).length);
  }, [atrasadasQuery.data, stats.atrasadas]);

  const filtradas = React.useMemo(
    () =>
      filtrarOrdens(ordens, {
        busca: debouncedQ,
        somenteAtrasadas: apenasAtrasadas,
        status: statusFiltro,
      }),
    [ordens, debouncedQ, apenasAtrasadas, statusFiltro],
  );

  /* ---- Mutação: mover OS (PATCH /ordens-servico/{id}/status) ---- */
  const moverMutation = useMutation({
    mutationFn: async ({ id, novoStatus }: { id: string; novoStatus: string }) => {
      const res = await apiClient.patch<OrdemServicoDTO>(`/v1/ordens-servico/${id}/status`, {
        novoStatus,
        responsavel: 'operador',
        observacao: 'Movido pela tela de OS',
      });
      return res.data;
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(['ordem-servico', vars.id], data);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      toast({
        title: 'Status atualizado',
        description: `OS movida para ${statusText(vars.novoStatus)}.`,
        variant: 'success',
      });
    },
    onError: (err) => {
      toast({
        title: 'Não foi possível mover a OS',
        description: err instanceof ApiError ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    },
  });

  /* ---- Atalho de teclado: / foca a busca (operação intensiva) ---- */
  React.useEffect(() => {
    if (isDashboard) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const emCampo = tag === 'input' || tag === 'textarea' || tag === 'select' || !!el?.isContentEditable;
      if (e.key === '/' && !emCampo) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQ('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDashboard]);

  const limparFiltros = () => {
    setQ('');
    setStatusFiltro('ALL');
    setApenasAtrasadas(false);
  };

  const { isLoading, isError, error, refetch, isFetching } = ordensQuery;

  /* ---------------------------------------------------------------- */
  /* Rota "/" — dashboard operacional                                  */
  /* ---------------------------------------------------------------- */
  if (isDashboard) {
    return (
      <div className="space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-secondary sm:text-base">
              Visão geral da sua ótica em um só lugar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden h-10 items-center gap-2 rounded border border-border bg-card px-4 text-sm font-medium text-secondary md:inline-flex">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <Button asChild>
              <Link to="/pdv">
                <Plus className="mr-2 h-4 w-4" aria-hidden /> Nova OS
              </Link>
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
              Atualizar
            </Button>
          </div>
        </header>

        <OfflineBanner />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Atrasadas" value={atrasadasTotal} sub="OS em atraso" icon={AlertTriangle} tone="danger" />
          <MetricCard label="Em produção" value={stats.producao} sub="No laboratório" icon={Factory} tone="warning" />
          <MetricCard label="Prontas p/ retirada" value={stats.prontas} sub="Notificar cliente" icon={PackageCheck} tone="success" />
          <MetricCard label="SLA no prazo" value={`${stats.slaPct}%`} sub="Fila carregada" icon={Timer} tone="info" />
        </div>

        <AlertaAtrasadas total={atrasadasTotal} />

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-5" aria-busy="true" aria-label="Carregando painéis">
            <Skeleton className="h-64 lg:col-span-3" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        ) : isError ? (
          <ErrorState error={error as ApiError} onRetry={() => refetch()} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-5">
            <OrdersChart ordens={ordens} />
            <PromoPanel ordens={ordens} />
          </div>
        )}

        {!isLoading && !isError && <LatestOrdersTable ordens={ordens} />}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Rota "/os" — fila + kanban                                        */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            Dashboard — Ordens de Serviço
          </h1>
          <p className="text-sm text-secondary">
            Máquina de 12 status • SLA por loja • timeline auditável
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden /> Atualizar
          </Button>
          <Button asChild size="sm">
            <Link to="/pdv">Novo orçamento no PDV</Link>
          </Button>
        </div>
      </header>

      <OfflineBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Atrasadas" value={atrasadasTotal} sub="SLA estourado" icon={AlertTriangle} tone="danger" />
        <MetricCard label="Em produção" value={stats.producao} sub="No laboratório" icon={Factory} tone="warning" />
        <MetricCard label="Prontas p/ retirada" value={stats.prontas} sub="Notificar WhatsApp" icon={PackageCheck} tone="success" />
        <MetricCard label="SLA no prazo" value={`${stats.slaPct}%`} sub="Fila carregada" icon={Timer} tone="info" />
      </div>

      <AlertaAtrasadas total={atrasadasTotal} />

      <PilotReadinessPanel
        stats={stats}
        loading={isLoading}
        error={isError ? error : null}
        onRetry={() => refetch()}
      />

      <FiltrosOS
        busca={q}
        onBusca={setQ}
        status={statusFiltro}
        onStatus={setStatusFiltro}
        somenteAtrasadas={apenasAtrasadas}
        onToggleAtrasadas={() => setApenasAtrasadas((v) => !v)}
        onLimpar={limparFiltros}
        total={filtradas.length}
        buscando={isLoading || isFetching}
        searchRef={searchRef}
      />

      {isLoading ? (
        <KanbanSkeleton />
      ) : isError ? (
        <ErrorState error={error as ApiError} onRetry={() => refetch()} />
      ) : filtradas.length === 0 ? (
        <EmptyKanban onClear={limparFiltros} />
      ) : (
        <KanbanBoard
          ordens={filtradas}
          podeMover={podeMovimentarOS(perfil)}
          movingId={moverMutation.isPending ? moverMutation.variables?.id ?? null : null}
          onMover={(os, novoStatus) => moverMutation.mutate({ id: os.id, novoStatus })}
        />
      )}

      <p className="text-xs text-muted">
        Colunas da fila: {KANBAN_COLUMNS.map((c) => c.title).join(' • ')} • terminais fora do
        quadro: Entregue, Cancelado e Devolvido p/ Garantia.
      </p>
    </div>
  );
}
