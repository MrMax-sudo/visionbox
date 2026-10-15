/**
 * cnpj.ts — Consulta oficial de CNPJ na Receita Federal via BrasilAPI pública gratuita.
 * Utilizado para preenchimento automático de Razão Social, Nome Fantasia, Endereço,
 * Telefone e E-mail nos cadastros de empresa.
 */

export interface BrasilApiCnpjResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string;
  descricao_situacao_cadastral?: string;
}

export async function fetchCnpj(cnpj: string): Promise<BrasilApiCnpjResult> {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) {
    throw new Error('CNPJ deve conter exatamente 14 dígitos');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('CNPJ não localizado na Receita Federal');
      }
      throw new Error(`Consulta à Receita Federal retornou erro (${res.status})`);
    }
    return (await res.json()) as BrasilApiCnpjResult;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Tempo limite esgotado ao consultar a Receita Federal');
    }
    if (err instanceof Error) throw err;
    throw new Error('Falha de conexão ao consultar CNPJ');
  } finally {
    clearTimeout(timeoutId);
  }
}
