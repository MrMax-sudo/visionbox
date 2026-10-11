import { useNavigate } from 'react-router-dom';
import { Package, Pencil, ShoppingCart, Trash2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProdutoDTO } from '@/lib/types';
import { formatBRL } from '@/lib/masks';

export interface ProdutoCardProps {
  produto: ProdutoDTO;
  onEdit: (produto: ProdutoDTO) => void;
  onDelete: (produto: ProdutoDTO) => void;
}

export function ProdutoCard({ produto: p, onEdit, onDelete }: ProdutoCardProps) {
  const navigate = useNavigate();

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-panel">
      <div className="group relative flex h-44 items-center justify-center border-b border-border bg-card-soft p-3">
        <Package className="absolute h-12 w-12 text-muted" aria-hidden />
        <img
          src={`/assets/produtos/${p.sku}.jpg`}
          alt={p.nome}
          loading="lazy"
          className="relative h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        <p className="font-mono text-[11px] text-muted">
          {p.sku} • NCM {p.ncm ?? '—'}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-primary">{p.nome}</h3>
        <p className="text-xs text-secondary">
          {p.marca ?? '—'} • {p.categoria}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-brand">{formatBRL(p.preco)}</span>
          <Badge variant={p.estoque <= 3 ? 'danger' : p.estoque <= 6 ? 'warning' : 'success'}>
            {p.estoque} em estoque
          </Badge>
        </div>

        {p.custo != null && (
          <p className="mt-1 text-[11px] text-muted">
            Custo {formatBRL(p.custo ?? 0)} • margem{' '}
            {p.preco > 0 ? (((p.preco - (p.custo ?? 0)) / p.preco) * 100).toFixed(0) : '—'}%
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => navigate(`/pdv?sku=${encodeURIComponent(p.sku)}`)}
          >
            <ShoppingCart className="mr-1 h-3.5 w-3.5" aria-hidden /> Adicionar ao PDV
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label={`Editar ${p.nome}`}
            title="Editar produto"
            onClick={() => onEdit(p)}
            disabled={!p.id}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-danger"
            aria-label={`Excluir ${p.nome}`}
            title="Excluir produto"
            onClick={() => onDelete(p)}
            disabled={!p.id}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
