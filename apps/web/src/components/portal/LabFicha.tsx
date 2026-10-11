import * as React from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Calendar,
  Clock,
  FileCheck,
  Glasses,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { badgeVariantForStatus, labelStatus, FLUXO_LAB, fmtData } from '@/components/portal/status';

/**
 * Blocos do Portal do Laboratório (ONDA 2E).
 * Ficha técnica pública (token HMAC vlab1): prescrição OD/OE, specs e ações
 * de avanço de etapa (produção/CQ) — contrato PATCH /status intocado.
 */

export interface GrauOtico {
  esferico?: string;
  cilindrico?: string;
  eixo?: number;
  adicao?: string;
  dnp?: string;
  altura?: string;
}

export interface LabPortalDetalhes {
  ordemServicoId: string;
  numeroOs: string;
  statusAtual: string;
  dataAbertura: string;
  previsaoEntrega?: string;
  armacaoNome?: string;
  armacaoSku?: string;
  lenteNome?: string;
  lenteSku?: string;
  tratamentos?: string[];
  observacoesLaboratorio?: string;
  /** Foto do CQ — campo opcional defensivo: renderiza quando o backend passar a enviar. */
  fotoUrl?: string;
  od?: GrauOtico;
  oe?: GrauOtico;
}

/* ────────────────────────────── cabeçalho / resumo ────────────────────────────── */

export function LabHeader({ numeroOs }: { numeroOs: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary-light text-secondary-dark">
          <Glasses className="h-7 w-7" aria-hidden />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-primary">VisionBox Lab Portal</h1>
            <Badge variant="secondary">Acesso Externo Seguro</Badge>
          </div>
          <p className="text-xs text-secondary">
            Ficha Técnica e Receituário Ótico para Produção e Surfaçagem
          </p>
        </div>
      </div>

      <div className="text-right">
        <span className="text-xs text-muted">Ordem de Serviço</span>
        <p className="font-mono text-lg font-bold text-brand">{numeroOs}</p>
      </div>
    </header>
  );
}

