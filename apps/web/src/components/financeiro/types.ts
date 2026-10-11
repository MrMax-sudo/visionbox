import { ApiError } from '@/lib/apiClient';

/* -------------------------------------------------------------------------
   Tipos e utilitários do módulo Financeiro (ONDA 2D)
   Contratos de API intocados — mesmos DTOs/ endpoints da tela legada:
     GET  /v1/financeiro/contas-receber | /contas-pagar  (Page, params page/size/status)
     GET  /v1/financeiro/dre/mes-atual                  (métricas do topo)
     GET  /v1/financeiro/dre?inicio&fim                  (DRE por período)
     POST /v1/financeiro/contas-{receber|pagar}/{id}/{baixar|cancelar}
   ------------------------------------------------------------------------- */

export type ContaReceberDTO = {
  id: string;
  descricao?: string;
  numeroDocumento?: string;
  valor?: number;
  valorPago?: number;
  saldo?: number;
  vencimento?: string;
  status?: string;
  vencida?: boolean;
  parcela?: number;
  totalParcelas?: number;
};

export type ContaPagarDTO = ContaReceberDTO & {
  fornecedor?: string;
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

export type AbaFinanceiro = 'receber' | 'pagar' | 'crediario' | 'dre';
export type TipoConta = 'receber' | 'pagar';
export type AcaoConta = 'baixar' | 'cancelar';

/** Valores do enum StatusConta/StatusContaPagar do backend. */
export const STATUS_CONTAS = ['PENDENTE', 'PAGO', 'VENCIDO', 'PARCIAL', 'CANCELADO'] as const;
export type StatusConta = (typeof STATUS_CONTAS)[number];

export const rotuloStatus: Record<string, string> = {
  PENDENTE: 'Pendente',
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

/** Saldo em aberto (cauda: saldo → valor → 0). */
export function saldoDe(conta: ContaReceberDTO): number {
  return conta.saldo ?? conta.valor ?? 0;
}

export function somarSaldo(contas: ContaReceberDTO[]): number {
  return contas.reduce((sum, c) => sum + saldoDe(c), 0);
}

/** Vencida = flag do backend ou status VENCIDO/VENCIDA. */
export function isVencida(conta: ContaReceberDTO): boolean {
  return Boolean(conta.vencida) || conta.status === 'VENCIDA' || conta.status === 'VENCIDO';
}

export function statusLabel(conta: ContaReceberDTO): string {
  if (conta.status === 'VENCIDA') return 'Vencida';
  if (isVencida(conta) && conta.status !== 'PAGO' && conta.status !== 'CANCELADO') return 'Vencida';
  return rotuloStatus[conta.status ?? ''] ?? conta.status ?? 'ABERTO';
}

export function statusVariant(conta: ContaReceberDTO): 'danger' | 'warning' | 'success' | 'outline' {
  if (conta.status === 'PAGO') return 'success';
  if (conta.status === 'CANCELADO') return 'outline';
  if (conta.status === 'PARCIAL') return 'warning';
  if (conta.status === 'VENCIDA' || isVencida(conta)) return 'danger';
  return 'outline';
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
