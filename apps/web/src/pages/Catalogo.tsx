import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PageResponse, ProdutoDTO } from '@/lib/types';
import { normalizeProduto, unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

type ProdutosPage = PageResponse<ProdutoDTO>;

const CATEGORIAS_PRODUTO = ['Armação', 'Lente', 'Lente de contato', 'Acessório', 'Serviço'] as const;
type CategoriaProduto = (typeof CATEGORIAS_PRODUTO)[number];

const TIPO_POR_CATEGORIA: Record<CategoriaProduto, string> = {
  'Armação': 'ARMACAO',
  'Lente': 'LENTE',
  'Lente de contato': 'LENTE_CONTATO',
  'Acessório': 'ACESSORIO',
  'Serviço': 'SERVICO',
};

const produtoSchema = z.object({
  sku: z.string().trim().min(1, 'SKU é obrigatório').max(50, 'SKU máximo 50 caracteres'),
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome máximo 200 caracteres'),
  categoria: z.enum(CATEGORIAS_PRODUTO, { errorMap: () => ({ message: 'Selecione a categoria' }) }),
  marca: z.string().max(100, 'Marca máxima 100 caracteres').optional().or(z.literal('')),
  custo: z.coerce.number({ invalid_type_error: 'Custo é obrigatório' }).min(0, 'Custo não pode ser negativo'),
  precoVenda: z.coerce
    .number({ invalid_type_error: 'Preço é obrigatório' })
    .min(0.01, 'Preço de venda deve ser maior que zero'),
  estoqueQuantidade: z.coerce
    .number({ invalid_type_error: 'Estoque é obrigatório' })
    .min(0, 'Estoque não pode ser negativo')
    .int('Estoque deve ser um número inteiro'),
  ncm: z
    .string()
    .regex(/^\d{0,8}$/, 'NCM deve ter até 8 dígitos')
    .optional()
    .or(z.literal('')),
  codigoBarras: z.string().max(50, 'Código de barras máximo 50 caracteres').optional().or(z.literal('')),
});

type ProdutoForm = z.infer<typeof produtoSchema>;

function categoriaDeProduto(p: ProdutoDTO): CategoriaProduto {
  const bruta = p.categoria ?? '';
  const normalizada = bruta
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (normalizada.startsWith('LENTE DE CONTATO') || normalizada === 'LENTE_CONTATO') return 'Lente de contato';
  if (normalizada.startsWith('ACESSOR')) return 'Acessório';
  if (normalizada.startsWith('SERVIC')) return 'Serviço';
  if (normalizada.startsWith('LENTE')) return 'Lente';
  return 'Armação';
}

export default function Catalogo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = React.useState('');
  const [marca, setMarca] = React.useState('');
  const [cat, setCat] = React.useState<'Todos' | 'Armação' | 'Lente'>('Todos');
  const debouncedQ = useDebounce(q, 350);
  const debouncedMarca = useDebounce(marca, 350);
  const [page, setPage] = React.useState(0);
  const size = 20;

  const [produtoDialogOpen, setProdutoDialogOpen] = React.useState(false);
  const [produtoEditando, setProdutoEditando] = React.useState<ProdutoDTO | null>(null);
  const [produtoExcluindo, setProdutoExcluindo] = React.useState<ProdutoDTO | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const form = useForm<ProdutoForm>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      sku: '',
      nome: '',
      categoria: 'Armação',
      marca: '',
      custo: 0,
      precoVenda: 0,
      estoqueQuantidade: 0,
      ncm: '',
      codigoBarras: '',
    },
  });

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

  function limparFormulario() {
    setActionError(null);
    form.reset({
      sku: '',
      nome: '',
      categoria: 'Armação',
      marca: '',
      custo: 0,
      precoVenda: 0,
      estoqueQuantidade: 0,
      ncm: '',
      codigoBarras: '',
    });
  }

  function abrirNovoProduto() {
    setProdutoEditando(null);
    limparFormulario();
    setProdutoDialogOpen(true);
  }

  function abrirEditarProduto(p: ProdutoDTO) {
    setProdutoEditando(p);
    setActionError(null);
    form.reset({
      sku: p.sku ?? '',
      nome: p.nome ?? '',
      categoria: categoriaDeProduto(p),
      marca: p.marca ?? '',
      custo: Number(p.custo ?? 0),
      precoVenda: Number(p.preco ?? 0),
      estoqueQuantidade: Number(p.estoque ?? 0),
      ncm: p.ncm ?? '',
      codigoBarras: '',
    });
    setProdutoDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (produtoEditando?.id) {
        const res = await apiClient.put(`/v1/produtos/${produtoEditando.id}`, payload);
        return res.data;
      }
      const res = await apiClient.post('/v1/produtos', payload);
      return res.data;
    },
    onSuccess: () => {
      setProdutoDialogOpen(false);
      setProdutoEditando(null);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
    },
    onError: (err: unknown) => {
      const problem = err instanceof ApiError ? err.problem : undefined;
      const fieldErrors = problem?.errors?.map((e) => `${e.field}: ${e.message}`).join(' • ');
      const msg = problem?.detail || problem?.message || (err instanceof Error ? err.message : 'Falha ao salvar produto');
      setActionError(fieldErrors ? `${msg} — ${fieldErrors}` : msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/produtos/${id}`);
    },
    onSuccess: () => {
      setProdutoExcluindo(null);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
    },
    onError: (err: unknown) => {
      const problem = err instanceof ApiError ? err.problem : undefined;
      setActionError(problem?.detail || (err instanceof Error ? err.message : 'Falha ao excluir produto'));
    },
  });

  function onSalvarProduto(values: ProdutoForm) {
    setActionError(null);
    const payload: Record<string, unknown> = {
      sku: values.sku,
      nome: values.nome,
      categoria: values.categoria,
      tipoProduto: TIPO_POR_CATEGORIA[values.categoria],
      marca: values.marca?.trim() ? values.marca.trim() : null,
      custo: values.custo,
      precoVenda: values.precoVenda,
      estoqueQuantidade: values.estoqueQuantidade,
      ncm: values.ncm?.trim() ? values.ncm.trim() : null,
      codigoBarras: values.codigoBarras?.trim() ? values.codigoBarras.trim() : null,
      ativoVenda: true,
    };
    saveMutation.mutate(payload);
  }

  // filtro client-side defensivo (caso backend não filtre cat)
  const filtered = React.useMemo(() => {
    return produtos.filter((p) => {
      if (cat !== 'Todos' && categoriaDeProduto(p) !== cat) return false;
      if (debouncedMarca && !(p.marca ?? '').toLowerCase().includes(debouncedMarca.toLowerCase())) return false;
      if (!debouncedQ) return true;
      const l = debouncedQ.toLowerCase();
      return p.sku.toLowerCase().includes(l) || p.nome.toLowerCase().includes(l) || (p.marca ?? '').toLowerCase().includes(l);
    });
  }, [produtos, cat, debouncedQ, debouncedMarca]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ, debouncedMarca, cat]);

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
          <Button variant="primary" onClick={abrirNovoProduto}>
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
          <div className="relative w-[170px]">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
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
            <Button variant="outline" size="sm" onClick={() => { setQ(''); setMarca(''); setCat('Todos'); }}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((p) => (
              <Card key={p.sku} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex h-44 items-center justify-center bg-[var(--color-bg-card-soft)] p-3 border-b border-[var(--color-border-soft)] relative group">
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
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/pdv?sku=${encodeURIComponent(p.sku)}`)}
                    >
                      Adicionar ao PDV
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Editar ${p.nome}`}
                      title="Editar produto"
                      onClick={() => abrirEditarProduto(p)}
                      disabled={!p.id}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${p.nome}`}
                      title="Excluir produto"
                      className="text-[var(--color-danger)]"
                      onClick={() => {
                        setActionError(null);
                        setProdutoExcluindo(p);
                      }}
                      disabled={!p.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
                disabled={!!(data as ProdutosPage)?.last || produtos.length < size}
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

      {/* Modal Novo/Editar produto */}
      <Dialog
        open={produtoDialogOpen}
        onClose={() => {
          if (saveMutation.isPending) return;
          setProdutoDialogOpen(false);
          setProdutoEditando(null);
        }}
        title={produtoEditando ? 'Editar produto' : 'Novo produto'}
        description={
          produtoEditando
            ? 'Atualize preço, estoque e dados fiscais do SKU.'
            : 'Cadastre uma armação ou lente com SKU único para a loja.'
        }
      >
        <form onSubmit={form.handleSubmit(onSalvarProduto)} className="space-y-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="produto-sku">
                SKU <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="produto-sku"
                placeholder="Ex.: ARM-RAY-001"
                {...form.register('sku')}
                aria-invalid={!!form.formState.errors.sku}
              />
              {form.formState.errors.sku && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.sku.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produto-nome">
                Nome <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="produto-nome"
                placeholder="Ex.: Armação Ray-Ban Aviador"
                {...form.register('nome')}
                aria-invalid={!!form.formState.errors.nome}
              />
              {form.formState.errors.nome && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.nome.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="produto-categoria">
                Categoria <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Select
                id="produto-categoria"
                value={form.watch('categoria')}
                onChange={(e) =>
                  form.setValue('categoria', e.target.value as CategoriaProduto, { shouldValidate: true })
                }
                aria-invalid={!!form.formState.errors.categoria}
              >
                {CATEGORIAS_PRODUTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              {form.formState.errors.categoria && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.categoria.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produto-marca">Marca</Label>
              <Input id="produto-marca" placeholder="Ex.: Ray-Ban" {...form.register('marca')} />
              {form.formState.errors.marca && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.marca.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="produto-custo">
                Custo (R$) <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="produto-custo"
                type="number"
                step="0.01"
                min={0}
                {...form.register('custo', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.custo}
              />
              {form.formState.errors.custo && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.custo.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produto-preco">
                Preço de venda (R$) <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="produto-preco"
                type="number"
                step="0.01"
                min={0}
                {...form.register('precoVenda', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.precoVenda}
              />
              {form.formState.errors.precoVenda && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.precoVenda.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produto-estoque">
                Estoque <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="produto-estoque"
                type="number"
                step="1"
                min={0}
                {...form.register('estoqueQuantidade', { valueAsNumber: true })}
                aria-invalid={!!form.formState.errors.estoqueQuantidade}
              />
              {form.formState.errors.estoqueQuantidade && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.estoqueQuantidade.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="produto-ncm">NCM</Label>
              <Input id="produto-ncm" placeholder="Ex.: 90031100" {...form.register('ncm')} />
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Opcional — se vazio, o sistema usa o NCM padrão da categoria.
              </p>
              {form.formState.errors.ncm && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.ncm.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="produto-barras">Código de barras</Label>
              <Input id="produto-barras" placeholder="EAN-13 (opcional)" {...form.register('codigoBarras')} />
              {form.formState.errors.codigoBarras && (
                <p className="text-xs text-[var(--color-danger)]">{form.formState.errors.codigoBarras.message}</p>
              )}
            </div>
          </div>

          {actionError && (
            <p
              role="alert"
              className="rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]"
            >
              {actionError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProdutoDialogOpen(false);
                setProdutoEditando(null);
              }}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {produtoEditando ? 'Salvar alterações' : 'Criar produto'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Excluir produto */}
      <Dialog
        open={!!produtoExcluindo}
        onClose={() => {
          if (deleteMutation.isPending) return;
          setProdutoExcluindo(null);
        }}
        title="Excluir produto"
        description="O produto sai da venda e do catálogo desta loja."
      >
        <p className="py-4 text-sm text-[var(--color-text-primary)]">
          Tem certeza que deseja excluir <strong>{produtoExcluindo?.nome}</strong> (SKU {produtoExcluindo?.sku})?
        </p>
        {actionError && (
          <p
            role="alert"
            className="mb-3 rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]"
          >
            {actionError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setProdutoExcluindo(null)} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!produtoExcluindo?.id || deleteMutation.isPending}
            onClick={() => {
              if (produtoExcluindo?.id) deleteMutation.mutate(produtoExcluindo.id);
            }}
          >
            {deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
