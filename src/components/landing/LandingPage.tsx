import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GitBranchPlus,
  Layers3,
  LockKeyhole,
  Mail,
  MoonStar,
  Network,
  PanelLeftOpen,
  ShieldCheck,
  Sparkles,
  Star,
  Workflow,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/store/auth";

const sectionFade = {
  hidden: { opacity: 0, y: 36 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const heroCards = [
  { title: "Mapas vivos", value: "12x", hint: "mais clareza entre ideias relacionadas" },
  { title: "Contexto conectado", value: "360°", hint: "visão cruzada entre ramos e submapas" },
  { title: "Fluxo com IA", value: "24/7", hint: "sugestões para organizar o pensamento" },
];

const benefits = [
  {
    icon: Network,
    title: "Conexões inteligentes",
    description: "Relacione ideias distantes, cruze contextos e revele padrões que não aparecem em listas comuns.",
  },
  {
    icon: BrainCircuit,
    title: "Pensamento assistido por IA",
    description: "Estruture temas, refine ramos e ganhe apoio para transformar intuições em mapas claros e acionáveis.",
  },
  {
    icon: Workflow,
    title: "Navegação fluida",
    description: "Entre em submapas, retorne ao contexto anterior e mantenha o raciocínio visual sempre em movimento.",
  },
  {
    icon: PanelLeftOpen,
    title: "Organização premium",
    description: "Pastas, favoritos, atalhos visuais e uma experiência desenhada para manter tudo sob controle.",
  },
  {
    icon: ShieldCheck,
    title: "Colaboração com governança",
    description: "Controle o acesso inicial, gerencie aprovações e mantenha o ambiente pronto para equipes exigentes.",
  },
  {
    icon: Zap,
    title: "Produtividade real",
    description: "Do brainstorming ao plano de execução, reduza atrito e avance com mais foco e menos ruído mental.",
  },
];

const differentiators = [
  "Conexões entre ramos que criam uma malha real de conhecimento",
  "Submapas dinâmicos para aprofundar ideias sem perder o panorama",
  "Canvas persistente para navegar sem resets irritantes de viewport",
  "Interface pensada para foco, velocidade e descoberta visual",
];

const stats = [
  { value: "41%", label: "menos tempo procurando contexto" },
  { value: "3.2x", label: "mais velocidade no brainstorming" },
  { value: "68%", label: "ganho percebido de foco em tarefas complexas" },
  { value: "92%", label: "sensação de organização mental após uma sessão" },
];

const floatingNodes = [
  { title: "Produto", x: "8%", y: "22%" },
  { title: "Pesquisa", x: "26%", y: "10%" },
  { title: "Operação", x: "72%", y: "18%" },
  { title: "Insights", x: "18%", y: "74%" },
  { title: "IA", x: "68%", y: "76%" },
];

const scrollToId = (id: string) => {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={sectionFade}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground backdrop-blur">
      <Sparkles size={12} />
      {children}
    </span>
  );
}

function QuickAccessCard() {
  const { login, configured, debugMessage } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const result = await login(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || debugMessage || "Não foi possível entrar agora.");
      return;
    }

    const nextUser = useAuth.getState().user;
    navigate({ to: nextUser?.role === "superadmin" || nextUser?.accessGranted ? "/dashboard" : "/activate" });
  };

  return (
    <div className="landing-panel relative overflow-hidden rounded-[28px] p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Acesso rápido</p>
          <p className="mt-1 text-xs text-muted-foreground">Entre em segundos ou crie sua conta agora.</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <MoonStar size={18} />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-3 backdrop-blur transition-colors focus-within:border-primary/40">
          <Mail size={16} className="text-muted-foreground" />
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-3 backdrop-blur transition-colors focus-within:border-primary/40">
          <LockKeyhole size={16} className="text-muted-foreground" />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        {error && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!configured || submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[image:var(--gradient-hero)] px-4 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Entrando..." : "Entrar agora"}
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Link
          to="/register"
          className="inline-flex items-center justify-center rounded-2xl border border-border/70 bg-background/50 px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted/70"
        >
          Criar conta
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-2xl border border-border/70 bg-background/50 px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted/70"
        >
          Tela de login
        </Link>
      </div>
    </div>
  );
}

