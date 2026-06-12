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
            <MetricCard label="Entropía media" value={entropySummary ? `${formatMetric(entropySummary.average)} bits` : "—"} detail="Promedio de los registros" accent="text-emerald-200" />
            <MetricCard label="Varianza" value={entropySummary ? formatMetric(entropySummary.average ? (entropySummary.average ** 2) / Math.max(1, entropySummary.count) : null) : "—"} detail="Medida de dispersión" accent="text-cyan-200" />
            <MetricCard label="Desviación estándar" value={entropySummary ? `${formatMetric(entropySummary.stdDev)} bits` : "—"} detail="Dispersion del conjunto" accent="text-fuchsia-200" />
            <MetricCard label="Distribuciones" value={hasConfiguredSources ? "Activas" : "Sin datos"} detail="Calculadas desde CSV de benchmark" accent="text-amber-200" />
          </div>
        </VisualPanel>

        <VisualPanel title="Interpretación" subtitle="Lección estadística">
          <div className="space-y-4 text-sm leading-7 text-slate-400">
            {loading ? (
              <p>Cargando métricas estadísticas desde Google Drive...</p>
            ) : null}

            {!loading && !hasConfiguredSources ? (
              <p>Configura NEXT_PUBLIC_VULNERABILITY_URL y los benchmarks para generar automáticamente histogramas y métricas probabilísticas.</p>
            ) : null}

            {histogram.length > 0 ? (
              <div>
                <p className="mb-3 font-medium text-white">Histograma de entropía</p>
                <div className="space-y-2">
                  {histogram.map((bucket) => (
                    <div key={bucket.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{bucket.label}</span>
                        <span>{bucket.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800">
                        <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.max(8, (bucket.count / Math.max(1, histogram.reduce((sum, item) => sum + item.count, 0))) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <p>Los histogramas muestran cómo se distribuye la entropía en los registros experimentales y permiten interpretar la variabilidad del riesgo estimado.</p>
          </div>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
