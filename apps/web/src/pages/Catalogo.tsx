import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Plus, Glasses, RefreshCw, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PageResponse, ProdutoDTO } from '@/lib/types';
import { normalizeProduto, unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

type ProdutosPage = PageResponse<ProdutoDTO>;

export default function Catalogo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = React.useState('');
  const [cat, setCat] = React.useState<'Todos' | 'Armação' | 'Lente'>('Todos');
  const debouncedQ = useDebounce(q, 350);
  const [page, setPage] = React.useState(0);
  const size = 20;

  const [importOpen, setImportOpen] = React.useState(false);
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [importResult, setImportResult] = React.useState<{
    totalLinhas: number;
    processadosComSucesso: number;
    totalErros: number;
    erros: string[];
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post<{
        totalLinhas: number;
        processadosComSucesso: number;
        totalErros: number;
        erros: string[];
      }>('/v1/produtos/importar-csv', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
    },
  });

  const queryKey = ['produtos', { q: debouncedQ, cat, page, size }] as const;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    // TODO API: backend deve expor GET /api/v1/produtos?page=&size=&search=&categoria=
    queryFn: async () => {
      const res = await apiClient.get<ProdutosPage | ProdutoDTO[]>('/v1/produtos', {
        params: {
          page,
          size,
          search: debouncedQ || undefined,
          q: debouncedQ || undefined,
          categoria: cat !== 'Todos' ? cat : undefined,
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

  // filtro client-side defensivo (caso backend não filtre cat)
  const filtered = React.useMemo(() => {
    return produtos.filter((p) => {
      if (cat !== 'Todos' && p.categoria !== cat) return false;
      if (!debouncedQ) return true;
      const l = debouncedQ.toLowerCase();
      return p.sku.toLowerCase().includes(l) || p.nome.toLowerCase().includes(l) || (p.marca ?? '').toLowerCase().includes(l);
    });
  }, [produtos, cat, debouncedQ]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ, cat]);

  const total = (data as ProdutosPage)?.totalElements ?? filtered.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Catálogo</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Armações e lentes • SKU único por loja • busca pg_trgm &lt;500ms</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setImportResult(null);
              setCsvFile(null);
              setImportOpen(true);
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
          <Button variant="primary">
            <Plus className="mr-2 h-4 w-4" /> Novo produto
          </Button>
        </div>
      </div>

      <OfflineBanner />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar SKU, nome, marca…"
              className="pl-9"
              aria-label="Buscar catálogo"
            />
          </div>
          <div className="flex gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-1">
            {(['Todos', 'Armação', 'Lente'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded px-3 py-1 text-xs font-medium transition ${cat === c ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
              >
                {c}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Marca
          </Button>
          <Badge variant="outline">
            {isLoading ? 'carregando…' : `${total} SKUs`}
            {isFetching && !isLoading && ' • atualizando'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
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
        </div>
      ) : isError ? (
        <ErrorState error={error as ApiError} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description={debouncedQ ? `Sem resultados para “${debouncedQ}”. Tente outro SKU ou nome.` : 'Nenhum SKU cadastrado para esta loja. Cadastre armações e lentes.'}
          action={
            <Button variant="outline" size="sm" onClick={() => { setQ(''); setCat('Todos'); }}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((p) => (
              <Card key={p.sku} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex h-44 items-center justify-center bg-white p-3 border-b border-gray-100 relative group">
                  <img
                    src={`/assets/produtos/${p.sku}.jpg`}
                    alt={p.nome}
                    className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = 'true';
                        img.src = '/assets/produtos/ARM-RAY-001.jpg';
                      }
                    }}
                  />
                </div>
                <CardContent className="flex flex-1 flex-col p-4">
                  <p className="font-mono text-[11px] text-[var(--color-text-muted)]">
                    {p.sku} • NCM {p.ncm ?? '—'}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-[var(--color-text-primary)]">{p.nome}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {p.marca ?? '—'} • {p.categoria}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--color-primary)]">
                      {p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <Badge variant={p.estoque <= 3 ? 'danger' : p.estoque <= 6 ? 'warning' : 'success'}>{p.estoque} em estoque</Badge>
                  </div>
                  {p.custo != null && (
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                      Custo {(p.custo ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • margem{' '}
                      {p.preco > 0 ? (((p.preco - (p.custo ?? 0)) / p.preco) * 100).toFixed(0) : '—'}%
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate(`/pdv?sku=${encodeURIComponent(p.sku)}`)}>
                    Adicionar ao PDV
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>
              Página {page + 1} { (data as ProdutosPage)?.totalPages ? `de ${(data as ProdutosPage).totalPages}` : ''} • {total} itens
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!(data as ProdutosPage)?.last || filtered.length < size}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Importação CSV */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Catálogo de Produtos (CSV)"
        description="Carregue centenas de armações e lentes de uma só vez usando uma planilha."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3 text-xs space-y-1">
            <p className="font-semibold text-[var(--color-text-primary)]">Formato do cabeçalho CSV recomendado:</p>
            <p className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              sku,nome,precoVenda,tipoProduto,precoCusto,estoqueQuantidade,ncm
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] pt-1">
              * Suporta arquivos separados por vírgula (,) ou ponto-e-vírgula (;). Exemplo: <br />
              <code className="text-[var(--color-primary)]">ARM-001;Armação Ray-Ban Aviador;499.00;ARMACAO;200.00;10;90031100</code>
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] p-6 text-center hover:border-[var(--color-primary)] cursor-pointer bg-[var(--color-bg-card)]">
              <Upload className="h-8 w-8 text-[var(--color-text-muted)] mb-2" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {csvFile ? csvFile.name : 'Clique para selecionar o arquivo .csv'}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] mt-1">
                {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Tamanho máximo: 10MB'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setCsvFile(f);
                    setImportResult(null);
                  }
                }}
              />
            </label>
          </div>

          {importMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-info)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Processando e validando linhas da planilha...
            </div>
          )}

          {importResult && (
            <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs space-y-2 bg-[var(--color-bg-page)]">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                <span>Resultado: {importResult.processadosComSucesso} produtos processados com sucesso!</span>
              </div>
              {importResult.totalErros > 0 && (
                <div className="text-[var(--color-danger)] space-y-1">
                  <p className="font-semibold">{importResult.totalErros} linhas com erro:</p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-32 overflow-auto text-[11px]">
                    {importResult.erros.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button
              variant="outline"
              onClick={() => setImportOpen(false)}
            >
              {importResult ? 'Concluir' : 'Cancelar'}
            </Button>
            <Button
              variant="primary"
              disabled={!csvFile || importMutation.isPending}
              onClick={() => {
                if (csvFile) importMutation.mutate(csvFile);
              }}
            >
              {importMutation.isPending ? 'Importando...' : 'Iniciar Importação'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
