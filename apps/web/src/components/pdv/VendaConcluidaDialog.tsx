import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ComprovanteImpressao } from '@/components/pdv/ComprovanteImpressao';
import type { VendaConcluida } from '@/components/pdv/pdvHelpers';

type VendaConcluidaDialogProps = {
  venda: VendaConcluida | null;
  onClose: () => void;
  emitindo: boolean;
  onEmitir: () => void;
  onAcompanhar: (osId: string) => void;
};

/**
 * Diálogo pós-venda: emissão da NFC-e (SEFAZ) + comprovante imprimível.
 * Prévia/orçamento (osId === 'PREVIA') não pode emitir fiscal nem navegar para OS.
 */
export function VendaConcluidaDialog({
  venda,
  onClose,
  emitindo,
  onEmitir,
  onAcompanhar,
}: VendaConcluidaDialogProps) {
  if (!venda) return null;

  const isPrevia = venda.osId === 'PREVIA';

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{isPrevia ? 'Orçamento / Prévia da Venda' : 'Venda Concluída com Sucesso!'}</DialogTitle>
          <DialogDescription>
            {isPrevia ? 'Prévia pronta para impressão — nenhuma OS foi criada ainda.' : `Ordem de Serviço: ${venda.osNumero}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status e Ação de Emissão Fiscal */}
          {venda.tipoDocumento === 'CUPOM' ? (
            <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-page p-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold text-primary">Cupom Não-Fiscal</p>
                  <p className="truncate text-xs text-secondary">
                    Venda registrada para simples conferência e garantia da ótica (sem transmissão SEFAZ).
                  </p>
                </div>
              </div>
              <span className="rounded bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-semibold text-secondary">
                Não-Fiscal
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-page p-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold text-primary">
                    {venda.tipoDocumento === 'DANFE' ? 'Emissão Fiscal (DANFE Modelo 55)' : 'Emissão Fiscal (NFC-e Modelo 65)'}
                  </p>
                  <p className="truncate text-xs text-secondary">
                    {venda.chaveNfce
                      ? `Autorizada! Chave: ${venda.chaveNfce.slice(0, 16)}...`
                      : `Emitir ${venda.tipoDocumento === 'DANFE' ? 'NF-e completa' : 'cupom fiscal'} na SEFAZ via Flowbox`}
                  </p>
                </div>
              </div>
              {!venda.chaveNfce && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={emitindo || isPrevia}
                  onClick={onEmitir}
                  aria-busy={emitindo}
                >
                  {emitindo && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {emitindo ? 'Emitindo...' : venda.tipoDocumento === 'DANFE' ? 'Emitir DANFE' : 'Emitir NFC-e'}
                </Button>
              )}
            </div>
          )}

          <ComprovanteImpressao
            osNumero={venda.osNumero}
            clienteNome={venda.clienteNome}
            clienteCpf={venda.clienteCpf}
            clienteTelefone={venda.clienteTelefone}
            itens={venda.itens}
            subtotal={venda.subtotal}
            desconto={venda.desconto}
            total={venda.total}
            formaPagamento={venda.formaPagamento}
            chaveNfce={venda.chaveNfce}
            protocoloNfce={venda.protocoloNfce}
            tipoDocumento={venda.tipoDocumento || 'CUPOM'}
          />
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>
            Fechar / Nova Venda
          </Button>
          {!isPrevia && (
            <Button variant="primary" onClick={() => onAcompanhar(venda.osId)}>
              Acompanhar OS
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
