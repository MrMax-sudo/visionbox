import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import type { ReceitaForm } from '@/components/pessoas/receitaForm';

type FormRegister = ReturnType<typeof useForm<ReceitaForm>>['register'];
type FormWatch = ReturnType<typeof useForm<ReceitaForm>>['watch'];
type FormErrors = ReturnType<typeof useForm<ReceitaForm>>['formState']['errors'];

export interface GrauFieldsProps {
  prefix: 'od' | 'oe';
  title: string;
  register: FormRegister;
  watch: FormWatch;
  errors: FormErrors;
}

/**
 * GrauFields — esf/cil/eixo/adicao de um olho (OD/OE).
 * Regras do domínio: eixo obrigatório se cilindro ≠ 0; adição só em MULTIFOCAL.
 */
export function GrauFields({ prefix, title, register, watch, errors }: GrauFieldsProps) {
  const tipoLente = watch('tipoLente');
  const cilindrico = watch(`${prefix}.cilindrico`);
  const showEixo =
    cilindrico !== 0 && cilindrico !== null && cilindrico !== undefined && !Number.isNaN(Number(cilindrico));
  const isMultifocal = tipoLente === 'MULTIFOCAL';
  const err = errors[prefix];

  return (
    <fieldset className="rounded border border-border bg-page p-3">
      <legend className="px-1 text-xs font-semibold text-primary">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Esférico (-30 a 30)" id={`${prefix}-esf`} required error={err?.esferico}>
          <Input
            type="number"
            step="0.25"
            placeholder="-2.50"
            {...register(`${prefix}.esferico`, { valueAsNumber: true })}
          />
        </Field>

        <Field label="Cilíndrico (-10 a 0)" id={`${prefix}-cil`} required error={err?.cilindrico}>
          <Input
            type="number"
            step="0.25"
            placeholder="-1.25"
            {...register(`${prefix}.cilindrico`, { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Eixo (0–180)"
          id={`${prefix}-eixo`}
          required={showEixo}
          error={err?.eixo}
          hint={showEixo ? undefined : 'Obrigatório se cilíndrico ≠ 0'}
        >
          <Input
            type="number"
            step="1"
            placeholder={showEixo ? 'ex: 90' : '—'}
            {...register(`${prefix}.eixo`, { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Adição (0–6)"
          id={`${prefix}-adicao`}
          required={isMultifocal}
          error={err?.adicao}
          hint={isMultifocal ? undefined : 'Só para lente MULTIFOCAL'}
        >
          <Input
            type="number"
            step="0.25"
            placeholder={isMultifocal ? '2.00' : '0.00'}
            disabled={!isMultifocal}
            {...register(`${prefix}.adicao`, { valueAsNumber: true })}
          />
        </Field>
      </div>
    </fieldset>
  );
}
