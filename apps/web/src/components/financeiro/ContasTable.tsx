import * as React from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, History, ReceiptText, XCircle } from 'lucide-react';
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
import { PagamentosTimeline } from './PagamentosTimeline';
import {
  baixavel,
  cancelavel,
  dataBR,
  isVencida,
  money,
  saldoDe,
  somarSaldo,
  statusLabel,
  statusVariant,
  type ContaPagarDTO,
  type ContaReceberDTO,
  type TipoConta,
} from './types';

/**
 * Tabela densa de títulos (Receber/Pagar/Crediário) com linha de totais.
 * Ações delegadas à tela: baixar abre o modal (parcial/integral), cancelar
 * chama a mutação direta. Linhas de contas a receber expandem mostrando o
 * histórico de baixas (GET /{id}/pagamentos — §3.3).
 */
export function ContasTable({
  contas,
  tipo,
  ocupado,
  onBaixar,
  onCancelar,
  emptyDescription,
}: {
  contas: ContaReceberDTO[];
  tipo: TipoConta;
  ocupado?: boolean;
  onBaixar: (conta: ContaReceberDTO) => void;
  onCancelar: (id: string) => void;
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

  // receber: chevron + título + vencimento | pagar: título + fornecedor + vencimento
  const spanResumo = tipo === 'pagar' ? 4 : 3;
  const totalValor = contas.reduce((sum, c) => sum + (c.valor ?? 0), 0);
  const totalSaldo = somarSaldo(contas);

  return (
    <div className="rounded-card border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-page hover:bg-page">
            {tipo === 'receber' && <TableHead className="w-10" aria-label="Detalhes" />}
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
          {contas.map((conta) => (
            <ContaRow
              key={conta.id}
              conta={conta}
              tipo={tipo}
              ocupado={ocupado}
              onBaixar={onBaixar}
              onCancelar={onCancelar}
            />
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={spanResumo} className="text-xs text-secondary">
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

function ContaRow({
  conta,
  tipo,
  ocupado,
  onBaixar,
  onCancelar,
}: {
  conta: ContaReceberDTO;
  tipo: TipoConta;
  ocupado?: boolean;
  onBaixar: (conta: ContaReceberDTO) => void;
  onCancelar: (id: string) => void;
}) {
  const [expandida, setExpandida] = React.useState(false);

  const parcelado = (conta.totalParcelas ?? 1) > 1;
  const vencida = isVencida(conta);
  const parcial = conta.status === 'PARCIAL';
  const fornecedor = (conta as ContaPagarDTO).fornecedor;
  const titulo = conta.descricao ?? conta.numeroDocumento ?? conta.id;
  const totalPagamentos = (conta.valorPago ?? 0) > 0 && parcial;

  return (
    <>
      <TableRow>
        {tipo === 'receber' && (
          <TableCell className="w-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={expandida ? 'Ocultar histórico de baixas' : 'Ver histórico de baixas'}
              aria-expanded={expandida}
              title="Histórico de baixas"
              onClick={() => setExpandida((v) => !v)}
            >
              {expandida ? (
                <ChevronDown className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronRight className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </TableCell>
        )}

        <TableCell>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{titulo}</span>
            {parcelado && (
              <Badge variant="secondary" className="shrink-0 text-[11px]">
                {conta.parcela}/{conta.totalParcelas}
              </Badge>
            )}
            {parcial && (
              <Badge variant="warning" className="shrink-0 text-[11px]">
                <History className="mr-1 h-3 w-3" aria-hidden />
                baixas
              </Badge>
            )}
          </span>
          {conta.descricao && conta.numeroDocumento && (
            <span className="block truncate text-xs text-muted">{conta.numeroDocumento}</span>
          )}
          {totalPagamentos && (
            <span className="block truncate text-xs text-muted">
              Pago {money(conta.valorPago)} de {money(conta.valor)}
            </span>
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
              title="Baixar título (parcial ou integral)"
              disabled={ocupado || !baixavel(conta)}
              onClick={() => onBaixar(conta)}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-danger hover:bg-danger-light"
              aria-label="Cancelar título"
              title="Cancelar título"
              disabled={ocupado || !cancelavel(conta)}
              onClick={() => onCancelar(conta.id)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {tipo === 'receber' && expandida && (
        <TableRow className="hover:bg-card">
          <TableCell colSpan={7} className="p-0">
            <PagamentosTimeline contaId={conta.id} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
