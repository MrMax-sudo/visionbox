import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/* -------------------------------------------------------------------------
   Compatibilidade legado (ONDA 0 → ONDA 1)
   As páginas atuais usam `<Dialog open onClose title description>`; esse
   contrato continua válido, mas agora renderizado por Radix Dialog
   (foco preso, overlay, ESC e aria corretos) com o MESMO visual anterior.
   ------------------------------------------------------------------------- */
export type LegacyDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

function LegacyDialog({ open, onClose, title, description, children, className }: LegacyDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]"
          aria-hidden
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-[720px] -translate-x-1/2 -translate-y-1/2',
            'overflow-auto rounded-card border border-border bg-card p-6 shadow-panel',
            'focus:outline-none',
            className,
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-semibold text-primary">
                {title ?? <span className="sr-only">Dialogo</span>}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-xs text-secondary">
                  {description}
                </DialogPrimitive.Description>
              )}
              {!description && (
                <DialogPrimitive.Description className="sr-only">
                  {title ?? 'Conteúdo do diálogo'}
                </DialogPrimitive.Description>
              )}
            </div>
            <button
              type="button"
              onClick={() => onClose()}
              aria-label="Fechar"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon' }),
                'h-8 w-8 shrink-0 rounded-full',
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* -------------------------------------------------------------------------
   API composta (padrão shadcn) — Dialog, DialogTrigger, DialogContent, …
   ------------------------------------------------------------------------- */
type RadixDialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;

export type DialogProps = LegacyDialogProps | RadixDialogProps;

function isLegacy(props: DialogProps): props is LegacyDialogProps {
  return 'onClose' in props && typeof (props as LegacyDialogProps).onClose === 'function';
}

/**
 * Dialog — polimórfico (ONDA 1)
 *  • com `onClose`  → API legada (páginas atuais), mantida 1:1;
 *  • sem `onClose`  → Radix Dialog.Root (use DialogTrigger + DialogContent).
 */
const Dialog = (props: DialogProps) => {
  if (isLegacy(props)) return <LegacyDialog {...props} />;
  return <DialogPrimitive.Root {...props} />;
};

const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-[720px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 gap-4',
        'overflow-y-auto rounded-card border border-border bg-card p-6 shadow-panel',
        'focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Fechar"
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'absolute right-4 top-4 h-8 w-8 rounded-full opacity-70 hover:opacity-100',
        )}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'font-display text-base font-semibold leading-none tracking-tight text-primary',
      className,
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-secondary', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
