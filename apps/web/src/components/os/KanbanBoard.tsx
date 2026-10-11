import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge, SlaChip } from '@/components/os/StatusBadge';
import {
  KANBAN_COLUMNS,
  brl,
  clienteDe,
  fmtDate,
  previsaoDe,
  produtoDe,
  proximosStatus,
  resolveSla,
  statusText,
  valorDe,
} from '@/components/os/osDomain';
import type { StatusOS } from '@/lib/osStatus';
import type { OrdemServicoDTO } from '@/lib/types';
import { cn } from '@/lib/utils';

const SLA_TEXT: Record<string, string> = {
  atrasado: 'font-semibold text-danger-dark',
  atencao: 'font-semibold text-warning-dark',
  ok: 'text-muted',
};

function OsCard({
  os,
  podeMover,
  moving,
  onMover,
}: {
  os: OrdemServicoDTO;
  podeMover: boolean;
  moving: boolean;
  onMover: (os: OrdemServicoDTO, novoStatus: string) => void;
}) {
  const sla = resolveSla(os);
  const previsao = previsaoDe(os);
  const titulo = os.numero ?? os.id;
  const proximos = proximosStatus(os.status);

  return (
    <article className="overflow-hidden rounded-card border border-border bg-card shadow-soft transition hover:border-border-strong">
      <Link
        to={`/os/${os.id}`}
        className="block p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs font-semibold text-brand">{titulo}</span>
          <StatusBadge status={os.status} className="shrink-0 px-2 py-0.5 text-[11px]" />
        </div>
        <p className="mt-2 truncate text-sm font-medium leading-tight text-primary">{clienteDe(os)}</p>
        <p className="truncate text-xs text-muted">
          {os.cpfMasked ?? '***'} • {os.vendedor ?? '—'}
        </p>
        <p className="mt-2 line-clamp-2 text-xs text-secondary">{produtoDe(os, 'Itens da OS')}</p>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className={cn('truncate', SLA_TEXT[sla] ?? SLA_TEXT.ok)}>
            Prazo: {previsao ? fmtDate(previsao) : '—'}
          </span>
          <span className="shrink-0 font-semibold text-primary">{brl(valorDe(os))}</span>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-page px-3 py-1.5">
        <SlaChip tone={sla} className="px-2 py-0.5 text-[11px]" />
        {podeMover && proximos.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={moving}
                className="h-7 gap-1 px-2 text-xs"
                aria-label={`Mover OS ${titulo} para outro status`}
              >
                {moving ? 'Movendo…' : 'Mover'}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuLabel>Mover para</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {proximos.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMover(os, s)} disabled={moving}>
                  <MoveRight className="h-4 w-4 text-muted" aria-hidden />
                  {statusText(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5" aria-busy="true" aria-label="Carregando Kanban">
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.id} className="rounded-card border border-border bg-card p-3">
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

/**
 * KanbanBoard — 5 colunas da fila operacional.
 * Movimentação por menu (teclado-first, sem lib de drag): PATCH /ordens-servico/{id}/status.
 */
export function KanbanBoard({
  ordens,
  podeMover,
  movingId,
  onMover,
}: {
  ordens: OrdemServicoDTO[];
  podeMover: boolean;
  movingId: string | null;
  onMover: (os: OrdemServicoDTO, novoStatus: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {KANBAN_COLUMNS.map((col) => {
        const items = ordens.filter((o) => col.statuses.includes(o.status as StatusOS));
        return (
          <section
            key={col.id}
            aria-label={`${col.title} — ${items.length} ordens`}
            className="flex min-w-0 flex-col rounded-card border border-border bg-card"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border bg-page px-3 py-2.5">
              <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-secondary">
                {col.title}
              </h3>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-secondary">
                {items.length}
              </span>
            </header>
            <div className="flex-1 space-y-3 p-3">
              {items.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted">Vazio</p>
              ) : (
                items.map((os) => (
                  <OsCard
                    key={os.id}
                    os={os}
                    podeMover={podeMover}
                    moving={movingId === os.id}
                    onMover={onMover}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
