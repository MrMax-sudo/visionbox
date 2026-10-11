import { statusLabel, type StatusOS } from '@/lib/osStatus';
import type { BadgeProps } from '@/components/ui/badge';

/**
 * status.ts — helpers de UI compartilhados pelos portais públicos (ONDA 2E).
 *
 * - Espelha o mapa semântico de `theme-visionbox.css` (.status-*) usando as
 *   variantes do <Badge> do kit → quando o CSS legado cair (Onda 3), as cores
 *   de status continuam corretas via tokens.
 * - Nenhum hex, nenhum arquivo legado: só tokens + kit (R5).
 */

export type BadgeStatusVariant = NonNullable<BadgeProps['variant']>;

/** Status OS → variante do Badge (mesma semântica do tema: info/warning/marca/success/danger). */
export function badgeVariantForStatus(status?: string): BadgeStatusVariant {
  switch (status) {
    case 'ORCAMENTO':
    case 'PEDIDO_CONFIRMADO':
      return 'info';
    case 'ENVIADO_LABORATORIO':
    case 'EM_PRODUCAO':
      return 'warning';
    case 'LENTE_PRONTA':
    case 'MONTAGEM':
    case 'CONTROLE_QUALIDADE':
      return 'default';
    case 'PRONTO_PARA_RETIRADA':
    case 'ENTREGUE':
      return 'success';
    case 'CANCELADO':
    case 'RETRABALHO':
    case 'DEVOLVIDO_GARANTIA':
      return 'danger';
    default:
      return 'secondary';
  }
}

/** Label legível do status (conhecido via lib/osStatus ou bruto formatado). */
export function labelStatus(status?: string): string {
  if (!status) return '—';
  return statusLabel[status as StatusOS] ?? status.replace(/_/g, ' ');
}

/** Fluxo canônico da OS visto pelo cliente (9 etapas da máquina de 12 status). */
export const FLUXO_CLIENTE = [
  'ORCAMENTO',
  'PEDIDO_CONFIRMADO',
  'ENVIADO_LABORATORIO',
  'EM_PRODUCAO',
  'LENTE_PRONTA',
  'MONTAGEM',
  'CONTROLE_QUALIDADE',
  'PRONTO_PARA_RETIRADA',
  'ENTREGUE',
] as const;

/** Etapas do laboratório que o portal do lab consegue avançar. */
export const FLUXO_LAB = ['ENVIADO_LABORATORIO', 'EM_PRODUCAO', 'LENTE_PRONTA'] as const;

/** Status que encerram o fluxo (sem atraso, sem etapa "atual" para atualizar). */
export const STATUS_TERMINAIS = new Set<string>(['ENTREGUE', 'CANCELADO']);

/** Formata data ISO; '—' quando vazia/inválida. */
export function fmtData(value?: string | null, comHora = false): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(
    'pt-BR',
    comHora ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' },
  );
}
