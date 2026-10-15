import * as React from 'react';
import { AlertCircle, Building2, Check, Loader2, Upload, Trash2, Image as ImageIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingRows } from '@/components/ui/loading-state';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';
import { fetchCnpj } from '@/lib/cnpj';
import { fetchViaCEP } from '@/lib/viacep';
import { useEmpresaStore } from '@/stores/empresaStore';

type EmpresaForm = {
  nome: string;
  cnpj: string;
  telefone: string;
  whatsapp: string;
  emailContato: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  site: string;
  logoUrl: string;
  logoBase64?: string;
};

const vazio: EmpresaForm = {
  nome: '',
  cnpj: '',
  telefone: '',
  whatsapp: '',
  emailContato: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  cep: '',
  site: '',
  logoUrl: '',
  logoBase64: '',
};

function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.problem?.detail || err.problem?.message || err.message;
  }
  return 'Não foi possível salvar. Tente novamente.';
}

/**
 * Seção Empresa do diálogo de Configurações (ONDA 2D).
 * GET/PUT /v1/empresa via stores/empresaStore — contrato inalterado.
 */
export function EmpresaConfig() {
  const { empresa, carregar, loading } = useEmpresaStore();
  const { toast } = useToast();
  const [form, setForm] = React.useState<EmpresaForm>(vazio);
  const [carregado, setCarregado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = React.useState(false);
  const [buscandoCep, setBuscandoCep] = React.useState(false);

  const buscarCnpj = async (cnpjDigitado?: string) => {
    const digitos = (cnpjDigitado ?? form.cnpj).replace(/\D/g, '');
    if (digitos.length !== 14) {
      toast({ variant: 'destructive', title: 'CNPJ incompleto', description: 'Digite os 14 números do CNPJ.' });
      return;
    }
    setBuscandoCnpj(true);
    try {
      const data = await fetchCnpj(digitos);
      const nomeEncontrado = data.nome_fantasia || data.razao_social;
      setForm((prev) => ({
        ...prev,
        nome: prev.nome || nomeEncontrado,
        telefone: prev.telefone || data.ddd_telefone_1 || '',
        emailContato: prev.emailContato || data.email || '',
        endereco: prev.endereco || data.logradouro || '',
        numero: prev.numero || data.numero || '',
        complemento: prev.complemento || data.complemento || '',
        bairro: prev.bairro || data.bairro || '',
        cidade: prev.cidade || data.municipio || '',
        uf: prev.uf || data.uf || '',
        cep: prev.cep || data.cep?.replace(/\D/g, '') || '',
      }));
      toast({
        variant: 'success',
        title: 'Dados preenchidos pela Receita Federal',
        description: nomeEncontrado,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro na consulta do CNPJ',
        description: e instanceof Error ? e.message : 'Falha ao consultar CNPJ.',
      });
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const buscarCep = async (cepDigitado?: string) => {
    const digitos = (cepDigitado ?? form.cep).replace(/\D/g, '');
    if (digitos.length !== 8) {
      toast({ variant: 'destructive', title: 'CEP incompleto', description: 'Digite os 8 números do CEP.' });
      return;
    }
    setBuscandoCep(true);
    try {
      const res = await fetchViaCEP(digitos);
      setForm((prev) => ({
        ...prev,
        endereco: res.logradouro || prev.endereco,
        bairro: res.bairro || prev.bairro,
        cidade: res.cidade || prev.cidade,
        uf: res.uf.toUpperCase() || prev.uf,
        complemento: res.complemento || prev.complemento,
      }));
      toast({
        variant: 'success',
        title: 'Endereço localizado via CEP!',
        description: `${res.logradouro}, ${res.bairro} — ${res.cidade}/${res.uf}`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Erro na consulta do CEP',
        description: e instanceof Error ? e.message : 'Falha ao buscar CEP.',
      });
    } finally {
      setBuscandoCep(false);
    }
  };

  React.useEffect(() => {
    if (!empresa || carregado) return;
    setForm({
      nome: empresa.nome ?? '',
      cnpj: empresa.cnpj ?? '',
      telefone: empresa.telefone ?? '',
      whatsapp: empresa.whatsapp ?? '',
      emailContato: empresa.emailContato ?? '',
      endereco: empresa.endereco ?? '',
      numero: empresa.numero ?? '',
      complemento: empresa.complemento ?? '',
      bairro: empresa.bairro ?? '',
      cidade: empresa.cidade ?? '',
      uf: empresa.uf ?? '',
      cep: empresa.cep ?? '',
      site: empresa.site ?? '',
      logoUrl: empresa.logoUrl ?? '',
      logoBase64: empresa.logoBase64 ?? '',
    });
    setCarregado(true);
  }, [empresa, carregado]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [enviandoLogo, setEnviandoLogo] = React.useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast({ variant: 'destructive', title: 'Formato inválido', description: 'Selecione uma imagem PNG, JPG ou WEBP.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'O logotipo deve ter no máximo 5MB.' });
      return;
    }

    setEnviandoLogo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const res = await apiClient.post<{ logoUrl?: string; logoBase64?: string }>('/v1/empresa/logo', { base64 });
        setForm((prev) => ({
          ...prev,
          logoUrl: res.data.logoUrl || '/api/v1/empresa/logo.png',
          logoBase64: base64,
        }));
        await carregar(true);
        toast({
          variant: 'success',
          title: 'Logotipo atualizado!',
          description: 'A imagem foi salva no banco de dados e será exibida no DANFE, recibos e orçamentos.',
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erro no envio do logo',
          description: mensagemErro(err),
        });
      } finally {
        setEnviandoLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoverLogo = async () => {
    setForm((prev) => ({ ...prev, logoUrl: '', logoBase64: '' }));
    try {
      await apiClient.put('/v1/empresa', { ...form, logoUrl: '', logoBase64: '' });
      await carregar(true);
      toast({ variant: 'success', title: 'Logotipo removido' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: mensagemErro(err) });
    }
  };

  React.useEffect(() => {
    if (!empresa) {
      carregar().catch(() => undefined);
    }
  }, [empresa, carregar]);

  const salvar = async () => {
    setErro(null);
    setSalvando(true);
    try {
      await apiClient.put('/v1/empresa', form);
      await carregar(true);
      toast({
        variant: 'success',
        title: 'Dados da empresa salvos',
        description: 'Nome, contato e endereço já valem para documentos e WhatsApp.',
      });
    } catch (err) {
      const msg = mensagemErro(err);
      setErro(msg);
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: msg });
    } finally {
      setSalvando(false);
    }
  };

  const set =
    (campo: keyof EmpresaForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [campo]: e.target.value }));
    };

  const carregandoInicial = !empresa && loading;

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Building2 className="h-3.5 w-3.5" aria-hidden /> Empresa
        </h3>
        <Button size="sm" onClick={salvar} disabled={salvando} aria-busy={salvando}>
          {salvando ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          Salvar
        </Button>
      </div>

      <p className="mt-2 text-xs text-secondary">
        Nome, CNPJ, contato e endereço usados em documentos e no WhatsApp (links{' '}
        <span className="font-mono">wa.me</span>).
      </p>

      {erro && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded border border-danger-light bg-danger-light px-3 py-2 text-xs text-danger-dark"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{erro}</span>
        </div>
      )}

      <div className="mt-3">
        {carregandoInicial ? (
          <LoadingRows rows={7} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Nome da empresa"
                value={form.nome}
                onChange={set('nome')}
                maxLength={200}
                placeholder="Ótica VisionBox"
              />
              <div className="space-y-1.5">
                <Label htmlFor="empresa-cnpj">CNPJ (Receita Federal)</Label>
                <div className="flex gap-2">
                  <Input
                    id="empresa-cnpj"
                    value={form.cnpj}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 14);
                      setForm((prev) => ({ ...prev, cnpj: val }));
                    }}
                    onBlur={() => {
                      if (form.cnpj.replace(/\D/g, '').length === 14 && !form.nome) {
                        void buscarCnpj();
                      }
                    }}
                    maxLength={14}
                    inputMode="numeric"
                    placeholder="Somente números"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void buscarCnpj()}
                    disabled={buscandoCnpj}
                    className="shrink-0 gap-1 text-xs"
                    title="Buscar dados na Receita Federal via BrasilAPI"
                  >
                    <Search className={buscandoCnpj ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                    {buscandoCnpj ? 'Consultando…' : 'Buscar Receita'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Telefone"
                value={form.telefone}
                onChange={set('telefone')}
                maxLength={20}
                placeholder="(11) 4000-0000"
              />
              <TextField
                label="WhatsApp (suporte)"
                value={form.whatsapp}
                onChange={set('whatsapp')}
                maxLength={20}
                placeholder="5511984987382"
                hint="Formato internacional com DDI 55, sem espaços."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="E-mail de contato"
                type="email"
                value={form.emailContato}
                onChange={set('emailContato')}
                maxLength={200}
                placeholder="contato@visionbox.com.br"
              />
              <TextField
                label="Site"
                value={form.site}
                onChange={set('site')}
                maxLength={255}
                placeholder="https://www.visionbox.com.br"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <div className="space-y-1.5">
                  <Label htmlFor="empresa-cep">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      id="empresa-cep"
                      value={form.cep}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setForm((prev) => ({ ...prev, cep: val }));
                        if (val.length === 8) {
                          void buscarCep(val);
                        }
                      }}
                      maxLength={8}
                      inputMode="numeric"
                      placeholder="00000000"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void buscarCep()}
                      disabled={buscandoCep}
                      className="shrink-0 gap-1 text-xs px-2.5"
                      title="Buscar endereço nos Correios via ViaCEP"
                    >
                      <Search className={buscandoCep ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                      {buscandoCep ? '…' : 'Buscar'}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="sm:col-span-4">
                <TextField
                  label="Endereço"
                  value={form.endereco}
                  onChange={set('endereco')}
                  maxLength={255}
                  placeholder="Av. Paulista, 1000"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <TextField
                  label="Número"
                  value={form.numero}
                  onChange={set('numero')}
                  maxLength={20}
                  placeholder="1000"
                />
              </div>
              <div className="sm:col-span-4">
                <TextField
                  label="Complemento"
                  value={form.complemento}
                  onChange={set('complemento')}
                  maxLength={120}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <TextField
                  label="Bairro"
                  value={form.bairro}
                  onChange={set('bairro')}
                  maxLength={120}
                />
              </div>
              <TextField
                label="Cidade"
                value={form.cidade}
                onChange={set('cidade')}
                maxLength={120}
              />
              <TextField
                label="UF"
                value={form.uf}
                onChange={set('uf')}
                maxLength={2}
                placeholder="SP"
              />
            </div>

            {/* Seção Logotipo com Upload e Preview */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-primary">Logotipo da Empresa</h4>
                  <p className="text-xs text-secondary">
                    Utilizado na impressão de DANFE (NF-e/NFC-e), Recibos térmicos e Orçamentos da OS. Salvo e persistido no banco de dados.
                  </p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={enviandoLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {enviandoLogo ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {form.logoUrl || form.logoBase64 ? 'Alterar Logo' : 'Enviar Logo'}
                </Button>
              </div>

              {(form.logoBase64 || form.logoUrl) ? (
                <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-page p-3">
                  <div className="flex h-16 w-36 items-center justify-center rounded border border-border bg-white p-1 overflow-hidden shadow-sm">
                    <img
                      src={form.logoBase64 || form.logoUrl}
                      alt="Logo da empresa"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-xs font-medium text-success flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Logotipo persistido no banco de dados
                    </p>
                    <p className="text-[11px] text-muted truncate mt-0.5">
                      {form.logoUrl || '/api/v1/empresa/logo.png'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={handleRemoverLogo}
                    title="Remover logotipo"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Remover
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border p-5 text-center cursor-pointer hover:border-primary/50 hover:bg-page transition"
                >
                  <ImageIcon className="h-8 w-8 text-muted" />
                  <p className="text-xs font-medium text-primary">Nenhum logotipo enviado</p>
                  <p className="text-[11px] text-muted">Clique para selecionar imagem PNG, JPG ou WEBP (máx. 5MB)</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
