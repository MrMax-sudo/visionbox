import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { Badge } from '@/components/ui/badge';
import { CompraItensTable } from '@/components/compras/CompraItensTable';
import { money, dataBR } from '@/components/financeiro/types';
import { buscarCompra, rotuloStatusCompra } from '@/lib/comprasService';

/** Badge de status da compra (StatusCompra: IMPORTADA | CONFIRMADA | CANCELADA). */
export function StatusCompraBadge({ status }: { status?: string }) {
  const rotulo = rotuloStatusCompra[status ?? ''] ?? status ?? '—';
  if (status === 'CANCELADA') return <Badge variant="danger">{rotulo}</Badge>;
  if (status === 'CONFIRMADA') return <Badge variant="success">{rotulo}</Badge>;
  return <Badge variant="info">{rotulo}</Badge>;
}

/**
 * DetalhesCompraModal — detalhe da compra com itens (descrição, NCM, qtd,
 * custo, EAN). Busca sob demanda: GET /v1/compras/{id} (itens só vêm no detalhe).
 */
export function DetalhesCompraModal({
  compraId,
  onClose,
}: {
  compraId: string | null;
  onClose: () => void;
}) {
  const compraQuery = useQuery({
    queryKey: ['compras', 'detalhe', compraId],
    queryFn: () => buscarCompra(compraId as string),
    enabled: Boolean(compraId),
    staleTime: 30_000,
  });

  if (!compraId) return null;

  const compra = compraQuery.data;

  return (
    <Dialog
      open
      onClose={onClose}
      title={compra ? `Compra ${compra.numero ?? '—'}${compra.serie ? ` / série ${compra.serie}` : ''}` : 'Detalhes da compra'}
      description={compra ? compra.fornecedorNome ?? undefined : 'Carregando dados da compra…'}
      className="max-w-[760px]"
    >
      {compraQuery.isLoading ? (
        <LoadingState title="Carregando itens da compra…" compact />
      ) : compraQuery.isError ? (
        <div className="py-4 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-danger-dark" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-danger-dark">Falha ao carregar a compra</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => compraQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : compra ? (
        <div className="space-y-4">
          {/* Cabeçalho */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <StatusCompraBadge status={compra.status} />
            <span className="text-xs text-muted">
              Emissão: <strong className="text-secondary">{dataBR(compra.dataEmissao ?? undefined)}</strong>
            </span>
          </div>

          {/* Dados fiscais */}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded border border-border bg-page px-4 py-3 text-xs sm:grid-cols-3">
            <div className="min-w-0">
              <dt className="text-muted">Fornecedor / CNPJ</dt>
              <dd className="truncate font-semibold text-primary">
                {compra.fornecedorNome ?? '—'}
              </dd>
              <dd className="font-mono text-secondary">{compra.fornecedorCnpj ?? '—'}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-muted">Chave de acesso</dt>
              <dd className="break-all font-mono text-secondary">{compra.chaveAcesso ?? '—'}</dd>
            </div>
          </dl>

          {/* Totais */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded border border-border bg-page px-3 py-2">
              <p className="text-[11px] text-muted">Subtotal</p>
              <p className="text-sm font-semibold tabular-nums text-primary">
                {money(compra.valorSubtotal)}
              </p>
            </div>
            <div className="rounded border border-border bg-page px-3 py-2">
              <p className="text-[11px] text-muted">Desconto</p>
              <p className="text-sm font-semibold tabular-nums text-primary">
                {money(compra.desconto)}
              </p>
            </div>
            <div className="rounded border border-border bg-page px-3 py-2">
              <p className="text-[11px] text-muted">Frete</p>
              <p className="text-sm font-semibold tabular-nums text-primary">
                {money(compra.frete)}
              </p>
            </div>
            <div className="rounded border border-primary-light bg-primary-light px-3 py-2">
              <p className="text-[11px] text-secondary">Total</p>
              <p className="text-sm font-bold tabular-nums text-primary">
                {money(compra.valorTotal)}
              </p>
            </div>
          </div>

          {/* Itens */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
              Itens da nota
            </h3>
            <CompraItensTable itens={compra.itens} />
          </div>

          {(compra.contasPagarIds?.length ?? 0) > 0 && (
            <p className="text-[11px] text-muted">
              {compra.contasPagarIds?.length} título(s) em Contas a Pagar vinculado(s) a esta
              compra — consulte o Financeiro para baixas.
            </p>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
