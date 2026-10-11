import * as React from 'react';
import { Link } from 'react-router-dom';
import { Download, Glasses, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/lib/pwa';
import { useOnline } from '@/hooks/useOnline';

/**
 * PortalChrome — chrome compartilhado dos portais públicos (ONDA 2E).
 * Sem AppShell: identidade de marca + offline banner + install PWA.
 */

export function PortalOffline({ mensagem }: { mensagem?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">
        {mensagem ?? 'Sem conexão — exibindo a última atualização carregada.'}
      </span>
    </div>
  );
}

export function PortalHeader({
  titulo,
  subtitulo,
  numeroOs,
  to = '/rastreio',
  instalar = false,
}: {
  titulo: string;
  subtitulo: string;
  /** Número da OS exibido como chip (quando já localizado). */
  numeroOs?: string;
  /** Rota de "nova busca"/volta do link do portal. */
  to?: string;
  /** Mostra o botão "Instalar app" quando o navegador disparar o prompt PWA. */
  instalar?: boolean;
}) {
  const { canInstall, instalando, install } = useInstallPrompt();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link to={to} className="flex min-w-0 items-center gap-3" aria-label={`${titulo} — nova busca`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-brand">
            <Glasses className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-primary">{titulo}</span>
            <span className="block truncate text-xs text-secondary">{subtitulo}</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {numeroOs && (
            <span className="hidden rounded-full border border-border px-2.5 py-1 font-mono text-xs text-secondary sm:inline-flex">
              OS {numeroOs}
            </span>
          )}
          {instalar && canInstall && (
            <Button variant="outline" size="sm" onClick={() => void install()} disabled={instalando} aria-label="Instalar aplicativo do portal">
              <Download className="mr-1.5 h-4 w-4" /> Instalar app
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function PortalFooter() {
  return (
    <footer className="mx-auto max-w-4xl px-4 py-6 text-center text-xs text-muted sm:px-6">
      <img src="/assets/icons/icon-192.png" alt="" aria-hidden className="mx-auto mb-2 h-8 w-8 rounded-lg" />
      <p>Portal oficial • dados atualizados pela ótica responsável pelo seu pedido.</p>
      <p className="mt-1">VisionBox — um novo olhar em gestão.</p>
    </footer>
  );
}
