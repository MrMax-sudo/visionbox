import * as React from 'react';
import { ChevronRight, Plus, Search, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { initials } from '@/components/pdv/pdvHelpers';
import type { ClienteDTO } from '@/lib/types';

type ClienteBuscaCardProps = {
  busca: string;
  onBuscaChange: (valor: string) => void;
  cliente: ClienteDTO | null;
  resultados: ClienteDTO[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onSelecionar: (cliente: ClienteDTO) => void;
  onRemover: () => void;
  onNovoCliente: () => void;
  onVerDados: () => void;
  className?: string;
};

const CARD_CLASS =
  'rounded-card border border-[var(--color-pdv-border)] bg-card-soft shadow-soft';

/**
 * Coluna 1 ( topo ) — cliente da venda: busca, seleção rápida e atalhos.
 * Estados: loading (Skeleton) / erro (ErrorState com retry) / vazio.
 */
export function ClienteBuscaCard({
  busca,
  onBuscaChange,
  cliente,
  resultados,
  isLoading,
  error,
  onRetry,
  onSelecionar,
  onRemover,
  onNovoCliente,
  onVerDados,
  className,
}: ClienteBuscaCardProps) {
  const mostrarResultados = busca.trim().length >= 2 && resultados.length > 0;

  return (
    <section className={cn(CARD_CLASS, 'shrink-0 p-3.5', className)} aria-label="Cliente da venda">
      <header className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-pdv-text)]">
          <UserRound className="h-[18px] w-[18px] text-brand" strokeWidth={1.8} aria-hidden />
          Cliente
        </h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onNovoCliente}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
          strokeWidth={1.8}
          aria-hidden
        />
        <Input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar por nome, CPF, telefone..."
          aria-label="Buscar cliente"
          className="h-10 rounded-[10px] pl-9"
        />
      </div>

      {error !== null && error !== undefined && (
        <div className="mt-2">
          <ErrorState error={error} onRetry={onRetry} compact />
        </div>
      )}

      {cliente ? (
        <div className="relative mt-3 flex items-center gap-3 rounded-[10px] bg-[var(--color-pdv-soft)] px-3 py-2.5 pr-9">
          <button
            type="button"
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-muted transition-colors hover:text-danger"
            onClick={onRemover}
            aria-label="Remover cliente da venda"
            title="Remover cliente da venda"
          >
            <X className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>

          <div
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
          >
            {initials(cliente.nome)}
          </div>

          <div className="grid min-w-0 flex-1 gap-0.5">
            <strong className="truncate text-sm font-semibold text-[var(--color-pdv-text)]" title={cliente.nome}>
              {cliente.nome}
            </strong>
            <span className="truncate text-xs text-secondary">
              {cliente.telefone ?? cliente.whatsapp ?? '—'}
            </span>
            <span className="truncate text-[11px] text-muted">
              CPF: {cliente.cpfMasked ?? cliente.cpf ?? '***'}
              {' • '}Última:{' '}
              {cliente.ultimaCompra ? new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR') : '—'}
            </span>
          </div>

          <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={onVerDados}>
            Ver dados <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex min-h-[64px] items-center justify-center rounded-[10px] bg-[var(--color-pdv-soft)] px-3 py-3 text-center text-sm text-muted">
          {isLoading ? (
            <div className="flex w-full items-center gap-3" aria-busy="true">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ) : busca.trim().length > 0 ? (
            'Selecione um cliente encontrado.'
          ) : (
            'Nenhum cliente selecionado — a venda sai como Consumidor.'
          )}
        </div>
      )}

      {mostrarResultados && (
        <ul className="mt-2 overflow-hidden rounded-[10px] border border-[var(--color-pdv-border)] bg-card-soft shadow-soft">
          {resultados.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelecionar(item)}
                className="flex w-full items-center justify-between gap-4 px-3 py-2.5 text-left text-sm text-[var(--color-pdv-text)] transition-colors hover:bg-[var(--color-pdv-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className="min-w-0 truncate">{item.nome}</span>
                <small className="shrink-0 text-xs text-muted">{item.cpfMasked ?? item.cpf ?? '***'}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
