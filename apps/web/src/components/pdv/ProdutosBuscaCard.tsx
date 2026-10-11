import * as React from 'react';
import { Box, Package, PackageSearch, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { currency, type ProdutoPdv } from '@/components/pdv/pdvHelpers';

const CATEGORIAS = ['Todos', 'Armações', 'Lentes', 'Óculos de Sol', 'Acessórios', 'Serviços'];

type ProdutosBuscaCardProps = {
  busca: string;
  onBuscaChange: (valor: string) => void;
  /** Enter no campo = adiciona o primeiro resultado ao carrinho. */
  onEnter: () => void;
  skuRef: React.RefObject<HTMLInputElement>;
  debouncedBusca: string;
  categoriaAtiva: string;
  onCategoria: (categoria: string) => void;
  produtos: ProdutoPdv[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onAdicionar: (produto: ProdutoPdv) => void;
  onNovoProduto: () => void;
  className?: string;
};

const CARD_CLASS =
  'flex min-h-0 flex-col overflow-hidden rounded-card border border-[var(--color-pdv-border)] bg-card-soft shadow-soft';

/**
 * Coluna 1 (base) — busca de produto/SKU, filtros de categoria e resultados.
 * Teclado-first: foco automático (ref), Enter adiciona o 1º resultado.
 */
export function ProdutosBuscaCard({
  busca,
  onBuscaChange,
  onEnter,
  skuRef,
  debouncedBusca,
  categoriaAtiva,
  onCategoria,
  produtos,
  isLoading,
  error,
  onRetry,
  onAdicionar,
  onNovoProduto,
  className,
}: ProdutosBuscaCardProps) {
  const filtrando = busca.trim().length > 0 || categoriaAtiva !== 'Todos';

  return (
    <section className={cn(CARD_CLASS, className)} aria-label="Busca de produtos">
      <header className="flex shrink-0 items-center justify-between gap-3 px-3.5 pt-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-pdv-text)]">
          <Box className="h-[18px] w-[18px] text-brand" strokeWidth={1.8} aria-hidden />
          Produto / SKU
        </h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onNovoProduto}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </header>

      <div className="relative shrink-0 px-3.5 pt-2.5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted"
          strokeWidth={1.8}
          aria-hidden
        />
        <Input
          ref={skuRef}
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
          placeholder="Buscar por produto, SKU, código de barras..."
          aria-label="Buscar produto, SKU ou código de barras"
          className="h-10 rounded-[10px] pl-9"
        />
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 px-3.5 pt-2.5" role="group" aria-label="Filtrar por categoria">
        {CATEGORIAS.map((categoria) => {
          const ativa = categoria === categoriaAtiva;
          return (
            <button
              key={categoria}
              type="button"
              aria-pressed={ativa}
              onClick={() =>
                onCategoria(categoria === categoriaAtiva && categoria !== 'Todos' ? 'Todos' : categoria)
              }
              className={cn(
                'h-7 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
                ativa
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-primary-light text-[var(--color-pdv-text)] hover:bg-primary hover:text-primary-foreground',
              )}
            >
              {categoria}
            </button>
          );
        })}
      </div>

      {error !== null && error !== undefined && (
        <div className="shrink-0 px-3.5 pt-2.5">
          <ErrorState error={error} onRetry={onRetry} compact />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3 pt-2.5">
        {!filtrando ? (
          <div className="max-h-[34vh] xl:max-h-none">
            <EmptyState
              icon={PackageSearch}
              title="Busque para vender"
              description="Digite o SKU, o nome do produto ou escolha uma categoria. Enter adiciona o primeiro resultado."
            />
          </div>
        ) : isLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <span className="sr-only">Carregando produtos.</span>
          </div>
        ) : produtos.length === 0 ? (
          <div className="max-h-[34vh] xl:max-h-none">
            <EmptyState
              title="Nenhum produto encontrado"
              description={
                debouncedBusca || categoriaAtiva !== 'Todos'
                  ? 'Ajuste a busca ou a categoria para encontrar o item.'
                  : 'Nenhum produto disponível para este filtro.'
              }
            />
          </div>
        ) : (
          <ul className="overflow-hidden rounded-[10px] border border-[var(--color-pdv-border-soft)]">
            {produtos.map((produto) => (
              <li key={produto.sku} className="border-b border-[var(--color-pdv-border-soft)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => onAdicionar(produto)}
                  className="flex w-full items-center gap-3 px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-pdv-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--color-pdv-border)] bg-card-soft">
                    <Package className="h-4 w-4 text-muted" aria-hidden />
                    <img
                      src={`/assets/produtos/${produto.sku}.jpg`}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0.5 h-9 w-9 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-pdv-text)]">
                      {produto.nome}
                    </span>
                    <small className="block truncate text-xs text-muted">
                      {produto.sku} • {currency(produto.preco)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
