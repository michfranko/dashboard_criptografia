"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardShell from "../components/dashboard-shell";
import Link from "next/link";
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
    timeCandidates: ["encryption_time", "encryption_time_seconds", "execution_time"],
    throughputCandidates: ["throughput_bps", "throughput"],
  },
  {
    name: "MD5",
    key: "md5Metrics",
    title: "Tiempo de hash",
    sizeCandidates: ["input_length", "input_size_bytes"],
    timeCandidates: ["hash_time", "execution_time"],
    throughputCandidates: ["throughput_bps", "throughput"],
  },
  {
    name: "RSA",
    key: "rsaMetrics",
    title: "Tiempo de cifrado",
    sizeCandidates: ["data_size_bytes", "data_size_bytest", "ciphertext_size_bytes"],
    timeCandidates: ["encryption_time", "encryption_time_seconds", "execution_time"],
    throughputCandidates: ["throughput_bps", "throughput"],
  },
  {
    name: "SHA-256",
    key: "shaMetrics",
    title: "Tiempo de hash",
    sizeCandidates: ["input_length", "input_size_bytes"],
    timeCandidates: ["hash_time", "execution_time"],
    throughputCandidates: ["throughput_bps", "throughput"],
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

  // Formateamos los datos para Recharts
  const chartData = useMemo(() => {
    return summaries.map((algo) => ({
      name: algo.name,
      "Tiempo (s)": algo.timeSummary ? algo.timeSummary.average : 0,
      "Throughput (bps)": algo.throughputSummary ? algo.throughputSummary.average : 0,
    }));
  }, [summaries]);

  const aesSummary = summaries.find((item) => item.name === "AES");
  const rsaSummary = summaries.find((item) => item.name === "RSA");
  const md5Summary = summaries.find((item) => item.name === "MD5");
  const shaSummary = summaries.find((item) => item.name === "SHA-256");

  const hasConfiguredSources = Object.values(sourceMap).some(Boolean);

  // Estilos del Tooltip adaptados a tu UI oscura
  const customTooltipStyle = {
    contentStyle: { backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" },
    labelStyle: { color: "#fff", fontWeight: "bold" },
  };

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Implementación y análisis de algoritmos criptográficos"
      description="Se presenta una visión comparativa de los algoritmos estudiados, sus características y los resultados obtenidos desde los datasets históricos."
      badge="Comparativa visual"
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        
        {/* COLUMNA IZQUIERDA: TARJETAS CON EL BOTÓN DETALLE INCORPORADO */}
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400">
              Cargando métricas desde Google Drive...
            </div>
          ) : null}

          {summaries.map((algorithm) => (
            <div
              key={algorithm.name}
              className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">
                  {algorithm.name}
                </h2>

                {/* TU EXCELENTE BOTÓN DE REDIRECCIÓN INTERACTIVA */}
                <Link
                  href={`/algoritmos/${algorithm.name.toLowerCase().replace("-", "")}`}
                  className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200 transition hover:bg-cyan-400/30 hover:border-cyan-400/40"
                >
                  Ver detalle →
                </Link>
              </div>

              {algorithm.error ? (
                <p className="mt-3 text-sm text-amber-300">
                  {algorithm.error}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Tiempo promedio"
                  value={
                    algorithm.timeSummary
                      ? `${formatMetric(algorithm.timeSummary.average)} s`
                      : "—"
                  }
                  detail={
                    algorithm.timeSummary
                      ? `Muestra: ${algorithm.timeSummary.count}`
                      : "Sin datos"
                  }
                  accent="text-cyan-200"
                />

                <MetricCard
                  label="Throughput"
                  value={
                    algorithm.throughputSummary
                      ? `${formatMetric(algorithm.throughputSummary.average)} bps`
                      : "—"
                  }
                  detail="Velocidad media"
                  accent="text-emerald-200"
                />

                <MetricCard
                  label="Tamaño promedio"
                  value={
                    algorithm.sizeSummary
                      ? `${formatMetric(algorithm.sizeSummary.average)} bytes`
                      : "—"
                  }
                  detail="Entrada"
                  accent="text-fuchsia-200"
                />
              </div>
            </div>
          ))}

          {!hasConfiguredSources && !loading ? (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-slate-900/70 p-5 text-sm leading-7 text-slate-400">
              Aún no hay URLs configuradas en el Dataset. Guarda los enlaces de Drive para cargar estas métricas.
            </div>
          ) : null}
        </div>

        {/* COLUMNA DERECHA: DASHBOARDS */}
        <div className="space-y-6">
          <VisualPanel title="Rendimiento computacional" subtitle="Throughput Promedio (bps)">
            <div className="mt-2 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip {...customTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px' }} />
                  <Bar dataKey="Throughput (bps)" fill="#10b981" radius={[8, 8, 0, 0]} name="Velocidad (bps)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </VisualPanel>

          <VisualPanel title="Costo temporal" subtitle="Tiempo de ejecución por algoritmo">
            <div className="mt-2 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip {...customTooltipStyle} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px' }} />
                  <Line type="monotone" dataKey="Tiempo (s)" stroke="#22d3ee" strokeWidth={3} activeDot={{ r: 8 }} name="Tiempo (s)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </VisualPanel>

          <VisualPanel title="Métricas Comparativas" subtitle="Indicadores clave">
            <div className="space-y-3">
              <MetricCard
                label="AES vs RSA"
                value={aesSummary?.timeSummary && rsaSummary?.timeSummary ? `${formatMetric(aesSummary.timeSummary.average)}s vs ${formatMetric(rsaSummary.timeSummary.average)}s` : "—"}
                detail="Diferencia en tiempo promedio de cifrado"
                accent="text-cyan-200"
              />
              <MetricCard
                label="MD5 vs SHA-256"
                value={md5Summary?.timeSummary && shaSummary?.timeSummary ? `${formatMetric(md5Summary.timeSummary.average)}s vs ${formatMetric(shaSummary.timeSummary.average)}s` : "—"}
                detail="Diferencia en tiempo de hashing"
                accent="text-emerald-200"
              />
            </div>
          </VisualPanel>
        </div>

      </div>
    </DashboardShell>
  );
}