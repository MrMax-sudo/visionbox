import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Eye,
  PackagePlus,
  RefreshCw,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UploadXmlCard } from '@/components/compras/UploadXmlCard';
import { ImportacaoResultadoModal } from '@/components/compras/ImportacaoResultadoModal';
import { DetalhesCompraModal, StatusCompraBadge } from '@/components/compras/DetalhesCompraModal';
import { money, dataBR } from '@/components/financeiro/types';
import { listarCompras, type CompraDTO } from '@/lib/comprasService';

const PAGE_SIZE = 20;

/**
 * Compras — entrada de mercadorias via XML NF-e (§3.4, Fase 4 / R11 COMPRAS_XML).
 *
 * • Upload (drag & drop ou clique) → POST /v1/compras/importar-xml (multipart)
 * • Listagem paginada: número, fornecedor, data, total, status
 * • Detalhe com itens (descrição, NCM, qtd, custo, EAN)
 *
 * Estados: Loading / Empty / Error / Offline em todas as consultas.
 */
export default function Compras() {
  const queryClient = useQueryClient();
  const [page, setPage] = React.useState(0);
  const [importada, setImportada] = React.useState<CompraDTO | null>(null);
  const [detalheId, setDetalheId] = React.useState<string | null>(null);

  const comprasQuery = useQuery({
    queryKey: ['compras', page, PAGE_SIZE],
    queryFn: () => listarCompras(page, PAGE_SIZE),
    staleTime: 15_000,
  });

  const compras = comprasQuery.data?.content ?? [];
  const totalPaginas = comprasQuery.data?.totalPages ?? 0;
  const totalRegistros = comprasQuery.data?.totalElements ?? 0;

  return (
    <div className="space-y-6 pb-12">
      <OfflineBanner />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Compras</h1>
          <p className="text-xs text-secondary">
            Entrada de mercadorias por XML NF-e: catálogo, estoque e Contas a Pagar em um só fluxo
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['compras'] })}
          disabled={comprasQuery.isFetching}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${comprasQuery.isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Upload de XML */}
      <UploadXmlCard
        onImportada={(compra) => {
          setImportada(compra);
          setPage(0);
        }}
      />

      {/* Listagem */}
      <section aria-label="Compras registradas" className="space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">Compras registradas</h2>
          {comprasQuery.data && (
            <span className="rounded-full bg-page px-2 py-0.5 text-[11px] font-semibold tabular-nums text-secondary">
              {totalRegistros}
            </span>
          )}
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-card shadow-soft">
          {comprasQuery.isLoading ? (
            <LoadingState title="Carregando compras…" />
          ) : comprasQuery.isError ? (
            <div className="p-4">
              <ErrorState error={comprasQuery.error} onRetry={() => comprasQuery.refetch()} />
            </div>
          ) : compras.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={PackagePlus}
                title="Nenhuma compra importada"
                description="Importe o primeiro XML de NF-e do fornecedor para registrar a entrada de mercadorias."
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-page hover:bg-page">
                    <TableHead>Nota / Série</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compras.map((compra) => (
                    <TableRow key={compra.id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setDetalheId(compra.id)}
                          className="font-mono font-semibold text-brand hover:underline"
                          aria-label={`Ver detalhes da compra ${compra.numero ?? ''}`}
                        >
                          {compra.numero ?? '—'}
                        </button>
                        {compra.serie ? (
                          <span className="ml-1 text-[11px] text-muted">série {compra.serie}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <span className="block truncate font-medium" title={compra.fornecedorNome ?? ''}>
                          {compra.fornecedorNome ?? '—'}
                        </span>
                        {compra.fornecedorCnpj ? (
                          <span className="block font-mono text-[11px] text-muted">
                            {compra.fornecedorCnpj}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-secondary">
                        {dataBR(compra.dataEmissao ?? undefined)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-secondary">
                        {money(compra.valorSubtotal)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money(compra.valorTotal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusCompraBadge status={compra.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDetalheId(compra.id)}
                          aria-label={`Detalhes da compra ${compra.numero ?? ''}`}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPaginas > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-secondary">
                  <div className="flex items-center gap-1.5">
                    <Boxes className="h-3.5 w-3.5 text-muted" aria-hidden />
                    Mostrando {compras.length} de {totalRegistros} compras
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0 || comprasQuery.isFetching}
                      className="h-7 w-7 p-0"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span>
                      Página {page + 1} de {totalPaginas}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
                      disabled={page >= totalPaginas - 1 || comprasQuery.isFetching}
                      className="h-7 w-7 p-0"
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Modais */}
      <ImportacaoResultadoModal compra={importada} onClose={() => setImportada(null)} />
      <DetalhesCompraModal compraId={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
