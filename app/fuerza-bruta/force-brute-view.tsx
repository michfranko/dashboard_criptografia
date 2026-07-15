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

import attacksRawData from "../data/attacks.json";
import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";

type AttackRow = Record<string, any>;
type StatRow = Record<string, any>;
type ComparisonRow = Record<string, any>;

type DatasetBundle = {
  attackResults: AttackRow[];
  attackStatistics: StatRow[];
  algorithmComparison: ComparisonRow[];
};

const tabs = ["General", "AES", "RSA", "MD5", "SHA-256"];

const formatMetric = (value: number | null, decimals: number = 2) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
};

const formatPercent = (value: number | null, decimals: number = 1) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
};

const parseNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeAlgorithmName = (value: unknown) => {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return "DESCONOCIDO";
  if (text === "SHA") return "SHA-256";
  if (text === "SHA256") return "SHA-256";
  return text;
};

const getDatasetByFile = (jsonData: any, fileName: string) => {
  const datasets = jsonData?.RESULTADOS_GLOBALES?.datasets ?? [];
  const match = datasets.find((dataset: any) => dataset.file === fileName);
  return Array.isArray(match?.data) ? match.data : [];
};

export default function ForceBruteView() {
  const [activeTab, setActiveTab] = useState("General");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAlgorithmFilter, setSelectedAlgorithmFilter] = useState("Todos");
  const [sortKey, setSortKey] = useState("attack_id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const datasets = useMemo<DatasetBundle>(() => {
    const attackResults = getDatasetByFile(attacksRawData, "all_attack_results.csv");
    const attackStatistics = getDatasetByFile(attacksRawData, "attack_statistics.csv");
    const algorithmComparison = getDatasetByFile(attacksRawData, "algorithm_comparison.csv");

    return {
      attackResults: attackResults.map((row: AttackRow) => ({ ...row, algoritmo: normalizeAlgorithmName(row.algoritmo) })),
      attackStatistics: attackStatistics.map((row: StatRow) => ({ ...row, algoritmo: normalizeAlgorithmName(row.algoritmo) })),
      algorithmComparison: algorithmComparison.map((row: ComparisonRow) => ({ ...row, algoritmo: normalizeAlgorithmName(row.algoritmo) })),
    };
  }, []);

  const selectedRows = useMemo(() => {
    if (activeTab === "General") return datasets.attackResults;
    return datasets.attackResults.filter((row) => row.algoritmo === activeTab);
  }, [activeTab, datasets.attackResults]);

  const selectedStat = useMemo(() => {
    if (activeTab === "General") {
      const totals = datasets.attackStatistics.reduce(
        (acc, row) => ({
          total_attacks: acc.total_attacks + parseNumber(row.total_attacks),
          successful_attacks: acc.successful_attacks + parseNumber(row.successful_attacks),
          failed_attacks: acc.failed_attacks + parseNumber(row.failed_attacks),
          average_attempts: acc.average_attempts + parseNumber(row.average_attempts),
          average_time: acc.average_time + parseNumber(row.average_time),
          average_attempts_per_second: acc.average_attempts_per_second + parseNumber(row.average_attempts_per_second),
          success_rate: acc.success_rate + parseNumber(row.success_rate),
        }),
        {
          total_attacks: 0,
          successful_attacks: 0,
          failed_attacks: 0,
          average_attempts: 0,
          average_time: 0,
          average_attempts_per_second: 0,
          success_rate: 0,
        },
      );

      const count = datasets.attackStatistics.length || 1;
      return {
        ...totals,
        average_attempts: totals.average_attempts / count,
        average_time: totals.average_time / count,
        average_attempts_per_second: totals.average_attempts_per_second / count,
        success_rate: totals.success_rate / count,
      };
    }

    return datasets.attackStatistics.find((row) => row.algoritmo === activeTab) ?? {};
  }, [activeTab, datasets.attackStatistics]);

  const summaryCards = useMemo(() => {
    const totalAttacks = parseNumber(selectedStat.total_attacks);
    const successfulAttacks = parseNumber(selectedStat.successful_attacks);
    const failedAttacks = parseNumber(selectedStat.failed_attacks);
    const successRate = parseNumber(selectedStat.success_rate);
    const averageTime = parseNumber(selectedStat.average_time);
    const averageAttempts = parseNumber(selectedStat.average_attempts);
    const averageSpeed = parseNumber(selectedStat.average_attempts_per_second);

    return [
      {
        label: "Algoritmo analizado",
        value: activeTab === "General" ? "Comparativa global" : activeTab,
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-white",
      },
      {
        label: "Ataques registrados",
        value: formatMetric(totalAttacks, 0),
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-cyan-300",
      },
      {
        label: "Ataques exitosos",
        value: formatMetric(successfulAttacks, 0),
        detail: `Ruta: RESULTADOS_GLOBALES.datasets[1].data · éxito = ${formatPercent(successRate)}`,
        accent: "text-emerald-300",
      },
      {
        label: "Ataques fallidos",
        value: formatMetric(failedAttacks, 0),
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-amber-300",
      },
      {
        label: "Tiempo promedio",
        value: `${formatMetric(averageTime, 3)} s`,
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-fuchsia-300",
      },
      {
        label: "Intentos promedio",
        value: formatMetric(averageAttempts, 0),
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-sky-300",
      },
      {
        label: "Tasa de éxito",
        value: formatPercent(successRate),
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-emerald-300",
      },
      {
        label: "Velocidad media",
        value: `${formatMetric(averageSpeed, 0)} c/s`,
        detail: "Ruta: RESULTADOS_GLOBALES.datasets[1].data",
        accent: "text-violet-300",
      },
    ];
  }, [activeTab, selectedStat]);

  const complexityData = useMemo(() => {
    const grouped = new Map<number, { log2: number; time: number[]; attempts: number[] }>();

    selectedRows.forEach((row) => {
      const log2 = parseNumber(row.log2_search_space);
      const time = parseNumber(row.attack_time_seconds) || parseNumber(row.execution_time);
      const attempts = parseNumber(row.attempts);
      if (!grouped.has(log2)) grouped.set(log2, { log2, time: [], attempts: [] });
      const bucket = grouped.get(log2)!;
      if (time > 0) bucket.time.push(time);
      if (attempts > 0) bucket.attempts.push(attempts);
    });

    return Array.from(grouped.values())
      .map((item) => ({
        log2: item.log2,
        tiempoPromedio: item.time.length ? item.time.reduce((acc, value) => acc + value, 0) / item.time.length : 0,
        intentosPromedio: item.attempts.length ? item.attempts.reduce((acc, value) => acc + value, 0) / item.attempts.length : 0,
      }))
      .sort((a, b) => a.log2 - b.log2);
  }, [selectedRows]);

  const evolutionData = useMemo(() => {
    return selectedRows
      .map((row) => ({
        attempt: parseNumber(row.attempts),
        tiempo: parseNumber(row.attack_time_seconds) || parseNumber(row.execution_time),
      }))
      .filter((row) => row.attempt > 0)
      .sort((a, b) => a.attempt - b.attempt)
      .slice(0, 40);
  }, [selectedRows]);

  const probabilityData = useMemo(() => {
    return datasets.attackStatistics.map((row) => ({
      name: row.algoritmo,
      exito: parseNumber(row.successful_attacks),
      fallos: parseNumber(row.failed_attacks),
    }));
  }, [datasets.attackStatistics]);

  const comparisonData = useMemo(() => {
    return datasets.algorithmComparison.map((row) => ({
      name: row.algoritmo,
      tiempo: parseNumber(row.average_time),
      intentos: parseNumber(row.average_attempts),
      tasa: parseNumber(row.success_rate),
      velocidad: parseNumber(row.average_attempts_per_second),
    }));
  }, [datasets.algorithmComparison]);

  const findings = useMemo(() => {
    if (!comparisonData.length) return [];

    const strongest = comparisonData.reduce((best, item) => (item.tasa > best.tasa ? item : best), comparisonData[0]);
    const quickest = comparisonData.reduce((best, item) => (item.tiempo < best.tiempo ? item : best), comparisonData[0]);
    const fastest = comparisonData.reduce((best, item) => (item.velocidad > best.velocidad ? item : best), comparisonData[0]);
    const biggestSearch = comparisonData.reduce((best, item) => (item.intentos > best.intentos ? item : best), comparisonData[0]);

    return [
      {
        title: "Resistencia observada",
        text: `${strongest.name} presenta la mayor tasa de éxito observada en el dataset de comparación (${formatPercent(strongest.tasa)}).`,
      },
      {
        title: "Tiempo de ruptura",
        text: `${quickest.name} muestra el menor tiempo promedio de ataque (${formatMetric(quickest.tiempo, 3)} s).`,
      },
      {
        title: "Velocidad de exploración",
        text: `${fastest.name} alcanza la mayor velocidad de intento por segundo (${formatMetric(fastest.velocidad, 0)} c/s).`,
      },
      {
        title: "Carga de trabajo",
        text: `${biggestSearch.name} requiere el mayor número de intentos promedio (${formatMetric(biggestSearch.intentos, 0)}).`,
      },
    ];
  }, [comparisonData]);

  const filteredTableRows = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    const rows = selectedRows.filter((row) => {
      const matchesAlgorithm = selectedAlgorithmFilter === "Todos" || row.algoritmo === selectedAlgorithmFilter;
      const haystack = [row.attack_id, row.algoritmo, row.attack_type, row.target_id, row.target_value, row.recovered_text, row.error_message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = haystack.includes(normalizedSearch);
      return matchesAlgorithm && matchesSearch;
    });

    const sortedRows = [...rows].sort((left, right) => {
      const leftValue = left[sortKey] ?? "";
      const rightValue = right[sortKey] ?? "";
      const comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sortedRows;
  }, [searchTerm, selectedAlgorithmFilter, selectedRows, sortDirection, sortKey]);

  const tablePageCount = Math.max(1, Math.ceil(filteredTableRows.length / 8));
  const visibleRows = filteredTableRows.slice((page - 1) * 8, page * 8);

  const resetTableState = () => {
    setPage(1);
    setSearchTerm("");
    setSelectedAlgorithmFilter("Todos");
    setSortKey("attack_id");
    setSortDirection("asc");
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const exportCsv = () => {
    const header = ["attack_id", "algoritmo", "attack_type", "target_id", "attack_successful", "execution_time", "attack_time_seconds", "attempts", "attempts_per_second", "key_size_bits", "password_length", "search_space", "log2_search_space"];
    const csvRows = filteredTableRows.map((row) => header.map((key) => `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(","));
    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fuerza-bruta-${activeTab.toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const customTooltipStyle = {
    contentStyle: { backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" },
    labelStyle: { color: "#fff", fontWeight: "bold" },
  };

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Ataques de Fuerza Bruta"
      description="La sección principal del análisis organiza la evidencia en resumen ejecutivo, complejidad temporal, probabilidad de éxito, comparación entre algoritmos y tabla de datos completa, usando únicamente variables presentes en attacks.json."
      badge="Análisis científico"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
            }}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.5)]"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-[24px] border border-white/10 bg-slate-950/70 p-5 text-sm text-slate-400">
        <p className="font-medium uppercase tracking-[0.25em] text-cyan-300">Resumen ejecutivo</p>
        <p className="mt-2 leading-7">
          Se analizan {formatMetric(selectedRows.length, 0)} registros de ataque para {activeTab === "General" ? "todos los algoritmos" : activeTab}. La interfaz organiza la información de forma científica en resumen, KPIs, complejidad temporal, evolución, probabilidad, comparación, tabla y conclusiones automáticas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} detail={card.detail} accent={card.accent} />
        ))}
      </div>

      <div className="mt-6 space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <VisualPanel title="Complejidad temporal" subtitle="Curva principal de resistencia frente a la dimensión de búsqueda">
            <div className="mt-4 h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={complexityData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="log2" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value), 3)} s`, "Tiempo medio"]} />
                  <Line type="monotone" dataKey="tiempoPromedio" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Fuente: RESULTADOS_GLOBALES.datasets[0].data · variables: log2_search_space, attack_time_seconds</p>
          </VisualPanel>

          <VisualPanel title="Evolución del ataque" subtitle="Intentos acumulados frente al tiempo observado">
            <div className="mt-4 h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="attempt" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value), 3)} s`, "Tiempo"]} />
                  <Area type="monotone" dataKey="tiempo" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.18} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Fuente: RESULTADOS_GLOBALES.datasets[0].data · variables: attempts, attack_time_seconds</p>
          </VisualPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <VisualPanel title="Probabilidad de éxito" subtitle="Distribución observada de éxitos y fracasos por algoritmo">
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={probabilityData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value), 0)}`, "Conteo"]} />
                  <Bar dataKey="exito" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fallos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Fuente: RESULTADOS_GLOBALES.datasets[1].data · variables: successful_attacks, failed_attacks</p>
          </VisualPanel>

          <VisualPanel title="Comparación entre algoritmos" subtitle="Tiempo medio, intentos, velocidad y tasa de éxito del conjunto de comparación">
            <div className="mt-4 h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip {...customTooltipStyle} formatter={(value) => [`${formatMetric(Number(value), 2)}`, "Valor"]} />
                  <Bar dataKey="tasa" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tiempo" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Fuente: RESULTADOS_GLOBALES.datasets[2].data · variables: average_time, average_attempts, average_attempts_per_second, success_rate</p>
          </VisualPanel>
        </div>

        <VisualPanel title="Resultados del análisis" subtitle="Hallazgos automáticos derivados únicamente de las variables del JSON">
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {findings.map((finding) => (
              <div key={finding.title} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-white">{finding.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{finding.text}</p>
              </div>
            ))}
          </div>
        </VisualPanel>

        <VisualPanel title="Datos completos" subtitle="Tabla interactiva con búsqueda, filtros, ordenamiento, paginación y exportación">
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="flex-1 text-sm text-slate-400">
              <span className="mb-2 block">Buscar registros</span>
              <input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por algoritmo, tipo de ataque, target o texto"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
              />
            </label>
            <label className="text-sm text-slate-400">
              <span className="mb-2 block">Filtrar algoritmo</span>
              <select
                value={selectedAlgorithmFilter}
                onChange={(event) => {
                  setSelectedAlgorithmFilter(event.target.value);
                  setPage(1);
                }}
                className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
              >
                <option value="Todos">Todos</option>
                {tabs.filter((tab) => tab !== "General").map((tab) => (
                  <option key={tab} value={tab}>{tab}</option>
                ))}
              </select>
            </label>
            <button
              onClick={exportCsv}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              Exportar CSV
            </button>
            <button
              onClick={resetTableState}
              className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  {[
                    { key: "attack_id", label: "ID" },
                    { key: "algoritmo", label: "Algoritmo" },
                    { key: "attack_type", label: "Tipo" },
                    { key: "attack_successful", label: "Éxito" },
                    { key: "execution_time", label: "Tiempo" },
                    { key: "attempts", label: "Intentos" },
                    { key: "attempts_per_second", label: "c/s" },
                  ].map((column) => (
                    <th key={column.key} className="cursor-pointer px-3 py-3" onClick={() => handleSort(column.key)}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.attack_id ?? `${row.algoritmo}-${row.target_id}`} className="border-b border-white/5 text-slate-300">
                    <td className="px-3 py-3">{row.attack_id ?? "—"}</td>
                    <td className="px-3 py-3">{row.algoritmo ?? "—"}</td>
                    <td className="px-3 py-3">{row.attack_type ?? "—"}</td>
                    <td className="px-3 py-3">{row.attack_successful ? "Sí" : "No"}</td>
                    <td className="px-3 py-3">{formatMetric(parseNumber(row.execution_time), 3)} s</td>
                    <td className="px-3 py-3">{formatMetric(parseNumber(row.attempts), 0)}</td>
                    <td className="px-3 py-3">{formatMetric(parseNumber(row.attempts_per_second), 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              Mostrando {visibleRows.length} de {filteredTableRows.length} registros · Fuente: RESULTADOS_GLOBALES.datasets[0].data
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-300"
              >
                Anterior
              </button>
              <span className="rounded-full bg-slate-950/80 px-3 py-2 text-slate-300">
                {page} / {tablePageCount}
              </span>
              <button
                onClick={() => setPage((current) => Math.min(tablePageCount, current + 1))}
                className="rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-300"
              >
                Siguiente
              </button>
            </div>
          </div>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
