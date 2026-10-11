import * as React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { badgeVariantForStatus, labelStatus, FLUXO_CLIENTE, fmtData } from '@/components/portal/status';
import type { RastreioEvento, RastreioOS } from '@/lib/rastreioApi';

/**
 * Blocos de status do Portal do Cliente (ONDA 2E).
 * Semáforo + etapas canônicas + timeline — sem dados sensíveis de grau (LGPD).
 */

export function CardResumo({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-brand">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <span className="block text-[11px] uppercase text-muted">{label}</span>
          <div className="mt-0.5 truncate text-sm font-semibold text-primary">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Semáforo do status atual — variantes do kit espelham o mapa .status-* do tema. */
export function SemaforoStatus({ status }: { status?: string }) {
  return (
    <Badge variant={badgeVariantForStatus(status)}>{labelStatus(status)}</Badge>
  );
}

/** Etapas canônicas da OS — concluída / atual / pendente. */
export function EtapasPedido({ status }: { status?: string }) {
  if (status === 'CANCELADO') {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded border border-danger-light bg-danger-light px-3 py-2.5 text-sm text-danger-dark"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Esta OS foi cancelada. Fale com a ótica para mais informações.</span>
      </div>
    );
  }

  // Status fora do fluxo canônico (ex.: RETRABALHO vindo do painel interno):
  // não marcamos nenhuma etapa como "atual" para não mentir ao cliente — o
  // semáforo do resumo continua mostrando o status real.
  const idxAtual = FLUXO_CLIENTE.indexOf((status ?? 'ORCAMENTO') as (typeof FLUXO_CLIENTE)[number]);
  const foraDoFluxo = idxAtual === -1 && status !== undefined;

  return (
    <div className="space-y-3">
      {foraDoFluxo && (
        <p
          role="status"
          className="flex items-center gap-2 rounded border border-warning-light bg-warning-light px-3 py-2 text-xs font-medium text-warning-dark"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Seu pedido está em etapa especial de reanálise. Fale com a ótica para detalhes.
        </p>
      )}
      <ol className="space-y-0">
        {FLUXO_CLIENTE.map((etapa, idx) => {
          const concluida = idx < idxAtual;
          const atual = idx === idxAtual;
          return (
            <li key={etapa} className="relative flex gap-3 pb-4 last:pb-0">
              {idx < FLUXO_CLIENTE.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[9px] top-5 h-[calc(100%-14px)] w-px',
                    concluida ? 'bg-success' : 'bg-border',
                  )}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  'relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2',
                  concluida
                    ? 'border-success bg-success text-primary-foreground'
                    : atual
                      ? 'border-primary bg-primary-light text-brand'
                      : 'border-border bg-card',
                )}
              >
                {concluida && <CheckCircle2 className="h-3 w-3" aria-hidden />}
                {atual && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'text-sm',
                    atual ? 'font-semibold text-primary' : concluida ? 'text-secondary' : 'text-muted',
                  )}
                >
                  {labelStatus(etapa)}
                </span>
                {atual && (
                  <span className="mt-1 block">
                    <SemaforoStatus status={status} />
                  </span>
                )}
              </span>
              {atual && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-label="Etapa atual" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Timeline de movimentações (EventoOS) — mais recente por último. */
export function TimelineOs({ eventos }: { eventos: NonNullable<RastreioOS['timeline']> }) {
  if (eventos.length === 0) {
    return (
      <p className="rounded border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
        Ainda não há movimentações registradas. A ótica atualiza esta timeline a cada etapa do pedido.
      </p>
    );
  }

  const ordenados: RastreioEvento[] = [...eventos].sort((a, b) => {
    const ta = a.dataHora ? new Date(a.dataHora).getTime() : 0;
    const tb = b.dataHora ? new Date(b.dataHora).getTime() : 0;
    return ta - tb;
  });

  return (
    <div className="relative pl-6">
      <span aria-hidden className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-border" />
      {ordenados.map((ev, index) => {
        const ultimo = index === ordenados.length - 1;
        return (
          <div key={ev.id ?? `${ev.dataHora ?? ''}-${index}`} className="relative pb-5 last:pb-0">
            <span
              aria-hidden
              className={cn(
                'absolute -left-1 top-1 h-3 w-3 rounded-full border-2 border-card',
                ultimo ? 'bg-primary' : 'bg-border-strong',
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-muted">{fmtData(ev.dataHora, true)}</span>
              <Badge variant={badgeVariantForStatus(ev.statusNovo)} className="px-2 py-0.5 text-[11px]">
                {labelStatus(ev.statusNovo)}
              </Badge>
            </div>
            {ev.observacao && <p className="mt-1 text-xs text-secondary">{ev.observacao}</p>}
          </div>
        );
      })}
    </div>
  );
}
