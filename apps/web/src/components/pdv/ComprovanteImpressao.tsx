import * as React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export function ComprovanteImpressao({
  osNumero = 'OS-2026-0001',
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
  const dataFormatada = new Date(data).toLocaleString('pt-BR');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Área visível na tela e formatada para impressão via CSS */}
      <div id="area-comprovante-impressao" className="rounded-lg border border-[var(--color-border)] bg-white p-6 font-mono text-black text-xs shadow-sm print:m-0 print:border-0 print:p-0 print:text-[10pt]">
        {/* Cabeçalho */}
        <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
          <h2 className="text-sm font-bold tracking-wider">VISIONBOX ÓTICA & LABORATÓRIO</h2>
          <p className="text-[10px] text-gray-600">Soluções Especializadas em Saúde Visual</p>
          <p className="text-[10px] text-gray-600">CNPJ: 00.000.000/0001-00</p>
          <p className="text-[10px] text-gray-600">Atendimento ao Cliente: (11) 99999-9999</p>
          <div className="mt-2 inline-block rounded bg-gray-100 px-2 py-0.5 font-bold text-[11px] text-black border border-gray-300">
            {tipo === 'os' ? 'VIA DE ORDEM DE SERVIÇO' : chaveNfce ? 'DANFE NFC-e - DOCUMENTO AUXILIAR' : 'COMPROVANTE DE PEDIDO / VENDA'}
          </div>
        </div>

        {/* Informações da OS e Cliente */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-1">
          <div className="flex justify-between">
            <span className="font-bold">NÚMERO OS:</span>
            <span className="font-bold">{osNumero}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>EMISSÃO:</span>
            <span>{dataFormatada}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span>CLIENTE:</span>
            <span className="font-bold">{clienteNome}</span>
          </div>
          {clienteCpf && (
            <div className="flex justify-between text-[11px]">
              <span>CPF:</span>
              <span>{clienteCpf}</span>
            </div>
          )}
          {clienteTelefone && (
            <div className="flex justify-between text-[11px]">
              <span>TELEFONE:</span>
              <span>{clienteTelefone}</span>
            </div>
          )}
        </div>

        {/* Seção Clínica (quando presente na OS) */}
        {(grauOD || grauOE) && (
          <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
            <p className="font-bold mb-1 text-[11px]">PRESCRIÇÃO ÓTICA (GRAUS):</p>
            {grauOD && <p className="text-[10px]">OD: {grauOD}</p>}
            {grauOE && <p className="text-[10px]">OE: {grauOE}</p>}
          </div>
        )}

        {/* Itens */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <p className="font-bold mb-1 text-[11px]">ITENS DO PEDIDO:</p>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] text-gray-500">
                <th className="py-1">ITEM</th>
                <th className="py-1 text-center">QTD</th>
                <th className="py-1 text-right">UN (R$)</th>
                <th className="py-1 text-right">TOTAL (R$)</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-100 text-[11px]">
                  <td className="py-1 pr-1 font-sans">{it.nome}</td>
                  <td className="py-1 text-center">{it.qtd}</td>
                  <td className="py-1 text-right">{(it.preco).toFixed(2)}</td>
                  <td className="py-1 text-right font-bold">{(it.preco * it.qtd).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totais e Pagamento */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>DESCONTO:</span>
              <span>- R$ {desconto.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-gray-300 pt-1">
            <span>TOTAL PAGO:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] pt-1">
            <span>FORMA DE PAGAMENTO:</span>
            <span className="font-bold">{formaPagamento}</span>
          </div>
        </div>

        {/* Dados Fiscais NFC-e (se emitido) */}
        {chaveNfce && (
          <div className="border-b border-dashed border-gray-400 pb-3 mb-3 text-[10px] text-center space-y-1 bg-gray-50 p-2 rounded">
            <p className="font-bold">CHAVE DE ACESSO NFC-E:</p>
            <p className="break-all font-mono">{chaveNfce}</p>
            {protocoloNfce && <p className="text-gray-600">Protocolo de Autorização: {protocoloNfce}</p>}
            <p className="text-[9px] text-gray-500">Consulte pela Chave de Acesso no portal da SEFAZ</p>
          </div>
        )}

        {/* Rodapé e Canhoto */}
        <div className="pt-2 text-center text-[10px] text-gray-500 space-y-3">
          <p>Obrigado pela preferência! Guarde este comprovante para a retirada dos seus óculos.</p>
          <div className="pt-6 border-t border-gray-300">
            <p className="text-[9px] text-gray-400">Assinatura do Cliente / Retirada</p>
          </div>
        </div>
      </div>

      {/* Ação de impressão */}
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="primary" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir Documento
        </Button>
      </div>
    </div>
  );
}
