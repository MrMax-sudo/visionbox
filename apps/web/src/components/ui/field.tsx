import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/** Aceita string, erro de zod ({ message }) ou vazio. */
export type FieldErrorLike = string | { message?: string } | null | undefined;

function resolveErrorMessage(error: FieldErrorLike): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  return error.message;
}

export type FieldControlProps = {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

export interface FieldProps {
  label: string;
  /** Gere e use sempre um id (label htmlFor + aria-describedby). */
  id?: string;
  error?: FieldErrorLike;
  hint?: string;
  required?: boolean;
  className?: string;
  /**
   * O control: um elemento (clonado com id/aria) ou uma render-prop
   * que recebe { id, 'aria-invalid', 'aria-describedby' }.
   */
  children: React.ReactNode | ((props: FieldControlProps) => React.ReactNode);
}

/**
 * Field — label + controle + mensagem de erro zod em um só.
 *
 * <Field label="CPF" id="cpf" error={errors.cpf}>
 *   <Input />
 * </Field>
 *
 * <Field label="Busca" id="q">{(ctrl) => <Input {...ctrl} />}</Field>
 */
export function Field({ label, id, error, hint, required, className, children }: FieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const message = resolveErrorMessage(error);

  const control: FieldControlProps = {
    id: fieldId,
    'aria-invalid': message ? true : undefined,
    'aria-describedby':
      [message ? errorId : null, hint && !message ? hintId : null].filter(Boolean).join(' ') ||
      undefined,
  };

  const content =
    typeof children === 'function'
      ? children(control)
      : React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, control)
        : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        )}
      </Label>
      {content}
      {hint && !message && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {message && (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-danger-dark"
        >
          {message}
        </p>
      )}
    </div>
  );
}

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  id?: string;
  error?: FieldErrorLike;
  hint?: string;
}

/**
 * TextField — atalho label + Input + erro zod (caso mais comum).
 */
export function TextField({
  label,
  id,
  error,
  hint,
  required,
  className,
  ...inputProps
}: TextFieldProps) {
  return (
    <Field label={label} id={id} error={error} hint={hint} required={required} className={className}>
      <Input {...inputProps} />
    </Field>
  );
}
