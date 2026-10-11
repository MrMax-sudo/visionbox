import { Dialog } from '@/components/ui/dialog';
import { ComprovanteImpressao } from '@/components/pdv/ComprovanteImpressao';
import type { OrdemServicoDTO } from '@/lib/types';
import { shortId } from '@/components/os/osDomain';

/**
 * Via de impressão térmica/A4 da OS — reutiliza o comprovante do PDV.
 * `grauOD`/`grauOE` só devem receber grau claro quando o perfil permite (R2/ADR-002);
 * passe `GRAU_OCULTO` caso contrário.
 */
export function PrintingOsDialog({
  open,
  onClose,
  os,
  displayNumber,
  clienteNome,
  grauOD,
  grauOE,
}: {
  open: boolean;
  onClose: () => void;
  os: OrdemServicoDTO;
  displayNumber: string;
  clienteNome: string;
  grauOD?: string;
  grauOE?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Impressão da Ordem de Serviço ${displayNumber}`}
      description="Via pronta para impressão térmica ou A4 para a ótica e laboratório."
    >
      <ComprovanteImpressao
        tipo="os"
        osNumero={displayNumber}
        clienteNome={clienteNome}
        data={os.criadoEm}
        itens={[
          ...(os.armacaoId
            ? [{ sku: 'ARM', nome: `Armação (${shortId(os.armacaoId)})`, qtd: 1, preco: 0 }]
            : []),
          ...(os.lenteId
            ? [{ sku: 'LNT', nome: `Lente Oftálmica (${shortId(os.lenteId)})`, qtd: 1, preco: 0 }]
            : []),
        ]}
        subtotal={0}
        desconto={0}
        total={0}
        formaPagamento="Consultar Financeiro"
        grauOD={grauOD}
        grauOE={grauOE}
      />
    </Dialog>
  );
}
