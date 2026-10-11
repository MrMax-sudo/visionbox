import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Button - shadcn/ui adaptado VisionBox (ONDA 1)
 *
 * Todos os tokens vêm de var(--color-*) (theme-visionbox.css) — nenhum hex (R5).
 *
 * Variants:
 *  - default     → --color-primary (marca)   [alias legado: primary]
 *  - secondary   → --color-secondary
 *  - outline     → superfície + borda
 *  - ghost       → transparente
 *  - destructive → --color-danger
 *  - link        → texto com underline
 *  - aliases legados usados nas páginas atuais: primary, danger, info, success, warning
 *
 * Sizes: sm | default | lg | icon
 * asChild: renderiza o filho (ex.: <Link/>) com as mesmas classes — Radix Slot.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap rounded',
    'text-sm font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-dark active:bg-primary-dark',
        // alias legado da Onda 0
        primary:
          'bg-primary text-primary-foreground hover:bg-primary-dark active:bg-primary-dark',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-dark active:bg-secondary-dark',
        outline:
          'border border-border bg-card text-primary hover:border-border-strong hover:bg-page',
        ghost:
          'text-primary hover:bg-page hover:text-primary',
        destructive:
          'bg-danger text-danger-foreground hover:bg-danger-dark active:bg-danger-dark',
        danger:
          'bg-danger text-danger-foreground hover:bg-danger-dark active:bg-danger-dark',
        link: 'text-brand underline-offset-4 hover:underline',
        info: 'bg-info text-primary-foreground hover:opacity-90',
        success:
          'bg-success text-success-foreground hover:bg-success-dark',
        warning:
          'bg-warning text-warning-foreground hover:opacity-90',
      },
      size: {
        sm: 'h-8 rounded px-3 text-xs',
        default: 'h-10 px-4 py-2',
        lg: 'h-11 rounded px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renderiza o filho como raiz mantendo as classes (Radix Slot). */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
