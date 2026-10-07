import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Glasses,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Calendar,
  Loader2,
  FileCheck,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/apiClient';

interface GrauOtico {
  esferico?: string;
  cilindrico?: string;
  eixo?: number;
  adicao?: string;
  dnp?: string;
  altura?: string;
}

interface LabPortalDetalhes {
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
  od?: GrauOtico;
  oe?: GrauOtico;
}

export default function LabPortal() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [feedbackMsg, setFeedbackMsg] = React.useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<LabPortalDetalhes>({
    queryKey: ['lab-portal', token],
    queryFn: async () => {
      if (!token) throw new Error('Token ausente');
      const res = await apiClient.get<LabPortalDetalhes>(`/v1/laboratorios/portal/${token}`);
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, obs }: { status: string; obs?: string }) => {
      if (!token) throw new Error('Token ausente');
      await apiClient.patch(`/v1/laboratorios/portal/${token}/status`, {
        status,
        observacao: obs || `Atualizado via Portal do Laboratório em ${new Date().toLocaleString('pt-BR')}`,
      });
    },
    onSuccess: (_, vars) => {
      setFeedbackMsg(`Status atualizado para ${vars.status} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['lab-portal', token] });
    },
  });

  function formatStatusBadge(status?: string) {
    switch (status) {
      case 'ENVIADO_LABORATORIO':
        return <Badge variant="warning">Aguardando Início</Badge>;
      case 'EM_PRODUCAO':
        return <Badge variant="info">Em Produção no Laboratório</Badge>;
      case 'LENTE_PRONTA':
        return <Badge variant="success">Lente Pronta / Produzida</Badge>;
      case 'RETRABALHO':
        return <Badge variant="danger">Retrabalho Solicitado</Badge>;
      default:
        return <Badge variant="outline">{status ?? '—'}</Badge>;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] p-6 flex flex-col items-center justify-center space-y-4">
        <Skeleton className="h-12 w-72 rounded-lg" />
        <Skeleton className="h-64 w-full max-w-2xl rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] p-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md p-6 text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-[var(--color-danger)]" />
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Link Expirado ou Inválido</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            O token de acesso deste laboratório expirou ou a ordem de serviço já foi concluída. Entre em contato com a ótica para emitir um novo link.
          </p>
          <Button variant="outline" onClick={() => refetch()} className="w-full">
            Tentar Novamente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Cabeçalho do Portal */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-secondary-light)] text-[var(--color-secondary-dark)]">
              <Glasses className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">VisionBox Lab Portal</h1>
                <span className="rounded bg-[var(--color-secondary-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-secondary-dark)]">
                  Acesso Externo Seguro
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Ficha Técnica e Receituário Ótico para Produção e Surfaçagem
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-[var(--color-text-muted)]">Ordem de Serviço</span>
            <p className="font-mono text-lg font-bold text-[var(--color-primary)]">{data.numeroOs}</p>
          </div>
        </header>

        {feedbackMsg && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-success-light)] p-4 text-sm font-medium text-[var(--color-success-dark)]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Resumo do Status e Prazos */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-[var(--color-warning)]" />
              <div>
                <span className="text-[11px] text-[var(--color-text-muted)] uppercase">Status Atual</span>
                <div className="mt-0.5">{formatStatusBadge(data.statusAtual)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-8 w-8 text-[var(--color-secondary)]" />
              <div>
                <span className="text-[11px] text-[var(--color-text-muted)] uppercase">Data de Abertura</span>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {new Date(data.dataAbertura).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-[var(--color-success)]" />
              <div>
                <span className="text-[11px] text-[var(--color-text-muted)] uppercase">Previsão de Entrega</span>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {data.previsaoEntrega ? new Date(data.previsaoEntrega).toLocaleDateString('pt-BR') : 'Urgente'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grade de Prescrição Ótica (OD / OE) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-[var(--color-primary)]" />
              Prescrição Médica & Medidas Pupilares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-page)] text-xs text-[var(--color-text-secondary)]">
                    <th className="py-2.5 px-3 text-left">Olho</th>
                    <th className="py-2.5 px-3">Esférico</th>
                    <th className="py-2.5 px-3">Cilíndrico</th>
                    <th className="py-2.5 px-3">Eixo</th>
                    <th className="py-2.5 px-3">Adição</th>
                    <th className="py-2.5 px-3">DNP (mm)</th>
                    <th className="py-2.5 px-3">Altura (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] font-mono">
                  <tr className="hover:bg-[var(--color-bg-page)]">
                    <td className="py-3 px-3 text-left font-sans font-bold text-[var(--color-secondary-dark)]">OD (Direito)</td>
                    <td className="py-3 px-3 font-semibold">{data.od?.esferico ?? '0.00'}</td>
                    <td className="py-3 px-3">{data.od?.cilindrico ?? '0.00'}</td>
                    <td className="py-3 px-3">{data.od?.eixo ? `${data.od.eixo}°` : '—'}</td>
                    <td className="py-3 px-3">{data.od?.adicao ?? '—'}</td>
                    <td className="py-3 px-3 font-semibold text-[var(--color-text-primary)]">{data.od?.dnp ?? '—'}</td>
                    <td className="py-3 px-3 font-semibold text-[var(--color-text-primary)]">{data.od?.altura ?? '—'}</td>
                  </tr>
                  <tr className="hover:bg-[var(--color-bg-page)]">
                    <td className="py-3 px-3 text-left font-sans font-bold text-[var(--color-secondary-dark)]">OE (Esquerdo)</td>
                    <td className="py-3 px-3 font-semibold">{data.oe?.esferico ?? '0.00'}</td>
                    <td className="py-3 px-3">{data.oe?.cilindrico ?? '0.00'}</td>
                    <td className="py-3 px-3">{data.oe?.eixo ? `${data.oe.eixo}°` : '—'}</td>
                    <td className="py-3 px-3">{data.oe?.adicao ?? '—'}</td>
                    <td className="py-3 px-3 font-semibold text-[var(--color-text-primary)]">{data.oe?.dnp ?? '—'}</td>
                    <td className="py-3 px-3 font-semibold text-[var(--color-text-primary)]">{data.oe?.altura ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detalhes de Lente, Armação e Tratamentos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Especificações da Armação & Lente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-[var(--color-text-muted)]">Armação Selecionada:</span>
                <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                  {data.armacaoNome} <span className="font-mono text-xs text-[var(--color-text-secondary)]">({data.armacaoSku})</span>
                </p>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">Tipo de Lente:</span>
                <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                  {data.lenteNome} <span className="font-mono text-xs text-[var(--color-text-secondary)]">({data.lenteSku})</span>
                </p>
              </div>
              {data.observacoesLaboratorio && (
                <div className="rounded bg-[var(--color-warning-light)] p-2.5 text-[var(--color-warning-dark)] border border-[var(--color-warning)]">
                  <span className="font-semibold">Instruções de Montagem:</span>
                  <p className="mt-0.5">{data.observacoesLaboratorio}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[var(--color-warning)]" />
                Tratamentos & Benefícios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.tratamentos && data.tratamentos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.tratamentos.map((t, idx) => (
                    <span
                      key={idx}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-secondary-light)] px-3 py-1 text-xs font-semibold text-[var(--color-secondary-dark)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">Lente básica sem tratamentos adicionais.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel de Ações do Laboratório */}
        <Card className="border-2 border-[var(--color-primary)]/20 bg-gradient-to-r from-[var(--color-secondary-light)]/40 to-[var(--color-primary-light)]/40">
          <CardHeader>
            <CardTitle className="text-sm">Ações do Laboratório Ótico</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Avance o estágio do pedido para sincronizar o painel da ótica e notificar o cliente via WhatsApp.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={statusMutation.isPending || data.statusAtual === 'RETRABALHO'}
                onClick={() => statusMutation.mutate({ status: 'RETRABALHO', obs: 'Retrabalho iniciado pelo técnico de montagem' })}
                className="text-[var(--color-danger-dark)] border-[var(--color-danger)] hover:bg-[var(--color-danger-light)]"
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Sinalizar Retrabalho
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={statusMutation.isPending || data.statusAtual === 'EM_PRODUCAO'}
                onClick={() => statusMutation.mutate({ status: 'EM_PRODUCAO', obs: 'Produção e corte de lentes iniciados' })}
              >
                <Play className="mr-1.5 h-4 w-4" /> Iniciar Produção
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={statusMutation.isPending || data.statusAtual === 'LENTE_PRONTA'}
                onClick={() => statusMutation.mutate({ status: 'LENTE_PRONTA', obs: 'Lentes surfaçadas e montadas com sucesso' })}
              >
                {statusMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Marcar como Lente Pronta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
