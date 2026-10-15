import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Tag,
  Printer,
  Plus,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Layers,
  FileSpreadsheet,
  Barcode
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';

import { apiClient } from '@/lib/apiClient';
import type { PageResponse, ProdutoDTO } from '@/lib/types';
import { unwrapPage, normalizeProduto } from '@/lib/types';
import { formatBRL } from '@/lib/masks';
import { useDebounce } from '@/hooks/useOnline';

interface ItemEtiqueta {
  produto: ProdutoDTO;
  quantidade: number;
}

export default function Etiquetas() {
  const { toast } = useToast();
  const [modelo, setModelo] = React.useState<'OTICA' | 'GONDOLA' | 'FOLHA_A4'>('OTICA');
  const [busca, setBusca] = React.useState('');
  const debouncedBusca = useDebounce(busca, 300);
  const [itensParaImprimir, setItensParaImprimir] = React.useState<ItemEtiqueta[]>([]);

  // Busca produtos do catálogo
  const { data: produtosData, isLoading } = useQuery({
    queryKey: ['produtos-etiquetas', debouncedBusca],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ProdutoDTO> | ProdutoDTO[]>('/v1/produtos', {
        params: {
          size: 15,
          search: debouncedBusca || undefined,
        },
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  const produtos: ProdutoDTO[] = React.useMemo(
    () => unwrapPage(produtosData).map((p) => normalizeProduto(p)),
    [produtosData]
  );

  function adicionarProduto(produto: ProdutoDTO) {
    setItensParaImprimir((prev) => {
      const idx = prev.findIndex((i) => i.produto.sku === produto.sku);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantidade += 1;
        return copy;
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function removerItem(sku: string) {
    setItensParaImprimir((prev) => prev.filter((i) => i.produto.sku !== sku));
  }

  function alterarQtd(sku: string, qtd: number) {
    if (qtd <= 0) {
      removerItem(sku);
      return;
    }
    setItensParaImprimir((prev) =>
      prev.map((i) => (i.produto.sku === sku ? { ...i, quantidade: qtd } : i))
    );
  }

  const totalEtiquetas = itensParaImprimir.reduce((acc, i) => acc + i.quantidade, 0);

  function handleImprimir() {
    if (itensParaImprimir.length === 0) {
      toast({
        title: 'Nenhum item selecionado',
        description: 'Adicione pelo menos um produto para gerar etiquetas.',
        variant: 'warning',
      });
      return;
    }

    const janela = window.open('', '_blank');
    if (!janela) {
      alert('Permita pop-ups para imprimir etiquetas.');
      return;
    }

    const listaExpandida: ProdutoDTO[] = [];
    itensParaImprimir.forEach((item) => {
      for (let i = 0; i < item.quantidade; i++) {
        listaExpandida.push(item.produto);
      }
    });

    const estilos = `
      <style>
        @page {
          margin: 0;
          size: ${modelo === 'FOLHA_A4' ? 'A4 portrait' : 'auto'};
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: ${modelo === 'FOLHA_A4' ? '10mm 5mm' : '2mm'};
          background: #fff;
          color: #000;
          -webkit-print-color-adjust: exact;
        }
        .grade-a4 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2mm 3mm;
        }
        .etiqueta-otica {
          width: 90mm;
          height: 20mm;
          border: 1px dashed #ccc;
          padding: 2mm;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          page-break-inside: avoid;
          margin-bottom: 2mm;
        }
        .etiqueta-gondola {
          width: 50mm;
          height: 30mm;
          border: 1px dashed #ccc;
          padding: 2mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          page-break-inside: avoid;
          margin-bottom: 2mm;
        }
        .barcode {
          font-family: 'Libre Barcode 128', 'Courier New', monospace;
          font-size: 26px;
          line-height: 1;
          letter-spacing: 2px;
          margin: 2px 0;
        }
        .texto-mini { font-size: 9px; line-height: 1.1; font-weight: bold; }
        .texto-preco { font-size: 14px; font-weight: 900; }
        @media print {
          .etiqueta-otica, .etiqueta-gondola { border: none; }
        }
      </style>
    `;

    const htmlEtiquetas = listaExpandida
      .map((p) => {
        const codigo = p.codigoBarras || p.sku;
        if (modelo === 'OTICA') {
          return `
            <div class="etiqueta-otica">
              <div style="flex: 1; padding-right: 4mm;">
                <div class="texto-mini">${p.nome.slice(0, 28)}</div>
                <div style="font-size: 8px; color: #555;">${p.marca || 'ÓTICA'} • ${p.sku}</div>
                <div class="barcode">*${codigo}*</div>
                <div style="font-size: 8px;">${codigo}</div>
              </div>
              <div style="text-align: right; border-left: 1px dotted #888; padding-left: 3mm;">
                <div style="font-size: 8px; text-transform: uppercase;">À Vista</div>
                <div class="texto-preco">${formatBRL(p.preco)}</div>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="etiqueta-gondola">
              <div>
                <div class="texto-mini">${p.nome.slice(0, 32)}</div>
                <div style="font-size: 8px; color: #555;">${p.marca || 'ÓTICA'} • SKU: ${p.sku}</div>
              </div>
              <div style="text-align: center;">
                <div class="barcode">*${codigo}*</div>
                <div style="font-size: 8px;">${codigo}</div>
              </div>
              <div style="text-align: right;">
                <span class="texto-preco">${formatBRL(p.preco)}</span>
              </div>
            </div>
          `;
        }
      })
      .join('');

    janela.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impressão de Etiquetas</title>
          ${estilos}
        </head>
        <body>
          <div class="${modelo === 'FOLHA_A4' ? 'grade-a4' : ''}">
            ${htmlEtiquetas}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    janela.document.close();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Tag className="h-7 w-7 text-brand" />
            Impressão de Etiquetas de Código de Barras
          </h1>
          <p className="text-sm text-secondary">
            Geração de etiquetas adesivas para armações de óculos (com borboleta/rabicho), caixas e gôndolas.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleImprimir}
          disabled={itensParaImprimir.length === 0}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Imprimir {totalEtiquetas > 0 ? `(${totalEtiquetas} etiquetas)` : ''}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Painel Esquerdo: Busca e Seleção de Produtos */}
        <div className="space-y-4 lg:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Search className="h-4 w-4 text-brand" />
                Selecionar Produtos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  placeholder="Buscar por nome, SKU ou código..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[480px] overflow-y-auto space-y-2 pr-1">
                {isLoading ? (
                  <p className="text-xs text-muted">Carregando catálogo...</p>
                ) : produtos.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">Nenhum produto encontrado.</p>
                ) : (
                  produtos.map((p) => {
                    const jaAdicionado = itensParaImprimir.some((i) => i.produto.sku === p.sku);
                    return (
                      <div
                        key={p.sku}
                        className="flex items-center justify-between rounded-lg border border-border p-2.5 transition-colors hover:bg-card-soft"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="truncate text-xs font-semibold text-foreground">{p.nome}</p>
                          <p className="text-[11px] text-muted font-mono">{p.sku} • {formatBRL(p.preco)}</p>
                        </div>
                        <Button
                          type="button"
                          variant={jaAdicionado ? 'outline' : 'primary'}
                          size="sm"
                          className="h-8 text-xs shrink-0"
                          onClick={() => adicionarProduto(p)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Adicionar
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Configuração de Modelo e Fila de Impressão */}
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand" />
                  Modelo de Etiqueta
                </CardTitle>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModelo('OTICA')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                      modelo === 'OTICA'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-secondary hover:bg-muted/50'
                    }`}
                  >
                    Ótica / Armação (Borboleta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelo('GONDOLA')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                      modelo === 'GONDOLA'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-secondary hover:bg-muted/50'
                    }`}
                  >
                    Gôndola / Caixa (Térmica)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelo('FOLHA_A4')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                      modelo === 'FOLHA_A4'
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-border text-secondary hover:bg-muted/50'
                    }`}
                  >
                    Folha A4 (Pimaco)
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {itensParaImprimir.length === 0 ? (
                <EmptyState
                  icon={Tag}
                  title="Nenhum item na fila"
                  description="Selecione produtos ao lado para compor a folha ou rolo de etiquetas térmicas."
                />
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-card-soft text-xs font-semibold text-secondary uppercase">
                        <tr>
                          <th className="px-3 py-2.5">Produto</th>
                          <th className="px-3 py-2.5">Código de Barras</th>
                          <th className="px-3 py-2.5">Preço</th>
                          <th className="px-3 py-2.5 text-center">Quantidade</th>
                          <th className="px-3 py-2.5 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {itensParaImprimir.map(({ produto, quantidade }) => (
                          <tr key={produto.sku} className="hover:bg-card-soft/40">
                            <td className="px-3 py-2.5 font-medium text-foreground">
                              <p className="line-clamp-1 text-xs">{produto.nome}</p>
                              <span className="text-[11px] text-muted font-mono">{produto.sku}</span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-secondary">
                              {produto.codigoBarras || produto.sku}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-semibold text-foreground">
                              {formatBRL(produto.preco)}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="number"
                                min={1}
                                max={999}
                                value={quantidade}
                                onChange={(e) => alterarQtd(produto.sku, Number(e.target.value))}
                                className="h-8 w-16 rounded border border-border bg-background px-2 text-center text-xs font-semibold"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-danger hover:bg-danger/10"
                                onClick={() => removerItem(produto.sku)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-card-soft p-3">
                    <span className="text-xs text-secondary">
                      Total a imprimir: <strong className="text-foreground">{totalEtiquetas}</strong> etiquetas
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs text-danger"
                      onClick={() => setItensParaImprimir([])}
                    >
                      Limpar fila
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
