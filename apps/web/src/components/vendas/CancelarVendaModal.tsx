import * as React from 'react';
import { AlertTriangle, Ban, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendaView } from '@/types/vendas';

interface CancelarVendaModalProps {
  open: boolean;
  onClose: () => void;
  venda: VendaView | null;
  onConfirmar: (motivo: string) => void;
  isPending?: boolean;
}

export function CancelarVendaModal({
  open,
  onClose,
  venda,
  onConfirmar,
  isPending = false,
}: CancelarVendaModalProps) {
  const [motivo, setMotivo] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setMotivo('');
      setErro(null);
    }
  }, [open]);

  if (!open || !venda) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo.trim()) {
      setErro('Informe a justificativa para o cancelamento.');
      return;
    }
    if (motivo.trim().length < 5) {
      setErro('A justificativa deve conter pelo menos 5 caracteres.');
      return;
    }
    setErro(null);
    onConfirmar(motivo.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancelar-venda-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-page)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2.5 text-[var(--color-danger-dark)]">
            <AlertTriangle className="h-5 w-5" />
            <h2 id="cancelar-venda-title" className="text-base font-bold text-[var(--color-text-primary)]">
              Cancelar Venda {venda.numero}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-100)] dark:hover:bg-[var(--color-neutral-800)]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="rounded-lg border border-[var(--color-warning-light)] bg-[var(--color-warning-light)]/40 p-3 text-xs text-[var(--color-warning-dark)]">
            <strong>Atenção:</strong> Ao confirmar o cancelamento, os itens reservados retornarão ao estoque da ótica e as parcelas no Contas a Receber serão canceladas.
          </div>

          <div>
            <label htmlFor="cancelar-motivo" className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">
              Justificativa do Cancelamento <span className="text-[var(--color-danger)]">*</span>
            </label>
            <textarea
              id="cancelar-motivo"
              rows={3}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                if (erro) setErro(null);
              }}
              placeholder="Ex: Desistência do cliente, erro no lançamento do valor ou produto incorreto..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              disabled={isPending}
            />
            {erro && <p className="mt-1 text-xs text-[var(--color-danger)]">{erro}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Voltar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isPending}
              className="gap-1.5"
            >
              <Ban className="h-4 w-4" />
              {isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
