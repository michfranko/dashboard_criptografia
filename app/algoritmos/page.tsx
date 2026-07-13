/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// IMPORTACIÓN NATIVA DEL JSON
import algorithmsRawData from "../data/algorithms.json";

import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";

// 1. Buscador profundo basado en "Duck Typing"
function extractRowsForAlgorithm(jsonData: any, targetAlgo: string): any[] {
  if (!jsonData) return [];
  const targetNormalized = targetAlgo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const algoKey = Object.keys(jsonData).find(
    key => key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === targetNormalized
  );
  if (!algoKey) return [];
  const algoData = jsonData[algoKey];
  let records: any[] = [];
  function findDataArray(obj: any) {
    if (records.length > 0) return;
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        if ('execution_time' in value[0] || 'file_size_mb' in value[0] || 'throughput_mb_s' in value[0]) {
          records = value;
          return;
        }
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) findDataArray(item);
    } else {
      for (const key of Object.keys(obj)) findDataArray(obj[key]);
    }
  }
  findDataArray(algoData);
  return records;
}

const formatMetric = (value: number | null, decimals: number = 2) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
};

export default function AlgoritmosPage() {
  const [activeTab, setActiveTab] = useState("AES");
  const tabs = ["AES", "RSA", "MD5", "SHA"];

  const rows = useMemo(() => extractRowsForAlgorithm(algorithmsRawData, activeTab), [activeTab]);

  const getBestValue = (row: any, candidates: string[]): number => {
    for (const key of candidates) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
        const num = Number(row[key]);
        if (!isNaN(num)) return num;
      }
    }
    return 0;
  };

  const metricsSummary = useMemo(() => {
    if (rows.length === 0) return { avgTime: 0, avgThroughput: 0, avgCpu: 0, maxRam: 0 };
    let totalTime = 0, totalThroughput = 0, totalCpu = 0, maxRam = 0;
    rows.forEach((r: any) => {
      totalTime += getBestValue(r, ["execution_time", "time_seconds", "time"]);
      totalThroughput += getBestValue(r, ["throughput_mb_s", "throughput", "speed_mb_s", "rate"]);
      totalCpu += getBestValue(r, ["cpu_usage", "cpu_percent", "cpu"]);
      const ram = getBestValue(r, ["ram_usage_mb", "ram_mb", "ram_usage", "memory_mb"]);
      if (ram > maxRam) maxRam = ram;
    });
    return {
      avgTime: totalTime / rows.length,
      avgThroughput: totalThroughput / rows.length,
      avgCpu: totalCpu / rows.length,
      maxRam: maxRam
    };
  }, [rows]);

  const chartData = useMemo(() => {
    return [...rows]
      .map((r: any) => ({
        fileSize: getBestValue(r, ["file_size_mb", "file_size", "size_mb", "size"]),
        executionTime: getBestValue(r, ["execution_time", "time_seconds", "time"]),
        throughput: getBestValue(r, ["throughput_mb_s", "throughput", "speed_mb_s", "rate"]),
        cpu: getBestValue(r, ["cpu_usage", "cpu_percent", "cpu"]),
      }))
      .sort((a, b) => a.fileSize - b.fileSize);
  }, [rows]);

  const customTooltipStyle = {
    contentStyle: { backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" },
    labelStyle: { color: "#fff", fontWeight: "bold" },
  };

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Rendimiento Criptográfico"
      description="Evaluación de eficiencia computacional: Tiempo de ejecución, uso de CPU y rendimiento por algoritmo."
      badge="Benchmark"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Tiempo de Ejecución Medio" value={metricsSummary.avgTime > 0 ? `${formatMetric(metricsSummary.avgTime, 4)} s` : "0 s"} detail="Latencia operativa" accent="text-amber-200" />
        <MetricCard label="Throughput Medio" value={metricsSummary.avgThroughput > 0 ? `${formatMetric(metricsSummary.avgThroughput)} MB/s` : "0 MB/s"} detail="Velocidad de procesamiento" accent="text-emerald-200" />
        {/*<MetricCard label="Uso de CPU Medio" value={metricsSummary.avgCpu > 0 ? `${formatMetric(metricsSummary.avgCpu)} %` : "0 %"} detail="Carga en el procesador" accent="text-cyan-200" />*/}
        {/*<MetricCard label="Pico de RAM" value={metricsSummary.maxRam > 0 ? `${formatMetric(metricsSummary.maxRam)} MB` : "0 MB"} detail="Consumo máximo de memoria" accent="text-fuchsia-200" />*/}
      </div>

      {rows.length > 0 ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <VisualPanel title="Escalabilidad Temporal" subtitle="Tiempo de ejecución en función del tamaño del archivo">
              <div className="mt-4 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTime" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="fileSize" stroke="#94a3b8" fontSize={11} name="MB" />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value), 4)} s`, "Tiempo"]} labelFormatter={(label) => `Archivo: ${label} MB`} />
                    <Area type="monotone" dataKey="executionTime" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTime)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </VisualPanel>

            <VisualPanel title="Velocidad de Procesamiento (Throughput)" subtitle="Megabytes procesados por segundo">
              <div className="mt-4 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="fileSize" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value))} MB/s`, "Throughput"]} labelFormatter={(label) => `Archivo: ${label} MB`} />
                    <Bar dataKey="throughput" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </VisualPanel>
          </div>

          {/*<VisualPanel title="Impacto en Hardware" subtitle="Consumo de CPU vs Tamaño de la carga útil">
            <div className="mt-4 h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="fileSize" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value))} %`, "CPU"]} labelFormatter={(label) => `Archivo: ${label} MB`} />
                  <Line type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </VisualPanel>*/}
        </div>
      ) : (
        <div className="mt-6 flex h-[300px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-900/70 text-slate-400">
          No se encontraron registros para el algoritmo {activeTab} en el archivo JSON.
        </div>
      )}
    </DashboardShell>
  );
}