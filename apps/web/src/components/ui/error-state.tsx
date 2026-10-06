import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ApiError, ProblemDetail } from '@/lib/apiClient';

function problemMessage(err: unknown): { title: string; detail: string; problem?: ProblemDetail } {
  if (err instanceof Error && (err as ApiError).problem) {
    const e = err as ApiError;
    const p = e.problem!;
    return {
      title: p.title || (e.status ? `Erro ${e.status}` : 'Falha ao carregar'),
      detail: p.detail || p.message || e.message,
      problem: p,
    };
  }
  if (err instanceof Error) {
    return { title: 'Falha ao carregar', detail: err.message };
  }
  return { title: 'Falha ao carregar', detail: String(err) };
}

export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { title, detail, problem } = problemMessage(error);

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{detail}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-7 shrink-0">
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Tentar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-card)] text-[var(--color-danger)]">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--color-danger-dark)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-danger-dark)]/80">{detail}</p>
      {problem?.errors && problem.errors.length > 0 && (
        <ul className="mx-auto mt-3 max-w-md list-disc pl-5 text-left text-xs text-[var(--color-danger-dark)]/80">
          {problem.errors.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.field}:</span> {e.message}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <Button variant="destructive" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      )}
    </div>
  );
}
