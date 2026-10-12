import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Filter, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { TODOS_STATUS, statusText } from '@/components/os/osDomain';

/* ------------------------------------------------------------------ */
/* Filtros da fila (busca + status + somente atrasadas)                */
/* ------------------------------------------------------------------ */

export function FiltrosOS({
  busca,
  onBusca,
  status,
  onStatus,
  somenteAtrasadas,
  onToggleAtrasadas,
  onLimpar,
  total,
  buscando,
  searchRef,
}: {
  busca: string;
  onBusca: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  somenteAtrasadas: boolean;
  onToggleAtrasadas: () => void;
  onLimpar: () => void;
  total: number;
  buscando: boolean;
  searchRef: React.RefObject<HTMLInputElement>;
}) {
  const temFiltro = Boolean(busca) || status !== 'ALL' || somenteAtrasadas;
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Kanban por status</CardTitle>
          <p className="mt-1 text-xs text-muted">
            Arraste não é obrigatório: cada card tem ação <strong>Mover</strong> (teclado-first).
            Atalho <kbd className="rounded border border-border bg-page px-1">/</kbd> foca a busca.
          </p>
        </div>
        <span className="text-xs text-muted" role="status" aria-live="polite">
          {buscando ? 'carregando…' : `${total} OS`}
        </span>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar OS, cliente, produto…"
            className="pl-9"
            aria-label="Buscar OS"
          />
        </div>

        <Select
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          aria-label="Filtrar por status"
          className="h-9 w-auto min-w-[180px]"
        >
          <option value="ALL">Todos os status (12)</option>
          {TODOS_STATUS.map((s) => (
            <option key={s} value={s}>
              {statusText(s)}
            </option>
          ))}
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={onToggleAtrasadas}
          aria-pressed={somenteAtrasadas}
          className={somenteAtrasadas ? 'border-danger text-danger-dark' : undefined}
        >
          <Filter className="mr-2 h-4 w-4" aria-hidden />
          {somenteAtrasadas ? 'Somente atrasadas' : 'Filtrar atrasadas'}
        </Button>

        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={onLimpar}>
            <X className="mr-1 h-4 w-4" aria-hidden /> Limpar
          </Button>
        )}

        <Badge variant="outline" className="hidden sm:inline-flex">
          Fila visível
        </Badge>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Alerta de SLA (dashboard)                                           */
/* ------------------------------------------------------------------ */

export function AlertaAtrasadas({ total }: { total: number }) {
  if (total <= 0) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-4 rounded-card border border-danger-light bg-danger-light px-5 py-4 text-danger-dark shadow-soft"
    >
      <AlertTriangle className="h-7 w-7 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Existem {total} ordens de serviço em atraso.</p>
        <p className="text-sm">Atenda essas OS para manter a satisfação dos seus clientes.</p>
      </div>
      <Button asChild variant="destructive" size="sm">
        <Link to="/os">
          Ver ordens <span aria-hidden>→</span>
        </Link>
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel de Distribuição por Status (dados reais do banco)            */
/* ------------------------------------------------------------------ */

export function PromoPanel({ ordens = [] }: { ordens?: Array<{ status: string }> }) {
  const orcamentos = ordens.filter((o) => o.status === 'ORCAMENTO').length;
  const confirmadas = ordens.filter((o) => o.status === 'PEDIDO_CONFIRMADO').length;
  const producao = ordens.filter((o) => ['ENVIADO_LABORATORIO', 'EM_PRODUCAO'].includes(o.status)).length;
  const montagem = ordens.filter((o) => ['LENTE_PRONTA', 'MONTAGEM', 'CONTROLE_QUALIDADE'].includes(o.status)).length;
  const prontas = ordens.filter((o) => o.status === 'PRONTO_PARA_RETIRADA').length;
  const concluidas = ordens.filter((o) => o.status === 'ENTREGUE').length;

  return (
    <Card className="flex flex-col justify-between overflow-hidden p-4 lg:col-span-2">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <CardTitle className="text-sm font-semibold text-primary">
            Distribuição por Status
          </CardTitle>
          <span className="font-mono text-xs text-muted">{ordens.length} ordens</span>
        </div>
        <div className="mt-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between border-b border-border/40 py-1">
            <span className="text-secondary">Orçamentos</span>
            <span className="font-mono font-semibold text-primary">{orcamentos}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/40 py-1">
            <span className="text-secondary">Confirmadas</span>
            <span className="font-mono font-semibold text-primary">{confirmadas}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/40 py-1">
            <span className="text-secondary">Laboratório / Produção</span>
            <span className="font-mono font-semibold text-warning-dark">{producao}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/40 py-1">
            <span className="text-secondary">Montagem / CQ</span>
            <span className="font-mono font-semibold text-secondary-dark">{montagem}</span>
          </div>
          <div className="flex items-center justify-between border-b border-border/40 py-1">
            <span className="text-secondary">Prontas p/ Retirada</span>
            <span className="font-mono font-semibold text-success-dark">{prontas}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-secondary">Entregues</span>
            <span className="font-mono font-semibold text-muted">{concluidas}</span>
          </div>
        </div>
      </div>
      <p className="mt-2 border-t border-border pt-2 text-[10px] text-muted">
        Dados consolidados da base de dados.
      </p>
    </Card>
  );
}
