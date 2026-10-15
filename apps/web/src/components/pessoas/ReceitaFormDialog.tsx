import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

import { apiClient } from '@/lib/apiClient';
import type { ClienteDTO, ReceitaDTO } from '@/lib/types';
import { ClienteCombobox } from '@/components/pessoas/ClienteCombobox';
import { GrauFields } from '@/components/pessoas/GrauFields';
import {
  RECEITA_DEFAULT_VALUES,
  apiErrorMessage,
  receitaSchema,
  type ReceitaForm,
} from '@/components/pessoas/receitaForm';

export interface ReceitaFormDialogProps {
  open: boolean;
  onClose: () => void;
  receitaParaEditar?: ReceitaDTO | null;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * ReceitaFormDialog — criação e edição de receita óptica + upload de anexo.
 * O form guarda SOMENTE o UUID do cliente (combobox); grau segue ADR-002.
 */
export function ReceitaFormDialog({ open, onClose, receitaParaEditar }: ReceitaFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedCliente, setSelectedCliente] = React.useState<ClienteDTO | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReceitaForm>({
    resolver: zodResolver(receitaSchema),
    defaultValues: RECEITA_DEFAULT_VALUES,
  });

  // Abertura: form limpo ou pré-populado para edição
  React.useLayoutEffect(() => {
    if (!open) return;
    if (receitaParaEditar) {
      reset({
        clienteId: receitaParaEditar.clienteId,
        tipoLente: (receitaParaEditar.tipo as 'MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL') || 'MONOFOCAL',
        dp: receitaParaEditar.dp ?? 62,
        od: {
          esferico: receitaParaEditar.rawOd?.esferico ?? 0,
          cilindrico: receitaParaEditar.rawOd?.cilindrico ?? 0,
          eixo: receitaParaEditar.rawOd?.eixo ?? null,
          adicao: receitaParaEditar.rawOd?.adicao ?? 0,
        },
        oe: {
          esferico: receitaParaEditar.rawOe?.esferico ?? 0,
          cilindrico: receitaParaEditar.rawOe?.cilindrico ?? 0,
          eixo: receitaParaEditar.rawOe?.eixo ?? null,
          adicao: receitaParaEditar.rawOe?.adicao ?? 0,
        },
        observacao: receitaParaEditar.observacao || '',
      });
      setSelectedCliente({
        id: receitaParaEditar.clienteId,
        nome: receitaParaEditar.clienteNome || 'Cliente',
        cpf: '',
        telefone: '',
        lojaId: '',
      });
    } else {
      reset(RECEITA_DEFAULT_VALUES);
      setSelectedCliente(null);
    }
    setFile(null);
    setUploadError(null);
  }, [open, receitaParaEditar, reset]);

