import * as React from 'react';
import { FileClock, TimerOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge, StatusDot } from '@/components/os/StatusBadge';
import { eventoAposPrevisao, fmtDateTime } from '@/components/os/osDomain';
import type { OrdemServicoDTO } from '@/lib/types';
import { cn } from '@/lib/utils';

type EventoOS = NonNullable<OrdemServicoDTO['historico']>[number];

/**
 * OsTimeline — EventoOS em linha do tempo vertical com semáforo de status
 * (ponto colorido) e marcador de SLA estourado quando o evento ocorre depois
 * da previsão prometida ao cliente.
 */
export function OsTimeline({
  historico,
  previsao,
}: {
  historico: EventoOS[];
  previsao?: string;
}) {
  if (historico.length === 0) {
    return (
      <EmptyState
        icon={FileClock}
        title="Nenhum evento registrado"
        description="Assim que a OS mudar de status, cada transição aparece aqui com data, responsável e observação."
      />
    );
  }

  return (
    <ol className="relative ml-1 pl-6">
      <span
        aria-hidden
        className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-border"
      />
      {historico.map((ev, index) => {
        const isLast = index === historico.length - 1;
        const atrasado = eventoAposPrevisao(ev.dataHora, previsao);
        return (
          <li key={ev.id ?? index} className="relative pb-6 last:pb-0">
            <StatusDot
              status={ev.statusNovo}
              className={cn(
                'absolute -left-1 top-1',
                isLast && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {fmtDateTime(ev.dataHora)}
              </Badge>
              <StatusBadge status={ev.statusNovo} className="px-2 py-0.5 text-[11px]" />
              <span className="text-xs text-muted">por {ev.responsavel ?? 'sistema'}</span>
              {atrasado && (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger-light px-2 py-0.5 text-[11px] font-semibold text-danger-dark">
                  <TimerOff className="h-3 w-3" aria-hidden /> SLA estourado neste ponto
                </span>
              )}
            </div>
            {ev.observacao && <p className="mt-1 text-sm text-secondary">{ev.observacao}</p>}
            {ev.statusAnterior && (
              <p className="mt-0.5 text-[11px] text-muted">
                {ev.statusAnterior.replace(/_/g, ' ')} → {ev.statusNovo?.replace(/_/g, ' ')}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OsTimelineCard({
  historico,
  previsao,
}: {
  historico: EventoOS[];
  previsao?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileClock className="h-4 w-4 text-brand" aria-hidden /> Timeline da OS
        </CardTitle>
        <p className="text-xs text-muted">
          Toda transição validada gera um EventoOS auditável (máquina de 12 status).
        </p>
      </CardHeader>
      <CardContent>
        <OsTimeline historico={historico} previsao={previsao} />
      </CardContent>
    </Card>
  );
}
