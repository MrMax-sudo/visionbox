import * as React from 'react';
import { Ban, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';
import { ComprovanteImpressao } from '@/components/pdv/ComprovanteImpressao';
import type { VendaConcluida } from '@/components/pdv/pdvHelpers';

type VendaConcluidaDialogProps = {
  venda: VendaConcluida | null;
  onClose: () => void;
  emitindo: boolean;
  onEmitir: () => void;
  onAcompanhar: (osId: string) => void;
};

const JUSTIFICATIVA_PADRAO = 'Cancelamento solicitado no PDV';
const JUSTIFICATIVA_MIN = 15;
const JUSTIFICATIVA_MAX = 255;

/**
 * Diálogo pós-venda: emissão da NFC-e (SEFAZ) + comprovante imprimível.
 * Prévia/orçamento (osId === 'PREVIA') não pode emitir fiscal nem navegar para OS.
 * Inclui cancelamento de NFC-e (POST /v1/fiscal/nfce/cancelar) com painel inline.
 */
export function VendaConcluidaDialog({
  venda,
  onClose,
  emitindo,
  onEmitir,
  onAcompanhar,
}: VendaConcluidaDialogProps) {
  const { toast } = useToast();
  const [painelCancelamento, setPainelCancelamento] = React.useState(false);
  const [justificativa, setJustificativa] = React.useState(JUSTIFICATIVA_PADRAO);
  const [cancelando, setCancelando] = React.useState(false);
  const [cancelada, setCancelada] = React.useState(false);

  // Reseta o estado de cancelamento quando uma nova venda substitui a anterior
  // (o componente permanece montado entre vendas — só `venda` muda).
  React.useEffect(() => {
    setPainelCancelamento(false);
    setJustificativa(JUSTIFICATIVA_PADRAO);
    setCancelada(false);
  }, [venda?.chaveNfce, venda?.osId]);

  if (!venda) return null;

  const isPrevia = venda.osId === 'PREVIA';
  // Cancelamento via /v1/fiscal/nfce/cancelar só se aplica a NFC-e (modelo 65).
  const podeCancelarNfce =
    venda.tipoDocumento !== 'CUPOM' && venda.tipoDocumento !== 'DANFE' && !!venda.chaveNfce && !cancelada;
  const justificativaTrim = justificativa.trim();
  const justificativaValida =
    justificativaTrim.length >= JUSTIFICATIVA_MIN && justificativaTrim.length <= JUSTIFICATIVA_MAX;

  async function handleConfirmarCancelamento() {
    if (!venda?.chaveNfce || !justificativaValida || cancelando) return;
    setCancelando(true);
    try {
      await apiClient.post('/v1/fiscal/nfce/cancelar', {
        chaveAcesso: venda.chaveNfce,
        justificativa: justificativaTrim,
      });
      setCancelada(true);
      setPainelCancelamento(false);
      toast({
        title: 'NFC-e cancelada',
        description: 'Cancelamento registrado na SEFAZ. O documento consta como cancelado.',
        variant: 'success',
      });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.problem?.detail || err.problem?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Falha ao cancelar a NFC-e.';
      // Painel permanece aberto para correção da justificativa / nova tentativa.
      toast({ title: 'Falha ao cancelar NFC-e', description: msg, variant: 'destructive' });
    } finally {
      setCancelando(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle>
            {venda.tipoDocumento === 'ORCAMENTO'
              ? 'Orçamento Comercial Gerado'
              : isPrevia
                ? 'Prévia da Venda'
                : 'Venda Concluída com Sucesso!'}
          </DialogTitle>
          <DialogDescription>
            {venda.tipoDocumento === 'ORCAMENTO'
              ? `Proposta comercial ${venda.osNumero} pronta para impressão.`
              : isPrevia
                ? 'Prévia pronta para impressão — nenhuma OS foi criada ainda.'
                : `Ordem de Serviço: ${venda.osNumero}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status e Ação de Emissão Fiscal */}
          {venda.tipoDocumento === 'ORCAMENTO' ? (
            <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-page p-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold text-primary">Orçamento Comercial (A4)</p>
                  <p className="truncate text-xs text-secondary">
                    Documento de proposta pronto para impressão ou envio ao cliente (sem valor fiscal).
                  </p>
                </div>
              </div>
              <span className="rounded bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 px-2.5 py-1 text-xs font-semibold">
                Orçamento
              </span>
            </div>
          ) : venda.tipoDocumento === 'CUPOM' ? (
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
                      : emitindo
                        ? 'Transmitindo para a SEFAZ via Flowbox...'
                        : `Aguardando transmissão para a SEFAZ via Flowbox`}
                  </p>
                  {venda.protocoloNfce && (
                    <p className="truncate text-xs text-secondary">
                      Protocolo de autorização: {venda.protocoloNfce}
                    </p>
                  )}
                </div>
              </div>
              {cancelada ? (
                <Badge variant="danger" className="gap-1">
                  <Ban className="h-3 w-3" aria-hidden /> Cancelada na SEFAZ
                </Badge>
              ) : (
                !venda.chaveNfce && (
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
                )
              )}
            </div>
          )}

          {/* Ação de cancelamento de NFC-e (somente documento autorizado com chave) */}
          {podeCancelarNfce && !painelCancelamento && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-danger"
                onClick={() => setPainelCancelamento(true)}
              >
                <Ban className="h-4 w-4" aria-hidden /> Cancelar NFC-e
              </Button>
            </div>
          )}

          {/* Painel inline de cancelamento — sem modal adicional */}
          {podeCancelarNfce && painelCancelamento && (
            <div
              className="space-y-3 rounded-card border border-danger-light bg-page p-3"
              role="group"
              aria-label="Cancelamento de NFC-e"
            >
              <div className="rounded border border-warning-light bg-warning-light px-3 py-2 text-xs text-warning-dark">
                A SEFAZ aceita o cancelamento de NFC-e em até 30 minutos após a autorização. Depois disso, use NF-e de
                devolução ou pedido extemporâneo.
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nfce-justificativa-cancelamento" className="text-xs">
                  Justificativa do cancelamento (mínimo {JUSTIFICATIVA_MIN} caracteres)
                </Label>
                <Textarea
                  id="nfce-justificativa-cancelamento"
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  maxLength={JUSTIFICATIVA_MAX}
                  disabled={cancelando}
                  aria-invalid={justificativa.length > 0 && !justificativaValida}
                  aria-describedby="nfce-justificativa-contador"
                />
                <p
                  id="nfce-justificativa-contador"
                  className={`text-xs ${justificativaValida ? 'text-secondary' : 'text-danger'}`}
                >
                  {justificativaTrim.length}/{JUSTIFICATIVA_MAX} caracteres
                  {!justificativaValida && justificativaTrim.length < JUSTIFICATIVA_MIN && (
                    <> — informe ao menos {JUSTIFICATIVA_MIN} caracteres.</>
                  )}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelando}
                  onClick={() => setPainelCancelamento(false)}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={!justificativaValida || cancelando}
                  onClick={handleConfirmarCancelamento}
                  aria-busy={cancelando}
                >
                  {cancelando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {cancelando ? 'Cancelando...' : 'Confirmar cancelamento'}
                </Button>
              </div>
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
