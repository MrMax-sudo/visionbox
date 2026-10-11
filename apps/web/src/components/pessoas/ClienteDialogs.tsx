import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { ClienteDTO } from '@/lib/types';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm text-primary">{children}</p>
    </div>
  );
}

export interface ClienteViewDialogProps {
  cliente: ClienteDTO | null;
  onClose: () => void;
  onEdit: (cliente: ClienteDTO) => void;
}

/** Detalhes do cliente — CPF sempre exibido mascarado (LGPD/ADR-002). */
export function ClienteViewDialog({ cliente, onClose, onEdit }: ClienteViewDialogProps) {
  return (
    <Dialog open={!!cliente} onClose={onClose} title="Cliente" description="Dados cadastrais completos.">
      {cliente && (
        <div className="space-y-4 text-sm">
          <Info label="Nome">{cliente.nome}</Info>
          <div className="grid gap-4 md:grid-cols-2">
            <Info label="CPF">
              <span className="font-mono">{cliente.cpfMasked ?? cliente.cpf ?? '***'}</span>
            </Info>
            <Info label="Telefone">{cliente.telefone ?? cliente.whatsapp ?? '—'}</Info>
            <Info label="E-mail">{cliente.email ?? '—'}</Info>
            <Info label="Canal preferido">{cliente.canalPreferido ?? '—'}</Info>
            <Info label="Consentimento recall">{cliente.consentimentoRecall ? 'Sim' : 'Não'}</Info>
            <Info label="Última compra">
              {cliente.ultimaCompra ? new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR') : '—'}
            </Info>
          </div>
          <Info label="Endereço">
            {[
              cliente.logradouro,
              cliente.numero,
              cliente.complemento,
              cliente.bairro,
              cliente.cidade,
              cliente.uf,
            ]
              .filter(Boolean)
              .join(', ') || '—'}
          </Info>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button variant="primary" onClick={() => onEdit(cliente)}>
              Editar
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export interface ClienteDeleteDialogProps {
  cliente: ClienteDTO | null;
  onClose: () => void;
}

/** Exclusão de cliente — preserva histórico fiscal/OS (soft delete no backend). */
export function ClienteDeleteDialog({ cliente, onClose }: ClienteDeleteDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/clientes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente excluído', description: 'Cadastro removido com sucesso.', variant: 'success' });
      onClose();
    },
  });

  const handleClose = () => {
    if (deleteMutation.isPending) return;
    onClose();
  };

  return (
    <Dialog
      open={!!cliente}
      onClose={handleClose}
      title="Excluir cliente"
      description="O histórico fiscal e de OS será preservado."
    >
      <div className="space-y-4">
        <p className="text-sm text-secondary">
          Deseja desativar <strong className="text-primary">{cliente?.nome}</strong>? O histórico fiscal e de OS
          será preservado.
        </p>
        {deleteMutation.isError && (
          <p
            role="alert"
            className="rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
          >
            {(deleteMutation.error as ApiError)?.message ?? 'Não foi possível excluir cliente'}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={handleClose} disabled={deleteMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!cliente || deleteMutation.isPending}
            onClick={() => cliente && deleteMutation.mutate(cliente.id)}
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Excluir
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
