export interface VendaItemView {
  produtoId?: string;
  sku?: string;
  nome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  desconto?: number;
  tipoProduto?: string;
}

export interface VendaPagamentoView {
  id?: string;
  formaPagamentoId?: string;
  formaPagamentoNome?: string;
  valor: number;
  /**
   * MDR (§3.5) — só preenchidos quando o backend enriquecer o DTO.
   * Ausentes → PagamentosTable degrada para Forma + Valor (nenhum campo inventado).
   */
  taxaValor?: number | string | null;
  valorLiquido?: number | string | null;
  maquininhaId?: string | null;
  parcelas?: number | null;
}

export interface VendaView {
  id: string;
  numero: string;
  dataHora: string;
  clienteId?: string;
  clienteNome: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  clienteWhatsapp?: string;

  // Status e Valores
  status: string;
  statusDescricao: string;
  subtotal: number;
  desconto: number;
  valorTotal: number;
  formaPagamento: string;

  // Fiscal
  statusFiscal: 'NAO_EMITIDO' | 'AUTORIZADO' | 'REJEITADO' | 'CONTINGENCIA' | 'CANCELADO' | 'PENDENTE';
  modeloFiscal?: string;
  serieFiscal?: string;
  numeroFiscal?: number;
  chaveAcesso?: string;
  protocoloFiscal?: string;
  dataAutorizacaoFiscal?: string;
  qrCodeUrl?: string;
  motivoFiscal?: string;

  // Itens e Pagamentos
  itens: VendaItemView[];
  pagamentos: VendaPagamentoView[];
  observacao?: string;
}

export interface VendaKpis {
  totalVendas: number;
  faturamentoTotal: number;
  ticketMedio: number;
  cuponsEmitidos: number;
  cuponsNaoEmitidos: number;
  totalCanceladas: number;
}

export interface VendaFiltros {
  search?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  statusFiscal?: string;
  page: number;
  size: number;
}
