import type { OrdemServicoDTO, ReceitaDTO } from '@/lib/types';
import { statusLabel, type StatusOS } from '@/lib/osStatus';

/**
 * osDomain — helpers puros do domínio OS usados por DashboardKanban e OSDetail.
 *
 * Regras preservadas 1:1 da Onda 0/1 (nenhuma regra de negócio nova):
 *  • mapa de transições (`nextStatusByCurrent`) — idêntico ao de OSDetail;
 *  • `ehAtrasada` — SLA explícito da API OU previsao vencida em OS não-terminal;
 *  • KPIs calculados no client a partir da fila carregada (não existe endpoint de métricas).
 * Labels/canônicos vêm de `@/lib/osStatus` (fonte das 12 cores/labels da máquina).
 */

/* ------------------------------------------------------------------ */
/* Fila / kanban                                                       */
/* ------------------------------------------------------------------ */

export type KanbanColumn = { id: string; title: string; statuses: StatusOS[] };

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'orcamento', title: 'Orçamento', statuses: ['ORCAMENTO', 'PEDIDO_CONFIRMADO'] },
  { id: 'producao', title: 'Em Produção', statuses: ['ENVIADO_LABORATORIO', 'EM_PRODUCAO'] },
  { id: 'montagem', title: 'Montagem', statuses: ['LENTE_PRONTA', 'MONTAGEM'] },
  { id: 'qualidade', title: 'Controle Qualidade', statuses: ['CONTROLE_QUALIDADE'] },
  { id: 'pronto', title: 'Pronto p/ Retirada', statuses: ['PRONTO_PARA_RETIRADA'] },
];

export const STATUS_TERMINAL = new Set<string>(['ENTREGUE', 'CANCELADO', 'DEVOLVIDO_GARANTIA']);

/** Os 12 status da máquina (osStatus.ts cobre 10; estes dois são do backend). */
export const TODOS_STATUS: string[] = [
  'ORCAMENTO',
  'PEDIDO_CONFIRMADO',
  'ENVIADO_LABORATORIO',
  'EM_PRODUCAO',
  'LENTE_PRONTA',
  'MONTAGEM',
  'CONTROLE_QUALIDADE',
  'PRONTO_PARA_RETIRADA',
  'ENTREGUE',
  'CANCELADO',
  'RETRABALHO',
  'DEVOLVIDO_GARANTIA',
];

/* ------------------------------------------------------------------ */
/* Transições de status (espelha o mapa usado em OSDetail — 1:1)       */
/* ------------------------------------------------------------------ */

export const nextStatusByCurrent: Record<string, string[]> = {
  ORCAMENTO: ['PEDIDO_CONFIRMADO', 'CANCELADO'],
  PEDIDO_CONFIRMADO: ['ENVIADO_LABORATORIO', 'CANCELADO'],
  ENVIADO_LABORATORIO: ['EM_PRODUCAO'],
  EM_PRODUCAO: ['LENTE_PRONTA'],
  LENTE_PRONTA: ['MONTAGEM'],
  MONTAGEM: ['CONTROLE_QUALIDADE'],
  CONTROLE_QUALIDADE: ['PRONTO_PARA_RETIRADA', 'RETRABALHO'],
  RETRABALHO: ['EM_PRODUCAO'],
  PRONTO_PARA_RETIRADA: ['ENTREGUE'],
};

