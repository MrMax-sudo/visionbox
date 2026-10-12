import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Filter, Plus, RefreshCw, Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, ProdutoDTO } from '@/lib/types';
import { normalizeProduto, unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';

import { ProdutoCard } from '@/components/catalogo/ProdutoCard';
import { ProdutoFormDialog } from '@/components/catalogo/ProdutoFormDialog';
import { ProdutoExcluirDialog } from '@/components/catalogo/ProdutoExcluirDialog';
import { categoriaDeProduto } from '@/components/catalogo/produtoForm';
import { CsvImportDialog } from '@/components/pessoas/CsvImportDialog';

type ProdutosPage = PageResponse<ProdutoDTO>;
type FiltroCategoria = 'Todos' | 'Armação' | 'Lente';

const CATEGORIA_FILTERS: ReadonlyArray<FiltroCategoria> = ['Todos', 'Armação', 'Lente'];

export default function Catalogo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = React.useState('');
  const [marca, setMarca] = React.useState('');
  const [cat, setCat] = React.useState<FiltroCategoria>('Todos');
  const debouncedQ = useDebounce(q, 350);
  const debouncedMarca = useDebounce(marca, 350);
  const [page, setPage] = React.useState(0);
  const size = 20;

  const [produtoDialogOpen, setProdutoDialogOpen] = React.useState(false);
  const [produtoEditando, setProdutoEditando] = React.useState<ProdutoDTO | null>(null);
  const [produtoExcluindo, setProdutoExcluindo] = React.useState<ProdutoDTO | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  const queryKey = ['produtos', { q: debouncedQ, marca: debouncedMarca, cat, page, size }] as const;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiClient.get<ProdutosPage | ProdutoDTO[]>('/v1/produtos', {
        params: {
          page,
          size,
          search: debouncedQ || undefined,
          q: debouncedQ || undefined,
          categoria: cat !== 'Todos' ? cat : undefined,
          marca: debouncedMarca || undefined,
        },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const produtos: ProdutoDTO[] = React.useMemo(
    () => unwrapPage(data as ProdutosPage | ProdutoDTO[]).map((p) => normalizeProduto(p)),
    [data],
  );

  function abrirNovoProduto() {
    setProdutoEditando(null);
    setProdutoDialogOpen(true);
  }

  function abrirEditarProduto(p: ProdutoDTO) {
    setProdutoEditando(p);
    setProdutoDialogOpen(true);
  }

  function abrirExcluirProduto(p: ProdutoDTO) {
    setProdutoExcluindo(p);
  }

  // deep-link ?novo=1 (ex.: a partir do PDV / configurações)
  React.useEffect(() => {
    if (searchParams.get('novo') === '1') {
      abrirNovoProduto();
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('novo');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  // filtro client-side defensivo (caso backend não filtre cat/marca)
  const filtered = React.useMemo(() => {
    return produtos.filter((p) => {
      if (cat !== 'Todos' && categoriaDeProduto(p) !== cat) return false;
      if (debouncedMarca && !(p.marca ?? '').toLowerCase().includes(debouncedMarca.toLowerCase())) return false;
      if (!debouncedQ) return true;
      const l = debouncedQ.toLowerCase();
      return (
        p.sku.toLowerCase().includes(l) ||
        p.nome.toLowerCase().includes(l) ||
        (p.marca ?? '').toLowerCase().includes(l)
      );
    });
  }, [produtos, cat, debouncedQ, debouncedMarca]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ, debouncedMarca, cat]);

  const total = (data as ProdutosPage)?.totalElements ?? filtered.length;
  const totalPages = (data as ProdutosPage)?.totalPages;
  const isLastPage = (data as ProdutosPage)?.last;

  function limparFiltros() {
    setQ('');
    setMarca('');
    setCat('Todos');
  }

  const temFiltro = !!debouncedQ || !!debouncedMarca || cat !== 'Todos';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-primary">Catálogo</h1>
          <p className="text-sm text-secondary">
            Armações e lentes • SKU único por loja • busca pg_trgm &lt;500ms
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden /> Importar CSV
          </Button>
          <Button variant="primary" onClick={abrirNovoProduto}>
            <Plus className="mr-2 h-4 w-4" aria-hidden /> Novo produto
          </Button>
        </div>
      </div>

      <OfflineBanner />

      {/* Busca + filtros (debounce 350ms → ?search&categoria&marca) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar SKU, nome, marca…"
              className="pl-9"
              aria-label="Buscar catálogo"
            />
          </div>

          <div
            className="flex gap-1 rounded border border-border bg-page p-1"
            role="group"
            aria-label="Filtrar por categoria"
          >
            {CATEGORIA_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  cat === c
                    ? 'bg-primary text-primary-foreground'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="relative w-[170px]">
            <Filter
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Marca"
              className="pl-9"
              aria-label="Filtrar por marca"
            />
          </div>

          <Badge variant="outline">
            {isLoading ? 'carregando…' : `${total} SKUs`}
            {isFetching && !isLoading && ' • atualizando'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Carregando catálogo">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </Card>
          ))}
          <span className="sr-only">Carregando catálogo.</span>
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={
            temFiltro
              ? `Sem resultados para “${debouncedQ || debouncedMarca || cat}”. Tente outro filtro ou SKU.`
              : 'Nenhum SKU cadastrado para esta loja. Cadastre armações e lentes.'
          }
          action={
            <Button variant="outline" size="sm" onClick={limparFiltros} disabled={!temFiltro}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProdutoCard key={p.sku} produto={p} onEdit={abrirEditarProduto} onDelete={abrirExcluirProduto} />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-secondary">
            <span>
              Página {page + 1} {totalPages ? `de ${totalPages}` : ''} • {total} itens
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!isLastPage || produtos.length < size}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ProdutoFormDialog
        open={produtoDialogOpen}
        produto={produtoEditando}
        onClose={() => {
          setProdutoDialogOpen(false);
          setProdutoEditando(null);
        }}
      />

      <ProdutoExcluirDialog produto={produtoExcluindo} onClose={() => setProdutoExcluindo(null)} />

      <CsvImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Catálogo de Produtos (Excel / CSV)"
        description="Carregue centenas de armações e lentes de uma só vez usando uma planilha Excel (.xlsx) ou CSV."
        endpoint="/v1/produtos/importar-csv"
        invalidateKeys={[['produtos'], ['pdv-produtos']]}
        columns="sku,nome,precoVenda,tipoProduto,precoCusto,estoqueQuantidade,ncm"
        example="ARM-001;Armação Ray-Ban Aviador;499.00;ARMACAO;200.00;10;90031100"
        itemLabel="produtos"
        successVerb="processados com sucesso"
        errorLabel="linhas com erro"
      />
    </div>
  );
}
