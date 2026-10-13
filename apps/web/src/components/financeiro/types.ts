import { ApiError } from '@/lib/apiClient';

/* -------------------------------------------------------------------------
   Tipos e utilitários do módulo Financeiro (Fase 3 Robustez §3.3)
   Contratos de API:
     GET  /v1/financeiro/contas-receber | /contas-pagar  (Page, params page/size/status)
     GET  /v1/financeiro/dre/mes-atual                  (métricas do topo)
     GET  /v1/financeiro/dre?inicio&fim                  (DRE por período)
      GET  /v1/financeiro/totais?dataInicio&dataFim       (V41 — métricas SUM no banco)
     POST /v1/financeiro/contas-receber/{id}/baixar      (parcial: valorPago/desconto/juros — R4/D-021)
     GET  /v1/financeiro/contas-receber/{id}/pagamentos  (histórico de baixas)
     POST /v1/financeiro/contas-receber/{id}/pagamentos/{pagamentoId}/estornar
                                                          (reabre título; ADMIN/GERENTE/FINANCEIRO)
     POST /v1/financeiro/contas-pagar                    (fornecedorId/competência/comprovante)
     GET|POST /v1/financeiro/fornecedores · GET|PUT|DELETE /{id} (CNPJ mascarado no GET)
      POST /v1/financeiro/fornecedores/{id}/reativar      (V41 — reversal do soft-delete)
     GET  /v1/financeiro/formas-pagamento                (ativas)
   Status backend: PENDENTE(=ABERTO), PARCIAL, PAGO, VENCIDO, CANCELADO.
   ------------------------------------------------------------------------- */

export type ContaReceberDTO = {
  id: string;
  descricao?: string;
  numeroDocumento?: string;
  valor?: number;
  valorPago?: number;
  /** V34 — valor em aberto derivado (valor - valorPago). */
  valorAberto?: number;
  saldo?: number;
  vencimento?: string;
  status?: string;
  vencida?: boolean;
  parcela?: number;
  totalParcelas?: number;
  criadoEm?: string;
};

export type ContaPagarDTO = ContaReceberDTO & {
  fornecedor?: string;
  /** V34 — vínculo com cadastro de fornecedor, competência e comprovante. */
  fornecedorId?: string;
  dataCompetencia?: string;
  comprovanteUrl?: string;
  ordemServicoId?: string;
};

/** FornecedorResponse — CNPJ sempre mascarado no GET (LGPD/ADR-002). */
export type FornecedorDTO = {
  id: string;
  lojaId?: string;
  nome: string;
  cnpjMasked?: string | null;
  contato?: string | null;
  telefone?: string | null;
  email?: string | null;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
};

/** FornecedorRequest — CNPJ em plain (com ou sem máscara) só no POST/PUT. */
export type FornecedorPayload = {
  nome: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  email?: string;
};

export type FormaPagamentoDTO = {
  id: string;
  nome: string;
  tipo?: string;
  ativo?: boolean;
  padrao?: boolean;
  taxaPercentual?: number;
  prazoDias?: number;
  permiteParcelar?: boolean;
  maxParcelas?: number;
  tPagNfce?: string;
};

/** ContaReceberPagamentoResponse — linha do histórico de baixas (§3.3). */
export type PagamentoDTO = {
  id: string;
  contaReceberId: string;
  caixaId?: string | null;
  usuarioId?: string | null;
  formaPagamentoId?: string | null;
  valorPago: number;
  /** V41/D-021 — desconto da baixa: abateu o título junto com valorPago (sem dinheiro entrar). */
  valorDesconto?: number;
  /** V41/D-021 — juros da baixa: receita extra, não abateu o título (entrou no caixa). */
  valorJuros?: number;
  dataPagamento?: string;
  observacao?: string | null;
  criadoEm?: string;
};

/** ContaPagarRequest — criação de conta a pagar (V34). */
export type ContaPagarPayload = {
  fornecedor?: string;
  fornecedorId?: string;
  descricao?: string;
  numeroDocumento?: string;
  valor: number;
  vencimento: string;
  dataCompetencia?: string;
  comprovanteUrl?: string;
  parcela?: number;
  totalParcelas?: number;
};

export type DreDTO = {
  receita?: number;
  custo?: number;
  comissao?: number;
  dre?: number;
  margemPercentual?: number;
  totalContasReceber?: number;
  totalContasPagar?: number;
  inicio?: string;
  fim?: string;
  observacao?: string;
};

/**
 * FinanceiroTotaisResponse (V41) — GET /v1/financeiro/totais?dataInicio&dataFim.
 * Somas SUM no banco (fim do cálculo client-side sobre 1 página size=100).
 * totalAReceberPeriodo/totalAPagarPeriodo: valor EM ABERTO dos títulos com
 * vencimento no período (exclui CANCELADO; parcialmente pago soma só o saldo).
 * titulosVencidosAteHoje: aberto a receber + a pagar vencidos antes de hoje
 * (fixo, independe do período). saldoProjetado = aReceber − aPagar.
 * totalRecebidoPeriodo: soma das linhas ativas de conta_receber_pagamento no período.
 */
export type FinanceiroTotaisDTO = {
  totalAReceberPeriodo?: number;
  totalAPagarPeriodo?: number;
  titulosVencidosAteHoje?: number;
  saldoProjetado?: number;
  totalRecebidoPeriodo?: number;
};

