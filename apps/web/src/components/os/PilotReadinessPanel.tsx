import * as React from 'react';
import { AlertTriangle, CheckCircle2, WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useOnline } from '@/hooks/useOnline';
import { cn } from '@/lib/utils';

export type ReadinessStats = {
  atrasadas: number;
  producao: number;
  prontas: number;
  slaPct: number;
  total: number;
};

const TONE_CLASS = {
  success: 'bg-success-light text-success-dark',
  warning: 'bg-warning-light text-warning-dark',
  danger: 'bg-danger-light text-danger-dark',
  info: 'bg-info-light text-info',
} as const;

function ReadinessItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <div className="min-w-0 rounded border border-border bg-page p-3">
      <p className="text-xs font-medium text-secondary">{label}</p>
      <p className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-sm font-semibold', TONE_CLASS[tone])}>
        {value}
      </p>
    </div>
  );
}

/** Painel de prontidão M2 — leitura operacional da fila (preservado da Onda 0). */
export function PilotReadinessPanel({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: ReadinessStats;
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
          <p className="mt-1 text-xs text-secondary">
            Piloto 2 óticas • leitura operacional da fila atual
          </p>
        </div>
        <Badge variant={badge.variant} className="shrink-0">
          {badge.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {!online && (
          <div className="flex items-center gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            <span>Modo offline ativo: validar PDV/outbox antes de abrir loja piloto.</span>
          </div>
        )}

        {!hasData ? (
          <div className="rounded border border-dashed border-border bg-page p-4 text-sm text-secondary">
            Nenhuma OS carregada para medir prontidão. Assim que houver dados, este painel mostra
            SLA, fila de laboratório e retirada.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ReadinessItem label="Base visível" value={`${stats.total} OS`} tone="info" />
            <ReadinessItem
              label="SLA atrasado"
              value={stats.atrasadas}
              tone={stats.atrasadas > 0 ? 'danger' : 'success'}
            />
            <ReadinessItem
              label="Fila laboratório"
              value={stats.producao}
              tone={stats.producao > 8 ? 'warning' : 'info'}
            />
            <ReadinessItem
              label="Retirada pendente"
              value={stats.prontas}
              tone={stats.prontas > 0 ? 'warning' : 'success'}
            />
          </div>
        )}

        <div className="grid gap-2 text-xs text-secondary sm:grid-cols-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-dark" aria-hidden />
            Login, dashboard, PDV e OS disponíveis
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-dark" aria-hidden />
            Dados recentes sem recarregar a tela
          </span>
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-dark" aria-hidden />
            Integrações externas em validação
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
