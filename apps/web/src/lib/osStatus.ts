export type StatusOS =
  | 'ORCAMENTO'
  | 'PEDIDO_CONFIRMADO'
  | 'ENVIADO_LABORATORIO'
  | 'EM_PRODUCAO'
  | 'LENTE_PRONTA'
  | 'MONTAGEM'
  | 'CONTROLE_QUALIDADE'
  | 'PRONTO_PARA_RETIRADA'
  | 'ENTREGUE'
  | 'CANCELADO';

export const statusLabel: Record<StatusOS, string> = {
  ORCAMENTO: 'Orçamento',
  PEDIDO_CONFIRMADO: 'Pedido Confirmado',
  ENVIADO_LABORATORIO: 'Enviado Lab',
  EM_PRODUCAO: 'Em Produção',
  LENTE_PRONTA: 'Lente Pronta',
  MONTAGEM: 'Montagem',
  CONTROLE_QUALIDADE: 'Controle Qualidade',
  PRONTO_PARA_RETIRADA: 'Pronto Retirada',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

export const statusClass: Record<StatusOS, string> = {
  ORCAMENTO: 'status-orcamento',
  PEDIDO_CONFIRMADO: 'status-pedido-confirmado',
  ENVIADO_LABORATORIO: 'status-enviado-laboratorio',
  EM_PRODUCAO: 'status-em-producao',
  LENTE_PRONTA: 'status-lente-pronta',
  MONTAGEM: 'status-montagem',
  CONTROLE_QUALIDADE: 'status-controle-qualidade',
  PRONTO_PARA_RETIRADA: 'status-pronto-para-retirada',
  ENTREGUE: 'status-entregue',
  CANCELADO: 'status-cancelado',
};
