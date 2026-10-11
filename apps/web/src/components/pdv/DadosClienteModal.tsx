import { Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ClienteDTO } from '@/lib/types';

type DadosClienteModalProps = {
  open: boolean;
  onClose: () => void;
  cliente: ClienteDTO | null;
  onRemover: () => void;
};

function Linha({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-xs font-semibold text-secondary">{label}</dt>
      <dd className="truncate text-sm text-primary" title={valor || undefined}>
        {valor || '—'}
      </dd>
    </div>
  );
}

/**
 * Dados do Cliente — ONDA 2A.
 * Contrato inalterado (`cliente: ClienteDTO | null`); só a camada visual foi
 * levada para tokens + UI kit. CPF usa a máscara já mascarada pelo backend (R2).
 */
export function DadosClienteModal({ open, onClose, cliente, onRemover }: DadosClienteModalProps) {
  if (!cliente) return null;

  const cidadeUf = [cliente.cidade, cliente.uf].filter(Boolean).join(' / ');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dados do cliente"
      description="Somente o que a API retorna para a sessão atual."
      className="max-w-[560px]"
    >
      <dl className="rounded-card border border-border bg-page px-4 py-1">
        <Linha label="Nome" valor={cliente.nome} />
        <Linha label="CPF" valor={cliente.cpfMasked ?? cliente.cpf ?? '***'} />
        <Linha label="Telefone" valor={cliente.telefone} />
        <Linha label="WhatsApp" valor={cliente.whatsapp} />
        <Linha label="Cidade / UF" valor={cidadeUf} />
        <Linha label="E-mail" valor={cliente.email} />
        <Linha
          label="Última compra"
          valor={
            cliente.ultimaCompra
              ? new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR')
              : undefined
          }
        />
      </dl>

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            onRemover();
            onClose();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Remover da venda
        </Button>
      </div>
    </Dialog>
  );
}
