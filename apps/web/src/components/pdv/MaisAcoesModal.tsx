import type { ElementType } from 'react';
import { ClipboardCopy, Trash2, UserRound, UserRoundX } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type MaisAcoesModalProps = {
  open: boolean;
  onClose: () => void;
  temItens: boolean;
  temCliente: boolean;
  onLimparCarrinho: () => void;
  onRemoverCliente: () => void;
  onCopiarResumo: () => void;
};

type AcaoProps = {
  icon: ElementType;
  titulo: string;
  descricao: string;
  disabled?: boolean;
  onClick: () => void;
};

function Acao({ icon: Icon, titulo, descricao, disabled, onClick }: AcaoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-3 text-left transition-colors hover:bg-[var(--color-bg-page)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{titulo}</span>
        <span className="block text-xs text-[var(--color-text-secondary)]">{descricao}</span>
      </span>
    </button>
  );
}

export function MaisAcoesModal({
  open,
  onClose,
  temItens,
  temCliente,
  onLimparCarrinho,
  onRemoverCliente,
  onCopiarResumo,
}: MaisAcoesModalProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Mais ações" description="Ações rápidas da venda atual.">
      <div className="space-y-2">
        <Acao
          icon={Trash2}
          titulo="Limpar carrinho"
          descricao={temItens ? 'Remove todos os itens adicionados.' : 'Carrinho já está vazio.'}
          disabled={!temItens}
          onClick={onLimparCarrinho}
        />
        <Acao
          icon={temCliente ? UserRoundX : UserRound}
          titulo="Remover cliente"
          descricao={temCliente ? 'Desvincula o cliente desta venda.' : 'Nenhum cliente selecionado.'}
          disabled={!temCliente}
          onClick={onRemoverCliente}
        />
        <Acao
          icon={ClipboardCopy}
          titulo="Copiar resumo da venda"
          descricao="Copia itens, subtotal, desconto e total para a área de transferência."
          disabled={!temItens}
          onClick={onCopiarResumo}
        />
      </div>

      <div className="mt-4 flex justify-end border-t border-[var(--color-border)] pt-3">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Dialog>
  );
}
