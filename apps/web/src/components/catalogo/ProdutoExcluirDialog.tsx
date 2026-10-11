import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

import { apiClient, ApiError } from '@/lib/apiClient';
import type { ProdutoDTO } from '@/lib/types';

export interface ProdutoExcluirDialogProps {
  /** null = fechado */
  produto: ProdutoDTO | null;
  onClose: () => void;
}

/** Exclusão de SKU — invalida catálogo e a busca do PDV. */
export function ProdutoExcluirDialog({ produto, onClose }: ProdutoExcluirDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActionError(null);
  }, [produto]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/v1/produtos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['pdv-produtos'] });
      toast({ title: 'Produto excluído', description: 'SKU removido do catálogo.', variant: 'success' });
      onClose();
    },
    onError: (err: unknown) => {
      const problem = err instanceof ApiError ? err.problem : undefined;
      setActionError(problem?.detail || (err instanceof Error ? err.message : 'Falha ao excluir produto'));
    },
  });

  const handleClose = () => {
    if (deleteMutation.isPending) return;
    onClose();
  };

  return (
    <Dialog
      open={!!produto}
      onClose={handleClose}
      title="Excluir produto"
      description="O produto sai da venda e do catálogo desta loja."
    >
      <p className="py-2 text-sm text-primary">
        Tem certeza que deseja excluir <strong>{produto?.nome}</strong> (SKU {produto?.sku})?
      </p>
      {actionError && (
        <p
          role="alert"
          className="mb-3 rounded border border-danger-light bg-danger-light px-3 py-2 text-sm text-danger-dark"
        >
          {actionError}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="outline" onClick={handleClose} disabled={deleteMutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          disabled={!produto?.id || deleteMutation.isPending}
          onClick={() => {
            if (produto?.id) deleteMutation.mutate(produto.id);
          }}
        >
          {deleteMutation.isPending ? 'Excluindo…' : 'Excluir'}
        </Button>
      </div>
    </Dialog>
  );
}
