import * as React from 'react';
import {
  X,
  Printer,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Ban,
  Phone,
  MessageCircle,
  Calendar,
  Wallet,
  ShoppingBag,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmpresaStore } from '@/stores/empresaStore';
import { VendaView } from '@/types/vendas';
import {
  executarImpressao,
  gerarHtmlNfce,
  gerarHtmlReciboNaoFiscal,
  DadosImpressao,
} from '@/lib/reciboPrint';

interface DetalhesVendaModalProps {
  open: boolean;
  onClose: () => void;
  venda: VendaView | null;
  onCancelarVenda: (venda: VendaView) => void;
}

function currency(val?: number): string {
  if (val == null) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DetalhesVendaModal({
  open,
  onClose,
  venda,
  onCancelarVenda,
}: DetalhesVendaModalProps) {
  const empresa = useEmpresaStore((s) => s.empresa);
  const [copiedKey, setCopiedKey] = React.useState(false);

  if (!open || !venda) return null;

  const isCancelada = venda.status === 'CANCELADO';

  function handleCopiarChave() {
    if (!venda?.chaveAcesso) return;
    navigator.clipboard.writeText(venda.chaveAcesso);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handleImprimirRecibo() {
    if (!venda) return;
    const dados: DadosImpressao = {
      osNumero: venda.numero,
      data: venda.dataHora,
      empresa: {
        nome: empresa?.nome,
        razaoSocial: empresa?.nome,
        cnpj: empresa?.cnpj,
        endereco: empresa?.endereco,
        numero: empresa?.numero,
        bairro: empresa?.bairro,
        cidade: empresa?.cidade,
        uf: empresa?.uf,
        telefone: empresa?.telefone,
        whatsapp: empresa?.whatsapp || undefined,
      },
      cliente: {
        nome: venda.clienteNome,
        cpf: venda.clienteCpf || undefined,
        telefone: venda.clienteTelefone || venda.clienteWhatsapp || undefined,
      },
      itens: venda.itens.map((it) => ({
        nome: it.nome,
        qtd: it.quantidade,
        preco: it.precoUnitario,
        sku: it.sku,
      })),
      subtotal: venda.subtotal,
      desconto: venda.desconto,
      total: venda.valorTotal,
      formaPagamento: venda.formaPagamento,
    };
    const html = gerarHtmlReciboNaoFiscal(dados);
    executarImpressao(html);
  }

  function handleImprimirNfce() {
    if (!venda) return;
    const dados: DadosImpressao = {
      osNumero: venda.numero,
      data: venda.dataAutorizacaoFiscal || venda.dataHora,
      empresa: {
        nome: empresa?.nome,
        razaoSocial: empresa?.nome,
        cnpj: empresa?.cnpj,
        endereco: empresa?.endereco,
        numero: empresa?.numero,
        bairro: empresa?.bairro,
        cidade: empresa?.cidade,
        uf: empresa?.uf,
        telefone: empresa?.telefone,
        whatsapp: empresa?.whatsapp || undefined,
      },
      cliente: {
        nome: venda.clienteNome,
        cpf: venda.clienteCpf || undefined,
      },
      itens: venda.itens.map((it) => ({
        nome: it.nome,
        qtd: it.quantidade,
        preco: it.precoUnitario,
        sku: it.sku,
      })),
      subtotal: venda.subtotal,
      desconto: venda.desconto,
      total: venda.valorTotal,
      formaPagamento: venda.formaPagamento,
      chaveNfce: venda.chaveAcesso,
      protocoloNfce: venda.protocoloFiscal,
      tipoDocumento: 'NFCE',
    };
    const html = gerarHtmlNfce(dados);
    executarImpressao(html);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalhes-venda-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-page)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="detalhes-venda-title" className="text-lg font-bold text-[var(--color-text-primary)]">
                  Venda {venda.numero}
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isCancelada
                      ? 'bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]'
                      : 'bg-[var(--color-success-light)] text-[var(--color-success-dark)]'
                  }`}
                >
                  {venda.statusDescricao || venda.status}
                </span>
                {venda.statusFiscal === 'AUTORIZADO' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-success-dark)]">
                    <ShieldCheck className="h-3 w-3" /> NFC-e Autorizada
                  </span>
                ) : venda.statusFiscal === 'CONTINGENCIA' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-light)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-warning-dark)]">
                    <AlertTriangle className="h-3 w-3" /> Contingência
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[var(--color-neutral-100)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)] dark:bg-[var(--color-neutral-800)]">
                    NFC-e Não emitida
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(venda.dataHora)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-primary)] dark:hover:bg-[var(--color-neutral-800)]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo com rolagem */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Card do Cliente */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Dados do Cliente
            </h3>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{venda.clienteNome}</p>
                {venda.clienteCpf && (
                  <p className="text-xs text-[var(--color-text-secondary)]">CPF: {venda.clienteCpf}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {venda.clienteWhatsapp && (
                  <a
                    href={`https://wa.me/55${venda.clienteWhatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 text-xs font-medium text-[var(--color-success-dark)] transition-colors hover:bg-[var(--color-success-light)]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                {venda.clienteTelefone && (
                  <a
                    href={`tel:${venda.clienteTelefone.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-100)] dark:hover:bg-[var(--color-neutral-800)]"
                  >
                    <Phone className="h-3.5 w-3.5" /> Ligar
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Itens da Venda */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Itens do Pedido ({venda.itens.length})
            </h3>
            <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-page)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Item / Descrição</th>
                    <th className="px-3 py-2.5 text-center font-medium">Qtd</th>
                    <th className="px-3 py-2.5 text-right font-medium">Preço Un.</th>
                    <th className="px-4 py-2.5 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {venda.itens.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-[var(--color-text-muted)]">
                        Nenhum item discriminado na OS.
                      </td>
                    </tr>
                  ) : (
                    venda.itens.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[var(--color-neutral-50)] dark:hover:bg-[var(--color-neutral-900)]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[var(--color-text-primary)]">{it.nome}</p>
                          {it.sku && <p className="text-[11px] text-[var(--color-text-muted)]">SKU: {it.sku}</p>}
                        </td>
                        <td className="px-3 py-3 text-center text-[var(--color-text-secondary)]">{it.quantidade}</td>
                        <td className="px-3 py-3 text-right text-[var(--color-text-secondary)]">
                          {currency(it.precoUnitario)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)]">
                          {currency(it.subtotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagamentos e Totais */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Formas de Pagamento */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                <Wallet className="h-3.5 w-3.5" /> Formas de Pagamento
              </div>
              <div className="space-y-2">
                {venda.pagamentos.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Forma registrada: <span className="font-semibold text-[var(--color-text-primary)]">{venda.formaPagamento}</span>
                  </p>
                ) : (
                  venda.pagamentos.map((pg, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-[var(--color-text-secondary)]">
                        {pg.formaPagamentoNome || 'Pagamento'}
                      </span>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {currency(pg.valor)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Resumo Financeiro
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[var(--color-text-secondary)]">
                  <span>Subtotal</span>
                  <span>{currency(venda.subtotal)}</span>
                </div>
                {venda.desconto > 0 && (
                  <div className="flex justify-between text-[var(--color-danger-dark)]">
                    <span>Desconto</span>
                    <span>-{currency(venda.desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--color-border)] pt-2 text-sm font-bold text-[var(--color-text-primary)]">
                  <span>Valor Total</span>
                  <span className="text-[var(--color-brand)]">{currency(venda.valorTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dados Fiscais */}
          {venda.statusFiscal !== 'NAO_EMITIDO' && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Documento Fiscal ({venda.modeloFiscal || 'NFC-e Mod. 65'})
              </h3>
              <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
                <div>
                  <span className="text-[var(--color-text-muted)]">Status SEFAZ:</span>
                  <p className="font-semibold text-[var(--color-text-primary)]">{venda.statusFiscal}</p>
                </div>
                {venda.protocoloFiscal && (
                  <div>
                    <span className="text-[var(--color-text-muted)]">Protocolo de Autorização:</span>
                    <p className="font-mono font-semibold text-[var(--color-text-primary)]">{venda.protocoloFiscal}</p>
                  </div>
                )}
                {venda.numeroFiscal != null && (
                  <div>
                    <span className="text-[var(--color-text-muted)]">Número / Série:</span>
                    <p className="text-[var(--color-text-primary)]">
                      Nº {venda.numeroFiscal} • Série {venda.serieFiscal || '1'}
                    </p>
                  </div>
                )}
                {venda.dataAutorizacaoFiscal && (
                  <div>
                    <span className="text-[var(--color-text-muted)]">Data/Hora Autorização:</span>
                    <p className="text-[var(--color-text-primary)]">{formatDate(venda.dataAutorizacaoFiscal)}</p>
                  </div>
                )}
              </div>

              {venda.chaveAcesso && (
                <div className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-page)] p-2">
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                    <span>Chave de Acesso (44 dígitos):</span>
                    <button
                      type="button"
                      onClick={handleCopiarChave}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] hover:underline"
                    >
                      {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedKey ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="break-all font-mono text-xs font-medium text-[var(--color-text-primary)]">
                    {venda.chaveAcesso}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observação */}
          {venda.observacao && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-xs">
              <span className="font-bold text-[var(--color-text-muted)]">Observações: </span>
              <span className="text-[var(--color-text-secondary)]">{venda.observacao}</span>
            </div>
          )}
        </div>

        {/* Rodapé com Ações Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-4">
          <div>
            {!isCancelada && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onCancelarVenda(venda)}
                className="gap-1.5"
              >
                <Ban className="h-4 w-4" /> Cancelar Venda
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleImprimirRecibo} className="gap-1.5">
              <Printer className="h-4 w-4" /> Recibo 80mm
            </Button>
            {venda.statusFiscal === 'AUTORIZADO' && (
              <Button variant="outline" size="sm" onClick={handleImprimirNfce} className="gap-1.5">
                <FileText className="h-4 w-4" /> Cupom NFC-e
              </Button>
            )}
            {venda.qrCodeUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-1.5"
              >
                <a href={venda.qrCodeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Consultar SEFAZ
                </a>
              </Button>
            )}
            <Button variant="default" size="sm" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
