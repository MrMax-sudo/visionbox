import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export type MetricTone = 'danger' | 'warning' | 'success' | 'info';

const TONE_CLASS: Record<MetricTone, string> = {
  danger: 'bg-danger-light text-danger-dark',
  warning: 'bg-warning-light text-warning-dark',
  success: 'bg-success-light text-success-dark',
  info: 'bg-info-light text-info',
};

/** Card de KPI do dashboard/kanban — 4 no topo, responsivo (1 → 2 → 4 colunas). */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  action,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone: MetricTone;
  /** Nodo opcional alinhado à direita (link/ação). */
  action?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <span
          aria-hidden
          className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded sm:h-12 sm:w-12', TONE_CLASS[tone])}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-secondary">{label}</p>
          <p className="text-2xl font-bold leading-tight text-primary">{value}</p>
          {sub && <p className="truncate text-xs text-muted">{sub}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
