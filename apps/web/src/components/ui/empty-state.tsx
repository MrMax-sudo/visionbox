import * as React from 'react';
import { PackageCheck, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({
  title = 'Nenhum resultado',
  description = 'Ajuste os filtros ou cadastre um novo registro.',
  icon: Icon = SearchX,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)]">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-text-secondary)]">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function EmptyKanban({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      title="Nenhuma OS encontrada"
      description="Ajuste os filtros ou crie um orçamento no PDV para gerar a primeira OS."
      icon={PackageCheck}
      action={
        onClear ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Limpar filtros
          </Button>
        ) : undefined
      }
    />
  );
}
