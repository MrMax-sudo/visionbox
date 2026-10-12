import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';

import { useAuthStore } from '@/stores/authStore';

export interface CaixaMovimento {
  id: string;
  tipo:
    | 'ABERTURA'
    | 'SUPRIMENTO'
    | 'SANGRIA'
    | 'VENDA_DINHEIRO'
    | 'VENDA_OUTROS'
    | 'ESTORNO'
    | 'FECHAMENTO';
  valor: number;
  formaPagamento?: string;
  motivo?: string;
  usuarioNome?: string;
  criadoEm: string;
}

export interface CaixaSessao {
  id: string;
  lojaId: string;
  usuarioId: string;
  operadorNome?: string;
  identificacaoCaixa: string;
  status: 'ABERTO' | 'FECHADO';
  abertoEm: string;
  fechadoEm?: string;
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoEsperado: number;
  saldoInformadoFechamento?: number;
  diferencaFechamento?: number;
  observacaoFechamento?: string;
  movimentos: CaixaMovimento[];
}

interface ControleCaixaModalProps {
  open: boolean;
  onClose: () => void;
}

type Aba = 'status' | 'abrir' | 'suprimento' | 'sangria' | 'fechar';

function mensagemErro(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.problem?.title || err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

const abaTriggerCls =
  'rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-xs font-semibold text-muted shadow-none transition-colors ' +
  'data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary ' +
  'data-[state=inactive]:hover:text-primary';

/**
 * Controle de Caixa Físico (PDV) — ONDA 2A.
 * Abertura, suprimento, sangria e fechamento cego inalterados; a camada visual
 * passou a UI kit (Tabs/Field/Skeleton/EmptyState/ErrorState + toasts).
 * Correção de estado: a query agora propaga erro de rede (antes virava “Caixa
 * Fechado” silencioso, levando o operador a reabrir uma sessão já aberta).
 */
export function ControleCaixaModal({ open, onClose }: ControleCaixaModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = React.useState<Aba>('status');

  // Form states — sem valores inventados; operador vem do login real
  const [saldoInicialInput, setSaldoInicialInput] = React.useState('');
  const [operadorNomeInput, setOperadorNomeInput] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setOperadorNomeInput(user?.nome || '');
      setSaldoInicialInput('');
      setFormError(null);
    }
  }, [open, user]);

  const [valorMovimentoInput, setValorMovimentoInput] = React.useState('');
  const [motivoMovimentoInput, setMotivoMovimentoInput] = React.useState('');
  const [saldoFechamentoInput, setSaldoFechamentoInput] = React.useState('');
  const [obsFechamentoInput, setObsFechamentoInput] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    data: caixaAtual,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CaixaSessao | null>({
    queryKey: ['caixa-status-atual'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CaixaSessao>('/v1/caixa/status-atual');
        return res.data || null;
      } catch (err) {
        // Sem sessão (204/404) = caixa fechado; qualquer outro erro (rede/5xx)
        // deve chegar à UI como erro — não como "caixa fechado".
        if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return null;
        throw err;
      }
    },
    enabled: open,
  });

  const abrirMutation = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(saldoInicialInput.replace(',', '.'));
      if (isNaN(valor) || valor < 0) throw new Error('Saldo inicial inválido');
      const res = await apiClient.post<CaixaSessao>('/v1/caixa/abrir', {
        saldoInicial: valor,
        identificacaoCaixa: 'CAIXA_01',
        operadorNome: operadorNomeInput || 'Operador',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-status-atual'] });
      setTab('status');
      setFormError(null);
      const fundo = parseFloat(saldoInicialInput.replace(',', '.')) || 0;
      toast({
        title: 'Caixa aberto',
        description: `Fundo de troco: ${formatBRL(fundo)}`,
      });
    },
    onError: (err) => {
      setFormError(mensagemErro(err, 'Erro ao abrir caixa'));
    },
  });

  const movimentoMutation = useMutation({
    mutationFn: async ({ tipo }: { tipo: 'SUPRIMENTO' | 'SANGRIA' }) => {
      const valor = parseFloat(valorMovimentoInput.replace(',', '.'));
      if (isNaN(valor) || valor <= 0) throw new Error('Valor da movimentação inválido');
      if (!motivoMovimentoInput.trim()) throw new Error('Motivo da movimentação é obrigatório');
      const res = await apiClient.post<CaixaSessao>('/v1/caixa/movimentar', {
        tipo,
        valor,
        motivo: motivoMovimentoInput,
        formaPagamento: 'DINHEIRO',
        usuarioNome: operadorNomeInput || 'Operador',
      });
      return res.data;
    },
    onSuccess: (sessao, vars) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-status-atual'] });
      setTab('status');
      setValorMovimentoInput('');
      setMotivoMovimentoInput('');
      setFormError(null);
      const valor = parseFloat(valorMovimentoInput.replace(',', '.')) || 0;
      toast({
        title: vars.tipo === 'SANGRIA' ? 'Sangria registrada' : 'Suprimento registrado',
        description: `${formatBRL(valor)} — saldo esperado ${formatBRL(sessao.saldoEsperado)}`,
      });
    },
    onError: (err) => {
      setFormError(mensagemErro(err, 'Erro ao movimentar caixa'));
    },
  });

  const fecharMutation = useMutation({
    mutationFn: async () => {
      const valor = parseFloat(saldoFechamentoInput.replace(',', '.'));
      if (isNaN(valor) || valor < 0) throw new Error('Valor conferido inválido');
      const res = await apiClient.post<CaixaSessao>('/v1/caixa/fechar', {
        saldoInformado: valor,
        observacao: obsFechamentoInput,
      });
      return res.data;
    },
    onSuccess: (sessao) => {
      queryClient.invalidateQueries({ queryKey: ['caixa-status-atual'] });
      setTab('status');
      setSaldoFechamentoInput('');
      setObsFechamentoInput('');
      setFormError(null);
      const dif = sessao.diferencaFechamento;
      toast({
        title: 'Caixa fechado',
        description:
          dif === undefined || dif === null
            ? 'Sessão encerrada.'
            : `Diferença de conferência: ${formatBRL(dif)}`,
      });
    },
    onError: (err) => {
      setFormError(mensagemErro(err, 'Erro ao fechar caixa'));
    },
  });

  const isAberto = caixaAtual && caixaAtual.status === 'ABERTO';

  function formatBRL(val?: number) {
    return (val ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Controle de Caixa Físico (PDV)"
      description="Gerencie abertura, sangrias, suprimentos e conferência cega de fechamento."
      className="max-w-[640px]"
    >
      <div className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-card border border-danger-light bg-danger-light p-3 text-xs text-danger-dark"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}

        {/* Barra de Status Rápida */}
        {isLoading ? (
          <div
            className="flex items-center justify-between rounded-card border border-border bg-page p-3"
            aria-busy="true"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
            <span className="sr-only">Carregando status do caixa…</span>
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <div className="flex items-center justify-between rounded-card border border-border bg-page p-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isAberto
                    ? 'bg-success-light text-success-dark'
                    : 'bg-danger-light text-danger-dark'
                }`}
                aria-hidden
              >
                {isAberto ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">
                  {isAberto ? 'Caixa Aberto' : 'Caixa Fechado'}
                </p>
                <p className="text-xs text-secondary">
                  {isAberto
                    ? `Aberto em ${new Date(caixaAtual.abertoEm).toLocaleTimeString('pt-BR')} por ${
                        caixaAtual.operadorNome || 'Operador'
                      }`
                    : 'Nenhuma sessão em andamento'}
                </p>
              </div>
            </div>
            {isAberto && (
              <div className="text-right">
                <span className="text-xs text-muted">Saldo em Caixa</span>
                <p className="font-mono text-base font-bold text-success">
                  {formatBRL(caixaAtual.saldoEsperado)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Abas de Ações */}
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as Aba);
            setFormError(null);
          }}
        >
          <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="status" className={abaTriggerCls}>
              Resumo &amp; Histórico
            </TabsTrigger>
            {!isAberto && (
              <TabsTrigger value="abrir" className={abaTriggerCls}>
                Abrir Caixa
              </TabsTrigger>
            )}
            {isAberto && (
              <>
                <TabsTrigger value="suprimento" className={abaTriggerCls}>
                  + Suprimento (Troco)
                </TabsTrigger>
                <TabsTrigger value="sangria" className={abaTriggerCls}>
                  - Sangria (Retirada)
                </TabsTrigger>
                <TabsTrigger value="fechar" className={abaTriggerCls}>
                  Fechar Caixa
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Tab: Status */}
          <TabsContent value="status" className="mt-3">
            {isAberto ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded border border-border bg-card p-2">
                    <span className="text-[10px] uppercase text-muted">Fundo Inicial</span>
                    <p className="font-mono text-xs font-semibold">
                      {formatBRL(caixaAtual.saldoInicial)}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-card p-2">
                    <span className="text-[10px] uppercase text-muted">+ Entradas</span>
                    <p className="font-mono text-xs font-semibold text-success">
                      {formatBRL(caixaAtual.totalEntradas)}
                    </p>
                  </div>
                  <div className="rounded border border-border bg-card p-2">
                    <span className="text-[10px] uppercase text-muted">- Saídas/Sangrias</span>
                    <p className="font-mono text-xs font-semibold text-danger">
                      {formatBRL(caixaAtual.totalSaidas)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-secondary">Últimos Movimentos:</p>
                  <div className="max-h-40 divide-y divide-border overflow-y-auto rounded border border-border text-xs">
                    {caixaAtual.movimentos && caixaAtual.movimentos.length > 0 ? (
                      caixaAtual.movimentos.map((m) => {
                        const entrada =
                          m.tipo === 'SUPRIMENTO' || m.tipo === 'ABERTURA' || m.tipo.startsWith('VENDA');
                        return (
                          <div key={m.id} className="flex items-center justify-between p-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {entrada ? (
                                <ArrowDownCircle className="h-4 w-4 shrink-0 text-success" aria-hidden />
                              ) : (
                                <ArrowUpCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium">{m.motivo || m.tipo}</p>
                                <p className="text-[10px] text-muted">
                                  {new Date(m.criadoEm).toLocaleTimeString('pt-BR')} •{' '}
                                  {m.formaPagamento || 'DINHEIRO'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 font-mono font-semibold ${
                                m.tipo === 'SANGRIA' ? 'text-danger' : 'text-success'
                              }`}
                            >
                              {m.tipo === 'SANGRIA' ? `- ${formatBRL(m.valor)}` : `+ ${formatBRL(m.valor)}`}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="p-3 text-center text-xs text-muted">
                        Nenhum movimento registrado nesta sessão.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Banknote}
                title="O caixa está fechado"
                description="Abra o caixa com um fundo de troco para liberar as operações de venda no PDV."
                action={<Button onClick={() => setTab('abrir')}>Abrir Caixa Agora</Button>}
              />
            )}
          </TabsContent>

          {/* Tab: Abrir */}
          <TabsContent value="abrir" className="mt-3">
            <div className="space-y-3">
              <Field
                label="Fundo de Troco Inicial (R$)"
                id="pdv-caixa-saldo-inicial"
                hint="Valor físico em gaveta na abertura."
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoInicialInput}
                  onChange={(e) => setSaldoInicialInput(e.target.value)}
                  placeholder="0.00"
                  className="font-mono"
                />
              </Field>
              <Field label="Operador Responsável" id="pdv-caixa-operador">
                <Input
                  type="text"
                  value={operadorNomeInput}
                  onChange={(e) => setOperadorNomeInput(e.target.value)}
                  placeholder="Nome do operador"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="outline" onClick={() => setTab('status')}>
                  Cancelar
                </Button>
                <Button disabled={abrirMutation.isPending} onClick={() => abrirMutation.mutate()}>
                  {abrirMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Confirmar Abertura
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Suprimento */}
          <TabsContent value="suprimento" className="mt-3">
            <div className="space-y-3">
              <Field
                label="Valor do Reforço / Suprimento (R$)"
                id="pdv-caixa-valor-suprimento"
                hint="Entrada de dinheiro para troco."
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorMovimentoInput}
                  onChange={(e) => setValorMovimentoInput(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="font-mono"
                />
              </Field>
              <Field label="Motivo / Justificativa" id="pdv-caixa-motivo-suprimento" required>
                <Input
                  type="text"
                  value={motivoMovimentoInput}
                  onChange={(e) => setMotivoMovimentoInput(e.target.value)}
                  placeholder="Ex: Reforço de moedas e notas de R$ 5"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="outline" onClick={() => setTab('status')}>
                  Cancelar
                </Button>
                <Button
                  disabled={movimentoMutation.isPending}
                  onClick={() => movimentoMutation.mutate({ tipo: 'SUPRIMENTO' })}
                >
                  {movimentoMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Registrar Suprimento
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Sangria */}
          <TabsContent value="sangria" className="mt-3">
            <div className="space-y-3">
              <Field
                label="Valor da Retirada / Sangria (R$)"
                id="pdv-caixa-valor-sangria"
                hint="Recolhimento para cofre."
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorMovimentoInput}
                  onChange={(e) => setValorMovimentoInput(e.target.value)}
                  placeholder="Ex: 200.00"
                  className="font-mono"
                />
              </Field>
              <Field label="Motivo do Recolhimento" id="pdv-caixa-motivo-sangria" required>
                <Input
                  type="text"
                  value={motivoMovimentoInput}
                  onChange={(e) => setMotivoMovimentoInput(e.target.value)}
                  placeholder="Ex: Sangria para cofre principal / pagamento fornecedor"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="outline" onClick={() => setTab('status')}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={movimentoMutation.isPending}
                  onClick={() => movimentoMutation.mutate({ tipo: 'SANGRIA' })}
                >
                  {movimentoMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Confirmar Sangria
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tab: Fechar */}
          <TabsContent value="fechar" className="mt-3">
            <div className="space-y-3">
              <div className="rounded-card border border-warning bg-warning-light p-3 text-xs text-warning-dark">
                <p className="font-semibold">Conferência Cega de Valores</p>
                <p className="mt-0.5 text-[11px]">
                  Conte o dinheiro físico na gaveta e digite o valor exato. O sistema irá registrar
                  qualquer eventual sobra ou falta.
                </p>
              </div>
              <Field
                label="Total em Dinheiro Físico Contado (R$)"
                id="pdv-caixa-saldo-fechamento"
                hint="Contagem cega: o sistema compara com o saldo esperado."
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={saldoFechamentoInput}
                  onChange={(e) => setSaldoFechamentoInput(e.target.value)}
                  placeholder="Ex: 450.00"
                  className="font-mono"
                />
              </Field>
              <Field label="Observações do Fechamento" id="pdv-caixa-obs-fechamento">
                <Input
                  type="text"
                  value={obsFechamentoInput}
                  onChange={(e) => setObsFechamentoInput(e.target.value)}
                  placeholder="Ex: Troco correto, comprovantes arquivados"
                />
              </Field>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="outline" onClick={() => setTab('status')}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={fecharMutation.isPending}
                  onClick={() => fecharMutation.mutate()}
                >
                  {fecharMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Fechar Caixa Agora
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar Janela
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
