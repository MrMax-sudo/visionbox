import { ShoppingCart, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { currency, type CartItem } from '@/components/pdv/pdvHelpers';
import type { ClienteDTO } from '@/lib/types';

type CarrinhoListaProps = {
  cart: CartItem[];
  cliente: ClienteDTO | null;
  onQtdChange: (sku: string, qtd: number) => void;
  onRemover: (sku: string) => void;
  onLimpar: () => void;
  className?: string;
};

const GRID_COLS =
  'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_104px_100px_36px] gap-2';

/**
 * Coluna 2 — carrinho da venda (denso, cabe em 1366x768).
 * Lista rola internamente; cabeçalho fixo; linha por item com qtd editável.
 */
export function CarrinhoLista({
  cart,
  cliente,
  onQtdChange,
  onRemover,
  onLimpar,
  className,
}: CarrinhoListaProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-[var(--color-pdv-border)] bg-card-soft shadow-soft',
        className,
      )}
      aria-label="Carrinho da venda"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-3.5 py-2.5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-pdv-text)]">
          <ShoppingCart className="h-[18px] w-[18px] text-brand" strokeWidth={1.8} aria-hidden />
          Carrinho — {cart.length} {cart.length === 1 ? 'item' : 'itens'}
        </h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onLimpar} disabled={cart.length === 0}>
          <Trash2 className="h-4 w-4" /> Limpar
        </Button>
      </header>

      {cart.length > 0 && (
        <div
          aria-hidden
          className={cn(
            GRID_COLS,
            'shrink-0 border-y border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-pdv-text)]',
          )}
        >
          <span>Item</span>
          <span>Cliente</span>
          <span className="text-center">Qtd</span>
          <span className="text-right">Preço</span>
          <span />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="max-h-[40vh] xl:max-h-none">
            <EmptyState
              icon={ShoppingCart}
              title="Carrinho vazio"
              description="Busque um produto ao lado para adicionar ao carrinho."
            />
          </div>
        ) : (
          <ul>
            {cart.map((item) => (
              <li
                key={item.sku}
                className={cn(
                  GRID_COLS,
                  'items-center border-b border-[var(--color-pdv-border-soft)] px-3.5 py-2 transition-colors hover:bg-[var(--color-pdv-soft)]',
                )}
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-semibold text-[var(--color-pdv-text)]" title={item.nome}>
                    {item.nome}
                  </strong>
                  <small className="block truncate text-[11px] text-muted">
                    {item.sku}
                    {item.categoria ? ` • ${item.categoria}` : ''}
                  </small>
                </div>

                <div className="min-w-0">
                  {cliente ? (
                    <span
                      title={cliente.nome}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-pdv-text)]"
                    >
                      <UserRound className="h-3 w-3 shrink-0 text-brand" aria-hidden />
                      <span className="truncate">{cliente.nome}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] italic text-muted">Consumidor</span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => onQtdChange(item.sku, Math.max(1, item.qtd - 1))}
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    title="Diminuir quantidade"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-pdv-border)] bg-card-soft text-sm font-bold text-[var(--color-pdv-text)] transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.qtd}
                    aria-label={`Quantidade de ${item.nome}`}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onQtdChange(item.sku, Number.isNaN(val) || val < 1 ? 1 : val);
                    }}
                    className="h-7 w-11 rounded-md border border-[var(--color-pdv-border)] bg-card-soft text-center text-[13px] font-semibold text-[var(--color-pdv-text)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => onQtdChange(item.sku, item.qtd + 1)}
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    title="Aumentar quantidade"
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-pdv-border)] bg-card-soft text-sm font-bold text-[var(--color-pdv-text)] transition-colors hover:border-primary hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    +
                  </button>
                </div>

                <div className="text-right">
                  <strong className="block text-sm font-bold text-[var(--color-pdv-text)]">
                    {currency(item.preco * item.qtd)}
                  </strong>
                  {item.qtd > 1 && (
                    <small className="block text-[11px] text-muted">
                      {item.qtd}x {currency(item.preco)}
                    </small>
                  )}
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => onRemover(item.sku)}
                    aria-label={`Remover ${item.nome}`}
                    title="Remover item"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-light hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
