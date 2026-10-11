import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type MetricTone = 'info' | 'success' | 'warning' | 'danger';

const toneClass: Record<MetricTone, string> = {
  info: 'bg-info-light text-info',
  success: 'bg-success-light text-success-dark',
  warning: 'bg-warning-light text-warning-dark',
  danger: 'bg-danger-light text-danger-dark',
};

/** Card de indicador financeiro (tokens do tema — nenhum hex). */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  tone: MetricTone;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded',
            toneClass[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-secondary">{label}</p>
          <p className="truncate text-xl font-semibold tabular-nums text-primary">{value}</p>
          <p className="truncate text-xs text-muted">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
