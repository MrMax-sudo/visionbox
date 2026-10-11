import type { ElementType } from 'react';
import { AlertTriangle, Calculator, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { money, type DreDTO } from './types';

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'text-primary',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs text-secondary">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
        </p>
        <p className={`mt-1.5 truncate text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Aba DRE — receita, custo, comissão e resultado.
 * Período: mês atual (GET /dre/mes-atual) ou recorte informado no filtro superior
 * (GET /dre?inicio=&fim= — contrato existente do DREController).
 */
export function DrePanel({
  dre,
  periodoLabel,
  carregando,
  erro,
  onRetry,
}: {
  dre?: DreDTO;
  periodoLabel: string;
  carregando?: boolean;
  erro?: unknown;
  onRetry?: () => void;
}) {
  if (carregando && !dre) return <LoadingState title="Calculando DRE…" description={periodoLabel} />;
  if (erro && !dre) return <ErrorState error={erro} onRetry={onRetry} />;
  if (!dre) return <LoadingState title="Calculando DRE…" />;

  const positivo = (dre.dre ?? 0) >= 0;
  const custoComissao = (dre.custo ?? 0) + (dre.comissao ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-page px-3 py-2">
        <p className="text-xs text-secondary">
          Período analisado: <span className="font-semibold text-primary">{periodoLabel}</span>
        </p>
        <p className="text-xs text-muted">
          {dre.totalContasReceber ?? 0} contas a receber · {dre.totalContasPagar ?? 0} contas a pagar
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Receita bruta" value={money(dre.receita)} sub="Contas a receber no período" icon={Wallet} />
        <StatTile label="Custos" value={money(dre.custo)} sub="Contas a pagar no período" icon={ReceiptText} />
        <StatTile
          label="Comissão"
          value={money(dre.comissao)}
          sub="Taxa sobre a receita"
          icon={Calculator}
        />
        <StatTile
          label="Resultado (DRE)"
          value={money(dre.dre)}
          sub={`Margem ${(dre.margemPercentual ?? 0).toFixed(1)}%`}
          icon={TrendingUp}
          tone={positivo ? 'text-success-dark' : 'text-danger-dark'}
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary">Receita bruta</span>
            <span className="tabular-nums text-primary">{money(dre.receita)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-secondary">Custos + comissão</span>
            <span className="tabular-nums text-primary">{money(custoComissao)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
            <span className="font-semibold text-primary">Resultado do período</span>
            <span
              className={`flex items-center gap-1.5 font-semibold tabular-nums ${
                positivo ? 'text-success-dark' : 'text-danger-dark'
              }`}
            >
              {!positivo && <AlertTriangle className="h-4 w-4" aria-hidden />}
              {money(dre.dre)}
            </span>
          </div>
          {dre.observacao && (
            <p className="break-words rounded border border-border bg-page px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
              {dre.observacao}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
