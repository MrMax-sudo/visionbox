import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import s from './Login.module.css';

const BANNER_LEFT = '/assets/login-banner-left.png';
const LOGO = '/assets/logo_.png';

export default function Login() {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [lembrar, setLembrar] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const setAuth = useAuthStore((st) => st.setAuth);
  const nav = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { data } = await apiClient.post(
        '/v1/auth/login',
        { email, senha },
        { headers: { 'X-Skip-Idempotency-Key': 'true' } },
      );
      const d = data as {
        accessToken: string;
        usuario: { id: string; nome: string; email: string; perfil: string; lojaId: string };
      };
      setAuth({
        token: d.accessToken,
        user: {
          id: d.usuario.id,
          nome: d.usuario.nome,
          email: d.usuario.email,
          perfil: d.usuario.perfil as never,
          lojaId: d.usuario.lojaId,
        },
      });
      nav('/', { replace: true });
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.problem?.detail || err.message || 'Falha no login'
          : err instanceof Error
            ? err.message
            : 'Falha no login';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.page}>
      <div className={s.grid}>
        {/* ============ PAINEL ESQUERDO — Banner gráfico ============ */}
        <section className={s.photo} aria-label="VisionBox — Gestão completa para sua ótica">
          <img
            className={s.photoImg}
            src={BANNER_LEFT}
            alt="VisionBox — Gestão completa para sua ótica: Mais controle, organização e resultados para o crescimento do seu negócio"
          />
          <div className="sr-only">
            <h1>Gestão completa para sua ótica</h1>
            <p>Mais controle, organização e resultados para o crescimento do seu negócio.</p>
            <ul>
              <li>Clientes e prescrições</li>
              <li>Vendas e pedidos em um só lugar</li>
              <li>Relatórios que impulsionam seus resultados</li>
            </ul>
            <p>Tecnologia a favor de novos olhares. Visão para grandes conquistas.</p>
          </div>
        </section>

        {/* ============ PAINEL DIREITO — Card de acesso ============ */}
        <main className={s.card}>
          {/* Anel decorativo (canto superior direito) — CSS puro */}
          <span className={s.deco} aria-hidden />

          <div className={s.cardInner}>
            <div className={s.logoWrap}>
              <img className={s.logo} src={LOGO} alt="VisionBox — Um novo olhar em gestão" />
            </div>

            <form onSubmit={handleSubmit} className={s.form}>
              {/* Usuário */}
              <div className={s.inputWrap}>
                <label className="sr-only" htmlFor="login-email">
                  Usuário
                </label>
                <User className={s.inputIcon} strokeWidth={1.7} aria-hidden />
                <input
                  id="login-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Usuário"
                  autoComplete="username"
                  required
                  autoFocus
                  aria-invalid={erro ? true : undefined}
                  className={s.input}
                />
              </div>

              {/* Senha */}
              <div className={s.inputWrap}>
                <label className="sr-only" htmlFor="login-senha">
                  Senha
                </label>
                <Lock className={s.inputIcon} strokeWidth={1.7} aria-hidden />
                <input
                  id="login-senha"
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Senha"
                  autoComplete="current-password"
                  required
                  aria-invalid={erro ? true : undefined}
                  className={`${s.input} ${s.inputPassword}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className={s.pwToggle}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <Eye className={s.pwIcon} strokeWidth={1.7} aria-hidden />
                  ) : (
                    <EyeOff className={s.pwIcon} strokeWidth={1.7} aria-hidden />
                  )}
                </button>
              </div>

              {/* Lembrar de mim */}
              <Label htmlFor="login-lembrar" className={s.remember}>
                <Checkbox
                  id="login-lembrar"
                  checked={lembrar}
                  onCheckedChange={(checked) => setLembrar(checked === true)}
                  className={s.checkbox}
                />
                <span>Lembrar de mim</span>
              </Label>

              {erro && (
                <div role="alert" className={s.error}>
                  {erro}
                </div>
              )}

              <button type="submit" disabled={loading} className={s.submit} aria-busy={loading}>
                {loading ? (
                  <>
                    <Loader2 className={`${s.btnIcon} animate-spin`} aria-hidden />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className={s.btnIcon} strokeWidth={1.7} aria-hidden />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Rodapé */}
          <footer className={s.footer}>
            <span className={s.footerTagline}>
              FOCO NA SUA VISÃO,
              <br />
              IMPULSO NO SEU NEGÓCIO.
            </span>
            <span className={s.divider} aria-hidden />
            <span className={s.footerCopyright}>
              Desenvolvido por <strong className={s.footerStrong}>TechboxBR</strong> 2026
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