function ResumoCard({
  label,
  icon: Icon,
  tone,
  children,
}: {
  label: string;
  icon: React.ElementType;
  tone: 'warning' | 'secondary' | 'success';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'warning'
      ? 'bg-warning-light text-warning-dark'
      : tone === 'success'
        ? 'bg-success-light text-success-dark'
        : 'bg-secondary-light text-secondary-dark';
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <span className="block text-[11px] uppercase text-muted">{label}</span>
          <div className="mt-0.5 truncate text-sm font-semibold text-primary">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LabResumo({ dados }: { dados: LabPortalDetalhes }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <ResumoCard label="Status Atual" icon={Clock} tone="warning">
        <Badge variant={badgeVariantForStatus(dados.statusAtual)}>
          {labelStatus(dados.statusAtual)}
        </Badge>
      </ResumoCard>
      <ResumoCard label="Data de Abertura" icon={Calendar} tone="secondary">
        {fmtData(dados.dataAbertura)}
      </ResumoCard>
      <ResumoCard label="Previsão de Entrega" icon={ShieldCheck} tone="success">
        {dados.previsaoEntrega ? fmtData(dados.previsaoEntrega) : 'Urgente'}
      </ResumoCard>
    </div>
  );
}

/* ────────────────────────────── etapas da produção ────────────────────────────── */

/** Timeline das etapas do lab (derivada do statusAtual — sem novo contrato). */
export function LabEtapasProducao({ status }: { status: string }) {
  const idxAtual = FLUXO_LAB.indexOf(status as (typeof FLUXO_LAB)[number]);
  const emRetrabalho = status === 'RETRABALHO';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Play className="h-4 w-4 text-brand" aria-hidden /> Etapas da produção
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {emRetrabalho && (
          <p
            role="status"
            className="flex items-center gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-xs font-medium text-danger-dark"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Retrabalho solicitado — corrija a lente e avance para "Lente Pronta" ao concluir.
          </p>
        )}
        <ol className="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-2">
          {FLUXO_LAB.map((etapa, idx) => {
            const concluida = idxAtual !== -1 && idx < idxAtual;
            const atual = idxAtual !== -1 && idx === idxAtual;
            return (
              <li key={etapa} className="relative flex flex-1 items-start gap-3 pb-4 last:pb-0 sm:flex-col sm:pb-0">
                {idx < FLUXO_LAB.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-[10px] top-6 h-[calc(100%-8px)] w-0.5 sm:left-6 sm:top-[10px] sm:h-0.5 sm:w-[calc(100%-16px)]',
                      concluida ? 'bg-success' : 'bg-border',
                    )}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    concluida
                      ? 'border-success bg-success text-primary-foreground'
                      : atual
                        ? 'border-primary bg-primary-light text-brand'
                        : 'border-border bg-card',
                  )}
                >
                  {concluida && <CheckCircle2 className="h-3 w-3" />}
                  {atual && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span
                  className={cn(
                    'text-xs sm:pt-0.5',
                    atual ? 'font-semibold text-primary' : concluida ? 'text-secondary' : 'text-muted',
                  )}
                >
                  {labelStatus(etapa)}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────── prescrição OD / OE ────────────────────────────── */

function CelulaGrau({ grau, olho }: { grau?: GrauOtico; olho: string }) {
  return (
    <TableRow>
      <TableCell className="font-sans font-bold text-secondary-dark">{olho}</TableCell>
      <TableCell className="text-center font-mono font-semibold">{grau?.esferico ?? '0.00'}</TableCell>
      <TableCell className="text-center font-mono">{grau?.cilindrico ?? '0.00'}</TableCell>
      <TableCell className="text-center font-mono">{grau?.eixo ? `${grau.eixo}°` : '—'}</TableCell>
      <TableCell className="text-center font-mono">{grau?.adicao ?? '—'}</TableCell>
      <TableCell className="text-center font-mono font-semibold">{grau?.dnp ?? '—'}</TableCell>
      <TableCell className="text-center font-mono font-semibold">{grau?.altura ?? '—'}</TableCell>
    </TableRow>
  );
}

export function LabPrescricao({ dados }: { dados: LabPortalDetalhes }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="h-5 w-5 text-brand" aria-hidden />
          Prescrição Médica & Medidas Pupilares
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Olho</TableHead>
              <TableHead className="text-center">Esférico</TableHead>
              <TableHead className="text-center">Cilíndrico</TableHead>
              <TableHead className="text-center">Eixo</TableHead>
              <TableHead className="text-center">Adição</TableHead>
              <TableHead className="text-center">DNP (mm)</TableHead>
              <TableHead className="text-center">Altura (mm)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <CelulaGrau grau={dados.od} olho="OD (Direito)" />
            <CelulaGrau grau={dados.oe} olho="OE (Esquerdo)" />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────── specs: armação / lente / CQ ────────────────────────────── */

export function LabEspecificacoes({ dados }: { dados: LabPortalDetalhes }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Especificações da Armação & Lente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div>
            <span className="text-muted">Armação Selecionada:</span>
            <p className="text-sm font-semibold text-primary">
              {dados.armacaoNome}{' '}
              {dados.armacaoSku && (
                <span className="font-mono text-xs text-secondary">({dados.armacaoSku})</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-muted">Tipo de Lente:</span>
            <p className="text-sm font-semibold text-primary">
              {dados.lenteNome}{' '}
              {dados.lenteSku && (
                <span className="font-mono text-xs text-secondary">({dados.lenteSku})</span>
              )}
            </p>
          </div>
          {dados.observacoesLaboratorio && (
            <div className="rounded border border-warning bg-warning-light p-2.5 text-warning-dark">
              <span className="font-semibold">Instruções de Montagem:</span>
              <p className="mt-0.5">{dados.observacoesLaboratorio}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Sparkles className="h-4 w-4 text-warning" aria-hidden />
              Tratamentos & Benefícios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dados.tratamentos && dados.tratamentos.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dados.tratamentos.map((t, idx) => (
                  <Badge key={idx} variant="secondary">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">Lente básica sem tratamentos adicionais.</p>
            )}
          </CardContent>
        </Card>

        {dados.fotoUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Camera className="h-4 w-4 text-brand" aria-hidden />
                Foto do Controle de Qualidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <a href={dados.fotoUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={dados.fotoUrl}
                  alt="Foto do controle de qualidade da OS"
                  className="max-h-56 w-full rounded border border-border object-contain"
                />
              </a>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────── ações do laboratório ────────────────────────────── */

export function LabAcoes({
  statusAtual,
  isPending,
  onStatus,
}: {
  statusAtual: string;
  isPending: boolean;
  onStatus: (status: string, obs: string) => void;
}) {
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm">Ações do Laboratório Ótico</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-secondary">
          Avance o estágio do pedido para sincronizar o painel da ótica e notificar o cliente via
          WhatsApp.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || statusAtual === 'RETRABALHO'}
            onClick={() => onStatus('RETRABALHO', 'Retrabalho iniciado pelo técnico de montagem')}
            className="text-danger-dark hover:bg-danger-light"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" /> Sinalizar Retrabalho
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isPending || statusAtual === 'EM_PRODUCAO'}
            onClick={() => onStatus('EM_PRODUCAO', 'Produção e corte de lentes iniciados')}
          >
            <Play className="mr-1.5 h-4 w-4" /> Iniciar Produção
          </Button>

          <Button
            variant="default"
            size="sm"
            disabled={isPending || statusAtual === 'LENTE_PRONTA'}
            onClick={() => onStatus('LENTE_PRONTA', 'Lentes surfaçadas e montadas com sucesso')}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
            )}
            Marcar como Lente Pronta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
