import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/toast';
import { useToast } from '@/components/ui/use-toast';
import { PortalOffline } from '@/components/portal/PortalChrome';
import {
  LabAcoes,
  LabEspecificacoes,
  LabEtapasProducao,
  LabHeader,
  LabPrescricao,
  LabResumo,
  type LabPortalDetalhes,
} from '@/components/portal/LabFicha';
import { apiClient, ApiError } from '@/lib/apiClient';

/**
 * Portal do Laboratório (público, /lab/:token — token HMAC vlab1).
 *
 * ONDA 2E: UI reescrita com kit + tokens; contrato intocado:
 *  - GET  /v1/laboratorios/portal/{token}
 *  - PATCH /v1/laboratorios/portal/{token}/status  { status, observacao }
 * Feedback via toast (Toaster montado localmente — a rota é pública e não
 * passa pelo AppShell, que é onde o Toaster raiz vive).
 */

function LabSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" aria-busy="true" aria-label="Carregando ficha do laboratório">
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
      <Skeleton className="h-56 w-full rounded-card" />
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}

export default function LabPortal() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery<LabPortalDetalhes>({
    // token sempre presente na rota /lab/:token; guardia defensivo abaixo cobre ausência
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
    mutationFn: async ({ status, obs }: { status: string; obs: string }) => {
      if (!token) throw new Error('Token ausente');
      await apiClient.patch(`/v1/laboratorios/portal/${token}/status`, {
        status,
        observacao: obs || `Atualizado via Portal do Laboratório em ${new Date().toLocaleString('pt-BR')}`,
      });
    },
    onSuccess: (_, vars) => {
      toast({
        variant: 'success',
        title: 'Status atualizado',
        description: `A OS agora está em "${vars.status}". O painel da ótica foi sincronizado.`,
      });
      queryClient.invalidateQueries({ queryKey: ['lab-portal', token] });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível atualizar o status',
        description: err instanceof ApiError ? err.message : 'Tente novamente em instantes.',
      });
    },
  });

  function handleStatus(status: string, obs: string) {
    statusMutation.mutate({ status, obs });
  }

  return (
    <div className="min-h-dvh bg-page py-8 px-4 sm:px-6 lg:px-8">
      {/* Toaster local: esta rota pública não monta o AppShell. */}
      <Toaster />

      <div className="mx-auto w-full max-w-4xl space-y-6">
        {isLoading && <LabSkeleton />}

        {(isError || (!isLoading && !data)) && (
          <div className="mx-auto w-full max-w-md space-y-3">
            <ErrorState error={new ApiError('Não foi possível abrir esta ficha técnica.')} onRetry={() => void refetch()} />
            <p className="text-center text-xs text-secondary">
              O token de acesso deste laboratório expirou ou a ordem de serviço já foi concluída.
              Entre em contato com a ótica para emitir um novo link.
            </p>
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            <LabHeader numeroOs={data.numeroOs} />
            <PortalOffline mensagem="Sem conexão — a ficha pode estar desatualizada. Verifique a rede antes de avançar o status." />
            <LabResumo dados={data} />
            <LabEtapasProducao status={data.statusAtual} />
            <LabPrescricao dados={data} />
            <LabEspecificacoes dados={data} />
            <LabAcoes
              statusAtual={data.statusAtual}
              isPending={statusMutation.isPending}
              onStatus={handleStatus}
            />
            <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-muted">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Acesso restrito ao laboratório parceiro. Não compartilhe este link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
