import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import DashboardShell from "./components/dashboard-shell";
import MetricCard from "./components/metric-card";
import VisualPanel from "./components/visual-panel";
import HomeCharts from "./components/home-charts";

export default async function Home() {
  const dataDir = path.join(process.cwd(), "app", "data");

  // Leer archivos JSON en el servidor de forma segura
  const dashboardRaw = await fs.readFile(path.join(dataDir, "dashboard.json"), "utf8");
  const dashboard = JSON.parse(dashboardRaw);

  const attacksRaw = await fs.readFile(path.join(dataDir, "attacks.json"), "utf8");
  const attacks = JSON.parse(attacksRaw);

  const probabilitiesRaw = await fs.readFile(path.join(dataDir, "probabilities.json"), "utf8");
  const probabilities = JSON.parse(probabilitiesRaw);

  // Extraer indicadores de dashboard.json
  const totalRecords = dashboard.aggregate.total_records;
  const totalFiles = dashboard.aggregate.total_files;
  const genDate = dashboard.metadata.generation_date;

  // Extraer resumen de ataques de attacks.json
  const attackStatsDataset = attacks.RESULTADOS_GLOBALES.datasets.find(
    (d: any) => d.file === "attack_statistics.csv"
  );
  const attackStats = attackStatsDataset ? attackStatsDataset.data : [];

  // Calcular totales agregados de ataques
  let totalSuccessful = 0;
  let totalFailed = 0;
  let totalAttacks = 0;
  attackStats.forEach((s: any) => {
    totalSuccessful += s.successful_attacks || 0;
    totalFailed += s.failed_attacks || 0;
    totalAttacks += s.total_attacks || 0;
  });

  // Gráficos comparativos (Recharts)
  const comparisonData = attackStats.map((s: any) => ({
    name: s.algoritmo,
    tiempo: Number(s.average_time || 0),
    exito: Number(s.success_rate || 0),
  }));

  // Extraer datos de probabilies.json (Intervalos de Confianza)
  const icDataset = probabilities.distributions.data.find(
    (d: any) => d.file === "intervalos_confianza.csv"
  );
  const icData = icDataset ? icDataset.data : [];

  const aes95Val = icData.find(
    (d: any) => d.algoritmo === "AES" && d.m_trica === "execution_time" && d.nivel_de_confianza === "95%"
  ) || {};
  const rsa95Val = icData.find(
    (d: any) => d.algoritmo === "RSA" && d.m_trica === "execution_time" && d.nivel_de_confianza === "95%"
  ) || {};

  // Extraer Kruskal-Wallis de probabilities.json
  const compDataset = probabilities.distributions.data.find(
    (d: any) => d.file === "comparaciones_estadisticas.csv"
  );
  const compData = compDataset ? compDataset.data : [];
  const kwTime = compData.find((d: any) => d.m_trica === "execution_time") || {};

  // Extraer Modelos de Regresión de probabilities.json
  const regDataset = probabilities.distributions.data.find(
    (d: any) => d.file === "modelos_regresion.csv"
  );
  const regData = regDataset ? regDataset.data : [];
  
  const md5Reg = regData.find(
    (d: any) => d.algoritmo === "MD5" && d.variable_dependiente === "attack_time_seconds"
  ) || {};
  const shaReg = regData.find(
    (d: any) => (d.algoritmo === "SHA-256" || d.algoritmo === "SHA") && d.variable_dependiente === "attack_time_seconds"
  ) || {};

  return (
    <DashboardShell
      eyebrow="Proyecto de investigación"
      title="Plataforma de análisis criptográfico y visualización de seguridad"
      description="Esta plataforma reúne experimentos, métricas de hardware y simulaciones estadísticas para estudiar el comportamiento de los algoritmos criptográficos frente a ataques de fuerza bruta y medir su complejidad matemática (entropía)."
      badge="Laboratorio finalizado v1.0"
    >
      <div className="space-y-6">
        {/* Fila de Metadatos de Actividad */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-950/40 p-4 text-xs text-slate-400">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>
              <strong className="text-slate-300">Proyecto:</strong> {dashboard.metadata.project_name}
            </span>
            <span>
              <strong className="text-slate-300">Generación:</strong>{" "}
              {new Date(genDate).toLocaleString("es-ES")}
            </span>
            <span>
              <strong className="text-slate-300">Archivos Pipeline:</strong> {totalFiles}
            </span>
            <span>
              <strong className="text-slate-300">Algoritmos Analizados:</strong> 4 (AES, RSA, MD5, SHA-256)
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Estado: Datos Sincronizados
          </span>
        </div>

        {/* KPIs Principales */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Experimentos Totales"
            value={totalRecords.toLocaleString()}
            detail="Registros de hardware procesados"
            accent="text-white"
          />
          <MetricCard
            label="Simulaciones de Ataque"
            value={totalAttacks.toString()}
            detail="Intentos de fuerza bruta ejecutados"
            accent="text-cyan-200"
          />
          <MetricCard
            label="Algoritmo Más Resistente"
            value="AES-256"
            detail="0% éxito de crackeo (162.19s prom.)"
            accent="text-emerald-200"
          />
          <MetricCard
            label="Algoritmo Más Vulnerable"
            value="RSA-2048"
            detail="55.56% éxito de crackeo (0.91s prom.)"
            accent="text-rose-200"
          />
        </div>

        {/* Visualizaciones Interactivas (Recharts) */}
        <HomeCharts
          comparisonData={comparisonData}
          totalSuccessful={totalSuccessful}
          totalFailed={totalFailed}
        />

        {/* Resumen Operativo y Probabilístico */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tabla de Resumen de Ataques */}
          <VisualPanel
            title="Resumen de Ataques"
            subtitle="Resultados empíricos de simulaciones de fuerza bruta por diccionario y directo"
          >
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/30 text-slate-400">
                  <tr>
                    <th className="px-3 py-3 font-semibold uppercase">Algoritmo</th>
                    <th className="px-3 py-3 font-semibold uppercase">Éxito / Total</th>
                    <th className="px-3 py-3 font-semibold uppercase">Tasa de Éxito</th>
                    <th className="px-3 py-3 font-semibold uppercase">Tiempo Promedio</th>
                    <th className="px-3 py-3 font-semibold uppercase">Intentos Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {attackStats.map((s: any) => (
                    <tr key={s.algoritmo} className="hover:bg-slate-900/35 transition">
                      <td className="px-3 py-3 font-semibold text-white">{s.algoritmo}</td>
                      <td className="px-3 py-3">
                        {s.successful_attacks} / {s.total_attacks}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.success_rate === 0
                              ? "bg-emerald-500/10 text-emerald-400"
                              : s.success_rate > 50
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {Number(s.success_rate).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-cyan-300">
                        {Number(s.average_time).toFixed(3)}s
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-400">
                        {Number(s.average_attempts).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </VisualPanel>

          {/* Modelado Probabilístico */}
          <VisualPanel
            title="Modelado Probabilístico"
            subtitle="Comportamiento estocástico e inferencia estadística"
          >
            <div className="mt-4 space-y-4 text-xs text-slate-400 leading-6">
              <div>
                <span className="font-semibold text-white">Modelado de Crecimiento de Latencia:</span>
                <p className="mt-1">
                  Los tiempos de ataque de MD5 y SHA-256 exhiben un comportamiento polinómico en relación con la longitud de entrada, con coeficientes de determinación robustos:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
                  <li>
                    SHA-256: Modelo Polinómico ($R^2$ ={" "}
                    <span className="text-fuchsia-300 font-semibold font-mono">
                      {Number(shaReg.mejor_r2 || 0).toFixed(4)}
                    </span>
                    )
                  </li>
                  <li>
                    MD5: Modelo Polinómico ($R^2$ ={" "}
                    <span className="text-fuchsia-300 font-semibold font-mono">
                      {Number(md5Reg.mejor_r2 || 0).toFixed(4)}
                    </span>
                    )
                  </li>
                </ul>
              </div>

              <div className="border-t border-slate-800/80 pt-4">
                <span className="font-semibold text-white">Intervalos de Confianza (95% de confianza):</span>
                <p className="mt-1">
                  Estimación estadística del tiempo de resistencia esperado ante ataques de fuerza bruta:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
                  <li>
                    AES-256: [
                    <span className="font-mono text-cyan-300">
                      {Number(aes95Val.i_c_inferior || 0).toFixed(2)}s
                    </span>
                    ,{" "}
                    <span className="font-mono text-cyan-300">
                      {Number(aes95Val.i_c_superior || 0).toFixed(2)}s
                    </span>
                    ]
                  </li>
                  <li>
                    RSA-2048: [
                    <span className="font-mono text-cyan-300">
                      {Number(rsa95Val.i_c_inferior || 0).toFixed(4)}s
                    </span>
                    ,{" "}
                    <span className="font-mono text-cyan-300">
                      {Number(rsa95Val.i_c_superior || 0).toFixed(4)}s
                    </span>
                    ]
                  </li>
                </ul>
              </div>

              <div className="border-t border-slate-800/80 pt-4">
                <span className="font-semibold text-white">Prueba Kruskal-Wallis (Valores Críticos):</span>
                <p className="mt-1">
                  Evaluación de significancia estadística para la variabilidad del tiempo de ataque:
                </p>
                <p className="mt-1 text-slate-300">
                  Estadístico $H$:{" "}
                  <span className="text-cyan-300 font-mono font-semibold">
                    {Number(kwTime.estad_stico || 0).toFixed(2)}
                  </span>{" "}
                  | Valor p:{" "}
                  <span className="text-cyan-300 font-mono font-semibold">
                    {Number(kwTime.p_valor || 0).toExponential(3)}
                  </span>
                  .
                </p>
                <p className="mt-1 text-emerald-400 font-bold">
                  ✔ {kwTime.interpretaci_n || "Diferencias significativas confirmadas"}
                </p>
              </div>
            </div>
          </VisualPanel>
        </div>

        {/* Ranking y Hallazgos */}
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Ranking de Algoritmos */}
          <VisualPanel
            title="Ranking de Resistencia"
            subtitle="Robustez empírica frente a ataques de fuerza bruta"
          >
            <div className="mt-4 space-y-3">
              {[
                {
                  rank: 1,
                  name: "AES-256",
                  desc: "Máxima seguridad. 0% tasa de éxito y tiempo de crackeo de 162.19 segundos promedio.",
                  style: "border-emerald-500/20 bg-emerald-500/5 text-emerald-300",
                  number: "bg-emerald-500/20 text-emerald-300",
                },
                {
                  rank: 2,
                  name: "SHA-256",
                  desc: "Seguridad alta. Tasa de éxito del 33.33% y tiempo de crackeo de 7.49 segundos promedio.",
                  style: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300",
                  number: "bg-cyan-500/20 text-cyan-300",
                },
                {
                  rank: 3,
                  name: "MD5",
                  desc: "Seguridad intermedia. Tasa de éxito del 33.33% y tiempo de crackeo de 7.77 segundos promedio.",
                  style: "border-amber-500/20 bg-amber-500/5 text-amber-300",
                  number: "bg-amber-500/20 text-amber-300",
                },
                {
                  rank: 4,
                  name: "RSA-2048",
                  desc: "Vulnerabilidad crítica. Tasa de éxito del 55.56% y tiempo de crackeo de 0.91 segundos promedio.",
                  style: "border-rose-500/20 bg-rose-500/5 text-rose-300",
                  number: "bg-rose-500/20 text-rose-300",
                },
              ].map((item) => (
                <div key={item.name} className={`flex items-start gap-3 rounded-2xl border p-3 ${item.style}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${item.number}`}>
                    {item.rank}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </VisualPanel>

          {/* Hallazgos de la investigación */}
          <VisualPanel
            title="Hallazgos de la Investigación"
            subtitle="Conclusiones principales de la investigación respaldadas por el análisis de datos"
          >
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-emerald-400 text-base">🛡</span> AES-256 es Inquebrantable en Pruebas
                </p>
                <p className="text-xs text-slate-400 mt-1.5 leading-5">
                  El cifrado simétrico AES-256 mantuvo una tasa de éxito de ataque del 0% en todas las ejecuciones.
                  A pesar del elevado rendimiento del motor de ataque, el enorme espacio de búsqueda de la clave de 256 bits (1.16e77 combinaciones teóricas) imposibilita la ruptura computacional.
                </p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-rose-400 text-base">⚠️</span> RSA-2048 presenta Debilidad Crítica
                </p>
                <p className="text-xs text-slate-400 mt-1.5 leading-5">
                  El algoritmo RSA-2048 fue el más vulnerable de los evaluados, cediendo ante el 55.56% de las simulaciones y siendo quebrado en 0.908 segundos promedio. Esto ilustra la susceptibilidad del cifrado asimétrico ante diccionarios cuando no se implementa una aleatorización de relleno (padding) óptima.
                </p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="text-amber-400 text-base">⚡</span> Equivalencia de Robustez en Hashings
                </p>
                <p className="text-xs text-slate-400 mt-1.5 leading-5">
                  SHA-256 y MD5 compartieron una tasa de éxito idéntica del 33.33%. El tiempo de ruptura de SHA-256 (~7.49s) fue ligeramente menor que el de MD5 (~7.77s) debido a que su tamaño de ciphertext (bloque de 64 bytes) optimiza ciertos vectores de hashing paralelo, aunque SHA-256 es teóricamente mucho más robusto que MD5 ante colisiones.
                </p>
              </div>
            </div>
          </VisualPanel>
        </div>

        {/* Accesos Directos de Navegación */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: "/algoritmos",
              title: "Módulo Algoritmos",
              desc: "Rendimiento y consumo de hardware de cifrado.",
              color: "hover:border-cyan-400/30 group",
              icon: "💻",
              index: "01",
            },
            {
              href: "/fuerza-bruta",
              title: "Módulo Ataques",
              desc: "Coste computacional e intentos simulados.",
              color: "hover:border-emerald-400/30 group",
              icon: "💥",
              index: "02",
            },
            {
              href: "/probabilidad",
              title: "Módulo Probabilidad",
              desc: "Modelado probabilístico y rango de confianza.",
              color: "hover:border-fuchsia-400/30 group",
              icon: "📊",
              index: "03",
            },
            {
              href: "/simulacion",
              title: "Módulo Simulación",
              desc: "Pruebas de ataques interactivos en vivo.",
              color: "hover:border-amber-400/30 group",
              icon: "🔬",
              index: "04",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition ${item.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest group-hover:text-cyan-300 transition">
                  {item.index} ↗
                </span>
              </div>
              <h4 className="mt-3 font-semibold text-white text-sm">{item.title}</h4>
              <p className="mt-1 text-[11px] text-slate-400 leading-4">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}