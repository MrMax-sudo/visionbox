import * as React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEmpresaStore } from '@/stores/empresaStore';

export interface ComprovanteItem {
  sku: string;
  nome: string;
  qtd: number;
  preco: number;
}

export interface ComprovanteProps {
  osNumero?: string;
  clienteNome?: string;
  clienteCpf?: string;
  clienteTelefone?: string;
  data?: Date | string;
  itens: ComprovanteItem[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  chaveNfce?: string;
  protocoloNfce?: string;
  tipo?: 'cupom' | 'os';
  grauOD?: string;
  grauOE?: string;
}

/**
 * Comprovante de venda / via de OS — ONDA 2A.
 * O layout do "papel" é intencionalmente monocromático (branco/preto/cinza de
 * bobina) e por isso usa cinzas do Tailwind em vez dos tokens de tema.
 * Utiliza dados da empresa persistidos no banco de dados via useEmpresaStore.
 */
export function ComprovanteImpressao({
  osNumero = '—',
  clienteNome = 'Consumidor',
  clienteCpf,
  clienteTelefone,
  data = new Date(),
  itens,
  subtotal,
  desconto,
  total,
  formaPagamento,
  chaveNfce,
  protocoloNfce,
  tipo = 'cupom',
  grauOD,
  grauOE,
}: ComprovanteProps) {
  const empresa = useEmpresaStore((s) => s.empresa);
  const dataFormatada = new Date(data).toLocaleString('pt-BR');

  const handlePrint = () => {
    window.print();
  };

  const cnpjFormatado = empresa?.cnpj
    ? empresa.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : null;
  const contatoEmpresa = empresa?.telefone || empresa?.whatsapp;
  const enderecoEmpresa = [empresa?.endereco, empresa?.numero, empresa?.cidade, empresa?.uf]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-4">
      {/* Área visível na tela e formatada para impressão via utilitários print:* */}
      <section
        id="area-comprovante-impressao"
        aria-label="Comprovante da venda"
        className="rounded-card border border-border bg-white p-6 font-mono text-black shadow-sm print:m-0 print:border-0 print:p-0 print:text-[10pt]"
      >
        {/* Cabeçalho */}
        <div className="mb-3 border-b border-dashed border-gray-400 pb-3 text-center">
          <h2 className="text-sm font-bold tracking-wider uppercase">
            {empresa?.nome || 'VISIONBOX ÓTICA'}
          </h2>
          {cnpjFormatado && (
            <p className="text-[10px] text-gray-600">CNPJ: {cnpjFormatado}</p>
          )}
          {contatoEmpresa && (
            <p className="text-[10px] text-gray-600">Atendimento: {contatoEmpresa}</p>
          )}
          {enderecoEmpresa && (
            <p className="text-[10px] text-gray-600">{enderecoEmpresa}</p>
          )}
          <div className="mt-2 inline-block rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-black">
            {tipo === 'os'
              ? 'VIA DE ORDEM DE SERVIÇO'
              : chaveNfce
                ? 'DANFE NFC-e - DOCUMENTO AUXILIAR'
                : 'COMPROVANTE DE PEDIDO / VENDA'}
          </div>
        </div>

        {/* Informações da OS e Cliente */}
        <div className="mb-3 space-y-1 border-b border-dashed border-gray-400 pb-3">
          <div className="flex justify-between gap-3">
            <span className="font-bold">NÚMERO OS:</span>
            <span className="font-bold">{osNumero}</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span>EMISSÃO:</span>
            <span>{dataFormatada}</span>
          </div>
          <div className="flex justify-between gap-3 text-[11px]">
            <span>CLIENTE:</span>
            <span className="font-bold">{clienteNome}</span>
          </div>
          {clienteCpf && (
            <div className="flex justify-between gap-3 text-[11px]">
              <span>CPF:</span>
              <span>{clienteCpf}</span>
            </div>
          )}
          {clienteTelefone && (
            <div className="flex justify-between gap-3 text-[11px]">
              <span>TELEFONE:</span>
              <span>{clienteTelefone}</span>
            </div>
          )}
        </div>

        {/* Seção Clínica (quando presente na OS) */}
        {(grauOD || grauOE) && (
          <div className="mb-3 border-b border-dashed border-gray-400 pb-3">
            <p className="mb-1 text-[11px] font-bold">PRESCRIÇÃO ÓTICA (GRAUS):</p>
            {grauOD && <p className="text-[10px]">OD: {grauOD}</p>}
            {grauOE && <p className="text-[10px]">OE: {grauOE}</p>}
          </div>
        )}

        {/* Itens */}
        <div className="mb-3 border-b border-dashed border-gray-400 pb-3">
          <p className="mb-1 text-[11px] font-bold">ITENS DO PEDIDO:</p>
          <table className="w-full text-left">
            <caption className="sr-only">Itens do pedido</caption>
            <thead>
              <tr className="border-b border-gray-200 text-[10px] text-gray-500">
                <th scope="col" className="py-1">
                  ITEM
                </th>
                <th scope="col" className="py-1 text-center">
                  QTD
                </th>
                <th scope="col" className="py-1 text-right">
                  UN (R$)
                </th>
                <th scope="col" className="py-1 text-right">
                  TOTAL (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-100 text-[11px]">
                  <td className="py-1 pr-1 font-sans">{it.nome}</td>
                  <td className="py-1 text-center">{it.qtd}</td>
                  <td className="py-1 text-right">{it.preco.toFixed(2)}</td>
                  <td className="py-1 text-right font-bold">{(it.preco * it.qtd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totais e Pagamento */}
        <div className="mb-3 space-y-1 border-b border-dashed border-gray-400 pb-3 text-[11px]">
          <div className="flex justify-between gap-3">
            <span>SUBTOTAL:</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between gap-3 text-gray-600">
              <span>DESCONTO:</span>
              <span>- R$ {desconto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-gray-300 pt-1 text-sm font-bold">
            <span>TOTAL PAGO:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-3 pt-1 text-[11px]">
            <span>FORMA DE PAGAMENTO:</span>
            <span className="font-bold">{formaPagamento}</span>
          </div>
        </div>

        {/* Dados Fiscais NFC-e (se emitido) */}
        {chaveNfce && (
          <div className="mb-3 space-y-1 rounded border border-dashed border-gray-400 bg-gray-50 p-2 text-center text-[10px]">
            <p className="font-bold">CHAVE DE ACESSO NFC-E:</p>
            <p className="break-all font-mono">{chaveNfce}</p>
            {protocoloNfce && <p className="text-gray-600">Protocolo de Autorização: {protocoloNfce}</p>}
            <p className="text-[9px] text-gray-500">
              Consulte pela Chave de Acesso no portal da SEFAZ
            </p>
          </div>
        )}

        {/* Rodapé e Canhoto */}
        <div className="space-y-3 pt-2 text-center text-[10px] text-gray-500">
          <p>Obrigado pela preferência! Guarde este comprovante para a retirada dos seus óculos.</p>
          <div className="border-t border-gray-300 pt-6">
            <p className="text-[9px] text-gray-400">Assinatura do Cliente / Retirada</p>
          </div>
        </div>
      </section>

      {/* Ação de impressão */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" aria-hidden /> Imprimir Documento
        </Button>
      </div>
    </div>
  );
}
