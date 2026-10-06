import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Receipt,
  FileText
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/apiClient';

export interface CaixaMovimento {
  id: string;
  tipo: 'ABERTURA' | 'SUPRIMENTO' | 'SANGRIA' | 'VENDA_DINHEIRO' | 'VENDA_OUTROS' | 'ESTORNO' | 'FECHAMENTO';
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

export function ControleCaixaModal({ open, onClose }: ControleCaixaModalProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<'status' | 'abrir' | 'suprimento' | 'sangria' | 'fechar'>('status');

  // Form states
  const [saldoInicialInput, setSaldoInicialInput] = React.useState('100.00');
  const [operadorNomeInput, setOperadorNomeInput] = React.useState('Operador PDV');
  const [valorMovimentoInput, setValorMovimentoInput] = React.useState('');
  const [motivoMovimentoInput, setMotivoMovimentoInput] = React.useState('');
  const [saldoFechamentoInput, setSaldoFechamentoInput] = React.useState('');
  const [obsFechamentoInput, setObsFechamentoInput] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: caixaAtual, isLoading, refetch } = useQuery<CaixaSessao | null>({
    queryKey: ['caixa-status-atual'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<CaixaSessao>('/v1/caixa/status-atual');
        return res.data || null;
      } catch (err: any) {
        if (err.response?.status === 204 || err.response?.status === 404) return null;
        return null;
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
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Erro ao abrir caixa');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-status-atual'] });
      setTab('status');
      setValorMovimentoInput('');
      setMotivoMovimentoInput('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Erro ao movimentar caixa');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-status-atual'] });
      setTab('status');
      setSaldoFechamentoInput('');
      setObsFechamentoInput('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Erro ao fechar caixa');
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
    >
      <div className="space-y-4">
        {formError && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-danger-light)] p-3 text-xs text-[var(--color-danger-dark)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Barra de Status Rápida */}
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)] p-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isAberto ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isAberto ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {isAberto ? 'Caixa Aberto' : 'Caixa Fechado'}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {isAberto ? `Aberto em ${new Date(caixaAtual.abertoEm).toLocaleTimeString('pt-BR')} por ${caixaAtual.operadorNome || 'Operador'}` : 'Nenhuma sessão em andamento'}
              </p>
            </div>
          </div>
          {isAberto && (
            <div className="text-right">
              <span className="text-xs text-[var(--color-text-muted)]">Saldo em Caixa</span>
              <p className="text-base font-bold text-emerald-600 font-mono">
                {formatBRL(caixaAtual.saldoEsperado)}
              </p>
            </div>
          )}
        </div>

        {/* Abas de Ações */}
        <div className="flex border-b border-[var(--color-border)]">
          <button
            type="button"
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${tab === 'status' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
            onClick={() => { setTab('status'); setFormError(null); }}
          >
            Resumo & Histórico
          </button>
          {!isAberto && (
            <button
              type="button"
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${tab === 'abrir' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
              onClick={() => { setTab('abrir'); setFormError(null); }}
            >
              Abrir Caixa
            </button>
          )}
          {isAberto && (
            <>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${tab === 'suprimento' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => { setTab('suprimento'); setFormError(null); }}
              >
                + Suprimento (Troco)
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${tab === 'sangria' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => { setTab('sangria'); setFormError(null); }}
              >
                - Sangria (Retirada)
              </button>
              <button
                type="button"
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${tab === 'fechar' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
                onClick={() => { setTab('fechar'); setFormError(null); }}
              >
                Fechar Caixa
              </button>
            </>
          )}
        </div>

        {/* Tab: Status */}
        {tab === 'status' && (
          <div className="space-y-3">
            {isAberto ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded border border-[var(--color-border)] p-2 bg-[var(--color-bg-card)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase">Fundo Inicial</span>
                    <p className="text-xs font-semibold font-mono">{formatBRL(caixaAtual.saldoInicial)}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] p-2 bg-[var(--color-bg-card)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase">+ Entradas</span>
                    <p className="text-xs font-semibold text-emerald-600 font-mono">{formatBRL(caixaAtual.totalEntradas)}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] p-2 bg-[var(--color-bg-card)]">
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase">- Saídas/Sangrias</span>
                    <p className="text-xs font-semibold text-red-600 font-mono">{formatBRL(caixaAtual.totalSaidas)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Últimos Movimentos:</p>
                  <div className="max-h-40 overflow-y-auto rounded border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-xs">
                    {caixaAtual.movimentos && caixaAtual.movimentos.length > 0 ? (
                      caixaAtual.movimentos.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            {m.tipo === 'SUPRIMENTO' || m.tipo === 'ABERTURA' || m.tipo.startsWith('VENDA') ? (
                              <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <ArrowUpCircle className="h-4 w-4 text-red-600" />
                            )}
                            <div>
                              <p className="font-medium">{m.motivo || m.tipo}</p>
                              <p className="text-[10px] text-[var(--color-text-muted)]">
                                {new Date(m.criadoEm).toLocaleTimeString('pt-BR')} • {m.formaPagamento || 'DINHEIRO'}
                              </p>
                            </div>
                          </div>
                          <span className={`font-mono font-semibold ${m.tipo === 'SANGRIA' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {m.tipo === 'SANGRIA' ? `- ${formatBRL(m.valor)}` : `+ ${formatBRL(m.valor)}`}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="p-3 text-center text-xs text-[var(--color-text-muted)]">Nenhum movimento registrado nesta sessão.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center space-y-3">
                <Banknote className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">O caixa está fechado</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Abra o caixa com um fundo de troco para liberar as operações de venda no PDV.
                  </p>
                </div>
                <Button variant="primary" onClick={() => setTab('abrir')}>
                  Abrir Caixa Agora
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Abrir */}
        {tab === 'abrir' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Fundo de Troco Inicial (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={saldoInicialInput}
                onChange={(e) => setSaldoInicialInput(e.target.value)}
                placeholder="Ex: 100.00"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Operador Responsável</label>
              <Input
                type="text"
                value={operadorNomeInput}
                onChange={(e) => setOperadorNomeInput(e.target.value)}
                placeholder="Nome do operador"
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button variant="outline" onClick={() => setTab('status')}>Cancelar</Button>
              <Button
                variant="primary"
                disabled={abrirMutation.isPending}
                onClick={() => abrirMutation.mutate()}
              >
                {abrirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Abertura
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Suprimento */}
        {tab === 'suprimento' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Valor do Reforço / Suprimento (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={valorMovimentoInput}
                onChange={(e) => setValorMovimentoInput(e.target.value)}
                placeholder="Ex: 50.00"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Motivo / Justificativa</label>
              <Input
                type="text"
                value={motivoMovimentoInput}
                onChange={(e) => setMotivoMovimentoInput(e.target.value)}
                placeholder="Ex: Reforço de moedas e notas de R$ 5"
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button variant="outline" onClick={() => setTab('status')}>Cancelar</Button>
              <Button
                variant="primary"
                disabled={movimentoMutation.isPending}
                onClick={() => movimentoMutation.mutate({ tipo: 'SUPRIMENTO' })}
              >
                {movimentoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Suprimento
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Sangria */}
        {tab === 'sangria' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Valor da Retirada / Sangria (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={valorMovimentoInput}
                onChange={(e) => setValorMovimentoInput(e.target.value)}
                placeholder="Ex: 200.00"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Motivo do Recolhimento</label>
              <Input
                type="text"
                value={motivoMovimentoInput}
                onChange={(e) => setMotivoMovimentoInput(e.target.value)}
                placeholder="Ex: Sangria para cofre principal / pagamento fornecedor"
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button variant="outline" onClick={() => setTab('status')}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={movimentoMutation.isPending}
                onClick={() => movimentoMutation.mutate({ tipo: 'SANGRIA' })}
              >
                {movimentoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Sangria
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Fechar */}
        {tab === 'fechar' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
              <p className="font-semibold">Conferência Cega de Valores</p>
              <p className="text-[11px] mt-0.5">
                Conte o dinheiro físico na gaveta e digite o valor exato. O sistema irá registrar qualquer eventual sobra ou falta.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Total em Dinheiro Físico Contado (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={saldoFechamentoInput}
                onChange={(e) => setSaldoFechamentoInput(e.target.value)}
                placeholder="Ex: 450.00"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-primary)]">Observações do Fechamento</label>
              <Input
                type="text"
                value={obsFechamentoInput}
                onChange={(e) => setObsFechamentoInput(e.target.value)}
                placeholder="Ex: Troco correto, comprovantes arquivados"
                className="mt-1 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <Button variant="outline" onClick={() => setTab('status')}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={fecharMutation.isPending}
                onClick={() => fecharMutation.mutate()}
              >
                {fecharMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fechar Caixa Agora
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-[var(--color-border)] pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar Janela
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