export function LandingPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const navItems = useMemo(
    () => [
      { label: "Benefícios", id: "beneficios" },
      { label: "Showcase", id: "showcase" },
      { label: "Diferenciais", id: "diferenciais" },
      { label: "Produtividade", id: "produtividade" },
    ],
    []
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="landing-orb left-[-10%] top-[10%] h-64 w-64 bg-primary/20" />
        <div className="landing-orb right-[-8%] top-[28%] h-72 w-72 bg-cyan-400/10" />
        <div className="landing-orb bottom-[-8%] left-[24%] h-80 w-80 bg-emerald-400/10" />
        <div className="landing-grid absolute inset-0 opacity-60" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/72 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => scrollToId("top")} className="flex items-center gap-3 text-left">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground shadow-[var(--shadow-soft)]">
              <Network size={20} />
            </span>
            <div>
              <div className="text-base font-semibold tracking-tight">MindoraMap</div>
              <div className="text-xs text-muted-foreground">Mapas mentais inteligentes</div>
            </div>
          </button>

          <nav className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToId(item.id)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              to="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
            >
              Cadastro
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-20">
            <video autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover">
              <source src="/mindora-hero.mp4" type="video/mp4" />
            </video>
          </div>
          <div
            className={`absolute inset-0 -z-10 ${
              theme === "dark"
                ? "bg-[linear-gradient(180deg,rgba(9,12,19,0.30)_0%,rgba(9,12,19,0.72)_38%,rgba(9,12,19,0.96)_100%)]"
                : "bg-[linear-gradient(180deg,rgba(248,249,252,0.18)_0%,rgba(248,249,252,0.52)_34%,rgba(248,249,252,0.88)_100%)]"
            }`}
          />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(110,114,255,0.24),transparent_28%),radial-gradient(circle_at_80%_16%,rgba(34,211,238,0.15),transparent_24%)]" />

          <div className="mx-auto grid min-h-[calc(100vh-4.75rem)] max-w-7xl gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:px-8 lg:py-20">
            <div className="flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="max-w-3xl"
              >
                <SectionLabel>Inteligência visual para pensamento complexo</SectionLabel>
                <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-balance text-foreground sm:text-6xl lg:text-7xl">
                  Transforme pensamentos em conexões inteligentes.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  O MindoraMap organiza ideias, revela relações escondidas e acelera o raciocínio com uma experiência
                  visual premium, fluida e pronta para trabalho sério.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.7 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-0.5 hover:opacity-95"
                >
                  Começar agora
                  <ArrowRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToId("showcase")}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-card/50 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-card"
                >
                  Ver demonstração
                  <ChevronRight size={16} />
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.7 }}
                className="mt-12 grid gap-4 sm:grid-cols-3"
              >
                {heroCards.map((card) => (
                  <div key={card.title} className="landing-panel rounded-[24px] p-4">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{card.title}</div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{card.hint}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.16, duration: 0.8 }}
              className="relative flex items-center"
            >
              <QuickAccessCard />
            </motion.div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-8 hidden px-8 lg:block">
            {floatingNodes.map((node, index) => (
              <motion.div
                key={node.title}
                className="absolute rounded-full border border-white/18 bg-background/70 px-4 py-2 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] backdrop-blur"
                style={{ left: node.x, top: node.y }}
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4 + index, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              >
                {node.title}
              </motion.div>
            ))}
          </div>
        </section>

        <section id="beneficios" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <SectionLabel>Benefícios</SectionLabel>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Da ideia bruta ao mapa estratégico com clareza incomum.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Menos caos, mais contexto. O MindoraMap une pensamento visual, organização e tecnologia para ampliar o
              seu raciocínio.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Reveal key={benefit.title} delay={index * 0.05}>
                  <div className="landing-panel h-full rounded-[28px] p-6 transition-transform duration-300 hover:-translate-y-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon size={20} />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold">{benefit.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{benefit.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        <section id="showcase" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Reveal>
              <SectionLabel>Showcase visual</SectionLabel>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Um canvas que parece vivo e entende a forma como você pensa.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Crie ramos, conecte temas, aprofunde ideias em submapas e mantenha contexto mesmo em estruturas mais
                densas.
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Nós conectados por contexto, não apenas por hierarquia",
                  "Submapas para aprofundar sem poluir o panorama principal",
                  "Experiência visual refinada para explorar raciocínio complexo",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4">
                    <CheckCircle2 size={18} className="mt-0.5 text-primary" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="landing-panel relative overflow-hidden rounded-[32px] p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between rounded-[22px] border border-border/70 bg-background/70 px-4 py-3 backdrop-blur">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Workspace</div>
                    <div className="mt-1 text-lg font-semibold">Estratégia Q3 · MindoraMap</div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-xs text-muted-foreground">
                    <Sparkles size={12} className="text-primary" />
                    IA assistindo o fluxo
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top,rgba(120,119,255,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6">
                  <div className="absolute inset-0 landing-grid opacity-70" />
                  <div className="relative min-h-[430px]">
                    <motion.div
                      className="absolute left-[8%] top-[40%] rounded-[24px] border border-primary/30 bg-primary/12 px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    >
                      <div className="text-sm font-semibold">Visão central</div>
                      <div className="mt-1 text-xs text-muted-foreground">Objetivos, riscos e prioridades</div>
                    </motion.div>
                    <motion.div
                      className="absolute left-[38%] top-[12%] rounded-[24px] border border-border/70 bg-card/75 px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur"
                      animate={{ y: [0, 8, 0] }}
                      transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    >
                      <div className="text-sm font-semibold">Pesquisa</div>
                      <div className="mt-1 text-xs text-muted-foreground">Sinais de mercado e demanda</div>
                    </motion.div>
                    <motion.div
                      className="absolute right-[8%] top-[38%] rounded-[24px] border border-border/70 bg-card/75 px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 5.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    >
                      <div className="text-sm font-semibold">Execução</div>
                      <div className="mt-1 text-xs text-muted-foreground">Plano tático e ownership</div>
                    </motion.div>
                    <motion.div
                      className="absolute bottom-[10%] left-[28%] rounded-[24px] border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 shadow-[var(--shadow-soft)] backdrop-blur"
                      animate={{ y: [0, 10, 0] }}
                      transition={{ duration: 6.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    >
                      <div className="text-sm font-semibold">Conexão cruzada</div>
                      <div className="mt-1 text-xs text-muted-foreground">Vínculo entre risco, pesquisa e entrega</div>
                    </motion.div>

                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 620" fill="none" aria-hidden="true">
                      <path d="M250 320C340 250 420 210 510 180" stroke="url(#line1)" strokeWidth="2.5" strokeDasharray="10 8" />
                      <path d="M300 340C450 360 640 360 760 310" stroke="url(#line2)" strokeWidth="2.5" strokeDasharray="10 8" />
                      <path d="M460 470C470 390 550 330 700 300" stroke="url(#line3)" strokeWidth="2.5" strokeDasharray="10 8" />
                      <defs>
                        <linearGradient id="line1" x1="250" y1="320" x2="510" y2="180" gradientUnits="userSpaceOnUse">
                          <stop stopColor="rgba(93,95,255,0.2)" />
                          <stop offset="1" stopColor="rgba(93,95,255,0.95)" />
                        </linearGradient>
                        <linearGradient id="line2" x1="300" y1="340" x2="760" y2="310" gradientUnits="userSpaceOnUse">
                          <stop stopColor="rgba(34,211,238,0.4)" />
                          <stop offset="1" stopColor="rgba(136,122,255,0.95)" />
                        </linearGradient>
                        <linearGradient id="line3" x1="460" y1="470" x2="700" y2="300" gradientUnits="userSpaceOnUse">
                          <stop stopColor="rgba(16,185,129,0.2)" />
                          <stop offset="1" stopColor="rgba(34,211,238,0.8)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="diferenciais" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl">
            <SectionLabel>Diferenciais</SectionLabel>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Mais que um mapa mental: uma arquitetura de conhecimento viva.
            </h2>
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Reveal>
              <div className="landing-panel rounded-[32px] p-6 sm:p-8">
                <div className="flex items-center gap-3 text-primary">
                  <GitBranchPlus size={20} />
                  <span className="text-sm font-semibold uppercase tracking-[0.22em]">Conhecimento conectado</span>
                </div>
                <div className="mt-8 space-y-5">
                  {differentiators.map((item) => (
                    <div key={item} className="flex items-start gap-4 rounded-[22px] border border-border/60 bg-background/50 p-4">
                      <CheckCircle2 size={18} className="mt-0.5 text-primary" />
                      <span className="text-sm leading-7 text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid gap-5 sm:grid-cols-2">
                {[
                  {
                    icon: Layers3,
                    title: "Mapas vivos",
                    body: "A estrutura cresce com você e acompanha a profundidade do raciocínio sem parecer um quadro estático.",
                  },
                  {
                    icon: Star,
                    title: "Experiência intuitiva",
                    body: "Menos fricção visual, mais foco no que importa: entender, conectar e executar.",
                  },
                  {
                    icon: Clock3,
                    title: "Velocidade real",
                    body: "Do insight ao plano em poucos movimentos, com um ambiente que favorece fluxo mental contínuo.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Pronto para escalar",
                    body: "Fluxos de acesso, organização por pastas e uma base preparada para evoluir com equipes e projetos maiores.",
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title} className="landing-panel rounded-[28px] p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon size={20} />
                      </div>
                      <h3 className="mt-6 text-xl font-semibold">{card.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.body}</p>
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="produtividade" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <SectionLabel>Produtividade aumentada</SectionLabel>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Métrica visual para uma sensação imediata de progresso.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Números fictícios, impacto real: tudo aqui foi desenhado para comunicar foco, velocidade e ordem mental.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 0.06}>
                <div className="landing-panel rounded-[28px] p-6 text-center">
                  <div className="text-4xl font-semibold tracking-[-0.05em] text-primary sm:text-5xl">{stat.value}</div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <Reveal>
            <div className="landing-panel relative overflow-hidden rounded-[36px] p-8 sm:p-10 lg:p-14">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,92,255,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_28%)]" />
              <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <SectionLabel>Pronto para começar</SectionLabel>
                  <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                    Leve seus pensamentos para um ambiente onde conexões viram vantagem competitiva.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                    Crie sua conta, organize seus mapas e experimente uma nova forma de estruturar conhecimento, foco e
                    execução.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[image:var(--gradient-hero)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-opacity hover:opacity-95"
                  >
                    Criar conta
                    <ArrowRight size={16} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/login" })}
                    className="inline-flex items-center justify-center rounded-full border border-border/70 bg-background/60 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-card"
                  >
                    Entrar no MindoraMap
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground">
                <Network size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold">MindoraMap</div>
                <div className="text-xs text-muted-foreground">Produtividade visual com inteligência aplicada</div>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
              Uma experiência pensada para transformar caos mental em estrutura clara, conectada e escalável.
            </p>
          </div>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <button type="button" onClick={() => scrollToId("beneficios")} className="transition-colors hover:text-foreground">
                Benefícios
              </button>
              <button type="button" onClick={() => scrollToId("showcase")} className="transition-colors hover:text-foreground">
                Showcase
              </button>
              <Link to="/login" className="transition-colors hover:text-foreground">
                Termos
              </Link>
              <Link to="/login" className="transition-colors hover:text-foreground">
                Privacidade
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
