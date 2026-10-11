import * as React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/os/StatusBadge';
import { clienteDe, fmtDate, previsaoDe, produtoDe } from '@/components/os/osDomain';
import type { OrdemServicoDTO } from '@/lib/types';

/** Últimas 5 OS da fila — atalho rápido para o detalhe (`/os/:id`). */
export function LatestOrdersTable({ ordens }: { ordens: OrdemServicoDTO[] }) {
  const latest = ordens.slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-5 w-5 text-brand" aria-hidden /> Últimas ordens de serviço
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/os">
            Ver todas <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {latest.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            Nenhuma ordem de serviço encontrada.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-primary-light hover:bg-primary-light">
                <TableHead>#OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Produto / Serviço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Previsão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {latest.map((os) => (
                <TableRow key={os.id}>
                  <TableCell className="font-mono font-semibold">{os.numero ?? os.id.slice(0, 8)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{clienteDe(os)}</TableCell>
                  <TableCell className="hidden max-w-[260px] truncate text-secondary md:table-cell">
                    {produtoDe(os)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={os.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{fmtDate(previsaoDe(os))}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm" aria-label={`Abrir OS ${os.numero ?? os.id.slice(0, 8)}`}>
                      <Link to={`/os/${os.id}`}>
                        <Eye className="h-4 w-4" aria-hidden /> Ver
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