export type AbaFinanceiro = 'receber' | 'pagar' | 'crediario' | 'fornecedores' | 'dre';
export type TipoConta = 'receber' | 'pagar';
export type AcaoConta = 'baixar' | 'cancelar';

/** Valores do enum StatusConta/StatusContaPagar do backend. */
export const STATUS_CONTAS = ['PENDENTE', 'PAGO', 'VENCIDO', 'PARCIAL', 'CANCELADO'] as const;
export type StatusConta = (typeof STATUS_CONTAS)[number];

/** PENDENTE (backend) = ABERTO (§3.3) — mesmo estado, rótulo unificado. */
export const rotuloStatus: Record<string, string> = {
  ABERTO: 'Aberto',
  PENDENTE: 'Aberto',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  PARCIAL: 'Parcial',
  CANCELADO: 'Cancelado',
};

/** Formata valor em BRL (ausente = R$ 0,00, igual ao comportamento legado). */
export function money(value?: number): string {
  return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** 'YYYY-MM-DD' ou ISO com hora → data PT-BR; vazio → '—'. */
export function dataBR(iso?: string): string {
  if (!iso) return '—';
  const dia = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return iso;
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

/** ISO com hora → 'dd/MM/aaaa HH:mm'; vazio → '—'. */
export function dataHoraBR(iso?: string): string {
  if (!iso) return '—';
  const base = dataBR(iso);
  if (base === '—') return base;
  const hora = iso.slice(11, 16);
  return hora ? `${base} ${hora}` : base;
}

/** Saldo em aberto (cauda V34: valorAberto → saldo → valor - valorPago → valor). */
export function saldoDe(conta: ContaReceberDTO): number {
  if (typeof conta.valorAberto === 'number') return conta.valorAberto;
  if (typeof conta.saldo === 'number') return conta.saldo;
  const valor = conta.valor ?? 0;
  const pago = conta.valorPago ?? 0;
  return Math.max(valor - pago, 0);
}

export function somarSaldo(contas: ContaReceberDTO[]): number {
  return contas.reduce((sum, c) => sum + saldoDe(c), 0);
}

/** Vencida = flag do backend ou status VENCIDO/VENCIDA. */
export function isVencida(conta: ContaReceberDTO): boolean {
  return Boolean(conta.vencida) || conta.status === 'VENCIDA' || conta.status === 'VENCIDO';
}

/** Título ainda com saldo a quitar (ABERTO/PENDENTE/PARCIAL/VENCIDO). */
export function emAberto(conta: ContaReceberDTO): boolean {
  const st = conta.status ?? '';
  return st !== 'PAGO' && st !== 'CANCELADO';
}

/** Pode receber nova baixa: em aberto e com saldo > 0. */
export function baixavel(conta: ContaReceberDTO): boolean {
  return emAberto(conta) && saldoDe(conta) > 0.004;
}

/** Pode ser cancelado: não pago e não cancelado. */
export function cancelavel(conta: ContaReceberDTO): boolean {
  const st = conta.status ?? '';
  return st !== 'PAGO' && st !== 'CANCELADO';
}

export function statusLabel(conta: ContaReceberDTO): string {
  if (conta.status === 'PARCIAL') return 'Parcial';
  if (conta.status === 'VENCIDA') return 'Vencida';
  if (isVencida(conta) && emAberto(conta) && conta.status !== 'PARCIAL') return 'Vencida';
  return rotuloStatus[conta.status ?? ''] ?? conta.status ?? 'Aberto';
}

export function statusVariant(conta: ContaReceberDTO): 'danger' | 'warning' | 'success' | 'outline' {
  if (conta.status === 'PAGO') return 'success';
  if (conta.status === 'CANCELADO') return 'outline';
  if (conta.status === 'PARCIAL') return isVencida(conta) ? 'danger' : 'warning';
  if (conta.status === 'VENCIDA' || isVencida(conta)) return 'danger';
  return 'outline';
}

/** 00.000.000/0000-00 — aceita parcial durante digitação. */
export function maskCNPJ(value: string | null | undefined): string {
  const d = (value ?? '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** CNPJ tem 14 dígitos (client-side; backend revalida com CnpjValidator). */
export function isCNPJCompleto(value: string | null | undefined): boolean {
  return (value ?? '').replace(/\D/g, '').length === 14;
}

/** Range do mês corrente em 'YYYY-MM-DD' (de/ate) — base das métricas do §3.3. */
export function mesAtualRange(): { de: string; ate: string } {
  const agora = new Date();
  const de = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const ate = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { de: iso(de), ate: iso(ate) };
}

/**
 * Filtro de período (cliente) sobre o vencimento.
 * Sem datas informadas → não filtra (comportamento da tela original).
 */
export function noPeriodo(vencimento: string | undefined, de: string, ate: string): boolean {
  if (!de && !ate) return true;
  if (!vencimento) return false;
  const dia = vencimento.slice(0, 10);
  if (de && dia < de) return false;
  if (ate && dia > ate) return false;
  return true;
}

/** Mensagem da falha de baixar/cancelar — prioriza problem.detail (RFC 7807). */
export function actionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const p = err.problem;
    const fieldErrors =
      p?.errors && p.errors.length > 0
        ? p.errors.map((fe) => `${fe.field}: ${fe.message}`).join(' • ')
        : '';
    return p?.detail || p?.message || fieldErrors || err.message || 'Falha na operação financeira.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Falha na operação financeira.';
}