  // preview do anexo
  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const saveMutation = useMutation({
    mutationFn: async (form: ReceitaForm) => {
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

      if (receitaParaEditar) {
        const res = await apiClient.put<ReceitaDTO>(`/v1/receitas/${receitaParaEditar.id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post<ReceitaDTO>('/v1/receitas', payload);
        return res.data;
      }
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

  function limparTudo() {
    reset(RECEITA_DEFAULT_VALUES);
    setSelectedCliente(null);
    setFile(null);
    setUploadError(null);
  }

  const handleClose = () => {
    if (isSubmitting || saveMutation.isPending || uploadMutation.isPending) return;
    onClose();
  };

  const onSubmit = async (form: ReceitaForm) => {
    setUploadError(null);
    let saved: ReceitaDTO | null = null;
    try {
      saved = await saveMutation.mutateAsync(form);
      if (file && saved?.id) {
        await uploadMutation.mutateAsync({ id: saved.id, fileToUpload: file });
      }
      queryClient.invalidateQueries({ queryKey: ['receitas'] });
      limparTudo();
      toast({
        title: receitaParaEditar ? 'Receita atualizada' : 'Receita salva',
        description: receitaParaEditar ? 'Os dados clínicos foram atualizados com sucesso.' : 'Receita criada com sucesso.',
        variant: 'success',
      });
      onClose();
    } catch (e) {
      const msg = apiErrorMessage(e, 'Falha ao salvar receita');
      if (saved) {
        queryClient.invalidateQueries({ queryKey: ['receitas'] });
        limparTudo();
        onClose();
        toast({
          title: 'Anexo não enviado',
          description: `Receita salva, mas o envio do anexo falhou: ${msg}`,
          variant: 'destructive',
        });
      } else {
        setUploadError(msg);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setUploadError('Arquivo muito grande — máximo 8MB');
      return;
    }
    if (!MIME_OK.includes(f.type)) {
      setUploadError('Formato inválido — use JPG, PNG, WEBP ou PDF');
      return;
    }
    setUploadError(null);
    setFile(f);
  };

  const busy = isSubmitting || saveMutation.isPending || uploadMutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={receitaParaEditar ? 'Editar receita' : 'Nova receita'}
      description={
        receitaParaEditar
          ? 'Atualize os dados da prescrição óptica e anexo.'
          : 'Informe os dados da prescrição e anexe a foto ou PDF quando disponível.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <ClienteCombobox
            active={open}
            selected={selectedCliente}
            onSelect={(c) => {
              setSelectedCliente(c);
              setValue('clienteId', c.id, { shouldValidate: true });
            }}
            onClear={() => setValue('clienteId', '', { shouldValidate: false })}
            error={errors.clienteId}
          />

          <Field label="Tipo de lente" id="tipo-lente" required error={errors.tipoLente}>
            <Select {...register('tipoLente')}>
              <option value="MONOFOCAL">Monofocal</option>
              <option value="BIFOCAL">Bifocal</option>
              <option value="MULTIFOCAL">Multifocal</option>
            </Select>
          </Field>
        </div>

        <Field
          label="DP — Distância Pupilar (mm)"
          id="dp"
          required
          error={errors.dp}
          hint="20 a 80 mm — medido no pupilor ou régua."
          className="max-w-[320px]"
        >
          <Input type="number" step="0.5" placeholder="62" {...register('dp', { valueAsNumber: true })} />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <GrauFields prefix="od" title="OD — Olho Direito" register={register} watch={watch} errors={errors} />
          <GrauFields prefix="oe" title="OE — Olho Esquerdo" register={register} watch={watch} errors={errors} />
        </div>

        <Field label="Observação" id="observacao" error={errors.observacao}>
          <Textarea
            rows={2}
            placeholder="Ex: lentes com tratamento antirreflexo"
            {...register('observacao')}
          />
        </Field>

        {/* Upload S3 presigned */}
        <div className="space-y-2">
          <Label htmlFor="anexo">
            Foto da receita{' '}
            <span className="font-normal text-muted">(JPG/PNG/WEBP/PDF até 8MB)</span>
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="anexo"
              className="inline-flex cursor-pointer items-center gap-2 rounded border border-border bg-page px-3 py-2 text-sm text-primary transition-colors hover:border-border-strong focus-within:ring-2 focus-within:ring-primary"
            >
              <Upload className="h-4 w-4" aria-hidden />
              {file ? 'Trocar arquivo' : 'Selecionar arquivo'}
            </label>
            <input
              id="anexo"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={handleFileChange}
            />
            {file && (
              <span className="flex items-center gap-1 text-xs text-secondary">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                {file.name} • {(file.size / 1024).toFixed(0)} KB
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="ml-1 rounded p-1 hover:bg-page"
                  aria-label="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            )}
          </div>

          {previewUrl && file?.type.startsWith('image/') && (
            <div className="overflow-hidden rounded border border-border bg-page p-2">
              <img src={previewUrl} alt="Preview da receita" className="max-h-64 w-full object-contain" />
            </div>
          )}
          {previewUrl && file?.type === 'application/pdf' && (
            <div className="rounded border border-border bg-page px-3 py-2 text-xs text-secondary">
              PDF selecionado. A visualização será feita após o envio.
            </div>
          )}
          {!file && (
            <p className="text-[11px] text-muted">
              Anexe uma foto ou PDF da receita para manter o histórico clínico do cliente.
            </p>
          )}
        </div>

        {uploadError && (
          <p role="alert" className="rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark">
            {uploadError}
          </p>
        )}
        {uploadMutation.isPending && (
          <p className="flex items-center gap-2 text-xs text-info" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Enviando anexo...
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {receitaParaEditar ? 'Atualizar receita' : 'Salvar receita'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
