import * as React from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnline } from '@/hooks/useOnline';

export function OfflineBanner({ pendingCount }: { pendingCount?: number }) {
  const online = useOnline();
  if (online && (!pendingCount || pendingCount === 0)) return null;
  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]"
      >
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        <span className="font-medium">Você está offline • operação em fila local (outbox) • sincroniza quando a rede voltar</span>
        {typeof pendingCount === 'number' && pendingCount > 0 && (
          <span className="ml-auto rounded-full bg-[var(--color-bg-card)] px-2 py-0.5 text-xs font-semibold">{pendingCount} pendentes</span>
        )}
      </div>
    );
  }
  // online mas com pendências
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-warning-light)] bg-[var(--color-warning-light)] px-3 py-2 text-sm text-[var(--color-warning-dark)]"
    >
      <Wifi className="h-4 w-4 shrink-0" aria-hidden />
      <span>Sincronizando • {pendingCount} na fila do outbox</span>
    </div>
  );
}

export function OnlineOnlyHint() {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="text-xs text-[var(--color-danger-dark)]">Sem conexão — dados exibidos do cache local.</p>
  );
}
