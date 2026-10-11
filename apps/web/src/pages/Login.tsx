import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Eye, EyeOff, FileText, Glasses, Loader2, Lock, User } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import s from './Login.module.css';

/**
 * Login — ONDA 2A.
 *
 * Composição 57/43: foto da ótica (`/assets/login-optica.png`) com véu marrom à
 * esquerda e card creme à direita. Sem `position:fixed`, sem zoom e sem scroll em
 * nenhuma altura (100dvh + breakpoints de altura locais no CSS module).
 * Foto/logo têm fallback — a tela nunca quebra se o asset faltar.
 */
const PHOTO = '/assets/login-optica.png';
const LOGO = '/assets/logo_.png';

const FEATURES = [
  { icon: Glasses, lines: ['Clientes', 'e prescrições'] },
  { icon: FileText, lines: ['Vendas e pedidos', 'em um só lugar'] },
  { icon: BarChart3, lines: ['Relatórios que', 'impulsionam', 'seus resultados'] },
];

export default function Login() {
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [lembrar, setLembrar] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = React.useState(false);
  const [logoFailed, setLogoFailed] = React.useState(false);

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
      // ApiError já carrega problem.detail (RFC 7807) ou a mensagem de timeout/sem rede
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
        {/* ============ PAINEL ESQUERDO — foto + véu marrom ============ */}
        <section className={s.photo} aria-label="VisionBox — gestão para óticas">
          {!photoFailed && (
            <img
              className={s.photoImg}
              src={PHOTO}
              alt=""
              aria-hidden
              onError={() => setPhotoFailed(true)}
            />
          )}
          <div className={s.photoOverlay} aria-hidden />

          <div className={s.photoContent}>
            <div>
              <div className={s.rule} aria-hidden />
              <p className={s.kicker}>
                Tecnologia
                <br />a favor de
                <br />
                novos olhares
              </p>
            </div>

            <div>
              <h1 className={s.headline}>
                <span>Gestão completa</span>
                <span className={s.headlineStrong}>para sua ótica</span>
              </h1>
              <p className={s.subtext}>
                Mais controle, organização e resultados para o crescimento do seu negócio.
              </p>

              <ul className={s.benefits}>
                {FEATURES.map(({ icon: Icon, lines }) => (
                  <li key={lines[0]} className={s.benefit}>
                    <span className={s.benefitIcon}>
                      <Icon className="h-6 w-6" strokeWidth={1.6} aria-hidden />
                    </span>
                    <span className={s.benefitText}>
                      {lines.map((line) => (
                        <span key={line} className={s.benefitLine}>
                          {line}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className={s.rule} aria-hidden />
              <p className={s.bottom}>
                Visão para
                <br />grandes
                <br />
                conquistas
              </p>
            </div>
          </div>
        </section>

        {/* ============ PAINEL DIREITO — card de acesso ============ */}
        <main className={s.card}>
          <div className={s.deco} aria-hidden />

          <div className={s.cardInner}>
            <div className={s.logoWrap}>
              {logoFailed ? (
                <div className={s.logoFallback} aria-label="VisionBox — um novo olhar em gestão">
                  <span className={s.logoWord}>
                    Vision<span className={s.logoWordAccent}>Box</span>
                  </span>
                  <span className={s.logoTagline}>Um novo olhar em gestão</span>
                </div>
              ) : (
                <img
                  className={s.logo}
                  src={LOGO}
                  alt="VisionBox — um novo olhar em gestão"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>

            <form onSubmit={handleSubmit} className={s.form} noValidate={false}>
              {/* Usuário */}
              <div className={s.inputWrap}>
                <label className="sr-only" htmlFor="login-email">
                  Usuário
                </label>
                <User className={s.inputIcon} strokeWidth={1.7} aria-hidden />
                <Input
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

              {/* Senha (exibível) */}
              <div className={s.inputWrap}>
                <label className="sr-only" htmlFor="login-senha">
                  Senha
                </label>
                <Lock className={s.inputIcon} strokeWidth={1.7} aria-hidden />
                <Input
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
                  {showPassword ? <Eye className="h-5 w-5" aria-hidden /> : <EyeOff className="h-5 w-5" aria-hidden />}
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

              <Button type="submit" disabled={loading} className={s.submit} aria-busy={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Rodapé */}
          <footer className={s.footer}>
            <span className={s.footerTagline}>Foco na sua visão, impulso no seu negócio.</span>
            <span className={s.divider} aria-hidden />
            <span>
              Desenvolvido por <strong className={s.footerStrong}>TechboxBR</strong> 2026
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
