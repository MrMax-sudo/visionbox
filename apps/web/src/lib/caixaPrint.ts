import { executarImpressao } from '@/lib/reciboPrint';
import type { RelatorioFechamento, ClassificacaoDiferenca } from '@/lib/caixaService';
import type { EmpresaConfig } from '@/stores/empresaStore';

/**
 * Impressão térmica 80mm do Fechamento de Caixa (Fase 2 Robustez ERP).
 * Mesmo padrão do ComprovanteImpressao/reciboPrint: iframe isolado + @media print,
 * layout monoespaçado da bobina, @page 80mm. Imprime o resumo por modalidade do
 * RelatorioFechamentoDTO (backend) — nenhuma apuração é feita no client.
 */

const AMP = String.fromCharCode(38); // "&" — evita entidade literal no fonte

function esc(texto?: string | null): string {
  return (texto ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return AMP + 'amp;';
      case '<': return AMP + 'lt;';
      case '>': return AMP + 'gt;';
      case '"': return AMP + 'quot;';
      default: return AMP + '#39;';
    }
  });
}

function moeda(valor?: number | null): string {
  return (valor ?? 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dataHora(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${min}`;
}

function rotuloClassificacao(classificacao?: ClassificacaoDiferenca | null): string {
  if (classificacao === 'SOBRA') return 'SOBRA DE CAIXA';
  if (classificacao === 'QUEBRA') return 'QUEBRA DE CAIXA';
  if (classificacao === 'EXATO') return 'EXATO (SEM DIFERENCA)';
  return 'EM ANDAMENTO';
}

/** Linha pontilhada "descrição ......... R$ valor" da bobina. */
function linhaValor(rotulo: string, valor: number | null | undefined, destaque = false): string {
  return `
    <div style="display:flex; justify-content:space-between; gap:4px; ${destaque ? 'font-weight:bold; font-size:1.05em;' : ''}">
      <span>${esc(rotulo)}</span>
      <span>R$ ${moeda(valor)}</span>
    </div>`;
}

/**
 * Gera o HTML da bobina 80mm do fechamento de caixa (não fiscal).
 * Base: RelatorioFechamentoDTO + dados da empresa (cabeçalho da loja).
 */
export function gerarHtmlFechamentoCaixa(
  relatorio: RelatorioFechamento,
  empresa?: EmpresaConfig | null,
): string {
  const empNome = esc(empresa?.nome || 'VISIONBOX OTICA');
  const empCnpj = empresa?.cnpj || '00.000.000/0001-91';
  const empEnd = [
    empresa?.endereco,
    empresa?.numero ? `, ${empresa.numero}` : '',
    empresa?.bairro ? ` - ${empresa.bairro}` : '',
    empresa?.cidade ? ` / ${empresa.cidade}` : '',
    empresa?.uf ? ` - ${empresa.uf}` : '',
  ]
    .filter(Boolean)
    .join('');
  const empFone = empresa?.telefone || empresa?.whatsapp || '';

  const abertoFechado =
    relatorio.status === 'ABERTO'
      ? `<tr><td>ABERTURA:</td><td class="text-right">${dataHora(relatorio.abertoEm)}</td></tr>
         <tr><td>FECHAMENTO:</td><td class="text-right">TURNO EM ANDAMENTO</td></tr>`
      : `<tr><td>ABERTURA:</td><td class="text-right">${dataHora(relatorio.abertoEm)}</td></tr>
         <tr><td>FECHAMENTO:</td><td class="text-right">${dataHora(relatorio.fechadoEm)}</td></tr>`;

  const modalidadesHtml = relatorio.resumoPorModalidade
    .map((m) => linhaValor(m.nome.toUpperCase(), m.total))
    .join('');

  const diferencaBloco =
    relatorio.status === 'FECHADO'
      ? `${linhaValor('VALOR CONTADO (INFORMADO)', relatorio.valorFechamentoInformado)}
         ${linhaValor('DIFERENCA DE CONFERENCIA', relatorio.diferencaFechamento, true)}
         <div class="text-center" style="font-weight:bold; margin-top:4px;">
           ${esc(rotuloClassificacao(relatorio.classificacaoDiferenca))}
         </div>`
      : `<div class="text-center" style="font-size:0.85em;">
           TURNO AINDA ABERTO — RELATORIO PARCIAL
         </div>`;

  const observacaoHtml = relatorio.observacaoFechamento
    ? `<div class="divider"></div>
       <div style="font-size:0.85em;">
         <strong>OBSERVACOES:</strong><br>${esc(relatorio.observacaoFechamento)}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Fechamento de Caixa</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Lucida Console', 'Consolas', 'Courier New', monospace;
      background-color: #fff;
      color: #000;
      padding: 6mm 4mm;
      width: 80mm;
      margin: 0 auto;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h4 {
      text-align: center;
      margin: 4px 0;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: bold;
    }
    .text-center { text-align: center; }
    .text-right  { text-align: right; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
    th, td { text-align: left; padding: 2px 1px; vertical-align: top; }
    th { border-bottom: 1px solid #000; font-size: 0.85em; text-transform: uppercase; }
    @media print {
      body { width: 100%; padding: 2mm 3mm; }
    }
  </style>
</head>
<body>
  <div>
    <h4>${empNome}</h4>
    <div class="text-center" style="font-size:0.8em; line-height:1.35;">
      <div>CNPJ: ${esc(empCnpj)}</div>
      ${empEnd ? `<div>${esc(empEnd)}</div>` : ''}
      ${empFone ? `<div>Fone: ${esc(empFone)}</div>` : ''}
    </div>

    <div class="divider"></div>
    <h4>FECHAMENTO DE CAIXA</h4>
    <div class="divider"></div>

    <table>
      <tr><td>CAIXA:</td><td class="text-right">${esc(relatorio.identificacaoCaixa)}</td></tr>
      <tr><td>OPERADOR:</td><td class="text-right">${esc(relatorio.operadorNome || 'Operador')}</td></tr>
      ${abertoFechado}
    </table>

    <div class="divider"></div>

    ${linhaValor('FUNDO DE TROCO', relatorio.saldoInicial)}
    ${linhaValor('(+) ENTRADAS', relatorio.totalEntradas)}
    ${linhaValor('(-) SAIDAS / SANGRIAS', relatorio.totalSaidas)}
    ${linhaValor('= ESPERADO (SISTEMA)', relatorio.valorFechamentoSistema, true)}

    <div class="divider"></div>
    ${diferencaBloco}

    <div class="divider"></div>
    <div style="font-weight:bold;">RESUMO POR MODALIDADE</div>
    <div style="font-size:0.9em; margin-top:2px;">
      ${modalidadesHtml}
      ${linhaValor('TOTAL VENDAS', relatorio.totalVendas, true)}
    </div>

    <div class="divider"></div>
    <div style="font-size:0.9em;">
      ${linhaValor('TOTAL SANGRIAS', relatorio.totalSangrias)}
      ${linhaValor('TOTAL SUPRIMENTOS', relatorio.totalSuprimentos)}
    </div>

    ${observacaoHtml}

    <div class="divider"></div>
    <div class="text-center" style="font-size:0.75em; color:#333;">
      Assinatura do Operador
      <div style="border-top:1px solid #999; margin-top:26px; padding-top:3px;">
        ${esc(relatorio.operadorNome || '')}
      </div>
    </div>

    <div class="divider"></div>
    <div class="text-center" style="font-size:0.75em; color:#444;">
      DOCUMENTO NAO FISCAL<br>
      VisionBox ERP • ${dataHora(relatorio.fechadoEm || relatorio.abertoEm)}
    </div>
  </div>
</body>
</html>`;
}

/** Dispara a impressão 80mm via iframe isolado (padrão executarImpressao). */
export function imprimirFechamentoCaixa(
  relatorio: RelatorioFechamento,
  empresa?: EmpresaConfig | null,
): void {
  executarImpressao(gerarHtmlFechamentoCaixa(relatorio, empresa));
}
