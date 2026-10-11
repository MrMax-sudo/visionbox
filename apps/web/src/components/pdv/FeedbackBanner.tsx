import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Feedback } from '@/components/pdv/pdvHelpers';

const TONE_CLASS: Record<Feedback['tone'], string> = {
  success: 'border-success-light bg-success-light text-success-dark',
  warning: 'border-warning-light bg-warning-light text-warning-dark',
  error: 'border-danger-light bg-danger-light text-danger-dark',
};

/**
 * Faixa de feedback do PDV (sucesso / aviso offline / erro).
 * `role=status` + `aria-live=polite` — o operador é avisado sem roubar o foco
 * do campo de busca (teclado-first).
 */
export function FeedbackBanner({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-sm', TONE_CLASS[feedback.tone])}
    >
      {feedback.tone === 'success' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
      )}
      <span className="min-w-0 flex-1">{feedback.msg}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar aviso"
        className="shrink-0 rounded p-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        <X className="h-4 w-4" strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}
