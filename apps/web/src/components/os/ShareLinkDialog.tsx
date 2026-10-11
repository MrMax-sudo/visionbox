import * as React from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * ShareLinkDialog — modal de link compartilhável (portal do laboratório e
 * portal de rastreio do cliente). Só muda o conteúdo/título: cópia para a
 * área de transferência + ação de envio (WhatsApp) continuam idênticas.
 */
export function ShareLinkDialog({
  open,
  onClose,
  title,
  description,
  highlightTitle,
  highlightText,
  linkLabel,
  link,
  shareLabel,
  shareDisabled,
  shareTitle,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  highlightTitle: string;
  highlightText: React.ReactNode;
  linkLabel: string;
  link: string | null;
  shareLabel: string;
  shareDisabled?: boolean;
  shareTitle?: string;
  onShare: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = () => {
    if (!link || !navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4">
        <div className="space-y-1 rounded border border-border bg-primary-light/40 p-3 text-xs text-primary">
          <p className="font-semibold">{highlightTitle}</p>
          <p className="text-[11px] text-secondary">{highlightText}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="share-link-input" className="text-xs font-semibold">
            {linkLabel}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="share-link-input"
              type="text"
              readOnly
              value={link ?? ''}
              placeholder="Gerando link…"
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!link}
              aria-label={copied ? 'Link copiado' : 'Copiar link'}
              title={copied ? 'Copiado!' : 'Copiar'}
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {copied && <p className="text-[11px] text-success-dark">Link copiado para a área de transferência.</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="success"
            onClick={onShare}
            disabled={shareDisabled || !link}
            title={shareTitle}
            className="gap-2"
          >
            <Share2 className="h-4 w-4" aria-hidden /> {shareLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
