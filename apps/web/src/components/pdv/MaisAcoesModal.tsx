import type { ElementType } from 'react';
import { ClipboardCopy, Sparkles, Trash2, UserRound, UserRoundX } from 'lucide-react';
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
  onSeedDemonstracao?: () => void;
  isSeeding?: boolean;
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
      className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-5 w-5 shrink-0 text-brand" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-primary">{titulo}</span>
        <span className="block text-xs text-secondary">{descricao}</span>
      </span>
    </button>
  );
}

/** Mais ações da venda — ONDA 2A (contrato inalterado). */
export function MaisAcoesModal({
  open,
  onClose,
  temItens,
  temCliente,
  onLimparCarrinho,
  onRemoverCliente,
  onCopiarResumo,
  onSeedDemonstracao,
  isSeeding,
}: MaisAcoesModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Mais ações"
      description="Ações rápidas da venda atual."
      className="max-w-[480px]"
    >
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
        {onSeedDemonstracao && (
          <Acao
            icon={Sparkles}
            titulo={isSeeding ? 'Carregando demonstração...' : '⚡ Carregar dados de demonstração'}
            descricao="Insere produtos ópticos (Ray-Ban, Oakley, Zeiss) e clientes de teste com receitas."
            disabled={isSeeding}
            onClick={onSeedDemonstracao}
          />
        )}
      </div>

      <div className="mt-4 flex justify-end border-t border-border pt-3">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Dialog>
  );
}
