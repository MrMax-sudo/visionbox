import * as React from 'react';
import { ShieldAlert, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost, ApiError } from '@/lib/apiClient';

interface AutorizacaoDescontoModalProps {
  open: boolean;
  onClose: () => void;
  percentualDesconto: number;
  valorDesconto: number;
  subtotal: number;
  onAutorizado: (supervisorNome: string, pin: string) => void;
}

/**
 * Resposta de POST /api/v1/autorizacoes-desconto (P7).
 * Autorizado via PIN retorna identificação de quem autorizou (GERENTE/ADMIN).
 */
type AutorizacaoDescontoResponse = {
  autorizado: boolean;
  exigePin: boolean;
  descontoPercentual: number;
  limiteSemPinPercentual: number;
  mensagem?: string | null;
  autorizadoPorId?: string | null;
  autorizadoPorNome?: string | null;
  autorizadoPorPerfil?: string | null;
};

/**
 * Alçada de Desconto — P7.
 * A validação do PIN agora é feita NO BACKEND (endpoint autenticado com rate-limit),
 * nunca mais contra lista local hardcoded (D-007). O backend identifica o
 * GERENTE/ADMIN que autorizou e devolve o nome para o comprovante.
 */
export function AutorizacaoDescontoModal({
  open,
  onClose,
  percentualDesconto,
  valorDesconto,
  subtotal,
  onAutorizado,
}: AutorizacaoDescontoModalProps) {
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSenha('');
      setErro(null);
      setIsLoading(false);
    }
  }, [open]);

  async function handleConfirmar() {
    if (isLoading) return;

    const pin = senha.trim();

    if (!pin) {
      setErro('Informe a senha de liberação do gerente.');
      return;
    }

    if (pin.length < 4) {
      setErro('O PIN gerencial deve ter pelo menos 4 caracteres.');
      return;
    }

    setErro(null);
    setIsLoading(true);
    try {
      const resp = await apiPost<AutorizacaoDescontoResponse>('/v1/autorizacoes-desconto', {
        descontoPercentual: Number(percentualDesconto.toFixed(2)),
        senha: pin,
      });

      if (resp.autorizado) {
        const autorizadoPor = resp.autorizadoPorNome ?? 'Gerente';
        setSenha('');
        onAutorizado(autorizadoPor, pin);
      } else {
        // 200 com autorizado=false: PIN inválido — mensagem genérica vem do backend
        setErro(resp.mensagem || 'Autorização negada.');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (!apiErr.status) {
        // sem rede: alçada NÃO é validada offline (exigiria PIN local — proibido, D-010)
        setErro('Sem conexão com o servidor. A autorização de desconto exige validação online (PIN gerencial).');
      } else {
        // 429 (rate-limit) e 400 de validação vêm como ProblemDetail (RFC 7807)
        setErro(apiErr.problem?.detail || apiErr.message || 'Falha ao processar a autorização.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Alçada de Desconto Excedida"
      description="Descontos acima de 15% exigem autorização expressa do gerente ou supervisor de loja."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-[var(--color-warning-light)] p-3 text-xs text-[var(--color-warning-dark)] border border-[var(--color-warning)]">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Solicitação de Desconto Especial ({percentualDesconto.toFixed(1)}%)</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              Subtotal: <b>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b> •
              Desconto: <b className="text-[var(--color-danger-dark)]">{valorDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              A autorização é validada no servidor e registrada em auditoria (quem autorizou, quando e %).
            </p>
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-danger-light)] p-2.5 text-xs text-[var(--color-danger-dark)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-[var(--color-text-primary)]">Senha de Autorização (Gerente/Admin)</label>
          <div className="relative mt-1">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <Input
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmar();
              }}
              placeholder="Digite o PIN gerencial"
              className="pl-9"
              autoFocus
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar Desconto
          </Button>
          <Button variant="primary" onClick={handleConfirmar} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {isLoading ? 'Validando...' : 'Autorizar e Concluir'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}