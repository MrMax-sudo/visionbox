import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, FileClock, Package, Printer, User, Glasses, Copy, Check, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ComprovanteImpressao } from '@/components/pdv/ComprovanteImpressao';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient, type ApiError } from '@/lib/apiClient';
import { statusClass, statusLabel, type StatusOS } from '@/lib/osStatus';
import { sanitizeWhatsApp } from '@/stores/empresaStore';
import type { OrdemServicoDTO } from '@/lib/types';

const nextStatusByCurrent: Record<string, string[]> = {
  ORCAMENTO: ['PEDIDO_CONFIRMADO', 'CANCELADO'],
  PEDIDO_CONFIRMADO: ['ENVIADO_LABORATORIO', 'CANCELADO'],
  ENVIADO_LABORATORIO: ['EM_PRODUCAO'],
  EM_PRODUCAO: ['LENTE_PRONTA'],
  LENTE_PRONTA: ['MONTAGEM'],
  MONTAGEM: ['CONTROLE_QUALIDADE'],
  CONTROLE_QUALIDADE: ['PRONTO_PARA_RETIRADA', 'RETRABALHO'],
  RETRABALHO: ['EM_PRODUCAO'],
  PRONTO_PARA_RETIRADA: ['ENTREGUE'],
};

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusText(status?: string | null) {
  if (!status) return '-';
  return statusLabel[status as StatusOS] ?? status.replace(/_/g, ' ');
}

