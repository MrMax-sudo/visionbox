import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Filter, Eye, Pencil, RefreshCw, Loader2, Trash2, FileSpreadsheet, Upload, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { PageResponse, ClienteDTO } from '@/lib/types';
import { unwrapPage } from '@/lib/types';
import { useDebounce, useOnline } from '@/hooks/useOnline';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { maskCPF, maskCEP, maskTelefone, unmask, isValidCPF } from '@/lib/masks';
import { fetchViaCEP } from '@/lib/viacep';

// ---------------------------------------------------------------------------
// Zod schema — alinhado a ADR-002 (CPF criptografado) + LGPD consentimento recall
// ---------------------------------------------------------------------------
const clienteSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter ao menos 3 caracteres').max(120),
  cpf: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || v.includes('*') || isValidCPF(v), 'CPF inválido'),
  telefone: z
    .string()
    .min(14, 'Telefone incompleto')
    .refine((v) => {
      const d = unmask(v);
      return d.length === 10 || d.length === 11;
    }, 'Telefone deve ter 10 ou 11 dígitos'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cep: z
    .string()
    .min(9, 'CEP incompleto')
    .refine((v) => unmask(v).length === 8, 'CEP deve ter 8 dígitos'),
  logradouro: z.string().min(1, 'Logradouro obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(1, 'Bairro obrigatório'),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  uf: z.string().length(2, 'UF deve ter 2 letras'),
  canalPreferido: z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'TELEFONE'], {
    errorMap: () => ({ message: 'Selecione um canal' }),
  }),
  consentimentoRecall: z.boolean(),
});

type ClienteForm = z.infer<typeof clienteSchema>;

