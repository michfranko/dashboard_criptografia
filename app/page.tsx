import Link from "next/link";

const navItems = [
  { href: "/", label: "Inicio" },
  { href: "/algoritmos", label: "Algoritmos" },
  { href: "/fuerza-bruta", label: "Fuerza bruta" },
  { href: "/probabilidad", label: "Probabilidad" },
  { href: "/graficas", label: "Gráficas" },
  { href: "/simulacion", label: "Simulación" },
  { href: "/dataset", label: "Dataset" },
];

const kpis = [
  { label: "Algoritmos evaluados", value: "4", detail: "AES, MD5, RSA y SHA-256" },
  { label: "Muestras históricas", value: "12.4K", detail: "Registros procesados desde CSV" },
  { label: "Probabilidad promedio", value: "94%", detail: "Precisión de análisis estadístico" },
  { label: "Tiempo de simulación", value: "< 2s", detail: "Respuesta en laboratorio en tiempo real" },
];

const modules = [
  {
    title: "Análisis de algoritmos",
    description: "Comparación de rendimiento, tamaño de salida y consumo de recursos.",
    accent: "from-cyan-500/25 to-cyan-400/5",
  },
  {
    title: "Ataques de fuerza bruta",
    description: "Evaluación de complejidad, longitud y probabilidad de éxito por escenario.",
    accent: "from-emerald-500/25 to-emerald-400/5",
  },
  {
    title: "Laboratorio interactivo",
    description: "Simulación de cifrado, entropía y estimación de riesgo en tiempo real.",
    accent: "from-fuchsia-500/25 to-fuchsia-400/5",
  },
  {
    title: "Gráficas explicativas",
    description: "Visualizaciones de barras para resumir probabilidades, factores condicionales y tendencias del estudio.",
    accent: "from-amber-500/25 to-amber-400/5",
  },
];

const stages = [
  "Adquisición de datos",
  "Procesamiento estadístico",
  "Simulación de ataques",
  "Visualización y conclusión",
];

const comparisons = [
  { name: "AES", score: 92, tone: "bg-cyan-400" },
  { name: "MD5", score: 78, tone: "bg-emerald-400" },
  { name: "RSA", score: 74, tone: "bg-fuchsia-400" },
  { name: "SHA-256", score: 90, tone: "bg-amber-400" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.15),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(192,132,252,0.16),_transparent_24%),linear-gradient(135deg,_#020617_0%,_#0f172a_45%,_#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-white/10 bg-slate-950/70 px-5 py-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r lg:px-6">
          <div className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-4 shadow-[0_0_45px_rgba(34,211,238,0.08)]">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/15 text-xl text-cyan-300">
              🔐
            </div>
            <h2 className="text-lg font-semibold text-white">CryptoLab Research</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Plataforma académica para análisis de criptografía, protocolos y seguridad.
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm transition ${
                  item.href === "/"
                    ? "bg-cyan-400/15 text-cyan-200"
                    : "bg-slate-900/70 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{item.label}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  0{index + 1}
                </span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">Estado</p>
            <p className="mt-2 text-sm text-slate-200">Datos históricos cargados desde Google Drive.</p>
            <div className="mt-3 h-2 rounded-full bg-slate-800">
              <div className="h-2 w-4/5 rounded-full bg-emerald-400" />
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-slate-900/70 p-5 shadow-[0_0_60px_rgba(15,23,42,0.35)] sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Proyecto de investigación</p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Plataforma de análisis criptográfico y visualización de seguridad
              </h1>
            </div>
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              Diseño inicial visual · En desarrollo
            </div>
          </header>

          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(15,23,42,0.3)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Inicio</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Análisis y visualización de protocolos de seguridad
                  </h2>
                </div>
                <div className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-sm text-fuchsia-200">
                  Investigación académica
                </div>
              </div>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                Esta plataforma reúne experimentos, métricas, comparaciones y simulaciones para estudiar cómo los algoritmos criptográficos se comportan frente a ataques, variaciones estadísticas y condiciones reales de uso.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-sm font-medium text-white">Objetivo</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Facilitar la comprensión visual de protocolos, tiempos de ejecución, entropía y riesgo estimado.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-sm font-medium text-white">Enfoque</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Integrar datos históricos desde CSV con una experiencia interactiva orientada a evaluación universitaria.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(15,23,42,0.3)]">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">Indicadores clave</p>
              <div className="mt-4 space-y-3">
                {kpis.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                    <div className="flex items-end justify-between gap-3">
                      <p className="text-sm text-slate-300">{item.label}</p>
                      <p className="text-lg font-semibold text-white">{item.value}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-4">
            {[
              { label: "Protocolos analizados", value: "8" },
              { label: "Escenarios de ataque", value: "24" },
              { label: "Intervalos de confianza", value: "95%" },
              { label: "Visualizaciones", value: "12+" },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(15,23,42,0.3)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Flujo del proyecto</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">De los datos experimentales a la conclusión visual</h3>
                </div>
                <div className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-sm text-slate-400">
                  Pipeline académico
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {stages.map((stage, index) => (
                  <div key={stage} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-semibold text-cyan-200">
                      {index + 1}
                    </div>
                    <p className="text-sm font-medium text-white">{stage}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-[0_0_60px_rgba(15,23,42,0.3)]">
              <p className="text-sm uppercase tracking-[0.35em] text-fuchsia-300">Comparativa rápida</p>
              <div className="mt-5 space-y-4">
                {comparisons.map((item) => (
                  <div key={item.name}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-300">{item.name}</span>
                      <span className="text-white">{item.score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${item.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            {modules.map((module) => (
              <div key={module.title} className={`rounded-[28px] border border-white/10 bg-gradient-to-br ${module.accent} p-[1px]`}>
                <div className="h-full rounded-[27px] bg-slate-950/90 p-5">
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Módulo</p>
                  <h3 className="mt-3 text-xl font-semibold text-white">{module.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{module.description}</p>
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
