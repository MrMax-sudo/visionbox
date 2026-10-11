import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Select — híbrido (ONDA 1)
 *
 * 1) Caminho legado (páginas atuais): `<Select {...register(...)}><option/>…</Select>`
 *    continua renderizando um <select> nativo — zero regressão de layout/comportamento.
 * 2) Caminho Radix (shadcn): sem `onChange` e sem <option> nos filhos, vira
 *    <Select.Root> — usando SelectTrigger / SelectValue / SelectContent / SelectItem.
 */

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;
type RadixSelectProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;

export type SelectProps = NativeSelectProps &
  Partial<Omit<RadixSelectProps, 'children'>> & { children?: React.ReactNode };

const nativeSelectClasses =
  'flex h-9 w-full rounded border border-border bg-card px-3 py-2 text-sm text-primary placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50';

function childrenHaveOptions(children: React.ReactNode): boolean {
  const stack: React.ReactNode[] = React.Children.toArray(children);
  while (stack.length > 0) {
    const node = stack.pop();
    if (!React.isValidElement(node)) continue;
    if (node.type === 'option') return true;
    const props = node.props as { children?: React.ReactNode } | null;
    if (props && typeof props === 'object' && 'children' in props && props.children) {
      stack.push(props.children);
    }
  }
  return false;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const { children, className, ...rest } = props;
  const isNative = childrenHaveOptions(children) || rest.onChange !== undefined;

  if (isNative) {
    // Preserva exatamente o comportamento legado (páginas usam react-hook-form).
    const {
      onValueChange: _onValueChange,
      open: _open,
      defaultOpen: _defaultOpen,
      onOpenChange: _onOpenChange,
      dir: _dir,
      ...nativeProps
    } = rest as NativeSelectProps & Partial<RadixSelectProps>;
    return (
      <select ref={ref} className={cn(nativeSelectClasses, className)} {...nativeProps}>
        {children}
      </select>
    );
  }

  const radixProps = rest as unknown as RadixSelectProps;
  return <SelectPrimitive.Root {...radixProps}>{children}</SelectPrimitive.Root>;
});
Select.displayName = 'Select';

/* --------------------------- Radix compound --------------------------- */

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between whitespace-nowrap rounded border border-border bg-card px-3 py-2 text-sm text-primary',
      'ring-offset-page focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
      '[&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-card border border-border bg-card text-primary shadow-panel',
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-xs font-semibold text-muted', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded py-1.5 pl-2 pr-8 text-sm outline-none',
      'data-[highlighted]:bg-primary-light data-[highlighted]:text-primary',
      'data-[state=checked]:font-medium',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

function SelectGroup({ className, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group className={className} {...props} />;
}
SelectGroup.displayName = 'SelectGroup';

function SelectValue(props: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value {...props} />;
}
SelectValue.displayName = 'SelectValue';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
