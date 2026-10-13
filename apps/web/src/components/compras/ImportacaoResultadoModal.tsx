import {
  BadgeDollarSign,
  Boxes,
  FileCheck2,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { CompraItensTable } from '@/components/compras/CompraItensTable';
import { money, dataBR } from '@/components/financeiro/types';
import {
  unidadesEstoque,
  type CompraDTO,
} from '@/lib/comprasService';

/**
 * ImportacaoResultadoModal — feedback pós-importação (§3.4): itens reconhecidos
 * (badge "Pré-cadastrado" vs "No catálogo" por item, vindo do preCadastrado da
 * resposta), unidades em estoque e títulos a pagar gerados a partir das duplicatas.
 */
export function ImportacaoResultadoModal({
  compra,
  onClose,
}: {
  compra: CompraDTO | null;
  onClose: () => void;
}) {
  if (!compra) return null;

  const itens = compra.itens ?? [];
  const qtdItens = itens.length;
  const unidades = unidadesEstoque(itens);
  const titulos = compra.contasPagarIds?.length ?? 0;
  const preCadastrados = itens.filter((i) => i.preCadastrado === true).length;

  return (
    <Dialog
      open
      onClose={onClose}
      title="NF-e importada com sucesso"
      description={`Nota ${compra.numero ?? '—'}${compra.serie ? ` (série ${compra.serie})` : ''} — ${compra.fornecedorNome ?? 'fornecedor'}`}
      className="max-w-[760px]"
    >
      <div className="space-y-4">
        {/* Resumo da nota */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded border border-border bg-page px-4 py-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted">Fornecedor</dt>
            <dd className="font-semibold text-primary">{compra.fornecedorNome ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">CNPJ</dt>
            <dd className="font-mono text-secondary">{compra.fornecedorCnpj ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted">Emissão</dt>
            <dd className="text-secondary">{dataBR(compra.dataEmissao ?? undefined)}</dd>
          </div>
          <div>
            <dt className="text-muted">Total da nota</dt>
            <dd className="font-semibold tabular-nums text-primary">
              {money(compra.valorTotal)}
            </dd>
          </div>
        </dl>

        {/* Feedback do resultado */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded border border-border bg-page p-3 text-center">
            <FileCheck2 className="mx-auto h-5 w-5 text-success-dark" aria-hidden />
            <p className="mt-1 text-lg font-bold tabular-nums text-primary">{qtdItens}</p>
            <p className="text-[11px] text-secondary">item(ns) reconhecido(s)</p>
          </div>
          <div className="rounded border border-border bg-page p-3 text-center">
            <Boxes className="mx-auto h-5 w-5 text-brand" aria-hidden />
            <p className="mt-1 text-lg font-bold tabular-nums text-primary">{unidades}</p>
            <p className="text-[11px] text-secondary">unidade(s) no estoque</p>
          </div>
          <div className="rounded border border-border bg-page p-3 text-center">
            <BadgeDollarSign className="mx-auto h-5 w-5 text-warning-dark" aria-hidden />
            <p className="mt-1 text-lg font-bold tabular-nums text-primary">{titulos}</p>
            <p className="text-[11px] text-secondary">título(s) a pagar gerado(s)</p>
          </div>
        </div>

        {/* Itens da nota */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
            Itens importados
          </h3>
          <CompraItensTable itens={itens} />
        </div>

        <p className="text-[11px] text-muted">
          {preCadastrados > 0
            ? `${preCadastrados} de ${qtdItens} item(ns) sem correspondência no catálogo foram pré-cadastrados automaticamente (badge amarelo) — custo atualizado, preço de venda zerado para definição manual. Os demais já estavam no catálogo.`
            : 'Todos os itens desta nota já existiam no catálogo da loja — nenhum pré-cadastro necessário.'}
        </p>
      </div>
    </Dialog>
  );
}
