import * as React from 'react';
import { AlertCircle, Building2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  if (err instanceof ApiError) return err.message;
  return 'Não foi possível salvar. Tente novamente.';
}

export function EmpresaConfig() {
  const { empresa, carregar } = useEmpresaStore();
  const [form, setForm] = React.useState<EmpresaForm>(vazio);
  const [carregado, setCarregado] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [salvo, setSalvo] = React.useState(false);

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
    setSalvo(false);
    setSalvando(true);
    try {
      await apiClient.put('/v1/empresa', form);
      await carregar(true);
      setSalvo(true);
      window.setTimeout(() => setSalvo(false), 2500);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const set = (campo: keyof EmpresaForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [campo]: e.target.value }));
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          <Building2 className="h-3.5 w-3.5" aria-hidden /> Empresa
        </h3>
        <div className="flex items-center gap-2">
          {salvo && (
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-success-dark)]">
              <Check className="h-3.5 w-3.5" /> Salvo
            </span>
          )}
          <Button size="sm" variant="primary" onClick={salvar} disabled={salvando} aria-busy={salvando}>
            {salvando ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
        Nome, CNPJ, contato e endereço usados em documentos e no WhatsApp (links <span className="font-mono">wa.me</span>).
      </p>

      {erro && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--color-danger-light)] p-2.5 text-xs text-[var(--color-danger-dark)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome da empresa">
            <Input value={form.nome} onChange={set('nome')} maxLength={200} placeholder="Ótica VisionBox" />
          </Field>
          <Field label="CNPJ">
            <Input value={form.cnpj} onChange={set('cnpj')} maxLength={14} placeholder="Somente números" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <Input value={form.telefone} onChange={set('telefone')} maxLength={20} placeholder="(11) 4000-0000" />
          </Field>
          <Field label="WhatsApp (suporte)">
            <Input value={form.whatsapp} onChange={set('whatsapp')} maxLength={20} placeholder="5511984987382" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail de contato">
            <Input value={form.emailContato} onChange={set('emailContato')} maxLength={200} placeholder="contato@visionbox.com.br" />
          </Field>
          <Field label="Site">
            <Input value={form.site} onChange={set('site')} maxLength={255} placeholder="https://www.visionbox.com.br" />
          </Field>
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-4">
            <Field label="Endereço">
              <Input value={form.endereco} onChange={set('endereco')} maxLength={255} placeholder="Av. Paulista, 1000" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Número">
              <Input value={form.numero} onChange={set('numero')} maxLength={20} placeholder="1000" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <Field label="Complemento">
              <Input value={form.complemento} onChange={set('complemento')} maxLength={120} />
            </Field>
          </div>
          <div className="col-span-3">
            <Field label="Bairro">
              <Input value={form.bairro} onChange={set('bairro')} maxLength={120} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2">
            <Field label="Cidade">
              <Input value={form.cidade} onChange={set('cidade')} maxLength={120} />
            </Field>
          </div>
          <Field label="UF">
            <Input value={form.uf} onChange={set('uf')} maxLength={2} placeholder="SP" />
          </Field>
          <Field label="CEP">
            <Input value={form.cep} onChange={set('cep')} maxLength={8} placeholder="Somente números" />
          </Field>
        </div>

        <Field label="URL do logo">
          <Input value={form.logoUrl} onChange={set('logoUrl')} maxLength={500} placeholder="https://cdn.exemplo.com/logo.png" />
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}