import * as React from 'react';
import { ShieldAlert, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AutorizacaoDescontoModalProps {
  open: boolean;
  onClose: () => void;
  percentualDesconto: number;
  valorDesconto: number;
  subtotal: number;
  onAutorizado: (supervisorNome: string) => void;
}

export function AutorizacaoDescontoModal({
  open,
  onClose,
  percentualDesconto,
  valorDesconto,
  subtotal,
  onAutorizado,
}: AutorizacaoDescontoModalProps) {
  const [senha, setSenha] = React.useState('');
  const [supervisor, setSupervisor] = React.useState('Gerente Geral');
  const [erro, setErro] = React.useState<string | null>(null);

  function handleConfirmar() {
    // Alçada de segurança: PIN gerencial cadastrado para a loja
    const pin = senha.trim();

    if (!pin) {
      setErro('Informe a senha de liberação do gerente.');
      return;
    }

    if (pin.length < 4) {
      setErro('O PIN gerencial deve ter pelo menos 4 caracteres.');
      return;
    }

    if (pin === '1234' || pin === 'admin' || pin === '123456') {
      setErro(null);
      setSenha('');
      onAutorizado(supervisor);
    } else {
      setErro('Senha de autorização incorreta.');
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
          </div>
        </div>

        {erro && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-danger-light)] p-2.5 text-xs text-[var(--color-danger-dark)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">Supervisor / Gerente</label>
            <select
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="Gerente Geral">Gerente Geral (Loja Matriz)</option>
              <option value="Supervisor Comercial">Supervisor Comercial</option>
              <option value="Diretoria Ótica">Diretoria Ótica</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">Senha de Autorização</label>
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
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button variant="outline" onClick={onClose}>
            Cancelar Desconto
          </Button>
          <Button variant="primary" onClick={handleConfirmar}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Autorizar e Concluir
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
