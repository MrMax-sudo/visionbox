import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Upload, Plus, Search, Filter, RefreshCw, Loader2, X, Image as ImageIcon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { PageResponse, ReceitaDTO } from '@/lib/types';
import { normalizeReceita, unwrapPage } from '@/lib/types';
import { useDebounce } from '@/hooks/useOnline';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';

type ReceitasPage = PageResponse<ReceitaDTO>;

// ---------------------------------------------------------------------------
// Helpers de validação grau — regras do domínio
// ---------------------------------------------------------------------------
function grauOlhoSchema(tipoField: string) {
  return z.object({
    esferico: z.coerce
      .number({ invalid_type_error: 'Esférico é obrigatório' })
      .min(-30, 'Esférico mínimo -30')
      .max(30, 'Esférico máximo 30'),
    cilindrico: z.coerce
      .number({ invalid_type_error: 'Cilíndrico é obrigatório' })
      .min(-10, 'Cilíndrico mínimo -10')
      .max(0, 'Cilíndrico máximo 0'),
    eixo: z.coerce.number().min(0).max(180).optional().nullable(),
    adicao: z.coerce.number().min(0).max(6).optional().nullable(),
  });
}

const baseSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  tipoLente: z.enum(['MONOFOCAL', 'BIFOCAL', 'MULTIFOCAL']),
  dp: z.coerce.number().min(20, 'DP mínimo 20mm').max(80, 'DP máximo 80mm'),
  od: grauOlhoSchema('od'),
  oe: grauOlhoSchema('oe'),
  observacao: z.string().max(500).optional().or(z.literal('')),
});

const receitaSchema = baseSchema.superRefine((data, ctx) => {
  // Eixo obrigatório se cilindro != 0
  for (const lado of ['od', 'oe'] as const) {
    const olho = data[lado];
    const cil = olho.cilindrico;
    if (cil !== 0 && cil !== null && cil !== undefined) {
      if (olho.eixo == null || Number.isNaN(olho.eixo as number)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'eixo'],
          message: 'Eixo 0–180 obrigatório quando cilindro ≠ 0',
        });
      } else if ((olho.eixo as number) < 0 || (olho.eixo as number) > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'eixo'],
          message: 'Eixo deve estar entre 0 e 180',
        });
      }
    }
    // Adição só permitida em MULTIFOCAL; se MULTIFOCAL, 0..6; senão deve ser 0/vazio
    const ad = olho.adicao;
    if (data.tipoLente !== 'MULTIFOCAL') {
      if (ad != null && ad !== 0 && !Number.isNaN(ad as number) && (ad as number) !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'adicao'],
          message: 'Adição só permitida para lente MULTIFOCAL',
        });
      }
    } else {
      if (ad != null && !Number.isNaN(ad as number) && ((ad as number) < 0 || (ad as number) > 6)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [lado, 'adicao'],
          message: 'Adição deve estar entre 0 e 6',
        });
      }
    }
  }
});

type ReceitaForm = z.infer<typeof receitaSchema>;

