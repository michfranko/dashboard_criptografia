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

const algorithmConfigs = [
  {
    name: "AES",
    key: "aesMetrics",
    title: "Tiempo de cifrado",
    sizeCandidates: ["data_size_bytes", "data_size_bytest", "size_bytes"],
    timeCandidates: ["encryption_time", "encryption_time_seconds"],
    throughputCandidates: ["throughput_bps"],
  },
  {
    name: "MD5",
    key: "md5Metrics",
    title: "Tiempo de hash",
    sizeCandidates: ["input_length", "input_size_bytes"],
    timeCandidates: ["hash_time"],
    throughputCandidates: ["throughput_bps"],
  },
  {
    name: "RSA",
    key: "rsaMetrics",
    title: "Tiempo de cifrado",
    sizeCandidates: ["data_size_bytes", "data_size_bytest", "ciphertext_size_bytes"],
    timeCandidates: ["encryption_time", "encryption_time_seconds"],
    throughputCandidates: ["throughput_bps"],
  },
  {
    name: "SHA-256",
    key: "shaMetrics",
    title: "Tiempo de hash",
    sizeCandidates: ["input_length", "input_size_bytes"],
    timeCandidates: ["hash_time"],
    throughputCandidates: ["throughput_bps"],
  },
] as const;

export default function AlgoritmosPage() {
  const [csvData, setCsvData] = useState<Record<string, { data: CsvData | null; error: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const sourceMap = useMemo(() => getConfiguredDriveSources(), []);

  useEffect(() => {
    let active = true;

    async function loadMetrics() {
      setLoading(true);
      const results = await fetchDriveCsvs(sourceMap);
      if (active) {
        setCsvData(results);
      }
    }

    const handleSourcesUpdated = () => {
      void loadMetrics();
    };

    void loadMetrics().finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    window.addEventListener(DRIVE_SOURCE_UPDATE_EVENT, handleSourcesUpdated);

    return () => {
      active = false;
      window.removeEventListener(DRIVE_SOURCE_UPDATE_EVENT, handleSourcesUpdated);
    };
  }, [sourceMap]);

  const summaries = useMemo(() => {
    return algorithmConfigs.map((config) => {
      const entry = csvData[config.key];
      const rows = entry?.data?.rows ?? [];
      const timeSummary = summarizeNumeric(rows, config.timeCandidates);
      const throughputSummary = summarizeNumeric(rows, config.throughputCandidates);
      const sizeSummary = summarizeNumeric(rows, config.sizeCandidates);

      return {
        ...config,
        timeSummary,
        throughputSummary,
        sizeSummary,
        error: entry?.error ?? null,
      };
    });
  }, [csvData]);

  const aesSummary = summaries.find((item) => item.name === "AES");
  const rsaSummary = summaries.find((item) => item.name === "RSA");
  const md5Summary = summaries.find((item) => item.name === "MD5");
  const shaSummary = summaries.find((item) => item.name === "SHA-256");

  const hasConfiguredSources = Object.values(sourceMap).some(Boolean);

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Implementación y análisis de algoritmos criptográficos"
      description="Se presenta una visión comparativa de los algoritmos estudiados, sus características y los resultados obtenidos desde los datasets históricos."
      badge="Comparativa visual"
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400">
              Cargando métricas desde Google Drive...
            </div>
          ) : null}

          {summaries.map((algorithm) => (
            <div key={algorithm.name} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">{algorithm.name}</h2>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">
                  {algorithm.title}
                </span>
              </div>

              {algorithm.error ? (
                <p className="mt-3 text-sm text-amber-300">{algorithm.error}</p>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Tiempo promedio"
                  value={algorithm.timeSummary ? `${formatMetric(algorithm.timeSummary.average)} s` : "—"}
                  detail={algorithm.timeSummary ? `Muestra: ${algorithm.timeSummary.count}` : "Sin datos aún"}
                  accent="text-cyan-200"
                />
                <MetricCard
                  label="Throughput promedio"
                  value={algorithm.throughputSummary ? `${formatMetric(algorithm.throughputSummary.average)} bps` : "—"}
                  detail="Extraído del CSV de métricas"
                  accent="text-emerald-200"
                />
                <MetricCard
                  label="Tamaño promedio"
                  value={algorithm.sizeSummary ? `${formatMetric(algorithm.sizeSummary.average)} bytes` : "—"}
                  detail="Longitud promedio de entrada"
                  accent="text-fuchsia-200"
                />
              </div>
            </div>
          ))}

          {!hasConfiguredSources && !loading ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm leading-7 text-slate-400">
              Aún no hay URLs de CSV configuradas. Puedes definir variables de entorno como NEXT_PUBLIC_AES_METRICS_URL, NEXT_PUBLIC_RSA_METRICS_URL, NEXT_PUBLIC_MD5_METRICS_URL y NEXT_PUBLIC_SHA256_METRICS_URL para alimentar esta vista automáticamente.
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <VisualPanel title="Métricas" subtitle="Indicadores de rendimiento">
            <div className="space-y-3">
              <MetricCard
                label="AES vs RSA"
                value={aesSummary && rsaSummary ? `${formatMetric(aesSummary.timeSummary?.average)} s vs ${formatMetric(rsaSummary.timeSummary?.average)} s` : "—"}
                detail="Comparación del tiempo promedio de cifrado"
                accent="text-cyan-200"
              />
              <MetricCard
                label="MD5 vs SHA-256"
                value={md5Summary && shaSummary ? `${formatMetric(md5Summary.timeSummary?.average)} s vs ${formatMetric(shaSummary.timeSummary?.average)} s` : "—"}
                detail="Comparación del tiempo promedio de hashing"
                accent="text-emerald-200"
              />
              <MetricCard
                label="Fuente activa"
                value={hasConfiguredSources ? "Google Drive" : "Sin configuración"}
                detail="Los datos se obtienen desde /api/drive-csv"
                accent="text-fuchsia-200"
              />
            </div>
          </VisualPanel>

          <VisualPanel title="Conclusión" subtitle="Interpretación del experimento">
            <p className="text-sm leading-7 text-slate-400">
              Los resultados se actualizan automáticamente cuando los archivos CSV de Google Drive están disponibles. El panel compara tiempos de ejecución, throughput y tamaño promedio para cada algoritmo del estudio.
            </p>
          </VisualPanel>
        </div>
      </div>
    </DashboardShell>
  );
}
