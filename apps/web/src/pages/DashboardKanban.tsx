import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Eye, Factory, Filter, MoreHorizontal, PackageCheck, Plus, RefreshCw, Search, Timer, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PageResponse, OrdemServicoDTO } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { statusLabel, statusClass, type StatusOS } from '@/lib/osStatus';
import { useDebounce, useOnline } from '@/hooks/useOnline';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';

const columns: { id: string; title: string; statuses: StatusOS[] }[] = [
  { id: 'orcamento', title: 'Orçamento', statuses: ['ORCAMENTO', 'PEDIDO_CONFIRMADO'] },
  { id: 'producao', title: 'Em Produção', statuses: ['ENVIADO_LABORATORIO', 'EM_PRODUCAO'] },
  { id: 'montagem', title: 'Montagem', statuses: ['LENTE_PRONTA', 'MONTAGEM'] },
  { id: 'qualidade', title: 'Controle Qualidade', statuses: ['CONTROLE_QUALIDADE'] },
  { id: 'pronto', title: 'Pronto p/ Retirada', statuses: ['PRONTO_PARA_RETIRADA'] },
];

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  tone: 'danger' | 'warning' | 'success' | 'info';
}) {
  const toneMap: Record<string, string> = {
    danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]',
    warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
    success: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]',
    info: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={`flex h-14 w-14 items-center justify-center rounded-[var(--radius)] ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[var(--color-text-primary)]">{label}</p>
          <p className="text-3xl font-bold leading-none text-[var(--color-text-primary)]">{value}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{sub}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full ${toneMap[tone]}`}>
          <ChevronRight className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function OrdersChart({ ordens }: { ordens: OrdemServicoDTO[] }) {
  const series = React.useMemo(() => {
    const buckets = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const base = buckets.map((label) => ({ label, recebidas: 0, producao: 0, prontas: 0, atrasadas: 0 }));
    ordens.forEach((os, index) => {
      const date = os.criadoEm ?? os.previsao ?? os.previsaoEntrega;
      const day = date ? new Date(date).getDay() : index % 7;
      const slot = base[(day + 6) % 7];
      slot.recebidas += 1;
      if (['ENVIADO_LABORATORIO', 'EM_PRODUCAO'].includes(os.status)) slot.producao += 1;
      if (os.status === 'PRONTO_PARA_RETIRADA') slot.prontas += 1;
      const explicitSla = (os.sla ?? os.slaStatus ?? '').toString().toLowerCase();
      const previsao = os.previsao ?? os.previsaoEntrega;
      if (explicitSla.includes('atrasado') || (previsao && new Date(previsao).getTime() < Date.now())) slot.atrasadas += 1;
    });
    return base;
  }, [ordens]);
  const max = Math.max(1, ...series.map((s) => s.recebidas + s.producao + s.prontas + s.atrasadas));
  const totals = series.reduce(
    (acc, item) => ({
      recebidas: acc.recebidas + item.recebidas,
      producao: acc.producao + item.producao,
      prontas: acc.prontas + item.prontas,
      atrasadas: acc.atrasadas + item.atrasadas,
    }),
    { recebidas: 0, producao: 0, prontas: 0, atrasadas: 0 },
  );

  return (
    <Card className="overflow-hidden lg:col-span-3">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-5 w-5" /> Ordens de Serviço
        </CardTitle>
        <span className="inline-flex h-8 items-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-xs font-medium text-[var(--color-text-secondary)]">
          Últimos 7 dias
        </span>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="flex h-48 items-end gap-5 border-t border-[var(--color-border)] pt-4">
          {series.map((item) => {
            const total = item.recebidas + item.producao + item.prontas + item.atrasadas;
            return (
              <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-full w-full max-w-9 items-end overflow-hidden rounded-t-[var(--radius)] bg-[var(--color-primary-light)]">
                  <div className="w-full bg-[var(--color-secondary)]" style={{ height: `${(item.recebidas / max) * 100}%` }} />
                  <div className="w-full bg-[var(--color-success)]" style={{ height: `${(item.prontas / max) * 100}%` }} />
                  <div className="w-full bg-[var(--color-bg-panel)]" style={{ height: `${(item.producao / max) * 100}%` }} />
                  <div className="w-full bg-[var(--color-danger)]" style={{ height: `${(item.atrasadas / max) * 100}%` }} />
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">{item.label}</span>
                <span className="sr-only">{total} ordens</span>
              </div>
            );
          })}
        </div>
        <div className="space-y-4 self-center text-sm">
          {[
            ['Recebidas', totals.recebidas, 'bg-[var(--color-secondary-light)] text-[var(--color-info)]'],
            ['Em produção', totals.producao, 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]'],
            ['Prontas', totals.prontas, 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]'],
            ['Atrasadas', totals.atrasadas, 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]'],
          ].map(([label, value, className]) => (
            <div key={label as string} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className={`flex h-7 w-7 items-center justify-center rounded ${className}` as string}>
                  <PackageCheck className="h-3.5 w-3.5" />
                </span>
                {label}
              </span>
              <strong className="text-lg text-[var(--color-text-primary)]">{value}</strong>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PromoPanel() {
  return (
    <Card className="relative overflow-hidden lg:col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border)] shadow-[var(--shadow-soft)] p-0 bg-[var(--color-bg-panel)] flex items-center justify-center">
      <img
        src="/assets/dashboard-banner.png"
        alt="Mais organização - Clientes mais satisfeitos. Controle, agilidade e resultados para sua ótica."
        className="w-full h-full min-h-[240px] max-h-[300px] object-cover object-center"
      />
    </Card>
  );
}

function LatestOrdersTable({ ordens }: { ordens: OrdemServicoDTO[] }) {
  const latest = ordens.slice(0, 5);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-5 w-5" /> Últimas ordens de serviço
        </CardTitle>
        <Link to="/os"><Button variant="outline" size="sm">Ver todas <ChevronRight className="ml-1 h-4 w-4" /></Button></Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-primary-light)] text-xs text-[var(--color-text-primary)]">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">#OS</th>
                <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                <th className="px-6 py-3 text-left font-semibold">Produto / Serviço</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-left font-semibold">Previsão</th>
                <th className="px-6 py-3 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {latest.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-muted)]">Nenhuma ordem de serviço encontrada.</td>
                </tr>
              ) : latest.map((os) => {
                const status = os.status as StatusOS;
                const produto = os.produto ?? ([os.armacaoId ? 'Armação' : null, os.lenteId ? 'Lente' : null].filter(Boolean).join(' + ') || 'Itens da OS');
                const previsao = os.previsao ?? os.previsaoEntrega;
                return (
                  <tr key={os.id} className="border-b border-[var(--color-border)] last:border-b-0">
                    <td className="px-6 py-3 font-mono font-semibold">{os.numero ?? os.id.slice(0, 8)}</td>
                    <td className="px-6 py-3">{os.cliente ?? 'Cliente não identificado'}</td>
                    <td className="px-6 py-3 text-[var(--color-text-secondary)]">{produto}</td>
                    <td className="px-6 py-3">
                      <span className={`badge ${statusClass[status] ?? 'status-orcamento'}`}>{statusLabel[status] ?? os.status}</span>
                    </td>
                    <td className="px-6 py-3">{previsao ? new Date(previsao).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-6 py-3 text-center">
                      <Link to={`/os/${os.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius)] border border-[var(--color-border)]">
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function OSCardView({ os }: { os: OrdemServicoDTO }) {
  const sla = (os.sla ?? os.slaStatus ?? 'ok').toString().toLowerCase() as 'atrasado' | 'atencao' | 'ok';
  const slaColor =
    sla === 'atrasado'
      ? 'text-[var(--color-danger)]'
      : sla === 'atencao'
        ? 'text-[var(--color-warning-dark)]'
        : 'text-[var(--color-text-muted)]';
  const status = os.status as StatusOS;
  const previsao = os.previsao ?? os.previsaoEntrega;
  const valor = os.valor ?? os.total ?? 0;
  const titulo = os.numero ?? os.id;
  const cliente = os.cliente ?? (os.clienteId ? `Cliente ${os.clienteId.slice(0, 8)}` : 'Cliente não identificado');
  const produto = os.produto ?? ([os.armacaoId ? 'armação vinculada' : null, os.lenteId ? 'lente vinculada' : null].filter(Boolean).join(' + ') || 'Itens da OS');
  return (
    <Link
      to={`/os/${os.id}`}
      className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-[var(--color-primary)]">{titulo}</span>
        <span className={`badge ${statusClass[status] ?? 'status-orcamento'} rounded-full px-2 py-0.5 text-[11px] font-medium`}>
          {statusLabel[status] ?? os.status}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium leading-tight text-[var(--color-text-primary)]">{cliente}</p>
      <p className="text-xs text-[var(--color-text-muted)]">
        {os.cpfMasked ?? '***'} • {os.vendedor ?? '—'}
      </p>
      <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text-secondary)]">{produto}</p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className={slaColor}>Prazo: {previsao ? new Date(previsao).toLocaleDateString('pt-BR') : '—'}</span>
        <span className="font-semibold text-[var(--color-text-primary)]">
          {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>
    </Link>
  );
}

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5" aria-busy="true" aria-label="Carregando Kanban">
      {columns.map((col) => (
        <div key={col.id} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <Skeleton className="h-4 w-24" />
          <div className="mt-3 space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyStateKanban({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
        <PackageCheck className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Nenhuma OS encontrada</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">
        Ajuste os filtros ou crie um orçamento no PDV para gerar a primeira OS.
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      )}
      <Link to="/pdv" className="mt-4 inline-flex">
        <Button variant="primary" size="sm">
          Ir para PDV
        </Button>
      </Link>
    </div>
  );
}

function ReadinessItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneMap: Record<string, string> = {
    success: 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]',
    warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
    danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]',
    info: 'bg-[var(--color-info-light)] text-[var(--color-info)]',
  };

  return (
    <div className="min-w-0 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3">
      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</p>
      <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-sm font-semibold ${toneMap[tone]}`}>{value}</p>
    </div>
  );
}

function PilotReadinessPanel({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: { atrasadas: number; producao: number; prontas: number; slaPct: number; total: number };
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const online = useOnline();
  const hasData = stats.total > 0;
  const blocked = stats.atrasadas > 0 || !online;
  const attention = stats.prontas > 0 || stats.producao > 0;

  const badge = !online
    ? { label: 'Offline', variant: 'danger' as const }
    : blocked
      ? { label: 'Ajustar SLA', variant: 'danger' as const }
      : attention
        ? { label: 'Pronto para piloto', variant: 'success' as const }
        : { label: 'Aguardando OS', variant: 'warning' as const };

  if (loading) {
    return (
      <Card aria-busy="true" aria-label="Carregando prontidão M2">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error && !hasData) {
    return <ErrorState error={error} onRetry={onRetry} compact />;
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle>Painel de prontidão M2</CardTitle>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Piloto 2 óticas • leitura operacional da fila atual</p>
        </div>
        <Badge variant={badge.variant} className="shrink-0">
          {badge.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!online && (
          <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            <span>Modo offline ativo: validar PDV/outbox antes de abrir loja piloto.</span>
          </div>
        )}

        {!hasData ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-page)] p-4 text-sm text-[var(--color-text-secondary)]">
            Nenhuma OS carregada para medir prontidão. Assim que houver dados, este painel mostra SLA, fila de laboratório e retirada.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReadinessItem label="Base visível" value={`${stats.total} OS`} tone="info" />
            <ReadinessItem label="SLA atrasado" value={stats.atrasadas} tone={stats.atrasadas > 0 ? 'danger' : 'success'} />
            <ReadinessItem label="Fila laboratório" value={stats.producao} tone={stats.producao > 8 ? 'warning' : 'info'} />
            <ReadinessItem label="Retirada pendente" value={stats.prontas} tone={stats.prontas > 0 ? 'warning' : 'success'} />
          </div>
        )}

        <div className="grid gap-2 text-xs text-[var(--color-text-secondary)] sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success-dark)]" aria-hidden />
            <span>Login, dashboard, PDV e OS disponíveis</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--color-success-dark)]" aria-hidden />
            <span>Dados recentes sem recarregar a tela</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning-dark)]" aria-hidden />
            <span>Integrações externas em validação</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type OrdensPage = PageResponse<OrdemServicoDTO>;

const STATUS_TERMINAL = new Set<string>(['ENTREGUE', 'CANCELADO', 'DEVOLVIDO_GARANTIA']);

function ehAtrasada(o: OrdemServicoDTO): boolean {
  const explicitSla = (o.sla ?? o.slaStatus ?? '').toString().toLowerCase();
  if (explicitSla.includes('atrasado')) return true;
  const previsao = o.previsao ?? o.previsaoEntrega;
  return Boolean(previsao && !STATUS_TERMINAL.has(o.status) && new Date(previsao).getTime() < Date.now());
}

export default function DashboardKanban() {
  const location = useLocation();
  const [q, setQ] = React.useState('');
  const [apenasAtrasadas, setApenasAtrasadas] = React.useState(false);
  const debouncedQ = useDebounce(q, 350);
  const [page] = React.useState(0);
  const size = 100; // kanban precisa volume maior por página

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['ordens-servico', { q: debouncedQ, page, size }],
    queryFn: async () => {
      const res = await apiClient.get<OrdensPage | OrdemServicoDTO[]>('/v1/ordens-servico', {
        params: { page, size, search: debouncedQ || undefined, q: debouncedQ || undefined },
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

  const ordens: OrdemServicoDTO[] = React.useMemo(() => unwrapPage(data as OrdensPage | OrdemServicoDTO[]), [data]);

  const filtered = React.useMemo(() => {
    const base = apenasAtrasadas ? ordens.filter(ehAtrasada) : ordens;
    if (!debouncedQ) return base;
    const l = debouncedQ.toLowerCase();
    return base.filter((o) => {
      const haystack = [o.id, o.numero, o.cliente, o.clienteId, o.produto, o.armacaoId, o.lenteId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(l);
    });
  }, [ordens, debouncedQ, apenasAtrasadas]);

  const stats = React.useMemo(() => {
    const terminal = new Set(['ENTREGUE', 'CANCELADO', 'DEVOLVIDO_GARANTIA']);
    const now = Date.now();
    const atrasadas = ordens.filter((o) => {
      const explicitSla = (o.sla ?? o.slaStatus ?? '').toString().toLowerCase();
      if (explicitSla.includes('atrasado')) return true;
      const previsao = o.previsao ?? o.previsaoEntrega;
      return Boolean(previsao && !terminal.has(o.status) && new Date(previsao).getTime() < now);
    }).length;
    const producao = ordens.filter((o) => ['EM_PRODUCAO', 'ENVIADO_LABORATORIO'].includes(o.status)).length;
    const prontas = ordens.filter((o) => o.status === 'PRONTO_PARA_RETIRADA').length;
    const abertas = ordens.filter((o) => !terminal.has(o.status)).length;
    const slaPct = abertas === 0 ? 0 : Math.round(((abertas - atrasadas) / abertas) * 100);
    return { atrasadas, producao, prontas, slaPct, total: ordens.length };
  }, [ordens]);

  const isDashboard = location.pathname === '/';

  if (isDashboard) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Dashboard</h1>
            <p className="text-base text-[var(--color-text-secondary)]">Visão geral da sua ótica em um só lugar.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 text-sm font-medium text-[var(--color-text-secondary)]">
              <CalendarDays className="h-4 w-4" /> Hoje, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            <Link to="/pdv">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Nova OS
              </Button>
            </Link>
            <Button variant="outline" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </div>

        <OfflineBanner />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Atrasadas" value={stats.atrasadas} sub="OS em atraso" icon={AlertTriangle} tone="danger" />
          <MetricCard label="Em produção" value={stats.producao} sub="No laboratório" icon={Factory} tone="warning" />
          <MetricCard label="Prontas p/ retirada" value={stats.prontas} sub="Notificar cliente" icon={PackageCheck} tone="success" />
          <MetricCard label="SLA no prazo" value={`${stats.slaPct}%`} sub="Últimos 7 dias" icon={Timer} tone="info" />
        </div>

        {stats.atrasadas > 0 && (
          <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-6 py-4 text-[var(--color-danger-dark)] shadow-[var(--shadow-soft)]">
            <AlertTriangle className="h-7 w-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Existem {stats.atrasadas} ordens de serviço em atraso.</p>
              <p className="text-sm">Atenda essas OS para manter a satisfação dos seus clientes.</p>
            </div>
            <Link to="/os">
              <Button variant="destructive" className="gap-2">Ver ordens <ChevronRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-5">
            <Skeleton className="h-64 lg:col-span-3" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        ) : isError ? (
          <ErrorState error={error as ApiError} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-5">
              <OrdersChart ordens={ordens} />
              <PromoPanel />
            </div>
            <LatestOrdersTable ordens={ordens} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Dashboard — Ordens de Serviço</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Máquina de 12 status • SLA por loja • timeline auditável</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Link to="/pdv">
            <Button variant="primary" size="sm">
              Novo orçamento no PDV
            </Button>
          </Link>
        </div>
      </div>

      <OfflineBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Atrasadas" value={stats.atrasadas} sub="SLA estourado" icon={AlertTriangle} tone="danger" />
        <MetricCard label="Em produção" value={stats.producao} sub="No laboratório" icon={Factory} tone="warning" />
        <MetricCard label="Prontas p/ retirada" value={stats.prontas} sub="Notificar WhatsApp" icon={PackageCheck} tone="success" />
        <MetricCard label="SLA no prazo" value={`${stats.slaPct}%`} sub="últimos 7 dias" icon={Timer} tone="info" />
      </div>

      <PilotReadinessPanel stats={stats} loading={isLoading} error={isError ? error : null} onRetry={() => refetch()} />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">Kanban por status</CardTitle>
          <span className="text-xs text-[var(--color-text-muted)]">
            {isLoading ? 'carregando...' : `${filtered.length} OS`} {isFetching && '• atualizando'}
          </span>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar OS, cliente, produto…" className="pl-9" aria-label="Buscar OS" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setApenasAtrasadas((v) => !v)}
            aria-pressed={apenasAtrasadas}
            className={apenasAtrasadas ? 'border-[var(--color-danger)] text-[var(--color-danger-dark)]' : undefined}
          >
            <Filter className="mr-2 h-4 w-4" /> {apenasAtrasadas ? 'Somente atrasadas' : 'Filtros'}
          </Button>
          <Badge variant="outline" className="hidden sm:inline-flex">
            <Eye className="mr-1 h-3 w-3" /> Fila visível
          </Badge>
        </CardContent>
      </Card>

      {isLoading ? (
        <KanbanSkeleton />
      ) : isError ? (
        <ErrorState error={error as ApiError} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyStateKanban onRetry={() => setQ('')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {columns.map((col) => {
            const items = filtered.filter((o) => col.statuses.includes(o.status as StatusOS));
            return (
              <div key={col.id} className="flex flex-col rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                <div className="sticky top-0 flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{col.title}</h3>
                  <span className="rounded-full bg-[var(--color-bg-page)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{items.length}</span>
                </div>
                <div className="flex-1 space-y-3 p-3">
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Vazio</p>
                  ) : (
                    items.map((os) => <OSCardView key={os.id} os={os} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
