import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type State = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Erro de render na tela', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="w-full max-w-lg rounded-[var(--radius-card)] border border-[var(--color-danger-light)] bg-[var(--color-bg-card)] p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-[var(--color-danger)]" />
          <h2 className="mt-3 text-base font-semibold text-[var(--color-text-primary)]">Não foi possível abrir esta tela</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{this.state.error.message || 'Erro inesperado na interface.'}</p>
          <Button className="mt-4 gap-2" variant="outline" onClick={() => this.setState({ error: null })}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
}
