/**
 * viacep.ts — fetch ViaCEP com tratamento de erro e timeout
 * Usa fetch nativo para não passar por interceptors de auth/idempotency.
 */

export type ViaCEPResult = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  ddd?: string;
};

type ViaCEPRaw = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ddd?: string;
  erro?: boolean | string;
};

/**
 * Busca endereço por CEP (8 dígitos).
 * @param cep string com ou sem máscara
 * @throws Error se CEP inválido ou não encontrado
 */
export async function fetchViaCEP(cep: string): Promise<ViaCEPResult> {
  const clean = cep.replace(/\D/g, '').slice(0, 8);
  if (clean.length !== 8) throw new Error('CEP deve conter 8 dígitos');

  const url = `https://viacep.com.br/ws/${clean}/json/`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`ViaCEP HTTP ${res.status}`);
    const data = (await res.json()) as ViaCEPRaw;
    if (data.erro) throw new Error('CEP não encontrado');
    return {
      cep: data.cep ?? clean,
      logradouro: data.logradouro ?? '',
      complemento: data.complemento ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      uf: data.uf ?? '',
      ddd: data.ddd,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('Tempo esgotado ao buscar CEP');
    throw e instanceof Error ? e : new Error('Falha ao buscar CEP');
  } finally {
    window.clearTimeout(timeout);
  }
}
