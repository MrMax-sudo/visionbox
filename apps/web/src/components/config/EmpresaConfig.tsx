import * as React from 'react';
import { AlertCircle, Building2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingRows } from '@/components/ui/loading-state';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/use-toast';
import { apiClient, ApiError } from '@/lib/apiClient';
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
    });
    setCarregado(true);
  }, [empresa, carregado]);

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
              <TextField
                label="CNPJ"
                value={form.cnpj}
                onChange={set('cnpj')}
                maxLength={14}
                inputMode="numeric"
                placeholder="Somente números"
              />
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
              <div className="sm:col-span-4">
                <TextField
                  label="Endereço"
                  value={form.endereco}
                  onChange={set('endereco')}
                  maxLength={255}
                  placeholder="Av. Paulista, 1000"
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label="Número"
                  value={form.numero}
                  onChange={set('numero')}
                  maxLength={20}
                  placeholder="1000"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Complemento"
                value={form.complemento}
                onChange={set('complemento')}
                maxLength={120}
              />
              <TextField
                label="Bairro"
                value={form.bairro}
                onChange={set('bairro')}
                maxLength={120}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <TextField
                  label="Cidade"
                  value={form.cidade}
                  onChange={set('cidade')}
                  maxLength={120}
                />
              </div>
              <TextField
                label="UF"
                value={form.uf}
                onChange={set('uf')}
                maxLength={2}
                placeholder="SP"
              />
              <TextField
                label="CEP"
                value={form.cep}
                onChange={set('cep')}
                maxLength={8}
                inputMode="numeric"
                placeholder="Somente números"
              />
            </div>

            <TextField
              label="URL do logo"
              value={form.logoUrl}
              onChange={set('logoUrl')}
              maxLength={500}
              placeholder="https://cdn.exemplo.com/logo.png"
            />
          </div>
        )}
      </div>
    </section>
  );
}
