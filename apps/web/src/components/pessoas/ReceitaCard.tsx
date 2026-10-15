import * as React from 'react';
import { Eye, Pencil, Trash2, FileText, User } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ReceitaDTO } from '@/lib/types';
import { isNavigableFotoUrl } from '@/components/pessoas/receitaForm';

export interface ReceitaCardProps {
  receita: ReceitaDTO;
  /** desabilita "Ver foto" enquanto o anexo carrega */
  loading?: boolean;
  onVerFoto: (receita: ReceitaDTO) => void;
  onEditar?: (receita: ReceitaDTO) => void;
  onExcluir?: (receita: ReceitaDTO) => void;
}

export function ReceitaCard({ receita, loading, onVerFoto, onEditar, onExcluir }: ReceitaCardProps) {
  const fotoReal = isNavigableFotoUrl(receita.fotoUrl);
  const temAnexo = !!receita.fotoUrl;

  return (
    <Card className="flex flex-col justify-between p-4 shadow-sm hover:shadow transition-shadow">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-semibold text-brand">{receita.id}</p>
            <p className="truncate text-sm font-semibold text-primary flex items-center gap-1.5 mt-0.5">
              <User className="h-3.5 w-3.5 text-secondary shrink-0" />
              {receita.clienteNome ?? receita.clienteId}
            </p>
            <p className="text-xs text-muted mt-0.5">
              Emissão: {receita.data ? new Date(receita.data).toLocaleDateString('pt-BR') : '—'}
              {receita.dataValidade ? ` • Validade: ${new Date(receita.dataValidade).toLocaleDateString('pt-BR')}` : ''}
            </p>
          </div>
          <Badge variant={receita.status === 'válida' || receita.status === 'VALIDA' ? 'success' : 'warning'}>
            {receita.status ?? 'VÁLIDA'}
          </Badge>
        </div>

        {/* Informações clínicas OD / OE */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-page p-2 border border-border/50">
            <p className="font-semibold text-secondary text-[11px] uppercase tracking-wide">Olho Direito (OD)</p>
            <p className="font-mono text-primary font-medium text-xs mt-0.5">{receita.od || '0.00'}</p>
          </div>
          <div className="rounded bg-page p-2 border border-border/50">
            <p className="font-semibold text-secondary text-[11px] uppercase tracking-wide">Olho Esquerdo (OE)</p>
            <p className="font-mono text-primary font-medium text-xs mt-0.5">{receita.oe || '0.00'}</p>
          </div>
        </div>

        {/* Metadados adicionais: DP, Tipo, Médico */}
        {(receita.dp || receita.tipo || receita.nomeMedico) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
            {receita.tipo && (
              <span className="rounded bg-page px-2 py-0.5 font-medium text-secondary">
                {receita.tipo}
              </span>
            )}
            {receita.dp && (
              <span className="rounded bg-page px-2 py-0.5 font-medium text-secondary">
                DP: {receita.dp}mm
              </span>
            )}
            {receita.nomeMedico && (
              <span className="rounded bg-page px-2 py-0.5 text-muted truncate max-w-[180px]" title={receita.nomeMedico}>
                Dr(a). {receita.nomeMedico}
              </span>
            )}
          </div>
        )}

        {receita.observacao && (
          <p className="mt-2 text-xs text-secondary italic line-clamp-2 bg-page/40 p-1.5 rounded border border-border/30">
            "{receita.observacao}"
          </p>
        )}
      </div>

      {/* Barra de Ações do CRUD */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={!temAnexo || !!loading}
            onClick={() => onVerFoto(receita)}
            title={temAnexo ? 'Visualizar anexo da receita' : 'Esta receita não possui foto anexada'}
          >
            <Eye className="mr-1 h-3.5 w-3.5" aria-hidden /> Foto
          </Button>
          <Badge variant={fotoReal ? 'success' : temAnexo ? 'warning' : 'outline'} className="text-[10px] py-0 px-1.5">
            {fotoReal ? 'Anexo OK' : temAnexo ? 'Pendente' : 'Sem anexo'}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {onEditar && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-primary hover:bg-page"
              onClick={() => onEditar(receita)}
              title="Editar receita"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
          )}
          {onExcluir && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-danger hover:text-danger hover:bg-danger/10"
              onClick={() => onExcluir(receita)}
              title="Excluir receita"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
