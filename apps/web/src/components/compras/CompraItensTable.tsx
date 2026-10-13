import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { money } from '@/components/financeiro/types';
import type { CompraItemDTO } from '@/lib/comprasService';

/**
 * CompraItensTable — itens da NF-e de entrada (§3.4): descrição, NCM, EAN,
 * qtd, custo unitário e total. Sem carregar/derivado de custo no front (R3).
 * A coluna "Origem" aparece só quando a resposta da importação informa
 * preCadastrado (null em leituras persistidas — coluna oculta no detalhe).
 */
export function CompraItensTable({ itens }: { itens: CompraItemDTO[] | null | undefined }) {
  const lista = itens ?? [];
  const exibirOrigem = lista.some((item) => item.preCadastrado != null);
  if (lista.length === 0) {
    return (
      <p className="rounded border border-dashed border-border bg-page px-3 py-6 text-center text-xs text-secondary">
        Nenhum item reconhecido nesta compra.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-page hover:bg-page">
            <TableHead>Descrição</TableHead>
            <TableHead>NCM</TableHead>
            <TableHead>EAN</TableHead>
            {exibirOrigem ? <TableHead>Origem</TableHead> : null}
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Custo unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-[280px]">
                <span className="block truncate font-medium" title={item.descricao ?? ''}>
                  {item.descricao || '—'}
                </span>
                {item.codigoFornecedor ? (
                  <span className="block text-[11px] text-muted">
                    Cód. fornecedor: {item.codigoFornecedor}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-xs text-secondary">
                {item.ncm || '—'}
              </TableCell>
              <TableCell className="font-mono text-xs text-secondary">
                {item.ean || '—'}
              </TableCell>
              {exibirOrigem ? (
                <TableCell>
                  {item.preCadastrado == null ? (
                    <span className="text-xs text-muted">—</span>
                  ) : item.preCadastrado ? (
                    <Badge variant="warning" title="Produto criado automaticamente pela importação — revise preço de venda e cadastro.">
                      Pré-cadastrado
                    </Badge>
                  ) : (
                    <Badge variant="success" title="Produto já existia no catálogo da loja.">
                      No catálogo
                    </Badge>
                  )}
                </TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">
                {item.quantidade ?? 0}
                {item.unidade ? (
                  <span className="ml-1 text-[11px] text-muted">{item.unidade}</span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(item.custoUnitario)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {money(item.valorTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="flex items-center gap-1.5 border-t border-border bg-page px-3 py-2 text-[11px] text-muted">
        <Package className="h-3 w-3 shrink-0" aria-hidden />
        Estoque e custo do catálogo atualizados pelo backend na importação.
      </p>
    </div>
  );
}
