import * as React from 'react';
import { cn } from '@/lib/utils';
import { statusText, type SlaTone } from '@/components/os/osDomain';

/**
 * StatusBadge / StatusDot / SlaChip — cores dos tokens `status-*` de
 * `theme-visionbox.css` (mapeamento semântico da máquina de 12 status),
 * traduzidas para utilitários Tailwind (nenhum hex, nenhuma classe legada).
 */

export type StatusTone = 'info' | 'warning' | 'brand' | 'success' | 'danger';

const TONE_CLASS: Record<StatusTone, string> = {
  info: 'bg-info-light text-info',
  warning: 'bg-warning-light text-warning-dark',
  brand: 'bg-primary-light text-brand',
  success: 'bg-success-light text-success-dark',
  danger: 'bg-danger-light text-danger-dark',
};

/** Mesmo agrupamento de `.status-*` em theme-visionbox.css. */
const TONE_BY_STATUS: Record<string, StatusTone> = {
  ORCAMENTO: 'info',
  PEDIDO_CONFIRMADO: 'info',
  ENVIADO_LABORATORIO: 'warning',
  EM_PRODUCAO: 'warning',
  LENTE_PRONTA: 'brand',
  MONTAGEM: 'brand',
  CONTROLE_QUALIDADE: 'brand',
  PRONTO_PARA_RETIRADA: 'success',
  ENTREGUE: 'success',
  CANCELADO: 'danger',
  RETRABALHO: 'danger',
  DEVOLVIDO_GARANTIA: 'danger',
};

export function statusTone(status?: string | null): StatusTone {
  if (!status) return 'info';
  return TONE_BY_STATUS[status] ?? 'info';
}

export function statusToneClasses(status?: string | null): string {
  return TONE_CLASS[statusTone(status)];
}

export function StatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium',
        statusToneClasses(status),
        className,
      )}
    >
      {statusText(status)}
    </span>
  );
}

/** Ponto colorido da timeline (semáforo de status). */
export function StatusDot({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('block h-3 w-3 shrink-0 rounded-full border border-border', statusToneClasses(status), className)}
    />
  );
}

const SLA_CLASS: Record<SlaTone, string> = {
  ok: 'bg-success-light text-success-dark',
  atencao: 'bg-warning-light text-warning-dark',
  atrasado: 'bg-danger-light text-danger-dark',
};

const SLA_LABEL: Record<SlaTone, string> = {
  ok: 'SLA no prazo',
  atencao: 'SLA em atenção',
  atrasado: 'SLA atrasado',
};

/** Semáforo SLA (ok / atenção / atrasado) com tokens success/warning/danger. */
export function SlaChip({
  tone,
  label,
  className,
}: {
  tone: SlaTone;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        SLA_CLASS[tone],
        className,
      )}
      title={SLA_LABEL[tone]}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? SLA_LABEL[tone]}
    </span>
  );
}
