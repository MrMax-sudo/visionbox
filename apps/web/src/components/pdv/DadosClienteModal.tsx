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
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-3 border-b border-[var(--color-border)] py-2 last:border-b-0">
      <dt className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)]">{valor || '—'}</dd>
    </div>
  );
}

export function DadosClienteModal({ open, onClose, cliente, onRemover }: DadosClienteModalProps) {
  if (!cliente) return null;

  const cidadeUf = [cliente.cidade, cliente.uf].filter(Boolean).join(' / ');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dados do cliente"
      description="Somente o que a API retorna para a sessão atual."
    >
      <dl className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-page)] px-4 py-2">
        <Linha label="Nome" valor={cliente.nome} />
        <Linha label="CPF" valor={cliente.cpfMasked ?? cliente.cpf ?? '***'} />
        <Linha label="Telefone" valor={cliente.telefone} />
        <Linha label="WhatsApp" valor={cliente.whatsapp} />
        <Linha label="Cidade / UF" valor={cidadeUf} />
        <Linha label="E-mail" valor={cliente.email} />
        <Linha
          label="Última compra"
          valor={cliente.ultimaCompra ? new Date(cliente.ultimaCompra).toLocaleDateString('pt-BR') : undefined}
        />
      </dl>

      <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
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