type ClientesPage = PageResponse<ClienteDTO>;

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Clientes() {
  const online = useOnline();
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(0);
  const size = 20;
  const debouncedQ = useDebounce(q, 350);
  const [open, setOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedCliente, setSelectedCliente] = React.useState<ClienteDTO | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [viaCepLoading, setViaCepLoading] = React.useState(false);
  const [viaCepError, setViaCepError] = React.useState<string | null>(null);

  // CSV Import state
  const [importOpen, setImportOpen] = React.useState(false);
  const [csvFile, setCsvFile] = React.useState<File | null>(null);
  const [importResult, setImportResult] = React.useState<{ totalRegistros: number; processadosComSucesso: number; totalErros: number; erros: string[] } | null>(null);

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<{ totalRegistros: number; processadosComSucesso: number; totalErros: number; erros: string[] }>(
        '/v1/clientes/importar-csv',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return res.data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
  });

  const queryClient = useQueryClient();

  const queryKey = ['clientes', { q: debouncedQ, page, size }] as const;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await apiClient.get<ClientesPage | ClienteDTO[]>('/v1/clientes', {
        params: { page, size, search: debouncedQ || undefined, q: debouncedQ || undefined },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const clientes: ClienteDTO[] = React.useMemo(() => unwrapPage(data as ClientesPage | ClienteDTO[]), [data]);

  const filtered = React.useMemo(() => {
    if (!debouncedQ) return clientes;
    const l = debouncedQ.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(l) ||
        (c.cpf ?? c.cpfMasked ?? '').includes(l) ||
        (c.cidade ?? '').toLowerCase().includes(l),
    );
  }, [clientes, debouncedQ]);

  const totalElements = (data as ClientesPage)?.totalElements ?? filtered.length;

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  // ---- Form ----
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      telefone: '',
      email: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      canalPreferido: 'WHATSAPP',
      consentimentoRecall: false,
    },
  });

  const cepValue = watch('cep');
  const cpfValue = watch('cpf');
  const telefoneValue = watch('telefone');

  // ViaCEP autocomplete — ao atingir 8 dígitos dispara busca e preenche
  const lastFetchedCep = React.useRef<string>('');
  React.useEffect(() => {
    const digits = unmask(cepValue);
    if (digits.length !== 8) {
      setViaCepError(null);
      return;
    }
    if (lastFetchedCep.current === digits) return;
    lastFetchedCep.current = digits;
    let cancelled = false;
    setViaCepLoading(true);
    setViaCepError(null);
    fetchViaCEP(digits)
      .then((res) => {
        if (cancelled) return;
        setValue('logradouro', res.logradouro, { shouldValidate: true });
        setValue('bairro', res.bairro, { shouldValidate: true });
        setValue('cidade', res.cidade, { shouldValidate: true });
        setValue('uf', res.uf.toUpperCase(), { shouldValidate: true });
        if (res.complemento) setValue('complemento', res.complemento);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setViaCepError(e.message);
      })
      .finally(() => {
        if (!cancelled) setViaCepLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cepValue, setValue]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ClienteForm) => {
      if (!isEditing && !payload.cpf) {
        throw new Error('CPF é obrigatório para novo cliente');
      }
      // backend espera cpf/cep/telefone apenas dígitos (criptografa no server)
      const body = {
        nome: payload.nome,
        ...(payload.cpf && !payload.cpf.includes('*') ? { cpf: unmask(payload.cpf) } : {}),
        telefone: unmask(payload.telefone),
        whatsapp: unmask(payload.telefone),
        email: payload.email || null,
        cep: unmask(payload.cep),
        logradouro: payload.logradouro,
        numero: payload.numero,
        complemento: payload.complemento || null,
        bairro: payload.bairro,
        cidade: payload.cidade,
        uf: payload.uf.toUpperCase(),
        canalPreferido: payload.canalPreferido,
        consentimentoRecall: payload.consentimentoRecall,
      };
      const res = isEditing && selectedCliente
        ? await apiClient.put<ClienteDTO>(`/v1/clientes/${selectedCliente.id}`, body)
        : await apiClient.post<ClienteDTO>('/v1/clientes', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setOpen(false);
      setIsEditing(false);
      setSelectedCliente(null);
      reset();
      lastFetchedCep.current = '';
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/clientes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setDeleteOpen(false);
      setSelectedCliente(null);
    },
  });

  const onSubmit = (dataForm: ClienteForm) => {
    saveMutation.mutate(dataForm);
  };

  function abrirNovo() {
    setIsEditing(false);
    setSelectedCliente(null);
    reset();
    setOpen(true);
  }

  function abrirVer(cliente: ClienteDTO) {
    setSelectedCliente(cliente);
    setViewOpen(true);
  }

  function abrirEditar(cliente: ClienteDTO) {
    setSelectedCliente(cliente);
    setIsEditing(true);
    reset({
      nome: cliente.nome,
      cpf: cliente.cpfMasked ?? cliente.cpf ?? '',
      telefone: maskTelefone(cliente.telefone ?? ''),
      email: cliente.email ?? '',
      cep: maskCEP(cliente.cep ?? ''),
      logradouro: cliente.logradouro ?? '',
      numero: cliente.numero ?? '',
      complemento: cliente.complemento ?? '',
      bairro: cliente.bairro ?? '',
      cidade: cliente.cidade ?? '',
      uf: cliente.uf ?? '',
      canalPreferido: (cliente.canalPreferido as ClienteForm['canalPreferido']) ?? 'WHATSAPP',
      consentimentoRecall: Boolean(cliente.consentimentoRecall),
    });
    setOpen(true);
  }

  function abrirExcluir(cliente: ClienteDTO) {
    setSelectedCliente(cliente);
    setDeleteOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Clientes</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            LGPD: CPF criptografado AES-GCM • exibição mascarada • consentimento recall
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCsvFile(null);
              setImportResult(null);
              setImportOpen(true);
            }}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
          <Button variant="primary" onClick={abrirNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo cliente
          </Button>
        </div>
      </div>

      <OfflineBanner />
      {!online && !isLoading && clientes.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">Exibindo dados em cache — busca server-side indisponível offline.</p>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, CPF, cidade…"
              className="pl-9"
              aria-label="Buscar clientes"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" /> Filtros
          </Button>
          <Badge variant="outline">
            {isLoading ? 'carregando…' : `${totalElements} clientes`}
            {isFetching && !isLoading && ' • atualizando…'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar lista">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Carregando clientes">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <ErrorState error={error as ApiError} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={debouncedQ ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          description={
            debouncedQ
              ? `Nenhum resultado para “${debouncedQ}”. Tente outro termo ou cadastre um novo cliente.`
              : 'Cadastre o primeiro cliente para iniciar vendas no PDV e gerar OS.'
          }
          action={
            debouncedQ ? (
              <Button variant="outline" size="sm" onClick={() => setQ('')}>
                Limpar busca
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={abrirNovo}>
                <Plus className="mr-2 h-4 w-4" /> Novo cliente
              </Button>
            )
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-page)] text-xs text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                    <th className="px-4 py-2 text-left font-medium">CPF</th>
                    <th className="px-4 py-2 text-left font-medium">Telefone</th>
                    <th className="px-4 py-2 text-left font-medium">Cidade</th>
                    <th className="px-4 py-2 text-right font-medium">Total gasto</th>
                    <th className="px-4 py-2 text-center font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-page)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text-primary)]">{c.nome}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Última compra {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">{c.cpfMasked ?? c.cpf ?? '***'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.telefone ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.cidade ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)]">
                        {(c.totalGasto ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Ver ${c.nome}`} onClick={() => abrirVer(c)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${c.nome}`} onClick={() => abrirEditar(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--color-danger)]" aria-label={`Excluir ${c.nome}`} onClick={() => abrirExcluir(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-xs">
              <span className="text-[var(--color-text-secondary)]">
                Página {page + 1} {(data as ClientesPage)?.totalPages ? `de ${(data as ClientesPage).totalPages}` : ''} • {totalElements}{' '}
                registros
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!(data as ClientesPage)?.last || filtered.length < size}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 md:hidden">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{c.nome}</p>
                    <p className="font-mono text-xs text-[var(--color-text-muted)]">{c.cpfMasked ?? c.cpf ?? '***'}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {c.telefone ?? '—'} • {c.cidade ?? '—'}
                    </p>
                  </div>
                  <Badge variant="info">{(c.totalGasto ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => abrirVer(c)}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirEditar(c)} aria-label={`Editar ${c.nome}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-danger)]" onClick={() => abrirExcluir(c)} aria-label={`Excluir ${c.nome}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog Novo Cliente */}
      <Dialog
        open={open}
        onClose={() => {
          if (isSubmitting || saveMutation.isPending) return;
          setOpen(false);
        }}
        title={isEditing ? 'Editar cliente' : 'Novo cliente'}
        description={isEditing ? 'Atualize dados cadastrais sem expor CPF em texto puro.' : 'CPF será criptografado AES-GCM no servidor. Campos com * são obrigatórios.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="nome">
              Nome completo <span className="text-[var(--color-danger)]">*</span>
            </Label>
            <Input id="nome" placeholder="Ex: Maria Silva" autoFocus {...register('nome')} aria-invalid={!!errors.nome} />
            {errors.nome && <p className="text-xs text-[var(--color-danger)]">{errors.nome.message}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cpf">
                CPF {!isEditing && <span className="text-[var(--color-danger)]">*</span>}
              </Label>
              <Input
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpfValue}
                onChange={(e) => setValue('cpf', maskCPF(e.target.value), { shouldValidate: true })}
                aria-invalid={!!errors.cpf}
              />
              {errors.cpf && <p className="text-xs text-[var(--color-danger)]">{errors.cpf.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">
                Telefone <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="telefone"
                inputMode="numeric"
                placeholder="(00) 00000-0000"
                value={telefoneValue}
                onChange={(e) => setValue('telefone', maskTelefone(e.target.value), { shouldValidate: true })}
                aria-invalid={!!errors.telefone}
              />
              {errors.telefone && <p className="text-xs text-[var(--color-danger)]">{errors.telefone.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="cliente@exemplo.com" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
          </div>

          {/* Endereço com ViaCEP */}
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="cep">
                CEP <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cepValue}
                  onChange={(e) => setValue('cep', maskCEP(e.target.value), { shouldValidate: true })}
                  aria-invalid={!!errors.cep}
                  aria-describedby="cep-help"
                />
                {viaCepLoading && <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--color-text-muted)]" />}
              </div>
              <p id="cep-help" className="text-[11px] text-[var(--color-text-muted)]">
                Digite 8 dígitos para buscar endereço automaticamente.
              </p>
              {errors.cep && <p className="text-xs text-[var(--color-danger)]">{errors.cep.message}</p>}
              {viaCepError && <p className="text-xs text-[var(--color-danger)]">{viaCepError}</p>}
              {viaCepLoading && <p className="text-xs text-[var(--color-info)]">Buscando endereço…</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="logradouro">
                Logradouro <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input id="logradouro" placeholder="Rua / Avenida" {...register('logradouro')} aria-invalid={!!errors.logradouro} />
              {errors.logradouro && <p className="text-xs text-[var(--color-danger)]">{errors.logradouro.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[120px_1fr_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="numero">
                Número <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input id="numero" placeholder="123" {...register('numero')} aria-invalid={!!errors.numero} />
              {errors.numero && <p className="text-xs text-[var(--color-danger)]">{errors.numero.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="complemento">Complemento</Label>
              <Input id="complemento" placeholder="Apto, bloco…" {...register('complemento')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bairro">
                Bairro <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input id="bairro" placeholder="Centro" {...register('bairro')} aria-invalid={!!errors.bairro} />
              {errors.bairro && <p className="text-xs text-[var(--color-danger)]">{errors.bairro.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cidade">
                Cidade <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input id="cidade" {...register('cidade')} aria-invalid={!!errors.cidade} />
              {errors.cidade && <p className="text-xs text-[var(--color-danger)]">{errors.cidade.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uf">
                UF <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input
                id="uf"
                placeholder="SP"
                maxLength={2}
                {...register('uf', {
                  setValueAs: (v: string) => v.toUpperCase(),
                })}
                onChange={(e) => setValue('uf', e.target.value.toUpperCase(), { shouldValidate: true })}
                aria-invalid={!!errors.uf}
                className="uppercase"
              />
              {errors.uf && <p className="text-xs text-[var(--color-danger)]">{errors.uf.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="canalPreferido">
              Canal preferido <span className="text-[var(--color-danger)]">*</span>
            </Label>
            <Select id="canalPreferido" {...register('canalPreferido')} aria-invalid={!!errors.canalPreferido}>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">E-mail</option>
              <option value="SMS">SMS</option>
              <option value="TELEFONE">Telefone</option>
            </Select>
            {errors.canalPreferido && <p className="text-xs text-[var(--color-danger)]">{errors.canalPreferido.message}</p>}
          </div>

          <label className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
              {...register('consentimentoRecall')}
            />
            <span className="text-xs leading-snug text-[var(--color-text-secondary)]">
              <span className="font-medium text-[var(--color-text-primary)]">Consentimento recall LGPD</span> — cliente autoriza
              contato para recall de lentes/armações e campanhas relacionadas à saúde visual. Sem este consentimento não enviaremos
              comunicações de marketing (base legal: consentimento art. 7º I).
            </span>
          </label>

          {saveMutation.isError && (
            <div className="rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
              {(saveMutation.error as ApiError)?.message ?? 'Falha ao salvar cliente'}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending || isSubmitting}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar alterações' : 'Salvar cliente'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Cliente">
        {selectedCliente && (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Nome</p>
              <p className="font-medium text-[var(--color-text-primary)]">{selectedCliente.nome}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">CPF</p>
                <p className="font-mono text-[var(--color-text-primary)]">{selectedCliente.cpfMasked ?? selectedCliente.cpf ?? '***'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Telefone</p>
                <p className="text-[var(--color-text-primary)]">{selectedCliente.telefone ?? selectedCliente.whatsapp ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">E-mail</p>
                <p className="text-[var(--color-text-primary)]">{selectedCliente.email ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">Canal preferido</p>
                <p className="text-[var(--color-text-primary)]">{selectedCliente.canalPreferido ?? '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Endereço</p>
              <p className="text-[var(--color-text-primary)]">
                {[selectedCliente.logradouro, selectedCliente.numero, selectedCliente.bairro, selectedCliente.cidade, selectedCliente.uf]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setViewOpen(false)}>Fechar</Button>
              <Button onClick={() => { setViewOpen(false); abrirEditar(selectedCliente); }}>Editar</Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir cliente">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Deseja desativar <strong className="text-[var(--color-text-primary)]">{selectedCliente?.nome}</strong>? O histórico fiscal e de OS será preservado.
          </p>
          {deleteMutation.isError && (
            <div className="rounded-[var(--radius)] bg-[var(--color-danger-light)] p-3 text-sm text-[var(--color-danger-dark)]">
              {(deleteMutation.error as ApiError)?.message ?? 'Não foi possível excluir cliente'}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteMutation.isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={() => selectedCliente && deleteMutation.mutate(selectedCliente.id)} disabled={!selectedCliente || deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal de Importação CSV */}
      <Dialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Clientes (CSV)"
        description="Carregue sua base de clientes existente a partir de uma planilha CSV."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3 text-xs space-y-1">
            <p className="font-semibold text-[var(--color-text-primary)]">Formato do cabeçalho CSV recomendado:</p>
            <p className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              nome,cpf,telefone,email,cidade,uf,cep,logradouro,numero,bairro
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] pt-1">
              * Suporta separador por vírgula (,) ou ponto-e-vírgula (;). CPF e Telefone são sanitizados automaticamente.<br />
              Exemplo: <code className="text-[var(--color-primary)]">Maria Silva;12345678900;11988887777;maria@email.com;São Paulo;SP;01310-100;Av Paulista;1000;Bela Vista</code>
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
              <Loader2 className="h-4 w-4 animate-spin" /> Processando e validando clientes da planilha...
            </div>
          )}

          {importResult && (
            <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs space-y-2 bg-[var(--color-bg-page)]">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                <span>Resultado: {importResult.processadosComSucesso} clientes importados com sucesso!</span>
              </div>
              {importResult.totalErros > 0 && (
                <div className="text-[var(--color-danger)] space-y-1">
                  <p className="font-semibold">{importResult.totalErros} linhas com inconsistência:</p>
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
