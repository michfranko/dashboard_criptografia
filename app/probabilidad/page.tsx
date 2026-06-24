"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";
import {
  buildHistogram,
  DRIVE_SOURCE_UPDATE_EVENT,
  fetchDriveCsvs,
  formatMetric,
  getConfiguredDriveSources,
  summarizeNumeric,
  type CsvData,
} from "../lib/csv-analytics";

const entropyCandidates = ["bits_entropia", "entropia", "bits_entropy", "entropy"];

// NUEVO: Función inteligente para calcular el riesgo y asignar colores
function getRiskProfile(entropyValue: number | null) {
  if (entropyValue === null) return { label: "Desconocido", bg: "bg-slate-600", text: "text-slate-400" };
  if (entropyValue < 40) return { label: "Crítico", bg: "bg-rose-500", text: "text-rose-400" };
  if (entropyValue <= 60) return { label: "Moderado", bg: "bg-amber-400", text: "text-amber-400" };
  return { label: "Seguro", bg: "bg-emerald-500", text: "text-emerald-400" };
}

export default function ProbabilidadPage() {
  const [csvData, setCsvData] = useState<Record<string, { data: CsvData | null; error: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const sourceMap = useMemo(() => getConfiguredDriveSources(), []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      const results = await fetchDriveCsvs({
        vulnerability: sourceMap.vulnerability,
        aesBenchmark: sourceMap.aesBenchmark,
        rsaBenchmark: sourceMap.rsaBenchmark,
        hashesBenchmark: sourceMap.hashesBenchmark,
      });
      if (active) {
        setCsvData(results);
      }
    }

    const handleSourcesUpdated = () => {
      void loadData();
    };

    void loadData().finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    window.addEventListener(DRIVE_SOURCE_UPDATE_EVENT, handleSourcesUpdated);

    return () => {
      active = false;
      window.removeEventListener(DRIVE_SOURCE_UPDATE_EVENT, handleSourcesUpdated);
    };
  }, [sourceMap.vulnerability, sourceMap.aesBenchmark, sourceMap.rsaBenchmark, sourceMap.hashesBenchmark]);

  const vulnerabilityRows = csvData.vulnerability?.data?.rows ?? [];
  const entropySummary = summarizeNumeric(vulnerabilityRows, entropyCandidates);
  const histogram = entropySummary ? buildHistogram(vulnerabilityRows.map((row) => Number(row["bits_entropia"] ?? row["entropia"] ?? row["entropy"] ?? 0)).filter((value) => Number.isFinite(value)), 6) : [];
  const hasConfiguredSources = Boolean(sourceMap.vulnerability || sourceMap.aesBenchmark || sourceMap.rsaBenchmark || sourceMap.hashesBenchmark);

  // Perfil de riesgo global para pintar las tarjetas principales
  const globalRisk = getRiskProfile(entropySummary?.average ?? null);

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Análisis probabilístico y estadístico"
      description="Se integran conceptos de probabilidad, distribución, entropía y correlación para interpretar los resultados obtenidos a partir de los datos experimentales."
      badge="Análisis estadístico"
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <VisualPanel title="Métricas" subtitle="Resumen estadístico">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Color dinámico basado en la entropía media */}
            <MetricCard 
              label="Entropía media" 
              value={entropySummary ? `${formatMetric(entropySummary.average)} bits` : "—"} 
              detail="Promedio de los registros" 
              accent={globalRisk.text} 
            />
            
            {/* Corrección matemática: La varianza es la desviación estándar al cuadrado */}
            <MetricCard 
              label="Varianza" 
              value={entropySummary?.stdDev ? formatMetric(entropySummary.stdDev ** 2) : "—"} 
              detail="Medida de dispersión" 
              accent="text-cyan-200" 
            />
            
            <MetricCard 
              label="Desviación estándar" 
              value={entropySummary ? `${formatMetric(entropySummary.stdDev)} bits` : "—"} 
              detail="Dispersión del conjunto" 
              accent="text-fuchsia-200" 
            />
            
            {/* Se reemplazó "Distribuciones" por una métrica de impacto real */}
            <MetricCard 
              label="Nivel de Riesgo" 
              value={entropySummary ? globalRisk.label : "Sin datos"} 
              detail="Basado en la entropía global" 
              accent={globalRisk.text} 
            />
          </div>
        </VisualPanel>

        <VisualPanel title="Interpretación" subtitle="Lección estadística">
          <div className="space-y-4 text-sm leading-7 text-slate-400">
            {loading ? (
              <p className="animate-pulse text-cyan-400">Analizando dataset de vulnerabilidades...</p>
            ) : null}

            {!loading && !hasConfiguredSources ? (
              <p>Configura el enlace de Vulnerabilidad en el Dataset para generar automáticamente los histogramas.</p>
            ) : null}

            {histogram.length > 0 ? (
              <div>
                <p className="mb-3 font-medium text-white">Histograma de entropía (Mapa de Riesgo)</p>
                <div className="space-y-2.5">
                  {histogram.map((bucket) => {
                    // Extraemos el primer número del rango para saber de qué color pintar la barra
                    const bucketStartValue = parseFloat(bucket.label.split("-")[0]);
                    const bucketRisk = getRiskProfile(bucketStartValue);
                    
                    return (
                      <div key={bucket.label} className="group">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                          <span>{bucket.label} bits</span>
                          <span className="font-medium">{bucket.count} muestras</span>
                        </div>
                        {/* Barra más gruesa (h-3) e interactiva con brillo al pasar el mouse */}
                        <div className="h-3 rounded-full bg-slate-800/80 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-700 ease-out ${bucketRisk.bg} group-hover:brightness-110`} 
                            style={{ width: `${Math.max(2, (bucket.count / Math.max(1, histogram.reduce((sum, item) => sum + item.count, 0))) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <p className="pt-2">
              Los histogramas muestran cómo se distribuye la entropía. Las barras <span className="text-rose-400 font-medium">rojas</span> indican agrupaciones de contraseñas altamente vulnerables frente a ataques de fuerza bruta.
            </p>
          </div>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}