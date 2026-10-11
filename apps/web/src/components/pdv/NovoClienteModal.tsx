import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { apiClient, ApiError } from '@/lib/apiClient';
import { isValidCPF, maskCPF, maskTelefone, unmask } from '@/lib/masks';
import type { ClienteDTO } from '@/lib/types';

type Feedback = { tone: 'success' | 'error' | 'warning'; msg: string };

type NovoClienteModalProps = {
  open: boolean;
  onClose: () => void;
  onSelecionado: (cliente: ClienteDTO) => void;
  onFeedback: (feedback: Feedback) => void;
};

function apiErrorMessage(err: unknown): string {
  const apiErr = err as ApiError;
  const detail =
    apiErr.problem?.detail || apiErr.problem?.title || apiErr.message || 'Falha ao cadastrar cliente.';
  const fieldErrors = apiErr.problem?.errors?.map((e) => `${e.field}: ${e.message}`).join(' • ');
  return fieldErrors ? `${detail} — ${fieldErrors}` : detail;
}

/**
 * Novo Cliente (PDV) — ONDA 2A: só camada visual (Field + tokens).
 * Validação client-side, mascaramento e mutação inalterados (R2: CPF só chega
 * cifrado ao backend; aqui apenas máscara de digitação).
 */
export function NovoClienteModal({ open, onClose, onSelecionado, onFeedback }: NovoClienteModalProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [telefone, setTelefone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setNome('');
      setCpf('');
      setTelefone('');
      setEmail('');
      setErro(null);
    }
  }, [open]);

  const criarCliente = useMutation({
    mutationFn: async () => {
      const cpfDigits = unmask(cpf);
      const telefoneDigits = unmask(telefone);
      const body: Record<string, string> = { nome: nome.trim() };
      if (cpfDigits) body.cpf = cpfDigits;
      if (telefoneDigits) {
        body.telefone = telefoneDigits;
        body.whatsapp = telefoneDigits;
      }
      if (email.trim()) body.email = email.trim();
      const res = await apiClient.post<ClienteDTO>('/v1/clientes', body);
      return res.data;
    },
    onSuccess: async (cliente) => {
      await queryClient.invalidateQueries({ queryKey: ['pdv-clientes'] });
      onSelecionado(cliente);
      onFeedback({
        tone: 'success',
        msg: `Cliente ${cliente.nome} cadastrado e selecionado na venda.`,
      });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = apiErrorMessage(err);
      setErro(msg);
      onFeedback({ tone: 'error', msg });
    },
  });

  function validar(): string | null {
    if (nome.trim().length < 2) return 'Informe o nome do cliente (mínimo 2 caracteres).';
    const cpfDigits = unmask(cpf);
    if (cpfDigits && !isValidCPF(cpfDigits)) return 'CPF inválido — confira os 11 dígitos.';
    const telefoneDigits = unmask(telefone);
    if (telefoneDigits && telefoneDigits.length !== 10 && telefoneDigits.length !== 11) {
      return 'Telefone deve ter 10 ou 11 dígitos.';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'E-mail inválido.';
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Novo cliente"
      description="Cadastro rápido para esta venda. CPF e telefone são opcionais, mas ajudam na emissão da NFC-e."
      className="max-w-[560px]"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const validacao = validar();
          if (validacao) {
            setErro(validacao);
            return;
          }
          setErro(null);
          criarCliente.mutate();
        }}
      >
        {erro && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-card border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0">{erro}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Nome"
            id="pdv-cliente-nome"
            required
            className="md:col-span-2"
            error={!!erro && nome.trim().length < 2 ? 'Nome é obrigatório.' : undefined}
          >
            <Input
              autoFocus
              autoComplete="off"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </Field>

          <Field label="CPF" id="pdv-cliente-cpf" hint="Opcional">
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
            />
          </Field>

          <Field label="Telefone / WhatsApp" id="pdv-cliente-telefone" hint="Opcional">
            <Input
              inputMode="tel"
              autoComplete="off"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </Field>

          <Field label="E-mail" id="pdv-cliente-email" className="md:col-span-2" hint="Opcional">
            <Input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={criarCliente.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={criarCliente.isPending} aria-busy={criarCliente.isPending}>
            {criarCliente.isPending ? 'Salvando...' : 'Salvar e usar na venda'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
