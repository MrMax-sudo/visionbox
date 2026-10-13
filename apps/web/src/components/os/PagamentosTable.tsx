import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { brl } from '@/components/os/osDomain';

/**
 * Forma estrutural aceita pela tabela — compatível com:
 *  - `OrdemServicoPagamentoView` (lib/types.ts — OrdemServicoResponse.pagamentos, §3.5)
 *  - `VendaPagamentoView` (types/vendas.ts — Central de Vendas, sem MDR ainda)
 */
export type PagamentoTableView = {
  id?: string;
  formaPagamentoId?: string | null;
  formaPagamentoNome?: string | null;
  /** BigDecimal serializado — number|string; nunca calcular no front. */
  valor: number | string;
  taxaValor?: number | string | null;
  valorLiquido?: number | string | null;
  maquininhaId?: string | null;
  parcelas?: number | null;
};

interface PagamentosTableProps {
  pagamentos: PagamentoTableView[];
  className?: string;
}

function num(valor: number | string | null | undefined): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Colunas de MDR só aparecem quando o backend enriqueceu pelo menos uma linha. */
function temMdr(pagamentos: PagamentoTableView[]): boolean {
  return pagamentos.some((p) => p.taxaValor != null || p.valorLiquido != null || p.parcelas != null);
}

function TaxaPendenteBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="warning" className="cursor-help whitespace-nowrap">
          Taxa pendente
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Taxa e líquido deste pagamento ainda não foram calculados — o MDR fica pendente até a
        conciliação da maquininha.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * PagamentosTable — tabela de pagamentos da venda/OS (§3.5 MDR).
 *
 * Compartilhada entre OSDetail e Central de Vendas (DetalhesVendaModal). Sem
 * dados de taxa/líquido/parcelas (DTO legado), degrada para Forma + Valor —
 * nenhum campo inventado. `taxaValor`/`valorLiquido` null → badge "Taxa
 * pendente" (conciliação de maquininha). Zero hex: só tokens do tema.
 */
export function PagamentosTable({ pagamentos, className }: PagamentosTableProps) {
  const mdr = temMdr(pagamentos);
  const colSpan = mdr ? 5 : 2;

  const totalValor = pagamentos.reduce((sum, p) => sum + num(p.valor), 0);
  const totalTaxa = pagamentos.reduce((sum, p) => sum + (p.taxaValor != null ? num(p.taxaValor) : 0), 0);
  const totalLiquido = pagamentos.reduce(
    (sum, p) => sum + (p.valorLiquido != null ? num(p.valorLiquido) : 0),
    0,
  );
  const pendentes = pagamentos.filter((p) => p.taxaValor == null).length;

  return (
    <div className={className}>
      <div className="overflow-x-auto rounded border border-border bg-card">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">Pagamentos da venda</caption>
          <thead className="border-b border-border bg-page text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Forma</th>
              {mdr && (
                <>
                  <th scope="col" className="px-2 py-2 text-center font-semibold">Parcelas</th>
                </>
              )}
              <th scope="col" className="px-3 py-2 text-right font-semibold">Valor</th>
              {mdr && (
                <>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Taxa</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Líquido</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagamentos.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-4 text-center text-muted">
                  Nenhum pagamento registrado.
                </td>
              </tr>
            ) : (
              pagamentos.map((p, index) => (
                <tr
                  key={p.id ?? `${p.formaPagamentoId ?? 'forma'}-${index}`}
                  className="transition-colors hover:bg-page"
                >
                  <td className="px-3 py-2 font-medium text-primary">
                    {p.formaPagamentoNome || 'Pagamento'}
                  </td>
                  {mdr && (
                    <td className="whitespace-nowrap px-2 py-2 text-center text-secondary">
                      {p.parcelas != null ? `${p.parcelas}x` : '—'}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-secondary">
                    {brl(num(p.valor))}
                  </td>
                  {mdr && (
                    <>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {p.taxaValor != null ? (
                          <span className="font-semibold text-danger-dark">−{brl(num(p.taxaValor))}</span>
                        ) : (
                          <TaxaPendenteBadge />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                        {p.valorLiquido != null ? (
                          <span className="font-semibold text-success-dark">{brl(num(p.valorLiquido))}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {pagamentos.length > 0 && (
            <tfoot className="border-t border-border bg-page font-semibold">
              <tr>
                <td className="px-3 py-2 text-muted">Total</td>
                {mdr && <td />}
                <td className="px-3 py-2 text-right tabular-nums text-primary">{brl(totalValor)}</td>
                {mdr && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums text-danger-dark">−{brl(totalTaxa)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success-dark">
                      {brl(totalLiquido)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {mdr && pendentes > 0 && (
        <p className="mt-1.5 text-[11px] text-muted">
          {pendentes === 1
            ? '1 pagamento com taxa pendente de conciliação.'
            : `${pendentes} pagamentos com taxa pendente de conciliação.`}
        </p>
      )}
    </div>
  );
}
