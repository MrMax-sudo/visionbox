import { Eye } from 'lucide-react';

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
}

export function ReceitaCard({ receita, loading, onVerFoto }: ReceitaCardProps) {
  const fotoReal = isNavigableFotoUrl(receita.fotoUrl);
  const temAnexo = !!receita.fotoUrl;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-semibold text-brand">{receita.id}</p>
          <p className="truncate text-sm font-medium text-primary">{receita.clienteNome ?? receita.clienteId}</p>
          <p className="text-xs text-muted">
            {receita.data ? new Date(receita.data).toLocaleDateString('pt-BR') : '—'}
          </p>
        </div>
        <Badge variant={receita.status === 'válida' || receita.status === 'VALIDA' ? 'success' : 'warning'}>
          {receita.status ?? '—'}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-page p-2">
          <p className="font-semibold text-secondary">OD</p>
          <p className="font-mono text-primary">{receita.od}</p>
        </div>
        <div className="rounded bg-page p-2">
          <p className="font-semibold text-secondary">OE</p>
          <p className="font-mono text-primary">{receita.oe}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={!temAnexo || !!loading}
          onClick={() => onVerFoto(receita)}
          title={temAnexo ? 'Visualizar anexo da receita' : 'Esta receita não possui anexo'}
        >
          <Eye className="mr-1 h-3.5 w-3.5" aria-hidden /> Ver foto
        </Button>
        <Badge variant={fotoReal ? 'success' : temAnexo ? 'warning' : 'outline'} className="self-center">
          {fotoReal ? 'Foto OK' : temAnexo ? 'Anexo pendente' : 'Sem foto'}
        </Badge>
      </div>
    </Card>
  );
}
