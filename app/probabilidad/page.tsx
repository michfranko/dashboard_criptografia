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
import probabilitiesRawData from "../data/probabilities.json";

import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";

// 1. Buscador profundo universal (Ahora etiqueta el algoritmo automáticamente)
function extractProbabilityRows(jsonData: any): any[] {
  let records: any[] = [];
  if (!jsonData) return records;

  function findDataArray(obj: any) {
    if (!obj || typeof obj !== "object") return;

    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        if ("log2_search_space" in value[0] || "search_space" in value[0] || "key_size_bits" in value[0]) {
          
          // Etiquetado Inteligente de Algoritmo
          const taggedData = value.map((r: any) => {
            let algoRaw = String(r.algorithm || r.algoritmo || "General").toUpperCase();
            // Normalizamos nombres
            if (algoRaw.includes("SHA-256")) algoRaw = "SHA-256";
            else if (algoRaw.includes("AES")) algoRaw = "AES";
            else if (algoRaw.includes("RSA")) algoRaw = "RSA";
            else if (algoRaw.includes("MD5")) algoRaw = "MD5";
            
            return { ...r, _algo: algoRaw };
          });
          
          records = [...records, ...taggedData];
        }
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) findDataArray(item);
    } else {
      for (const key of Object.keys(obj)) findDataArray(obj[key]);
    }
  }

  findDataArray(jsonData);
  return records;
}

const formatMetric = (value: number | null, decimals: number = 2) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: decimals }).format(value);
};

const formatScientific = (value: number | null) => {
  if (value === null || !Number.isFinite(value) || value === 0) return "0";
  if (value < 1000000) return new Intl.NumberFormat("en-US").format(value);
  return value.toExponential(2).replace("e+", " x 10^");
};

