import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary-light text-secondary-dark',
        success: 'border-transparent bg-success-light text-success-dark',
        warning: 'border-transparent bg-warning-light text-warning-dark',
        danger: 'border-transparent bg-danger-light text-danger-dark',
        destructive: 'border-transparent bg-danger-light text-danger-dark',
        outline: 'border-border text-secondary bg-transparent',
        info: 'border-transparent bg-info-light text-info',
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