// ---------------------------------------------------------------------------
// Componente auxiliar — campo grau
// ---------------------------------------------------------------------------
function GrauFields({
  prefix,
  title,
  register,
  watch,
  errors,
}: {
  prefix: 'od' | 'oe';
  title: string;
  register: ReturnType<typeof useForm<ReceitaForm>>['register'];
  watch: ReturnType<typeof useForm<ReceitaForm>>['watch'];
  errors: ReturnType<typeof useForm<ReceitaForm>>['formState']['errors'];
}) {
  const tipoLente = watch('tipoLente');
  const cilindrico = watch(`${prefix}.cilindrico` as const);
  const showEixo = cilindrico !== 0 && cilindrico !== null && cilindrico !== undefined && !Number.isNaN(Number(cilindrico));
  const isMultifocal = tipoLente === 'MULTIFOCAL';
  const err = (errors as Record<string, unknown>)[prefix] as
    | { esferico?: { message: string }; cilindrico?: { message: string }; eixo?: { message: string }; adicao?: { message: string } }
    | undefined;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3">
      <p className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-esf`}>Esférico (-30 a 30) *</Label>
          <Input
            id={`${prefix}-esf`}
            type="number"
            step="0.25"
            placeholder="-2.50"
            {...register(`${prefix}.esferico` as const, { valueAsNumber: true })}
            aria-invalid={!!err?.esferico}
          />
          {err?.esferico && <p className="text-xs text-[var(--color-danger)]">{err.esferico.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-cil`}>Cilíndrico (-10 a 0) *</Label>
          <Input
            id={`${prefix}-cil`}
            type="number"
            step="0.25"
            placeholder="-1.25"
            {...register(`${prefix}.cilindrico` as const, { valueAsNumber: true })}
            aria-invalid={!!err?.cilindrico}
          />
          {err?.cilindrico && <p className="text-xs text-[var(--color-danger)]">{err.cilindrico.message}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-eixo`}>
            Eixo (0–180) {showEixo && <span className="text-[var(--color-danger)]">*</span>}
          </Label>
          <Input
            id={`${prefix}-eixo`}
            type="number"
            step="1"
            placeholder={showEixo ? 'ex: 90' : '—'}
            {...register(`${prefix}.eixo` as const, { valueAsNumber: true })}
            aria-invalid={!!err?.eixo}
          />
          {err?.eixo && <p className="text-xs text-[var(--color-danger)]">{err.eixo.message}</p>}
          {!showEixo && <p className="text-[11px] text-[var(--color-text-muted)]">Obrigatório se cilíndrico ≠ 0</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-adicao`}>
            Adição (0–6) {isMultifocal ? <span className="text-[var(--color-danger)]">*</span> : <span className="text-[var(--color-text-muted)]">(só MULTIFOCAL)</span>}
          </Label>
          <Input
            id={`${prefix}-adicao`}
            type="number"
            step="0.25"
            placeholder={isMultifocal ? '2.00' : '0.00'}
            disabled={!isMultifocal}
            {...register(`${prefix}.adicao` as const, { valueAsNumber: true })}
            aria-invalid={!!err?.adicao}
          />
          {err?.adicao && <p className="text-xs text-[var(--color-danger)]">{err.adicao.message}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function Receitas() {
  const [q, setQ] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'Todas' | 'Com anexo' | 'Sem anexo'>('Todas');
  const debouncedQ = useDebounce(q, 350);
  const [page, setPage] = React.useState(0);
  const size = 12;
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [viewFotoUrl, setViewFotoUrl] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['receitas', { q: debouncedQ, page, size }],
    queryFn: async () => {
      const res = await apiClient.get<ReceitasPage | ReceitaDTO[]>('/v1/receitas', {
        params: { page, size, search: debouncedQ || undefined, q: debouncedQ || undefined },
      });
      return res.data;
    },
    staleTime: 30_000,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const receitas: ReceitaDTO[] = React.useMemo(
    () => unwrapPage(data as ReceitasPage | ReceitaDTO[]).map((r) => normalizeReceita(r)),
    [data],
  );

  const filteredReceitas = React.useMemo(() => {
    return receitas.filter((r) => {
      if (statusFilter === 'Com anexo' && !r.fotoUrl) return false;
      if (statusFilter === 'Sem anexo' && r.fotoUrl) return false;
      if (!debouncedQ) return true;
      const term = debouncedQ.toLowerCase();
      return (
        r.id.toLowerCase().includes(term) ||
        r.clienteId.toLowerCase().includes(term) ||
        (r.clienteNome ?? '').toLowerCase().includes(term)
      );
    });
  }, [debouncedQ, receitas, statusFilter]);

  React.useEffect(() => {
    setPage(0);
  }, [debouncedQ]);

  const total = (data as ReceitasPage)?.totalElements ?? filteredReceitas.length;

  // form
  const {
    register,
    handleSubmit,
    watch,
    reset,
    control: _control,
    formState: { errors, isSubmitting },
  } = useForm<ReceitaForm>({
    resolver: zodResolver(receitaSchema),
    defaultValues: {
      clienteId: '',
      tipoLente: 'MONOFOCAL',
      dp: 62 as unknown as number,
      od: { esferico: 0, cilindrico: 0, eixo: null, adicao: null },
      oe: { esferico: 0, cilindrico: 0, eixo: null, adicao: null },
      observacao: '',
    },
  });

  // preview effect
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const createMutation = useMutation({
    mutationFn: async (form: ReceitaForm) => {
      // payload alinhado ao backend — grau criptografado (ADR-002)
      const payload = {
        clienteId: form.clienteId,
        tipoLente: form.tipoLente,
        dp: form.dp,
        od: {
          esferico: form.od.esferico,
          cilindrico: form.od.cilindrico,
          eixo: form.od.cilindrico !== 0 ? (form.od.eixo ?? null) : null,
          adicao: form.tipoLente === 'MULTIFOCAL' ? (form.od.adicao ?? 0) : 0,
        },
        oe: {
          esferico: form.oe.esferico,
          cilindrico: form.oe.cilindrico,
          eixo: form.oe.cilindrico !== 0 ? (form.oe.eixo ?? null) : null,
          adicao: form.tipoLente === 'MULTIFOCAL' ? (form.oe.adicao ?? 0) : 0,
        },
        observacao: form.observacao || null,
      };
      const res = await apiClient.post<ReceitaDTO>('/v1/receitas', payload);
      return res.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, fileToUpload }: { id: string; fileToUpload: File }) => {
      const fd = new FormData();
      fd.append('file', fileToUpload);
      // backend espera multipart em POST /v1/receitas/{id}/anexo (S3 presigned ou direto)
      const res = await apiClient.post(`/v1/receitas/${id}/anexo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });

  const onSubmit = async (form: ReceitaForm) => {
    setUploadError(null);
    try {
      const created = await createMutation.mutateAsync(form);
      if (file && created?.id) {
        await uploadMutation.mutateAsync({ id: created.id, fileToUpload: file });
      }
      queryClient.invalidateQueries({ queryKey: ['receitas'] });
      setOpen(false);
      reset();
      setFile(null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Falha ao salvar receita';
      setUploadError(msg);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setUploadError('Arquivo muito grande — máximo 8MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)) {
      setUploadError('Formato inválido — use JPG, PNG, WEBP ou PDF');
      return;
    }
    setUploadError(null);
    setFile(f);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Receitas</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Prescrição óptica, anexos e histórico clínico do cliente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova receita
          </Button>
        </div>
      </div>

      <OfflineBanner />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente ou ID…" className="pl-9" aria-label="Buscar receitas" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--color-text-muted)]" />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="h-8 w-[140px]"
              aria-label="Filtrar receitas"
            >
              <option value="Todas">Todas</option>
              <option value="Com anexo">Com anexo</option>
              <option value="Sem anexo">Sem anexo</option>
            </Select>
          </div>
          <Badge variant="outline">
            {isLoading ? 'carregando…' : `${total} receitas`} {isFetching && !isLoading && '• atualizando'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando receitas">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <ErrorState error={error as ApiError} onRetry={() => refetch()} />
      ) : filteredReceitas.length === 0 ? (
        <EmptyState
          title={debouncedQ ? 'Nenhuma receita encontrada' : 'Nenhuma receita cadastrada'}
          description={
            debouncedQ
              ? `Sem resultados para “${debouncedQ}”.`
              : 'Cadastre a primeira receita para vincular grau, validade e anexo ao cliente.'
          }
          action={
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova receita
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredReceitas.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[var(--color-primary)]">{r.id}</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.clienteNome ?? r.clienteId}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '—'}</p>
                  </div>
                  <Badge variant={r.status === 'válida' || r.status === 'VALIDA' ? 'success' : 'warning'}>{r.status ?? '—'}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-[var(--color-bg-page)] p-2">
                    <p className="font-semibold text-[var(--color-text-secondary)]">OD</p>
                    <p className="font-mono text-[var(--color-text-primary)]">{r.od}</p>
                  </div>
                  <div className="rounded bg-[var(--color-bg-page)] p-2">
                    <p className="font-semibold text-[var(--color-text-secondary)]">OE</p>
                    <p className="font-mono text-[var(--color-text-primary)]">{r.oe}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const anexoUrl = r.fotoUrl || `/api/v1/receitas/${r.id}/anexo`;
                      setViewFotoUrl(anexoUrl);
                    }}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> Ver foto
                  </Button>
                  <Badge variant={r.fotoUrl ? 'success' : 'outline'} className="self-center">
                    {r.fotoUrl ? 'Foto OK' : 'Anexo'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>
              Página {page + 1} {(data as ReceitasPage)?.totalPages ? `de ${(data as ReceitasPage).totalPages}` : ''} • {total} itens
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!!(data as ReceitasPage)?.last}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Dialog Nova Receita */}
      <Dialog
        open={open}
        onClose={() => {
          if (isSubmitting || createMutation.isPending || uploadMutation.isPending) return;
          setOpen(false);
        }}
        title="Nova receita"
        description="Informe os dados da prescrição e anexe a foto ou PDF quando disponível."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="clienteId">
                ID do cliente <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Input id="clienteId" placeholder="UUID ou CPF mascarado" {...register('clienteId')} aria-invalid={!!errors.clienteId} />
              {errors.clienteId && <p className="text-xs text-[var(--color-danger)]">{errors.clienteId.message}</p>}
              <p className="text-[11px] text-[var(--color-text-muted)]">Vincula prescrição ao cliente (multi-tenant).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipoLente">
                Tipo de lente <span className="text-[var(--color-danger)]">*</span>
              </Label>
              <Select id="tipoLente" {...register('tipoLente')} aria-invalid={!!errors.tipoLente}>
                <option value="MONOFOCAL">Monofocal</option>
                <option value="BIFOCAL">Bifocal</option>
                <option value="MULTIFOCAL">Multifocal</option>
              </Select>
              {errors.tipoLente && <p className="text-xs text-[var(--color-danger)]">{errors.tipoLente.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dp">
              DP — Distância Pupilar (mm) <span className="text-[var(--color-danger)]">*</span>
            </Label>
            <Input
              id="dp"
              type="number"
              step="0.5"
              placeholder="62"
              {...register('dp', { valueAsNumber: true })}
              aria-invalid={!!errors.dp}
              className="max-w-[160px]"
            />
            {errors.dp && <p className="text-xs text-[var(--color-danger)]">{errors.dp.message}</p>}
            <p className="text-[11px] text-[var(--color-text-muted)]">20 a 80 mm — medido no pupilor ou régua.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <GrauFields prefix="od" title="OD — Olho Direito" register={register} watch={watch} errors={errors} />
            <GrauFields prefix="oe" title="OE — Olho Esquerdo" register={register} watch={watch} errors={errors} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea id="observacao" placeholder="Ex: lentes com tratamento antirreflexo" rows={2} {...register('observacao')} />
          </div>

          {/* Upload S3 presigned */}
          <div className="space-y-2">
            <Label htmlFor="anexo">
              Foto da receita <span className="text-[var(--color-text-muted)]">(JPG/PNG/WEBP/PDF até 8MB)</span>
            </Label>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="anexo"
                className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
              >
                <Upload className="h-4 w-4" />
                {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
              </label>
              <input
                id="anexo"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {file && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                  <ImageIcon className="h-3.5 w-3.5" />
                  {file.name} • {(file.size / 1024).toFixed(0)} KB
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-1 rounded p-1 hover:bg-[var(--color-bg-page)]"
                    aria-label="Remover arquivo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>

            {/* Preview */}
            {previewUrl && file?.type.startsWith('image/') && (
              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] p-2">
                <img src={previewUrl} alt="Preview da receita" className="max-h-64 w-full object-contain" />
              </div>
            )}
            {previewUrl && file?.type === 'application/pdf' && (
              <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                PDF selecionado. A visualização será feita após o envio.
              </div>
            )}
            {!file && (
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Anexe uma foto ou PDF da receita para manter o histórico clínico do cliente.
              </p>
            )}
          </div>

          {(createMutation.isError || uploadError) && (
            <div className="rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
              {uploadError ?? (createMutation.error as ApiError)?.message ?? 'Falha ao salvar receita'}
            </div>
          )}
          {uploadMutation.isPending && (
            <p className="flex items-center gap-2 text-xs text-[var(--color-info)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando anexo...
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setFile(null);
                setUploadError(null);
              }}
              disabled={createMutation.isPending || uploadMutation.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || createMutation.isPending || uploadMutation.isPending}>
              {(createMutation.isPending || uploadMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar receita
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog Visualizar Anexo */}
      {viewFotoUrl && (
        <Dialog
          open={!!viewFotoUrl}
          onClose={() => setViewFotoUrl(null)}
          title="Foto da Receita Oftálmica"
          description="Documento anexado no histórico clínico."
        >
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] p-2 flex items-center justify-center">
              <img
                src={viewFotoUrl}
                alt="Receita Oftálmica"
                className="max-h-[65vh] w-auto object-contain rounded"
                onError={(e) => {
                  // Fallback se for PDF ou link não renderizável direto
                  (e.target as HTMLElement).style.display = 'none';
                  const parent = (e.target as HTMLElement).parentElement;
                  if (parent && !parent.querySelector('.pdf-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'pdf-fallback p-6 text-center text-sm';
                    fallback.innerHTML = `<p class="mb-3 font-semibold">Documento PDF ou arquivo anexado</p><a href="${viewFotoUrl}" target="_blank" rel="noreferrer" class="inline-flex items-center px-4 py-2 bg-[var(--color-primary)] text-white rounded font-medium text-xs">Abrir anexo em nova aba</a>`;
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <a
                href={viewFotoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--color-primary)] hover:underline font-medium"
              >
                Abrir imagem em tamanho real
              </a>
              <Button variant="outline" onClick={() => setViewFotoUrl(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
