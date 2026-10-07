import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const detail = apiErr.problem?.detail || apiErr.problem?.title || apiErr.message || 'Falha ao cadastrar cliente.';
  const fieldErrors = apiErr.problem?.errors?.map((e) => `${e.field}: ${e.message}`).join(' • ');
  return fieldErrors ? `${detail} — ${fieldErrors}` : detail;
}

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
      onFeedback({ tone: 'success', msg: `Cliente ${cliente.nome} cadastrado e selecionado na venda.` });
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
          <div role="alert" className="rounded-[var(--radius)] border border-[var(--color-danger-light)] bg-[var(--color-danger-light)] px-3 py-2 text-sm text-[var(--color-danger-dark)]">
            {erro}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="pdv-cliente-nome">
              Nome <span className="text-[var(--color-danger)]">*</span>
            </Label>
            <Input
              id="pdv-cliente-nome"
              autoFocus
              autoComplete="off"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              aria-invalid={!!erro && nome.trim().length < 2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdv-cliente-cpf">CPF</Label>
            <Input
              id="pdv-cliente-cpf"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pdv-cliente-telefone">Telefone / WhatsApp</Label>
            <Input
              id="pdv-cliente-telefone"
              inputMode="tel"
              autoComplete="off"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="pdv-cliente-email">E-mail</Label>
            <Input
              id="pdv-cliente-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@exemplo.com"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={criarCliente.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={criarCliente.isPending}>
            {criarCliente.isPending ? 'Salvando...' : 'Salvar e usar na venda'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
