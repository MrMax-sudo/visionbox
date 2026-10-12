import * as React from 'react';
import { PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { OrdemServicoDTO } from '@/lib/types';
import { previsaoDe, slaExplicito } from '@/components/os/osDomain';

/**
 * OrdersChart — barras agrupadas dos últimos 7 dias (recebidas / em produção /
 * prontas / atrasadas) calculadas a partir da fila já carregada.
 */
export function OrdersChart({ ordens }: { ordens: OrdemServicoDTO[] }) {
  const series = React.useMemo(() => {
    const buckets = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const base = buckets.map((label) => ({ label, recebidas: 0, producao: 0, prontas: 0, atrasadas: 0 }));
    ordens.forEach((os) => {
      const rawDate = os.criadoEm ?? os.previsaoEntrega ?? os.previsao;
      if (!rawDate) return;
      const parsed = new Date(rawDate);
      if (isNaN(parsed.getTime())) return;
      const day = parsed.getDay();
      const slot = base[(day + 6) % 7];
      if (!slot) return;
      slot.recebidas += 1;
      if (['ENVIADO_LABORATORIO', 'EM_PRODUCAO'].includes(os.status)) slot.producao += 1;
      if (os.status === 'PRONTO_PARA_RETIRADA') slot.prontas += 1;
      const previsao = previsaoDe(os);
      if (slaExplicito(os).includes('atrasado') || (previsao && new Date(previsao).getTime() < Date.now())) {
        slot.atrasadas += 1;
      }
    });
    return base;
  }, [ordens]);

  const max = Math.max(1, ...series.map((s) => s.recebidas + s.producao + s.prontas + s.atrasadas));
  const totals = series.reduce(
    (acc, item) => ({
      recebidas: acc.recebidas + item.recebidas,
      producao: acc.producao + item.producao,
      prontas: acc.prontas + item.prontas,
      atrasadas: acc.atrasadas + item.atrasadas,
    }),
    { recebidas: 0, producao: 0, prontas: 0, atrasadas: 0 },
  );

  const legend: Array<{ label: string; value: number; className: string }> = [
    { label: 'Recebidas', value: totals.recebidas, className: 'bg-secondary' },
    { label: 'Em produção', value: totals.producao, className: 'bg-warning' },
    { label: 'Prontas', value: totals.prontas, className: 'bg-success' },
    { label: 'Atrasadas', value: totals.atrasadas, className: 'bg-danger' },
  ];

  return (
    <Card className="overflow-hidden lg:col-span-3">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-5 w-5 text-brand" aria-hidden /> Ordens de Serviço
        </CardTitle>
        <span className="inline-flex h-8 items-center rounded border border-border bg-page px-3 text-xs font-medium text-secondary">
          Últimos 7 dias
        </span>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div
          role="img"
          aria-label={`Distribuição de ordens nos últimos 7 dias: ${totals.recebidas} recebidas, ${totals.producao} em produção, ${totals.prontas} prontas, ${totals.atrasadas} atrasadas.`}
          className="flex h-48 items-end gap-3 border-t border-border pt-4"
        >
          {series.map((item) => (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-[calc(100%-18px)] w-full items-end justify-center gap-[3px]">
                <div className="w-1/4 rounded-t bg-secondary" style={{ height: `${(item.recebidas / max) * 100}%` }} />
                <div className="w-1/4 rounded-t bg-warning" style={{ height: `${(item.producao / max) * 100}%` }} />
                <div className="w-1/4 rounded-t bg-success" style={{ height: `${(item.prontas / max) * 100}%` }} />
                <div className="w-1/4 rounded-t bg-danger" style={{ height: `${(item.atrasadas / max) * 100}%` }} />
              </div>
              <span className="text-[11px] text-secondary">{item.label}</span>
            </div>
          ))}
        </div>
        <ul className="space-y-3 self-center text-sm">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-secondary">
                <span aria-hidden className={cn('h-3 w-3 rounded-full', item.className)} />
                {item.label}
              </span>
              <strong className="text-base text-primary">{item.value}</strong>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
