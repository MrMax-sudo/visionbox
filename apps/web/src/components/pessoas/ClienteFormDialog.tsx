import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { ClienteDTO } from '@/lib/types';
import { maskCPF, maskCEP, maskTelefone, unmask, isValidCPF } from '@/lib/masks';
import { fetchViaCEP } from '@/lib/viacep';

// ---------------------------------------------------------------------------
// Zod schema — alinhado a ADR-002 (CPF criptografado) + LGPD consentimento recall
// ---------------------------------------------------------------------------
export const clienteSchema = z.object({
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

export type ClienteForm = z.infer<typeof clienteSchema>;

const DEFAULT_VALUES: ClienteForm = {
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
};

export interface ClienteFormDialogProps {
  open: boolean;
  /** null = novo cliente; objeto = edição (CPF pode chegar mascarado) */
  cliente: ClienteDTO | null;
  onClose: () => void;
}

/**
 * ClienteFormDialog — criar/editar cliente (ViaCEP, máscaras, consentimento LGPD).
 * CPF: criptografado no servidor; na edição o valor pode vir mascarado (`***`)
 * para VENDEDOR e NÃO é reenviado em texto puro (ADR-002).
 */
export function ClienteFormDialog({ open, cliente, onClose }: ClienteFormDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!cliente;
  const [viaCepLoading, setViaCepLoading] = React.useState(false);
  const [viaCepError, setViaCepError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClienteForm>({
    resolver: zodResolver(clienteSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const cepValue = watch('cep');
  const cpfValue = watch('cpf');
  const telefoneValue = watch('telefone');
  const consentimentoValue = watch('consentimentoRecall');

  // Abertura: valores do cliente (edição) ou zerados (novo) — antes do paint.
  React.useLayoutEffect(() => {
    if (!open) return;
    if (!cliente) {
      reset(DEFAULT_VALUES);
      return;
    }
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
  }, [open, cliente, reset]);

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
      const res =
        isEditing && cliente
          ? await apiClient.put<ClienteDTO>(`/v1/clientes/${cliente.id}`, body)
          : await apiClient.post<ClienteDTO>('/v1/clientes', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      reset(DEFAULT_VALUES);
      lastFetchedCep.current = '';
      setViaCepError(null);
      toast({
        title: isEditing ? 'Cliente atualizado' : 'Cliente criado',
        description: 'Cadastro salvo com sucesso.',
        variant: 'success',
      });
      onClose();
    },
  });

  const handleClose = () => {
    if (isSubmitting || saveMutation.isPending) return;
    onClose();
  };

  const onSubmit = (dataForm: ClienteForm) => saveMutation.mutate(dataForm);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEditing ? 'Editar cliente' : 'Novo cliente'}
      description={
        isEditing
          ? 'Atualize dados cadastrais sem expor CPF em texto puro.'
          : 'CPF será criptografado AES-GCM no servidor. Campos com * são obrigatórios.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome completo" id="cliente-nome" required error={errors.nome}>
          <Input placeholder="Ex: Maria Silva" autoFocus {...register('nome')} />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="CPF"
            id="cliente-cpf"
            required={!isEditing}
            error={errors.cpf}
            hint={isEditing ? 'Mantenha o CPF atual se não for alterar.' : undefined}
          >
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpfValue}
              onChange={(e) => setValue('cpf', maskCPF(e.target.value), { shouldValidate: true })}
            />
          </Field>

          <Field label="Telefone" id="cliente-telefone" required error={errors.telefone}>
            <Input
              inputMode="numeric"
              placeholder="(00) 00000-0000"
              value={telefoneValue}
              onChange={(e) => setValue('telefone', maskTelefone(e.target.value), { shouldValidate: true })}
            />
          </Field>
        </div>

        <Field label="E-mail" id="cliente-email" error={errors.email}>
          <Input type="email" placeholder="cliente@exemplo.com" {...register('email')} />
        </Field>

        {/* Endereço com ViaCEP */}
        <div className="grid gap-4 md:grid-cols-[160px_1fr]">
          <Field
            label="CEP"
            id="cliente-cep"
            required
            error={errors.cep ?? viaCepError ?? undefined}
            hint="Digite 8 dígitos para buscar endereço automaticamente."
          >
            <div className="relative">
              <Input
                inputMode="numeric"
                placeholder="00000-000"
                value={cepValue}
                onChange={(e) => setValue('cep', maskCEP(e.target.value), { shouldValidate: true })}
              />
              {viaCepLoading && (
                <Loader2
                  className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted"
                  aria-hidden
                />
              )}
            </div>
          </Field>

          <Field label="Logradouro" id="cliente-logradouro" required error={errors.logradouro}>
            <Input placeholder="Rua / Avenida" {...register('logradouro')} />
          </Field>
        </div>
        {viaCepLoading && (
          <p className="text-xs text-info" role="status">
            Buscando endereço…
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-[120px_1fr_1fr]">
          <Field label="Número" id="cliente-numero" required error={errors.numero}>
            <Input placeholder="123" {...register('numero')} />
          </Field>
          <Field label="Complemento" id="cliente-complemento" error={errors.complemento}>
            <Input placeholder="Apto, bloco…" {...register('complemento')} />
          </Field>
          <Field label="Bairro" id="cliente-bairro" required error={errors.bairro}>
            <Input placeholder="Centro" {...register('bairro')} />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cidade" id="cliente-cidade" required error={errors.cidade}>
            <Input {...register('cidade')} />
          </Field>
          <Field label="UF" id="cliente-uf" required error={errors.uf}>
            <Input
              placeholder="SP"
              maxLength={2}
              className="uppercase"
              {...register('uf', { setValueAs: (v: string) => (v ?? '').toUpperCase() })}
              onChange={(e) => setValue('uf', e.target.value.toUpperCase(), { shouldValidate: true })}
            />
          </Field>
        </div>

        <Field label="Canal preferido" id="cliente-canal" required error={errors.canalPreferido}>
          <Select {...register('canalPreferido')}>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">E-mail</option>
            <option value="SMS">SMS</option>
            <option value="TELEFONE">Telefone</option>
          </Select>
        </Field>

        {/* Consentimento recall (LGPD — base legal: consentimento art. 7º I) */}
        <div className="flex items-start gap-3 rounded border border-border bg-page p-3">
          <Checkbox
            id="cliente-consentimento"
            className="mt-0.5"
            checked={consentimentoValue === true}
            onCheckedChange={(v) =>
              setValue('consentimentoRecall', v === true, { shouldValidate: true, shouldDirty: true })
            }
          />
          <Label htmlFor="cliente-consentimento" className="cursor-pointer text-xs font-normal leading-snug text-secondary">
            <span className="font-medium text-primary">Consentimento recall LGPD</span> — cliente autoriza contato
            para recall de lentes/armações e campanhas relacionadas à saúde visual. Sem este consentimento não
            enviaremos comunicações de marketing (base legal: consentimento art. 7º I).</Label>
        </div>

        {saveMutation.isError && (
          <p
            role="alert"
            className="rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
          >
            {(saveMutation.error as ApiError)?.message ?? 'Falha ao salvar cliente'}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={saveMutation.isPending || isSubmitting}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {isEditing ? 'Salvar alterações' : 'Salvar cliente'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