export default function ProbabilidadPage() {
  const [activeTab, setActiveTab] = useState("General");
  const tabs = ["General", "AES", "RSA", "MD5", "SHA-256"];

  const allRows = useMemo(() => extractProbabilityRows(probabilitiesRawData), []);

  // 2. Filtramos los datos según la pestaña activa
  // Reemplaza esta sección de filteredRows por esta versión blindada
  const filteredRows = useMemo(() => {
    if (activeTab === "General") return allRows;
    
    // Normalizamos el nombre del tab y el del registro para comparar sin errores
    const tabName = activeTab.toLowerCase(); 
    return allRows.filter((r) => {
      const algoName = String(r._algo || "").toLowerCase();
      // Si el tab es SHA-256, buscamos cualquier cosa que sea SHA
      if (tabName === "sha-256") return algoName.includes("sha");
      
      return algoName === tabName;
    });
  }, [allRows, activeTab]);

  const getBestValue = (row: any, candidates: string[]): number => {
    for (const key of candidates) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
        const num = Number(row[key]);
        if (!isNaN(num)) return num;
      }
    }
    return 0;
  };

  // 3. Cálculos Dinámicos de Tarjetas
  const metricsSummary = useMemo(() => {
    if (filteredRows.length === 0) return { maxEntropy: 0, avgSpace: 0, maxAttempts: 0 };

    let maxEntropy = 0;
    let totalSpace = 0;
    let maxAttempts = 0;
    let validSpaceCount = 0;

    filteredRows.forEach((r: any) => {
      const entropy = getBestValue(r, ["log2_search_space", "entropy"]);
      let space = getBestValue(r, ["search_space", "combinations"]);
      const attempts = getBestValue(r, ["attempts", "total_attempts"]);

      if (entropy > maxEntropy) maxEntropy = entropy;
      if (attempts > maxAttempts) maxAttempts = attempts;
      
      if ((space === 0 || space === null) && entropy > 0) {
        space = Math.pow(2, entropy);
      }

      if (space > 0) {
        totalSpace += space;
        validSpaceCount++;
      }
    });

    return {
      maxEntropy,
      avgSpace: validSpaceCount > 0 ? totalSpace / validSpaceCount : 0,
      maxAttempts,
    };
  }, [filteredRows]);

  // 4. Agrupación y Limpieza Matemática
  const chartData = useMemo(() => {
    const grouped = new Map<number, { entropy: number[]; space: number[]; attempts: number[] }>();

    filteredRows.forEach((r: any) => {
      let groupKeyRaw = getBestValue(r, ["key_size_bits", "password_length", "plaintext_length"]);
      
      // LIMPIEZA: Si el eje X trae números raros, los redondeamos a enteros limpios
      let groupKey = groupKeyRaw > 0 ? Math.round(groupKeyRaw) : 0; 
      
      let entropy = getBestValue(r, ["log2_search_space", "entropy"]);
      let space = getBestValue(r, ["search_space", "combinations"]);
      const attempts = getBestValue(r, ["attempts", "execution_time_attack"]);

      if ((space === 0 || space === null) && entropy > 0) {
        space = Math.pow(2, entropy);
      }

      if (groupKey > 0) {
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, { entropy: [], space: [], attempts: [] });
        }
        const current = grouped.get(groupKey)!;
        if (entropy > 0) current.entropy.push(entropy);
        if (space > 0) current.space.push(space);
        if (attempts > 0) current.attempts.push(attempts);
      }
    });

    return Array.from(grouped.entries())
      .map(([longitud, item]) => {
        const avgEntropy = item.entropy.length ? item.entropy.reduce((a, b) => a + b, 0) / item.entropy.length : 0;
        const avgSpace = item.space.length ? item.space.reduce((a, b) => a + b, 0) / item.space.length : 0;
        const avgAttempts = item.attempts.length ? item.attempts.reduce((a, b) => a + b, 0) / item.attempts.length : 0;

        return {
          longitud, // Ahora será un número entero limpio (Ej: 128, 256, 2048)
          Entropia: Number(avgEntropy.toFixed(2)),
          Combinaciones: avgSpace,
          Intentos: avgAttempts,
        };
      })
      .sort((a, b) => a.longitud - b.longitud);
  }, [filteredRows]);

  const customTooltipStyle = {
    contentStyle: { backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" },
    labelStyle: { color: "#fff", fontWeight: "bold" },
  };

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Análisis de Probabilidad y Entropía"
      description="Evaluación estocástica del espacio de búsqueda y el crecimiento exponencial de la seguridad criptográfica."
      badge="Estadística Matemática"
    >
      {/* Botones de Filtro Dinámico */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tarjetas Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Registros Analizados" value={filteredRows.length > 0 ? String(filteredRows.length) : "0"} detail={activeTab === "General" ? "Vectores procesados globales" : `Métricas de ${activeTab}`} accent="text-white" />
        <MetricCard label="Entropía Máxima" value={metricsSummary.maxEntropy > 0 ? `${formatMetric(metricsSummary.maxEntropy)} bits` : "0 bits"} detail="Nivel máximo de incertidumbre (log2)" accent="text-fuchsia-300" />
        <MetricCard label="Espacio de Búsqueda Medio" value={metricsSummary.avgSpace > 0 ? formatScientific(metricsSummary.avgSpace) : "0"} detail="Combinaciones posibles calculadas" accent="text-cyan-300" />
        <MetricCard label="Pico de Dificultad Registrado" value={metricsSummary.maxAttempts > 0 ? formatScientific(metricsSummary.maxAttempts) : "0"} detail="Peor escenario computacional" accent="text-rose-300" />
      </div>

      {/* Gráficos Estadísticos */}
      {chartData.length > 0 ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            
            {/* Gráfico 1: Entropía */}
            <VisualPanel title="Crecimiento de Entropía" subtitle="Incertidumbre (Bits) vs Dimensión de la clave">
              <div className="mt-4 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEntropy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d946ef" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="longitud" stroke="#94a3b8" fontSize={11} name="Dimensión" />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip {...customTooltipStyle} formatter={(value) => [`${value} bits`, "Entropía"]} labelFormatter={(label) => `Dimensión Base: ${label}`} />
                    <Area type="monotone" dataKey="Entropia" stroke="#d946ef" fillOpacity={1} fill="url(#colorEntropy)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </VisualPanel>

            {/* Gráfico 2: Combinaciones */}
            <VisualPanel title="Explosión Combinatoria Real" subtitle="Total de combinaciones posibles calculadas en el espacio de búsqueda">
              <div className="mt-4 h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="longitud" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val.toExponential(1)} />
                    <Tooltip {...customTooltipStyle} formatter={(value) => [formatScientific(Number(value)), "Combinaciones"]} labelFormatter={(label) => `Dimensión Base: ${label}`} />
                    <Bar dataKey="Combinaciones" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </VisualPanel>
          </div>

          {/* Gráfico 3: Intentos / Coste */}
          <VisualPanel title="Análisis de Esfuerzo de Fractura" subtitle="Carga computacional o coste estocástico de simulación">
            <div className="mt-4 h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="longitud" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => val.toExponential(1)} />
                  <Tooltip {...customTooltipStyle} formatter={(value) => [formatScientific(Number(value)), "Métrica de Esfuerzo"]} labelFormatter={(label) => `Dimensión Base: ${label}`} />
                  <Line type="monotone" dataKey="Intentos" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </VisualPanel>
        </div>
      ) : (
        <div className="mt-6 flex h-[300px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-slate-900/70 text-slate-400">
          No se encontraron métricas de probabilidad para el filtro seleccionado.
        </div>
      )}
    </DashboardShell>
  );
}