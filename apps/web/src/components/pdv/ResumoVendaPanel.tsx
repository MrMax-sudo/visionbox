import * as React from 'react';
import {
  Banknote,
  CreditCard,
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Printer,
  ReceiptText,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { currency, type DescontoTipo } from '@/components/pdv/pdvHelpers';

function PixIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M112.57 391.19c20.35 0 39.48-7.93 53.88-22.32l84.58-84.6 84.45 84.46c14.4 14.4 33.53 22.33 53.87 22.33 13.88 0 27.27-3.78 39.02-10.99l-61.9-61.9 6.27-6.28 77.29-77.29c15.11-15.11 15.11-39.7 0-54.81l-77.29-77.28-7.14-7.15 62.77-62.77c-11.75-7.21-25.14-10.99-39.02-10.99-20.35 0-39.48 7.93-53.88 22.33l-84.45 84.46-84.58-84.6c-14.4-14.4-33.53-22.33-53.88-22.33-13.88 0-27.27 3.78-39.02 10.99l62.77 62.77-7.14 7.15-77.29 77.28c-15.11 15.11-15.11 39.7 0 54.81l77.29 77.29 6.27 6.28-61.9 61.9c11.75 7.21 25.14 10.99 39.02 10.99zm-43.91-158.41l73.49-73.49 73.62 73.62-73.62 73.62-73.49-73.75zm223.75 73.75l-73.62-73.62 73.62-73.62 73.49 73.49-73.49 73.75z" />
    </svg>
  );
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface FormaPagamentoDTO {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  padrao: boolean;
}

function getIconForForma(tipo: string): React.ElementType {
  const t = (tipo || '').toUpperCase();
  if (t === 'PIX') return PixIcon;
  if (t === 'DINHEIRO') return Banknote;
  if (t === 'DEBITO' || t === 'CREDITO') return CreditCard;
  if (t === 'CREDIARIO') return ReceiptText;
  return CreditCard;
}

type ResumoVendaPanelProps = {
  subtotal: number;
  desconto: number;
  descontoTipo: DescontoTipo;
  onDescontoTipo: (tipo: DescontoTipo) => void;
  onDesconto: (valor: number) => void;
  total: number;
  troco: number;
  valorRecebido: number;
  onValorRecebido: (valor: number) => void;
  formaPagamento: string;
  onFormaPagamento: (forma: string) => void;
  onFinalizar: () => void;
  finalizando: boolean;
  temItens: boolean;
  tipoCupom: import('@/components/pdv/pdvHelpers').TipoCupom;
  onTipoCupomChange: (tipo: import('@/components/pdv/pdvHelpers').TipoCupom) => void;
  onVisualizarCupom: () => void;
  onAbrirCaixa: () => void;
  onOrcamento: () => void;
  onMaisAcoes: () => void;
  isCaixaAberto?: boolean;
  caixaOperador?: string;
  className?: string;
};

/**
 * Coluna 3 — resumo, desconto, forma de pagamento e o botão Finalizar (F8).
 * Offline-first: o Finalizar só desabilita com carrinho vazio ou envio em curso;
 * NUNCA por falta de rede (a venda cai no outbox local).
 */
