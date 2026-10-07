import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button — shadcn/ui adaptado VisionBox
 *
 * Variants mapeiam para tokens de theme-visionbox.css via var(--color-*).
 * - primary: --color-primary (marca)
 * - secondary: --color-secondary (ação secundária)
 * - destructive: --color-danger (erro/cancelamento)
 * - outline / ghost / link: neutros
 *
 * Todas as cores vêm de var(--color-*), nunca hex hard-coded (R5).
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius)]',
    'text-sm font-medium ring-offset-background transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-dark)] active:bg-[var(--color-primary-dark)]',
        secondary:
          'bg-[var(--color-secondary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-secondary-dark)] active:bg-[var(--color-secondary-dark)]',
        destructive:
          'bg-[var(--color-danger)] text-[var(--color-text-on-danger)] hover:bg-[var(--color-danger-dark)] active:bg-[var(--color-danger-dark)]',
        outline:
          'border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)] hover:border-[var(--color-border-strong)]',
        ghost:
          'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)] hover:text-[var(--color-text-primary)]',
        link: 'text-[var(--color-primary)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-[var(--radius)] px-3 text-xs',
        lg: 'h-11 rounded-[var(--radius)] px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild: _asChild, ...props }, ref) => {
    // asChild reservado para futura integração com Radix Slot; por ora renderiza button nativo
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