function shortId(id?: string | null) {
  if (!id) return '-';
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export default function OSDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [printOpen, setPrintOpen] = React.useState(false);

  // Lab Portal state
  const [labModalOpen, setLabModalOpen] = React.useState(false);
  const [labLink, setLabLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const gerarLabTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ token: string; expiraEm: string }>('/v1/laboratorios/portal-tokens', {
        ordemServicoId: id,
        ttlMinutos: 1440, // 24h
      });
      return res.data;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/lab/${data.token}`;
      setLabLink(link);
      setLabModalOpen(true);
    },
  });

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

  const moverStatus = useMutation({
    mutationFn: async (novoStatus: string) => {
      const res = await apiClient.patch<OrdemServicoDTO>(`/v1/ordens-servico/${id}/status`, {
        novoStatus,
        responsavel: 'operador',
        observacao: 'Movido pela tela de OS',
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['ordem-servico', id], data);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
    },
  });

  if (osQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (osQuery.isError || !osQuery.data) {
    return <ErrorState error={osQuery.error as ApiError} onRetry={() => osQuery.refetch()} />;
  }

  const os = osQuery.data;
  const displayNumber = os.numero ?? shortId(os.id);
  const status = os.status ?? 'ORCAMENTO';
  const nextStatuses = nextStatusByCurrent[status] ?? [];
  const historico = os.historico ?? [];

  return (
    <div className="space-y-5">
      <OfflineBanner />
      <Link to="/os" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]">
        <ArrowLeft className="h-4 w-4" /> Voltar para OS
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-[var(--color-text-primary)]">
            <span className="font-mono text-[var(--color-primary)]">{displayNumber}</span>
            <span className={`badge ${statusClass[status as StatusOS] ?? 'status-orcamento'} rounded-full px-2.5 py-0.5 text-xs`}>
              {statusText(status)}
            </span>
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Criada em {fmtDate(os.criadoEm)} • previsão {fmtDate(os.previsaoEntrega ?? os.previsao)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => gerarLabTokenMutation.mutate()}
            disabled={gerarLabTokenMutation.isPending}
            className="text-[var(--color-secondary-dark)] border-[var(--color-border)] hover:bg-[var(--color-bg-card-soft)]"
          >
            <Glasses className="mr-2 h-4 w-4" /> Link do Laboratório
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintOpen(true)}
          >
            <Printer className="mr-2 h-4 w-4" /> Imprimir OS
          </Button>
          {nextStatuses.map((novoStatus) => (
            <Button
              key={novoStatus}
              variant={novoStatus === 'CANCELADO' ? 'outline' : 'primary'}
              size="sm"
              onClick={() => moverStatus.mutate(novoStatus)}
              disabled={moverStatus.isPending}
            >
              <Clock className="mr-2 h-4 w-4" /> {statusText(novoStatus)}
            </Button>
          ))}
        </div>
      </div>

      {moverStatus.isError && <ErrorState error={moverStatus.error as ApiError} compact />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileClock className="h-4 w-4" /> Timeline da OS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                Nenhum evento registrado para esta OS.
              </p>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-[var(--color-border)]" />
                {historico.map((ev, index) => (
                  <div key={ev.id ?? index} className="relative pb-6 last:pb-0">
                    <span
                      className={`absolute -left-1 top-1 h-3 w-3 rounded-full border-2 border-[var(--color-bg-card)] ${
                        index === historico.length - 1 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]'
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[11px]">{fmtDate(ev.dataHora)}</Badge>
                      <span className={`badge ${statusClass[ev.statusNovo as StatusOS] ?? 'status-orcamento'} rounded-full px-2 py-0.5 text-[11px]`}>
                        {statusText(ev.statusNovo)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">por {ev.responsavel ?? 'sistema'}</span>
                    </div>
                    {ev.observacao && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{ev.observacao}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4" /> Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--color-text-secondary)]">Cliente</span>
                <span className="truncate text-[var(--color-text-primary)]">{os.clienteNome ?? shortId(os.clienteId)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--color-text-secondary)]">WhatsApp</span>
                <span className="font-mono text-xs text-[var(--color-text-primary)]">{os.clienteWhatsapp ?? '-'}</span>
              </div>
              {os.receitaId && (
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--color-text-secondary)]">Receita</span>
                  <span className="font-mono text-xs text-[var(--color-text-primary)]">{shortId(os.receitaId)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4" /> Produção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[var(--color-text-secondary)]">Armação</span>
                <span className="font-mono text-xs text-[var(--color-text-primary)]">{shortId(os.armacaoId)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--color-text-secondary)]">Lente</span>
                <span className="font-mono text-xs text-[var(--color-text-primary)]">{shortId(os.lenteId)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[var(--color-text-secondary)]">Laboratório</span>
                <span className="font-mono text-xs text-[var(--color-text-primary)]">{shortId(os.laboratorioId)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Impressão da OS */}
      <Dialog
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={`Impressão da Ordem de Serviço ${displayNumber}`}
        description="Via pronta para impressão térmica ou A4 para a ótica e laboratório."
      >
        <ComprovanteImpressao
          tipo="os"
          osNumero={displayNumber}
          clienteNome={`Cliente #${shortId(os.clienteId)}`}
          data={os.criadoEm}
          itens={[
            ...(os.armacaoId ? [{ sku: 'ARM', nome: `Armação (${shortId(os.armacaoId)})`, qtd: 1, preco: 0 }] : []),
            ...(os.lenteId ? [{ sku: 'LNT', nome: `Lente Oftálmica (${shortId(os.lenteId)})`, qtd: 1, preco: 0 }] : []),
          ]}
          subtotal={0}
          desconto={0}
          total={0}
          formaPagamento="Consultar Financeiro"
        />
      </Dialog>

      {/* Modal de Compartilhamento do Portal do Laboratório */}
      <Dialog
        open={labModalOpen}
        onClose={() => setLabModalOpen(false)}
        title="Link de Acesso do Laboratório Ótico"
        description="Envie este link seguro para o laboratório acompanhar graus, armação, tratamentos e atualizar a produção."
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-secondary-light)]/60 p-3 text-xs space-y-1 text-[var(--color-text-primary)]">
            <p className="font-semibold">Acesso sem necessidade de login:</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              O técnico do laboratório poderá visualizar a receita completa (OD/OE) e alterar o status para <b>Em Produção</b>, <b>Lente Pronta</b> ou <b>Retrabalho</b> com 1 toque.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">URL do Portal (Válido por 24 horas)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={labLink ?? ''}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-2 text-xs font-mono text-[var(--color-text-primary)]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (labLink) {
                    navigator.clipboard.writeText(labLink);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[var(--color-border)]">
            <Button
              variant="outline"
              onClick={() => setLabModalOpen(false)}
            >
              Fechar
            </Button>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  if (labLink) {
                    const destinatario = sanitizeWhatsApp(os.clienteWhatsapp ?? '');
                    const texto = encodeURIComponent(`Olá, segue o link de acompanhamento da sua OS ${displayNumber}:\n${labLink}`);
                    const url = destinatario ? `https://wa.me/${destinatario}?text=${texto}` : `https://api.whatsapp.com/send?text=${texto}`;
                    window.open(url, '_blank');
                  }
                }}
                disabled={!os.clienteWhatsapp}
                title={os.clienteWhatsapp ? 'Abrir WhatsApp do cliente' : 'Cliente sem WhatsApp cadastrado'}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Share2 className="mr-2 h-4 w-4" /> Enviar no WhatsApp do cliente
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