export function ResumoVendaPanel({
  subtotal,
  desconto,
  descontoTipo,
  onDescontoTipo,
  onDesconto,
  total,
  troco,
  valorRecebido,
  onValorRecebido,
  formaPagamento,
  onFormaPagamento,
  onFinalizar,
  finalizando,
  temItens,
  tipoCupom,
  onTipoCupomChange,
  onVisualizarCupom,
  onAbrirCaixa,
  onOrcamento,
  onMaisAcoes,
  isCaixaAberto = true,
  caixaOperador,
  className,
}: ResumoVendaPanelProps) {
  const formasQuery = useQuery({
    queryKey: ['formas-pagamento-pdv'],
    queryFn: async () => {
      const res = await apiClient.get<FormaPagamentoDTO[]>('/v1/financeiro/formas-pagamento');
      return (res.data ?? []).filter((f) => f.ativo);
    },
    staleTime: 30_000,
  });

  const formas = formasQuery.data ?? [];

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col overflow-y-auto rounded-card border border-[var(--color-pdv-border)] bg-card-soft p-4 shadow-soft',
        className,
      )}
      aria-label="Resumo da venda"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-pdv-text)]">
          <ReceiptText className="h-[18px] w-[18px] text-brand" strokeWidth={1.8} aria-hidden />
          Resumo da venda
        </h2>
      </header>

      {/* Totais */}
      <div className="grid gap-2.5">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <span className="text-sm text-[var(--color-pdv-text)]">Subtotal</span>
          <strong className="text-sm font-semibold text-[var(--color-pdv-text)]">{currency(subtotal)}</strong>
        </div>

        <div className="grid grid-cols-[1fr_auto_84px_auto_1fr] items-center gap-2">
          <span className="text-sm text-[var(--color-pdv-text)]">Desconto</span>
          <button
            type="button"
            aria-pressed={descontoTipo === 'percentual'}
            onClick={() => onDescontoTipo('percentual')}
            className={cn(
              'h-8 rounded-md border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              descontoTipo === 'percentual'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] text-[var(--color-pdv-text)]',
            )}
            title="Desconto em percentual"
          >
            %
          </button>
          <Input
            type="number"
            min={0}
            value={desconto}
            onChange={(e) => onDesconto(Number(e.target.value) || 0)}
            aria-label={descontoTipo === 'percentual' ? 'Desconto em percentual' : 'Desconto em reais'}
            className="h-9 text-right text-sm"
          />
          <button
            type="button"
            aria-pressed={descontoTipo === 'valor'}
            onClick={() => onDescontoTipo('valor')}
            className={cn(
              'h-8 rounded-md border px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              descontoTipo === 'valor'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] text-[var(--color-pdv-text)]',
            )}
            title="Desconto em reais"
          >
            R$
          </button>
          <span aria-hidden />
        </div>

        <div className="mt-1 grid grid-cols-[1fr_auto] items-center gap-3 border-t border-[var(--color-pdv-border-soft)] pt-3">
          <span className="text-lg font-bold text-[var(--color-pdv-text)]">Total</span>
          <strong className="text-2xl font-bold text-[var(--color-pdv-text)]">{currency(total)}</strong>
        </div>
      </div>

      {/* Pagamento */}
      <section className="mt-4 border-t border-[var(--color-pdv-border-soft)] pt-3.5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[var(--color-pdv-text)]">
            <Wallet className="h-4 w-4 text-brand" strokeWidth={1.8} aria-hidden />
            Pagamento
          </h3>
          <span className="text-[10px] text-muted">
            {formas.length > 0 ? `${formas.length} ativos` : 'Sem métodos'}
          </span>
        </div>

        {formas.length === 0 ? (
          <p className="mt-2.5 rounded-card border border-dashed border-border px-2 py-3 text-center text-xs text-muted">
            Nenhuma forma de pagamento ativa.
          </p>
        ) : (
          <div
            className={cn(
              'mt-2.5 grid gap-1.5',
              formas.length === 1 && 'grid-cols-1',
              formas.length === 2 && 'grid-cols-2',
              formas.length === 3 && 'grid-cols-3',
              formas.length >= 4 && 'grid-cols-4',
            )}
            role="group"
            aria-label="Forma de pagamento"
          >
            {formas.map((f) => {
              const ativa =
                formaPagamento.toLowerCase() === f.nome.toLowerCase() ||
                formaPagamento.toLowerCase() === f.tipo.toLowerCase();
              const Icon = getIconForForma(f.tipo);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => onFormaPagamento(f.nome)}
                  className={cn(
                    'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[9px] border px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    ativa
                      ? 'border-transparent bg-[var(--color-login-button)] text-[var(--color-text-on-action)] font-bold shadow-sm'
                      : 'border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] text-[var(--color-pdv-text)] hover:border-primary',
                  )}
                  title={f.nome}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  <span className="text-[11px] font-semibold leading-tight truncate max-w-full px-0.5">
                    {f.nome}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <label htmlFor="pdv-valor-recebido" className="text-sm text-[var(--color-pdv-text)]">
            Valor recebido
          </label>
          <Input
            id="pdv-valor-recebido"
            type="number"
            min={0}
            value={valorRecebido}
            onChange={(e) => onValorRecebido(Number(e.target.value) || 0)}
            aria-label="Valor recebido"
            className="h-9 w-[140px] text-right text-sm"
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-pdv-text)]">Troco</span>
          <strong className="text-xl font-bold text-[var(--color-pdv-success)]">{currency(troco)}</strong>
        </div>
      </section>

      {/* Tipo de Documento / Emissão */}
      <section className="mt-3.5 border-t border-[var(--color-pdv-border-soft)] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[var(--color-pdv-text)] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-brand" /> Documento / Emissão
          </span>
          <span className="text-[10px] text-muted font-medium">
            {tipoCupom === 'CUPOM' ? 'Sem envio SEFAZ' : tipoCupom === 'NFCE' ? 'SEFAZ Mod. 65' : 'SEFAZ Mod. 55'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Tipo de documento">
          <button
            type="button"
            aria-pressed={tipoCupom === 'CUPOM'}
            onClick={() => onTipoCupomChange('CUPOM')}
            className={cn(
              'flex flex-col items-center justify-center py-1.5 px-1 rounded-md border text-center transition-colors',
              tipoCupom === 'CUPOM'
                ? 'border-primary bg-primary text-primary-foreground font-bold shadow-sm'
                : 'border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] text-[var(--color-pdv-text)] hover:border-primary',
            )}
            title="Cupom Não-Fiscal / Recibo de Venda"
          >
            <span className="text-xs font-bold leading-tight">Cupom</span>
            <span className="text-[9px] opacity-80">Não-fiscal</span>
          </button>

          <button
            type="button"
            aria-pressed={tipoCupom === 'NFCE'}
            onClick={() => onTipoCupomChange('NFCE')}
            className={cn(
              'flex flex-col items-center justify-center py-1.5 px-1 rounded-md border text-center transition-colors',
              tipoCupom === 'NFCE'
                ? 'border-primary bg-primary text-primary-foreground font-bold shadow-sm'
                : 'border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] text-[var(--color-pdv-text)] hover:border-primary',
            )}
            title="NFC-e Modelo 65 (Cupom Fiscal do Consumidor)"
          >
            <span className="text-xs font-bold leading-tight">NFC-e</span>
            <span className="text-[9px] opacity-80">Mod. 65</span>
          </button>

          <button
            type="button"
            aria-pressed={tipoCupom === 'DANFE'}
            onClick={() => onTipoCupomChange('DANFE')}
            className={cn(
              'flex flex-col items-center justify-center py-1.5 px-1 rounded-md border text-center transition-colors',
              tipoCupom === 'DANFE'
                ? 'border-primary bg-primary text-primary-foreground font-bold shadow-sm'
                : 'border-[var(--color-pdv-border-soft)] bg-[var(--color-pdv-soft)] text-[var(--color-pdv-text)] hover:border-primary',
            )}
            title="DANFE NF-e Modelo 55 (Nota Fiscal Eletrônica)"
          >
            <span className="text-xs font-bold leading-tight">DANFE</span>
            <span className="text-[9px] opacity-80">Mod. 55</span>
          </button>
        </div>
      </section>

      {/* Finalizar */}
      <Button
        id="pdv-finalizar"
        onClick={onFinalizar}
        disabled={!temItens || finalizando}
        aria-busy={finalizando}
        className={cn(
          'mt-4 h-12 w-full gap-2 rounded-[9px] text-base',
          'bg-[var(--color-login-button)] text-[var(--color-text-on-action)] hover:bg-primary hover:text-primary-foreground',
          'disabled:opacity-100',
        )}
      >
        <LockKeyhole className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        {finalizando ? 'Enviando...' : 'Finalizar'}
      </Button>
      <p className="mt-1.5 text-center text-[11px] text-muted">
        Atalho F8 — funciona offline (venda entra na fila).
      </p>

      <div className="mt-auto grid grid-cols-[1fr_1fr_44px] gap-2 pt-3">
        <Button variant="outline" className="gap-1.5 text-xs" onClick={onOrcamento}>
          <FileText className="h-4 w-4" /> Orçamento
        </Button>
        <Button variant="outline" className="gap-1.5 text-xs" onClick={onVisualizarCupom}>
          <Printer className="h-4 w-4" /> Ver Cupom
        </Button>
        <Button variant="outline" size="icon" aria-label="Mais ações" onClick={onMaisAcoes}>
          <MoreHorizontal />
        </Button>
      </div>
    </aside>
  );
}
