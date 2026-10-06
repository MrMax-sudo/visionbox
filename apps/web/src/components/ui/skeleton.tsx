import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('animate-pulse rounded bg-[var(--color-border)]', className)} {...props} />
  );
}

export { Skeleton };
