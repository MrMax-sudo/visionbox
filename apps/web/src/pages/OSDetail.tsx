import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Glasses,
  Lock,
  Printer,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, type ApiError } from '@/lib/apiClient';
import { normalizeReceita, type OrdemServicoDTO } from '@/lib/types';
import { useAuthStore } from '@/stores/authStore';
import { sanitizeWhatsApp } from '@/stores/empresaStore';
import { StatusBadge, SlaChip } from '@/components/os/StatusBadge';
import { OsTimelineCard } from '@/components/os/OsTimeline';
import { ShareLinkDialog } from '@/components/os/ShareLinkDialog';
import { PrintingOsDialog } from '@/components/os/PrintingOsDialog';
import { ClientePanel, ProducaoPanel, ReceitaPanel } from '@/components/os/OsInfoPanels';
import {
  GRAU_OCULTO,
  clienteDe,
  fmtDateTime,
  podeLerReceita,
  podeMovimentarOS,
  podeVerGrau,
  previsaoDe,
  proximosStatus,
  resolveSla,
  shortId,
  statusText,
  type ReceitaApiResponse,
} from '@/components/os/osDomain';

export default function OSDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const perfil = useAuthStore((s) => s.user?.perfil);
  const podeMover = podeMovimentarOS(perfil);

  const [printOpen, setPrintOpen] = React.useState(false);
  const [labModalOpen, setLabModalOpen] = React.useState(false);
  const [labLink, setLabLink] = React.useState<string | null>(null);
  const [rastreioModalOpen, setRastreioModalOpen] = React.useState(false);
  const [rastreioLink, setRastreioLink] = React.useState<string | null>(null);

  /* ---------------- Queries ---------------- */

  const osQuery = useQuery({
    queryKey: ['ordem-servico', id],
    queryFn: async () => {
      const res = await apiClient.get<OrdemServicoDTO>(`/v1/ordens-servico/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 15_000,
    retry: 1,
  });

  const os = osQuery.data;
  const receitaId = os?.receitaId;
  const podeLer = podeLerReceita(perfil);

  const receitaQuery = useQuery({
    queryKey: ['receita', receitaId],
    queryFn: async () => {
      const res = await apiClient.get<ReceitaApiResponse>(`/v1/receitas/${receitaId}`);
      return normalizeReceita(res.data);
    },
    enabled: Boolean(receitaId) && podeLer,
    staleTime: 60_000,
    retry: 1,
  });

  /* ---------------- Mutations ---------------- */

  const gerarLabTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ token: string; expiraEm: string }>(
        '/v1/laboratorios/portal-tokens',
        { ordemServicoId: id, ttlMinutos: 1440 }, // 24h
      );
      return res.data;
    },
    onSuccess: (data) => {
      setLabLink(`${window.location.origin}/lab/${data.token}`);
      setLabModalOpen(true);
    },
    onError: (err: ApiError) => {
      toast({
        title: 'Não foi possível gerar o link do laboratório',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const gerarRastreioTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.get<{ token: string; url: string }>(
        `/v1/ordens-servico/${id}/rastreio-token`,
      );
      return res.data;
    },
    onSuccess: (data) => {
      setRastreioLink(`${window.location.origin}/rastreio/${data.token}`);
      setRastreioModalOpen(true);
    },
    onError: (err: ApiError) => {
      toast({
        title: 'Não foi possível gerar o link de rastreio',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const moverStatus = useMutation({
    mutationFn: async (novoStatus: string) => {
      const res = await apiClient.patch<OrdemServicoDTO>(`/v1/ordens-servico/${id}/status`, {
        novoStatus,
        responsavel: 'operador',
        observacao: 'Movido pela tela de OS',
      });
      return res.data;
    },
    onSuccess: (data, novoStatus) => {
      queryClient.setQueryData(['ordem-servico', id], data);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      toast({
        title: 'Status atualizado',
        description: `OS agora está em ${statusText(novoStatus)}.`,
        variant: 'success',
      });
    },
    onError: (err: ApiError) => {
      toast({
        title: 'Transição recusada',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  /* ---------------- Estados de carregamento/erro ---------------- */

  if (osQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Carregando ordem de serviço">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
        <span className="sr-only">Carregando ordem de serviço…</span>
      </div>
    );
  }

  if (osQuery.isError || !os) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorState error={osQuery.error} onRetry={() => osQuery.refetch()} />
      </div>
    );
  }

  const status = os.status ?? 'ORCAMENTO';
  const displayNumber = os.numero ?? shortId(os.id);
  const nextStatuses = proximosStatus(status);
  const historico = os.historico ?? [];
  const sla = resolveSla(os);
  const previsao = previsaoDe(os);
  const clienteNome = clienteDe(os);
  const verGrau = podeVerGrau(perfil);

  return (
    <div className="space-y-5">
      <OfflineBanner />
      <BackLink />

      {/* ---------------- Cabeçalho da OS ---------------- */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-primary">
                <span className="font-mono text-brand">{displayNumber}</span>
                <StatusBadge status={status} />
                <SlaChip tone={sla} />
              </h1>
              <p className="mt-1 truncate text-sm text-secondary">
                {clienteNome} • criada em {fmtDateTime(os.criadoEm)} • previsão{' '}
                {fmtDateTime(previsao)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Responsável atual: {historico[historico.length - 1]?.responsavel ?? 'sistema'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => gerarRastreioTokenMutation.mutate()}
                disabled={gerarRastreioTokenMutation.isPending}
              >
                <Share2 className="mr-2 h-4 w-4" aria-hidden /> Rastreio do Cliente
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => gerarLabTokenMutation.mutate()}
                disabled={gerarLabTokenMutation.isPending}
              >
                <Glasses className="mr-2 h-4 w-4" aria-hidden /> Link do Laboratório
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}>
                <Printer className="mr-2 h-4 w-4" aria-hidden /> Imprimir OS
              </Button>
            </div>
          </div>

          {/* ---------------- Transições de status ---------------- */}
          <div className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-secondary">
                Próxima etapa:
              </span>
              {podeMover ? (
                nextStatuses.length > 0 ? (
                  nextStatuses.map((novoStatus) => (
                    <Button
                      key={novoStatus}
                      variant={novoStatus === 'CANCELADO' ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => moverStatus.mutate(novoStatus)}
                      disabled={moverStatus.isPending}
                      className={novoStatus === 'CANCELADO' ? 'border-danger text-danger-dark' : undefined}
                    >
                      <Clock className="mr-2 h-4 w-4" aria-hidden /> {statusText(novoStatus)}
                    </Button>
                  ))
                ) : (
                  <span className="text-sm text-muted">
                    Status final — nenhuma transição disponível.
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Perfil <strong className="font-semibold text-secondary">{perfil ?? '—'}</strong>{' '}
                  somente leitura nesta OS.
                </span>
              )}
            </div>
            {moverStatus.isError && (
              <div className="mt-3">
                <ErrorState error={moverStatus.error} compact onRetry={() => moverStatus.reset()} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Timeline + dados ---------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <OsTimelineCard historico={historico} previsao={previsao} />

        <div className="space-y-4">
          <ClientePanel os={os} />
          <ReceitaPanel
            receitaId={receitaId}
            receita={receitaQuery.data}
            isLoading={receitaQuery.isLoading}
            error={receitaQuery.isError ? receitaQuery.error : null}
            onRetry={() => receitaQuery.refetch()}
            podeLer={podeLer}
            podeVerGrau={verGrau}
          />
          <ProducaoPanel os={os} />
        </div>
      </div>

      {/* ---------------- Impressão ---------------- */}
      <PrintingOsDialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        os={os}
        displayNumber={displayNumber}
        clienteNome={clienteNome}
        grauOD={receitaQuery.data ? (verGrau ? receitaQuery.data.od : GRAU_OCULTO) : undefined}
        grauOE={receitaQuery.data ? (verGrau ? receitaQuery.data.oe : GRAU_OCULTO) : undefined}
      />

      {/* ---------------- Portal do laboratório ---------------- */}
      <ShareLinkDialog
        open={labModalOpen}
        onClose={() => setLabModalOpen(false)}
        title="Link de Acesso do Laboratório Ótico"
        description="Envie este link seguro para o laboratório terceirizado acompanhar graus, armação, tratamentos e atualizar a produção."
        highlightTitle="Acesso técnico para o laboratório:"
        highlightText={
          <>
            O técnico do laboratório poderá visualizar a receita completa (OD/OE) e alterar o status
            para <b>Em Produção</b>, <b>Lente Pronta</b> ou <b>Retrabalho</b> com 1 toque.
          </>
        }
        linkLabel="URL do Portal do Laboratório (válida por 24 horas)"
        link={labLink}
        shareLabel="Enviar para o Laboratório"
        shareTitle="Abrir WhatsApp do laboratório"
        onShare={() => {
          if (!labLink) return;
          const texto = encodeURIComponent(
            `Olá, segue a OS ${displayNumber} para produção:\n${labLink}`,
          );
          window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank', 'noopener');
        }}
      />

      {/* ---------------- Portal de rastreio do cliente (US17) ---------------- */}
      <ShareLinkDialog
        open={rastreioModalOpen}
        onClose={() => setRastreioModalOpen(false)}
        title="Link de Rastreio do Cliente (PWA)"
        description="Envie este link para o cliente acompanhar as etapas da confecção dos óculos, previsão e garantia."
        highlightTitle="Portal do Cliente com Proteção LGPD:"
        highlightText={
          <>
            O cliente visualiza o semáforo de status em tempo real, etapas concluídas, previsão de
            entrega, dados da ótica e 2ª via da garantia.
          </>
        }
        linkLabel="Link de rastreio público"
        link={rastreioLink}
        shareLabel="Enviar no WhatsApp do cliente"
        shareDisabled={!os.clienteWhatsapp}
        shareTitle={os.clienteWhatsapp ? 'Abrir WhatsApp do cliente' : 'Cliente sem WhatsApp cadastrado'}
        onShare={() => {
          if (!rastreioLink) return;
          const destinatario = sanitizeWhatsApp(os.clienteWhatsapp ?? '');
          const primeiroNome = os.clienteNome ? os.clienteNome.split(' ')[0] : null;
          const texto = encodeURIComponent(
            `${primeiroNome ? `Olá ${primeiroNome}` : 'Olá'}, acompanhe o andamento da confecção dos seus óculos (OS ${displayNumber}) em tempo real pelo nosso portal:\n${rastreioLink}`,
          );
          const url = destinatario
            ? `https://wa.me/${destinatario}?text=${texto}`
            : `https://api.whatsapp.com/send?text=${texto}`;
          window.open(url, '_blank', 'noopener');
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BackLink() {
  return (
    <Link
      to="/os"
      className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-brand"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar para OS
    </Link>
  );
}
