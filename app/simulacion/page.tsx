import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";

export default function SimulacionPage() {
  return (
    <DashboardShell
      eyebrow="Módulo interactivo"
      title="Laboratorio de simulación en tiempo real"
      description="Aquí se preparará la experiencia interactiva para ingresar texto o contraseñas, analizar su complejidad y estimar el riesgo asociado."
      badge="Próxima fase"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <VisualPanel title="Entrada del usuario" subtitle="Interfaz interactiva">
          <div className="rounded-2xl border border-dashed border-cyan-400/20 bg-slate-950/70 p-4">
            <p className="text-sm text-slate-400">Campo de entrada para usuario, contraseña o texto.</p>
            <div className="mt-4 h-28 rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-sm text-slate-500">
              Aquí se mostrará el formulario interactivo en una siguiente iteración.
            </div>
          </div>
        </VisualPanel>

        <VisualPanel title="Resultados previstos" subtitle="Análisis en tiempo real">
          <div className="space-y-3 text-sm leading-7 text-slate-400">
            <MetricCard label="Longitud" value="12" detail="Métrica de entrada" accent="text-cyan-200" />
            <MetricCard label="Entropía" value="Alta" detail="Nivel de incertidumbre estimado" accent="text-emerald-200" />
            <MetricCard label="Riesgo" value="Moderado" detail="Probabilidad de éxito del ataque" accent="text-fuchsia-200" />
          </div>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
