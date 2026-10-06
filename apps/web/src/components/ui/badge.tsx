import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--color-primary)] text-[var(--color-text-on-primary)]',
        secondary: 'border-transparent bg-[var(--color-secondary-light)] text-[var(--color-secondary-dark)]',
        success: 'border-transparent bg-[var(--color-success-light)] text-[var(--color-success-dark)]',
        warning: 'border-transparent bg-[var(--color-warning-light)] text-[var(--color-warning-dark)]',
        danger: 'border-transparent bg-[var(--color-danger-light)] text-[var(--color-danger-dark)]',
        outline: 'border-[var(--color-border)] text-[var(--color-text-secondary)] bg-transparent',
        info: 'border-transparent bg-[var(--color-info-light)] text-[var(--color-info)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
