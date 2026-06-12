"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";
import {
  DRIVE_SOURCE_UPDATE_EVENT,
  fetchDriveCsvs,
  formatMetric,
  getConfiguredDriveSources,
  summarizeNumeric,
  type CsvData,
} from "../lib/csv-analytics";

const vulnerabilityCandidates = {
  entropy: ["bits_entropia", "entropia", "bits_entropy", "entropy"],
  aes: ["tiempo_estimado_aes", "time_estimated_aes", "aes_time"],
  rsa: ["tiempo_estimado_rsa", "time_estimated_rsa", "rsa_time"],
  md5: ["tiempo_estimado_md5", "time_estimated_md5", "md5_time"],
  sha256: ["tiempo_estimado_sha_256", "tiempo_estimado_sha256", "time_estimated_sha256", "sha256_time"],
};

export default function FuerzaBrutaPage() {
  const [csvData, setCsvData] = useState<Record<string, { data: CsvData | null; error: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const sourceMap = useMemo(() => getConfiguredDriveSources(), []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      const results = await fetchDriveCsvs({ vulnerability: sourceMap.vulnerability });
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
  }, [sourceMap.vulnerability]);

  const vulnerability = csvData.vulnerability?.data?.rows ?? [];
  const entropySummary = summarizeNumeric(vulnerability, vulnerabilityCandidates.entropy);
  const aesSummary = summarizeNumeric(vulnerability, vulnerabilityCandidates.aes);
  const rsaSummary = summarizeNumeric(vulnerability, vulnerabilityCandidates.rsa);
  const md5Summary = summarizeNumeric(vulnerability, vulnerabilityCandidates.md5);
  const shaSummary = summarizeNumeric(vulnerability, vulnerabilityCandidates.sha256);
  const hasConfiguredSource = Boolean(sourceMap.vulnerability);

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Pruebas de ataque por fuerza bruta"
      description="Se exponen los escenarios experimentales, los efectos de la longitud y el uso de caracteres especiales en la probabilidad de éxito del ataque."
      badge="Simulación de riesgo"
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <VisualPanel title="Escenarios" subtitle="Comparativa de resistencia">
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-400">
                Cargando tiempos estimados desde el CSV de vulnerabilidad...
              </div>
            ) : null}

            {!loading && !hasConfiguredSource ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/70 p-4 text-sm leading-7 text-slate-400">
                Define NEXT_PUBLIC_VULNERABILITY_URL para cargar analisis_vulnerabilidad_final.csv y generar estos tiempos automáticamente.
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Entropía</p>
                <span className="text-sm text-cyan-200">{entropySummary ? `${formatMetric(entropySummary.average)} bits` : "—"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Promedio de la columna de entropía del CSV.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Tiempo estimado AES</p>
                <span className="text-sm text-cyan-200">{aesSummary ? `${formatMetric(aesSummary.average)} s` : "—"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Promedio calculado sobre el archivo de vulnerabilidad.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Tiempo estimado RSA</p>
                <span className="text-sm text-cyan-200">{rsaSummary ? `${formatMetric(rsaSummary.average)} s` : "—"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Métrica obtenida de la misma fuente.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Tiempo estimado MD5</p>
                <span className="text-sm text-cyan-200">{md5Summary ? `${formatMetric(md5Summary.average)} s` : "—"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Valor medio del análisis del dataset.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Tiempo estimado SHA-256</p>
                <span className="text-sm text-cyan-200">{shaSummary ? `${formatMetric(shaSummary.average)} s` : "—"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Promedio extraído del CSV correspondiente.</p>
            </div>
          </div>
        </VisualPanel>

        <VisualPanel title="Hallazgos" subtitle="Interpretación de riesgos">
          <div className="space-y-4 text-sm leading-7 text-slate-400">
            <MetricCard label="Entropía media" value={entropySummary ? `${formatMetric(entropySummary.average)} bits` : "—"} detail="Promedio calculado sobre las muestras" accent="text-emerald-200" />
            <MetricCard label="Desviación estándar" value={entropySummary ? `${formatMetric(entropySummary.stdDev)} bits` : "—"} detail="Variabilidad de los valores de entropía" accent="text-fuchsia-200" />
            <p>La seguridad estimada crece cuando la entropía y la longitud aumentan, y los tiempos esperados de ataque cambian según el algoritmo evaluado.</p>
          </div>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
