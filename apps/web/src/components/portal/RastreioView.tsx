import * as React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Hash,
  History,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  Store,
  Glasses,
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmtData } from '@/components/portal/status';
import { CardResumo, EtapasPedido, SemaforoStatus, TimelineOs } from '@/components/portal/RastreioStatus';
import { sanitizeWhatsApp } from '@/stores/empresaStore';
import type { RastreioOS } from '@/lib/rastreioApi';

/* ────────────────────────────── cartões laterais ────────────────────────────── */

function CardOptica({ optica }: { optica?: RastreioOS['optica'] }) {
  const whats = sanitizeWhatsApp(optica?.whatsapp ?? optica?.telefone);
  const nome = optica?.nome?.trim() || 'Ótica parceira VisionBox';
  const endereco = [
    optica?.endereco,
    optica?.cidade && optica?.uf ? `${optica.cidade}/${optica.uf}` : optica?.cidade,
  ]
    .filter(Boolean)
    .join(' — ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Store className="h-4 w-4 text-brand" aria-hidden /> Ótica responsável
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <Glasses className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-primary">{nome}</p>
            {optica?.cnpj && <p className="font-mono text-xs text-muted">CNPJ {optica.cnpj}</p>}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <p className="min-w-0 text-xs text-secondary">
            {endereco || <span className="text-muted">Endereço não informado.</span>}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden />
          <p className="min-w-0 text-xs text-secondary">
            {optica?.telefone || optica?.whatsapp ? (
              (optica?.whatsapp ?? optica?.telefone)
            ) : (
              <span className="text-muted">Telefone não informado.</span>
            )}
          </p>
        </div>

        {whats && (
          <a
            href={`https://wa.me/${whats}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Falar com a ótica ${nome} pelo WhatsApp`}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'w-full')}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Falar com a ótica
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function CardGarantia({ garantia }: { garantia?: RastreioOS['garantia'] }) {
  const itens = garantia?.itens ?? [];
  const temDados = Boolean(garantia?.dataCompra || garantia?.validadeMeses || itens.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden /> 2ª via da garantia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!temDados ? (
          <p className="rounded border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
            A 2ª via da garantia aparecerá aqui assim que a ótica registrar a compra deste pedido.
          </p>
        ) : (
          <>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-secondary">Data da compra</dt>
                <dd className="font-semibold text-primary">{fmtData(garantia?.dataCompra)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-secondary">Garantia</dt>
                <dd className="font-semibold text-primary">
                  {garantia?.validadeMeses ? `${garantia.validadeMeses} meses` : 'conforme item'}
                </dd>
              </div>
            </dl>

            {itens.length > 0 && (
              <ul className="divide-y divide-border rounded border border-border">
                {itens.map((item, idx) => (
                  <li key={idx} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="min-w-0 text-primary">
                      {item.descricao ?? 'Item do pedido'}
                      {item.quantidade && item.quantidade > 1 ? ` • ${item.quantidade}x` : ''}
                    </span>
                    <span className="shrink-0 text-muted">
                      {item.validade
                        ? `válida até ${fmtData(item.validade)}`
                        : item.garantiaMeses
                          ? `${item.garantiaMeses} meses`
                          : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir 2ª via
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────── visão completa ────────────────────────────── */

export function RastreioView({ dados }: { dados: RastreioOS }) {
  const [copiado, setCopiado] = React.useState(false);
  const numero = dados.numeroOs ?? '—';
  const previsao = dados.previsaoEntrega;
  const atrasada =
    Boolean(previsao) &&
    !['ENTREGUE', 'CANCELADO'].includes(dados.statusAtual ?? '') &&
    new Date(previsao!).getTime() < Date.now();
  const eventos = dados.timeline ?? [];
  const produto =
    dados.produtoResumo ?? [dados.armacaoNome, dados.lenteNome].filter(Boolean).join(' + ');

  async function copiarNumero() {
    try {
      await navigator.clipboard.writeText(numero);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o número já está visível na tela */
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo / semáforo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <span className="block text-[11px] uppercase text-muted">Status atual</span>
            <div className="mt-1.5">
              <SemaforoStatus status={dados.statusAtual} />
            </div>
          </CardContent>
        </Card>

        <CardResumo label="Previsão de entrega" icon={CalendarDays}>
          {previsao ? (
            <span className={atrasada ? 'text-danger-dark' : undefined}>{fmtData(previsao)}</span>
          ) : (
            <span className="text-muted">A definir</span>
          )}
          {atrasada && (
            <span className="ml-2 rounded bg-danger-light px-1.5 py-0.5 text-[10px] font-semibold text-danger-dark">
              atrasada
            </span>
          )}
        </CardResumo>

        <CardResumo label="Abertura do pedido" icon={Clock3}>
          {fmtData(dados.dataAbertura)}
        </CardResumo>

        <CardResumo label="Número da OS" icon={Hash}>
          <span className="flex items-center gap-1.5">
            <span className="font-mono">{numero}</span>
            {dados.numeroOs && (
              <button
                type="button"
                onClick={() => void copiarNumero()}
                className="rounded p-1 text-muted hover:text-brand"
                aria-label="Copiar número da OS"
              >
                {copiado ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </span>
        </CardResumo>
      </div>

      {(dados.clientePrimeiroNome || produto) && (
        <p className="text-xs text-secondary">
          {dados.clientePrimeiroNome && (
            <>
              Olá, <span className="font-semibold text-primary">{dados.clientePrimeiroNome}</span>
            </>
          )}
          {produto ? `${dados.clientePrimeiroNome ? ' — ' : ''}${produto}` : ''}. Acompanhe cada etapa abaixo.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-brand" aria-hidden /> Etapas do pedido
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EtapasPedido status={dados.statusAtual} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4 text-secondary" aria-hidden /> Histórico de movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineOs eventos={eventos} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <CardOptica optica={dados.optica} />
          <CardGarantia garantia={dados.garantia} />
        </div>
      </div>
    </div>
  );
}
