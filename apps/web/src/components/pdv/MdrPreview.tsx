import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useOnline';
import { calcularLiquido, type ResultadoMdrDTO, type TipoCartao } from '@/lib/maquininhaService';
import { currency } from '@/components/pdv/pdvHelpers';

interface MdrPreviewProps {
  maquininhaId: string | undefined;
  valor: number;
  tipo: TipoCartao;
  parcelas: number;
}

/**
 * MdrPreview — preview de taxa/líquido por linha de cartão do PDV (§3.5).
 *
 * - `valor` é debounced (400ms) antes de bater no backend;
 * - TanStack Query deduplica por chave e cancela a requisição anterior via
 *   `signal` do axios quando os inputs mudam (nenhuma resposta superseded é usada);
 * - o cálculo de verdade (HALF_EVEN, 2 casas) fica SEMPRE no backend — aqui é
 *   só exibição; o payload final nunca persiste estes números.
 */
export function MdrPreview({ maquininhaId, valor, tipo, parcelas }: MdrPreviewProps) {
  const parcelasEfetivas = tipo === 'DEBITO' ? 1 : parcelas;
  const debValor = useDebounce(valor, 400);
  const habilitado = Boolean(maquininhaId) && debValor >= 0.01;

  const mdrQuery = useQuery<ResultadoMdrDTO>({
    queryKey: ['mdr-preview', maquininhaId ?? '', debValor, tipo, parcelasEfetivas],
    queryFn: ({ signal }) =>
      calcularLiquido(maquininhaId as string, { valor: debValor, tipo, parcelas: parcelasEfetivas }, { signal }),
    enabled: habilitado,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 0,
    refetchOnWindowFocus: false,
    placeholderData: (prev: ResultadoMdrDTO | undefined) => prev,
  });

  if (!habilitado) return null;

  // Preview é não-crítico: falha NUNCA bloquea a finalização da venda.
  if (mdrQuery.isError) {
    return (
      <p role="status" className="flex items-center justify-end gap-1 text-[11px] text-muted">
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
        Taxa indisponível — será conciliada depois
      </p>
    );
  }

  if (mdrQuery.isFetching || !mdrQuery.data) {
    return (
      <p role="status" aria-live="polite" className="flex items-center justify-end gap-1 text-[11px] text-muted">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> calculando taxa…
      </p>
    );
  }

  const taxa = Number(mdrQuery.data.taxaValor ?? 0);
  const liquido = Number(mdrQuery.data.valorLiquido ?? 0);

  return (
    <p role="status" aria-live="polite" className="flex items-center justify-end gap-1.5 text-xs">
      <span className="text-muted">Taxa</span>
      <span className="font-semibold tabular-nums text-danger-dark">{currency(taxa)}</span>
      <span className="text-muted" aria-hidden>•</span>
      <span className="text-muted">Líquido</span>
      <span className="font-semibold tabular-nums text-success-dark">{currency(liquido)}</span>
    </p>
  );
}
