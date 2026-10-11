import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estados de carregamento — Onda 1.
 * Todo async da UI deve ter um destes (loading/empty/error/offline).
 */
export function LoadingState({
  title = 'Carregando…',
  description,
  compact = false,
  className,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-6' : 'gap-3 py-14',
        className,
      )}
    >
      <Loader2
        className="h-5 w-5 animate-spin text-brand"
        aria-hidden
      />
      <p className="text-sm font-medium text-secondary">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-muted">{description}</p>
      )}
      <span className="sr-only">Carregando conteúdo, aguarde.</span>
    </div>
  );
}

/** Indicador inline (botões, linhas de tabela, toolbars). */
export function InlineLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 text-xs text-secondary"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden />
      {label}
    </span>
  );
}

/** Skeleton em grade — substitui o conteúdo de listas/tabelas durante fetch. */
export function LoadingRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded bg-border"
        />
      ))}
      <span className="sr-only">Carregando linhas…</span>
    </div>
  );
}