export function proximosStatus(status?: string | null): string[] {
  if (!status) return [];
  return nextStatusByCurrent[status] ?? [];
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

/** Fora dos 10 status do `osStatus.ts` (máquina tem 12). */
const STATUS_EXTRA_LABEL: Record<string, string> = {
  RETRABALHO: 'Retrabalho',
  DEVOLVIDO_GARANTIA: 'Devolvido p/ Garantia',
};

export function statusText(status?: string | null): string {
  if (!status) return '-';
  const canonico = statusLabel[status as StatusOS];
  return canonico ?? STATUS_EXTRA_LABEL[status] ?? status.replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ */
/* SLA (semáforo)                                                      */
/* ------------------------------------------------------------------ */

export type SlaTone = 'ok' | 'atencao' | 'atrasado';

export function slaExplicito(o: OrdemServicoDTO): string {
  return (o.sla ?? o.slaStatus ?? '').toString().toLowerCase();
}

export function previsaoDe(o: OrdemServicoDTO): string | undefined {
  return o.previsao ?? o.previsaoEntrega ?? undefined;
}

/** Idêntico ao cálculo original do dashboard. */
export function ehAtrasada(o: OrdemServicoDTO): boolean {
  if (slaExplicito(o).includes('atrasado')) return true;
  const previsao = previsaoDe(o);
  return Boolean(
    previsao && !STATUS_TERMINAL.has(o.status) && new Date(previsao).getTime() < Date.now(),
  );
}

/** Semáforo SLA da OS: atraso real > atenção (vence em < 24h) > ok. */
export function resolveSla(o: OrdemServicoDTO): SlaTone {
  if (ehAtrasada(o)) return 'atrasado';
  const explicito = slaExplicito(o);
  if (explicito.includes('atencao') || explicito.includes('atenção')) return 'atencao';
  const previsao = previsaoDe(o);
  if (!previsao || STATUS_TERMINAL.has(o.status)) return 'ok';
  const resta = new Date(previsao).getTime() - Date.now();
  return resta > 0 && resta < 24 * 60 * 60 * 1000 ? 'atencao' : 'ok';
}

/** Evento já ocorreu depois da previsão prometida ao cliente? */
export function eventoAposPrevisao(dataHora: string | undefined, previsao?: string): boolean {
  if (!dataHora || !previsao) return false;
  const tEvento = new Date(dataHora).getTime();
  const tPrevisao = new Date(previsao).getTime();
  return Number.isFinite(tEvento) && Number.isFinite(tPrevisao) && tEvento > tPrevisao;
}

/* ------------------------------------------------------------------ */
/* Formatação                                                          */
/* ------------------------------------------------------------------ */

export function fmtDateTime(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

export function shortId(id?: string | null): string {
  if (!id) return '-';
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export function brl(value?: number | null): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}

export function clienteDe(os: OrdemServicoDTO): string {
  return (
    os.clienteNome ??
    os.cliente ??
    (os.clienteId ? `Cliente ${os.clienteId.slice(0, 8)}` : 'Cliente não identificado')
  );
}

export function produtoDe(os: OrdemServicoDTO, vazio = 'Itens da OS'): string {
  if (os.produto) return os.produto;
  return (
    [os.armacaoId ? 'Armação' : null, os.lenteId ? 'Lente' : null].filter(Boolean).join(' + ') ||
    vazio
  );
}

export function valorDe(os: OrdemServicoDTO): number {
  return os.valor ?? os.total ?? 0;
}

/* ------------------------------------------------------------------ */
/* Filtros + métricas do dashboard                                     */
/* ------------------------------------------------------------------ */

export type FiltroOS = {
  busca: string;
  somenteAtrasadas: boolean;
  status?: string; // '' | 'ALL' → sem filtro
};

export function filtrarOrdens(ordens: OrdemServicoDTO[], filtro: FiltroOS): OrdemServicoDTO[] {
  let base = filtro.somenteAtrasadas ? ordens.filter(ehAtrasada) : ordens;
  if (filtro.status && filtro.status !== 'ALL') {
    base = base.filter((o) => o.status === filtro.status);
  }
  const busca = filtro.busca.trim().toLowerCase();
  if (!busca) return base;
  return base.filter((o) => {
    const haystack = [o.id, o.numero, o.clienteNome, o.cliente, o.clienteId, o.produto, o.armacaoId, o.lenteId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(busca);
  });
}

export type DashboardStats = {
  atrasadas: number;
  producao: number;
  prontas: number;
  abertas: number;
  slaPct: number;
  total: number;
};

export function computeStats(ordens: OrdemServicoDTO[]): DashboardStats {
  const now = Date.now();
  const atrasadas = ordens.filter((o) => {
    if (slaExplicito(o).includes('atrasado')) return true;
    const previsao = previsaoDe(o);
    return Boolean(previsao && !STATUS_TERMINAL.has(o.status) && new Date(previsao).getTime() < now);
  }).length;
  const producao = ordens.filter((o) => ['EM_PRODUCAO', 'ENVIADO_LABORATORIO'].includes(o.status)).length;
  const prontas = ordens.filter((o) => o.status === 'PRONTO_PARA_RETIRADA').length;
  const abertas = ordens.filter((o) => !STATUS_TERMINAL.has(o.status)).length;
  const slaPct = abertas === 0 ? 0 : Math.round(((abertas - atrasadas) / abertas) * 100);
  return { atrasadas, producao, prontas, abertas, slaPct, total: ordens.length };
}

/* ------------------------------------------------------------------ */
/* Perfis (RBAC de exibição — o backend continua sendo a autoridade)   */
/* ------------------------------------------------------------------ */

/** `hasAnyRole` de `/api/v1/ordens-servico/**` (SecurityConfig). */
export const PERFIS_COM_ACESSO_OS = [
  'ADMIN',
  'GERENTE',
  'VENDEDOR',
  'OTICO',
  'TECNICO',
  'LABORATORIO',
] as const;

/** `hasAnyRole` de `/api/v1/receitas/**` (SecurityConfig). */
export const PERFIS_COM_ACESSO_RECEITA = ['ADMIN', 'GERENTE', 'VENDEDOR', 'OTICO'] as const;

/**
 * Quem vê grau em claro. R2/ADR-002: exibição de grau/CPF mascarada para VENDEDOR;
 * default seguro (LGPD minimização) = mascarar qualquer perfil fora da lista clínica/gerencial.
 */
export const PERFIS_QUE_VEEM_GRAU = [
  'ADMIN',
  'GERENTE',
  'OTICO',
  'TECNICO',
  'LABORATORIO',
  'DESENVOLVEDOR',
] as const;

export function podeMovimentarOS(perfil?: string | null): boolean {
  return !!perfil && (PERFIS_COM_ACESSO_OS as readonly string[]).includes(perfil);
}

export function podeLerReceita(perfil?: string | null): boolean {
  return !!perfil && (PERFIS_COM_ACESSO_RECEITA as readonly string[]).includes(perfil);
}

export function podeVerGrau(perfil?: string | null): boolean {
  return !!perfil && (PERFIS_QUE_VEEM_GRAU as readonly string[]).includes(perfil);
}

/** Grau mascarado (LGPD/ADR-002) — usado na UI e na impressão. */
export const GRAU_OCULTO = '•••• ••••';

/* ------------------------------------------------------------------ */
/* Receita clínica (GET /v1/receitas/{id})                              */
/* ------------------------------------------------------------------ */

export type GrauShape = {
  esferico?: number;
  cilindrico?: number;
  eixo?: number | null;
  adicao?: number | null;
};

/** Contrato da API de receita antes da normalização (`normalizeReceita`). */
export type ReceitaApiResponse = Omit<ReceitaDTO, 'od' | 'oe' | 'data'> & {
  od: ReceitaDTO['od'] | GrauShape;
  oe: ReceitaDTO['oe'] | GrauShape;
  data?: string;
  dataEmissao?: string;
  dataValidade?: string;
  criadoEm?: string;
  tipo?: string;
  anexoS3Key?: string | null;
};
