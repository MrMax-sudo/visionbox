import { CheckCircle2, ReceiptText, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  dataBR,
  isVencida,
  money,
  saldoDe,
  somarSaldo,
  statusLabel,
  statusVariant,
  type AcaoConta,
  type ContaPagarDTO,
  type ContaReceberDTO,
  type TipoConta,
} from './types';

/**
 * Tabela densa de títulos (Receber/Pagar/Crediário) com linha de totais.
 * Ações de baixar/cancelar são delegadas à tela (mesma mutação da tela legada).
 */
export function ContasTable({
  contas,
  tipo,
  ocupado,
  onAcao,
  emptyDescription,
}: {
  contas: ContaReceberDTO[];
  tipo: TipoConta;
  ocupado?: boolean;
  onAcao: (id: string, action: AcaoConta) => void;
  emptyDescription: string;
}) {
  if (contas.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Nenhum título nesta lista"
        description={emptyDescription}
      />
    );
  }

  const colunas = tipo === 'pagar' ? 7 : 6;
  const totalValor = contas.reduce((sum, c) => sum + (c.valor ?? 0), 0);
  const totalSaldo = somarSaldo(contas);

  return (
    <div className="rounded-card border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-page hover:bg-page">
            <TableHead>Título</TableHead>
            {tipo === 'pagar' && <TableHead>Fornecedor</TableHead>}
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {contas.map((conta) => {
            const parcelado = (conta.totalParcelas ?? 1) > 1;
            const vencida = isVencida(conta);
            const fornecedor = (conta as ContaPagarDTO).fornecedor;
            const titulo = conta.descricao ?? conta.numeroDocumento ?? conta.id;

            return (
              <TableRow key={conta.id}>
                <TableCell>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{titulo}</span>
                    {parcelado && (
                      <Badge variant="secondary" className="shrink-0 text-[11px]">
                        {conta.parcela}/{conta.totalParcelas}
                      </Badge>
                    )}
                  </span>
                  {conta.descricao && conta.numeroDocumento && (
                    <span className="block truncate text-xs text-muted">{conta.numeroDocumento}</span>
                  )}
                </TableCell>

                {tipo === 'pagar' && (
                  <TableCell className="whitespace-nowrap text-secondary">
                    {fornecedor || '—'}
                  </TableCell>
                )}

                <TableCell
                  className={
                    vencida
                      ? 'whitespace-nowrap font-medium text-danger-dark'
                      : 'whitespace-nowrap text-secondary'
                  }
                >
                  {dataBR(conta.vencimento)}
                </TableCell>

                <TableCell className="text-right tabular-nums text-secondary">
                  {money(conta.valor)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {money(saldoDe(conta))}
                </TableCell>

                <TableCell>
                  <Badge variant={statusVariant(conta)}>{statusLabel(conta)}</Badge>
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-success-dark hover:bg-success-light"
                      aria-label="Baixar título"
                      title="Baixar título"
                      disabled={ocupado || conta.status === 'PAGO'}
                      onClick={() => onAcao(conta.id, 'baixar')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-danger hover:bg-danger-light"
                      aria-label="Cancelar título"
                      title="Cancelar título"
                      disabled={ocupado || conta.status === 'CANCELADO'}
                      onClick={() => onAcao(conta.id, 'cancelar')}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={colunas - 4} className="text-xs text-secondary">
              {contas.length} título{contas.length === 1 ? '' : 's'} · total do período
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-secondary">
              {money(totalValor)}
            </TableCell>
            <TableCell className="text-right text-sm font-semibold tabular-nums">
              {money(totalSaldo)}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
