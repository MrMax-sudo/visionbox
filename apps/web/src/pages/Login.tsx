import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { ArrowRight, BarChart3, Eye, EyeOff, FileText, Glasses, Loader2, Lock, User } from 'lucide-react';

/**
 * Único asset externo necessário (opcional): /public/assets/login-bg.jpg
 * -> FOTO da ótica SEM textos (prateleiras + óculos sobre o balcão).
 * Se não existir, o painel esquerdo mostra um degradê marrom e a tela continua funcionando.
 */
const BG_PHOTO = '/assets/login-bg.jpg';

/* Logotipo em SVG/HTML — não depende de nenhuma imagem */
function VisionBoxLogo() {
  return (
    <div className="flex flex-col items-center select-none" aria-label="VisionBox - Um novo olhar em gestão">
      <svg viewBox="0 0 120 50" className="h-[54px] w-auto mb-1" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="vb-lens" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#B98B57" />
            <stop offset="1" stopColor="#7A4A22" />
          </linearGradient>
        </defs>
        {/* lente esquerda */}
        <circle cx="34" cy="27" r="19" stroke="#4A2812" strokeWidth="6.5" />
        {/* lente direita */}
        <circle cx="86" cy="27" r="19" stroke="url(#vb-lens)" strokeWidth="6.5" />
        {/* ponte */}
        <path d="M52 22 Q60 12 68 22" stroke="#7A4A22" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div className="text-[46px] sm:text-[52px] leading-none font-bold tracking-[-0.045em]">
        <span className="text-[#4A2812]">Vision</span>
        <span className="text-[#8A5A2B]">Box</span>
      </div>
      <div className="mt-3 text-[10px] sm:text-[11px] uppercase tracking-[0.42em] text-[#5B4030] pl-[0.42em]">
        Um novo olhar em gestão
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Glasses, lines: ['Clientes', 'e prescrições'] },
  { icon: FileText, lines: ['Vendas e pedidos', 'em um só lugar'] },
  { icon: BarChart3, lines: ['Relatórios que', 'impulsionam', 'seus resultados'] },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lembrar, setLembrar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const { data } = await apiClient.post(
        '/v1/auth/login',
        { email, senha },
        { headers: { 'X-Skip-Idempotency-Key': 'true' } }
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
      const msg = err instanceof Error ? err.message : 'Falha no login';
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    'w-full h-[52px] rounded-xl border border-[#DDD3C9] bg-[#FBF8F5] text-[#3E2C22] ' +
    'placeholder:text-[#9C8B7E] text-[15px] shadow-[0_1px_2px_rgba(60,40,25,0.05)] ' +
    'focus:border-[#6B4423] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B4423]/15 transition';

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#E9E1D8] to-[#DDD1C4] lg:h-screen">
      {/* ================= PAINEL ESQUERDO (foto + texto) ================= */}
      <section
        className="absolute hidden lg:block left-[1.5%] top-[2.2%] bottom-[2.4%] w-[57.7%] overflow-hidden rounded-[28px] border border-[#C9B8A6]/60 shadow-[0_20px_60px_rgba(40,25,15,0.25)]"
        style={{
          backgroundImage: `url(${BG_PHOTO}), linear-gradient(135deg, #3A281C 0%, #5A3F2C 55%, #8B6A4B 100%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Véu marrom: escuro à esquerda, transparente à direita */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#2B1D14]/90 via-[#3A281C]/70 to-transparent to-[62%]" />

        <div className="relative z-10 flex h-full flex-col justify-between py-[7%] pl-[6%] pr-[36%] text-[#F3E9DF]">
          {/* Topo */}
          <div>
            <div className="mb-5 h-px w-9 bg-[#C99D6B]" />
            <p className="text-[11px] xl:text-xs uppercase leading-[1.9] tracking-[0.32em] text-[#E5D6C6]">
              Tecnologia
              <br />a favor de
              <br />novos olhares
            </p>
          </div>

          {/* Meio */}
          <div>
            <h1 className="text-[clamp(28px,3.4vw,46px)] leading-[1.08] tracking-[-0.01em]">
              <span className="block font-light text-[#F3E9DF]">Gestão completa</span>
              <span className="block font-bold text-[#D8B78F]">para sua ótica</span>
            </h1>
            <p className="mt-5 max-w-[320px] text-[clamp(13px,1.15vw,16px)] leading-relaxed text-[#EADFD3]">
              Mais controle, organização e resultados para o crescimento do seu negócio.
            </p>

            <ul className="mt-9 space-y-5">
              {FEATURES.map(({ icon: Icon, lines }) => (
                <li key={lines[0]} className="flex items-center gap-4">
                  <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/10">
                    <Icon className="h-6 w-6 text-[#F3E9DF]" strokeWidth={1.6} />
                  </span>
                  <span className="text-[clamp(13px,1.1vw,15px)] leading-snug text-[#EADFD3]">
                    {lines.map((l) => (
                      <span key={l} className="block">
                        {l}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Rodapé */}
          <div>
            <div className="mb-4 h-px w-9 bg-[#C99D6B]" />
            <p className="text-[11px] xl:text-xs uppercase leading-[1.9] tracking-[0.32em] text-[#E5D6C6]">
              Visão para
              <br />grandes
              <br />conquistas
            </p>
          </div>
        </div>
      </section>

      {/* ================= CARD DIREITO (login) ================= */}
      <main className="relative z-10 flex min-h-screen flex-col overflow-hidden bg-[#F4EFEA] lg:absolute lg:right-[1.2%] lg:top-[2.2%] lg:bottom-[2.4%] lg:min-h-0 lg:w-[42.5%] lg:rounded-[28px] lg:shadow-[0_20px_60px_rgba(40,25,15,0.22)]">
        {/* Arco decorativo */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[70px] -top-[70px] h-[190px] w-[190px] rounded-full border-[26px] border-[#E6DCD1]"
        />

        <div className="flex flex-1 flex-col justify-center px-8 py-10 sm:px-14 lg:px-[9%]">
          <div className="mb-10 flex justify-center">
            <VisionBoxLogo />
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {/* Usuário */}
            <div className="relative">
              <User
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4A2812]"
                strokeWidth={1.7}
              />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Usuário"
                autoComplete="username"
                required
                className={`${inputCls} pl-12 pr-4`}
              />
            </div>

            {/* Senha */}
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4A2812]"
                strokeWidth={1.7}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha"
                autoComplete="current-password"
                required
                className={`${inputCls} pl-12 pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#4A2812] transition-colors hover:text-[#8A5A2B]"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>

            {/* Lembrar de mim (sem onClick no label: evitava o duplo toggle) */}
            <label className="flex w-fit cursor-pointer select-none items-center gap-2.5 text-sm text-[#4A3A30]">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
                className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-[#C4B7AA] bg-[#FBF8F5] text-[#6B4423] focus:ring-[#6B4423]"
              />
              <span>Lembrar de mim</span>
            </label>

            {erro && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-[#6B4423] text-base font-medium text-white shadow-[0_6px_16px_rgba(107,68,35,0.28)] transition hover:bg-[#58371B] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé */}
        <footer className="flex shrink-0 flex-col items-center justify-between gap-3 px-8 pb-7 sm:flex-row sm:px-[7%]">
          <span className="max-w-[220px] text-center text-[10px] uppercase leading-[1.9] tracking-[0.2em] text-[#8A6F5A] sm:text-left">
            Foco na sua visão, impulso no seu negócio.
          </span>
          <span className="hidden h-8 w-px bg-[#8A6F5A] sm:block" />
          <span className="text-xs text-[#4A3A30]">
            Desenvolvido por <strong className="font-semibold">TechboxBR</strong> 2026
          </span>
        </footer>
      </main>
    </div>
  );
}
