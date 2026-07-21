/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";

// IMPORTACIÓN NATIVA DEL JSON
import algorithmsRawData from "../data/algorithms.json";

import DashboardShell from "../components/dashboard-shell";
import VisualPanel from "../components/visual-panel";

// MAPEOS ESTÁTICOS DE DATOS GENERALES
const getGeneralInfo = (tab: string) => {
  const keyMap: Record<string, { tipo: string; cat: string; keySize: string; blockSize: string; desc: string; standard: string }> = {
    "AES": {
      tipo: "Simétrico",
      cat: "Cifrado Simétrico",
      keySize: "256 bits (AES-256 en experimentos)",
      blockSize: "128 bits",
      standard: "FIPS PUB 197",
      desc: "Estándar de cifrado por bloques adoptado por el gobierno de EE.UU. Es altamente eficiente y resistente a ataques criptoanalíticos conocidos."
    },
    "RSA": {
      tipo: "Asimétrico",
      cat: "Cifrado Asimétrico",
      keySize: "2048 bits (en experimentos)",
      blockSize: "Variable (según el padding y tamaño clave)",
      standard: "PKCS #1 / RFC 8017",
      desc: "Sistema de clave pública basado en la dificultad de factorizar números enteros grandes. Su sobrecarga computacional es considerablemente mayor a la simétrica."
    },
    "SHA-256": {
      tipo: "Hash",
      cat: "Función Hash",
      keySize: "No aplica (Salida fija de 256 bits)",
      blockSize: "512 bits (tamaño del bloque de procesamiento)",
      standard: "FIPS PUB 180-4",
      desc: "Función de hashing criptográfica de un solo sentido diseñada por la NSA. Genera un resumen digest determinista de 32 bytes (64 caracteres hexadecimales)."
    },
    "MD5": {
      tipo: "Hash",
      cat: "Función Hash",
      keySize: "No aplica (Salida fija de 128 bits)",
      blockSize: "512 bits (tamaño del bloque de procesamiento)",
      standard: "RFC 1321",
      desc: "Algoritmo de reducción criptográfico de 128 bits creado en 1991. Se considera roto por colisiones, pero sigue siendo un benchmark comparativo de velocidad indispensable."
    }
  };
  return keyMap[tab] || { tipo: "Desconocido", cat: "Desconocido", keySize: "N/A", blockSize: "N/A", standard: "N/A", desc: "" };
};

// COMPONENTE DE TARJETA KPI PERSONALIZADA
function KpiCard({
  label,
  value,
  detail,
  path,
  variable,
  icon = "◆",
  textColor = "text-cyan-300",
  barColor = "bg-cyan-500",
  glowColor = "rgba(6,182,212,0.12)",
}: {
  label: string;
  value: string;
  detail: string;
  path: string;
  variable: string;
  icon?: string;
  textColor?: string;
  barColor?: string;
  glowColor?: string;
}) {
  return (
    <div
      style={{ "--glow" : glowColor } as React.CSSProperties}
      className="relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-white/5 bg-slate-900/40 p-4 pl-5 backdrop-blur-md transition-all duration-300 hover:border-white/10 hover:bg-slate-900/60 group"
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 24px ${glowColor}`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "")}
    >
      {/* Barra de color de acento lateral */}
      <div className={`absolute left-0 top-0 h-full w-[3px] ${barColor} rounded-l-full opacity-80`}></div>

      {/* Ícono flotante top-right */}
      <div className="absolute top-3 right-3 text-sm opacity-20 group-hover:opacity-40 transition-opacity duration-300 select-none">
        {icon}
      </div>

      <div>
        <p className="text-[9px] font-bold tracking-[0.18em] text-slate-500 uppercase">{label}</p>
        <p className={`mt-2 text-[1.35rem] font-black tracking-tight leading-none ${textColor}`}>{value}</p>
        <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">{detail}</p>
      </div>

      <div className="mt-4 pt-2 border-t border-white/5 text-[8.5px] font-mono text-slate-600 space-y-0.5">
        <div className="truncate"><span className="text-slate-500 font-semibold">path › </span>{path}</div>
        <div className="truncate"><span className="text-slate-500 font-semibold">var › </span>{variable}</div>
      </div>
    </div>
  );
}

// FORMATTEADOR DE MÉTRICAS
const formatValue = (val: any, formatType: 'time' | 'throughput' | 'number' | 'percent' | 'scientific' | 'default') => {
  if (val === null || val === undefined || isNaN(Number(val))) return "—";
  const num = Number(val);
  
  switch (formatType) {
    case 'time':
      if (num === 0) return "0 s";
      if (num < 0.001) return `${(num * 1e6).toFixed(2)} µs`;
      if (num < 1) return `${(num * 1000).toFixed(2)} ms`;
      return `${num.toFixed(4)} s`;
      
    case 'throughput':
      // El JSON contiene Bytes/seg en refinados. Convertimos a MB/s
      if (num > 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(2)} MB/s`;
      if (num > 1024) return `${(num / 1024).toFixed(2)} KB/s`;
      return `${num.toFixed(2)} B/s`;
      
    case 'percent':
      return `${num.toFixed(2)}%`;
      
    case 'scientific':
      if (num > 1e6) return num.toExponential(3);
      return num.toLocaleString("en-US");
      
    case 'number':
    default:
      return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
};

export default function AlgoritmosPage() {
  const [activeTab, setActiveTab] = useState<"AES" | "RSA" | "SHA-256" | "MD5">("AES");
  const [activeSection, setActiveSection] = useState<"resumen" | "rendimiento" | "seguridad" | "benchmark" | "datos">("resumen");
  
  const tabs: ("AES" | "RSA" | "SHA-256" | "MD5")[] = ["AES", "RSA", "SHA-256", "MD5"];
  
  const subSections = [
    { id: "resumen", label: "Ficha & KPIs", icon: "📋" },
    { id: "rendimiento", label: "Rendimiento", icon: "⚡" },
    { id: "seguridad", label: "Seguridad", icon: "🛡️" },
    { id: "benchmark", label: "Benchmark Global", icon: "⚖️" },
    { id: "datos", label: "Explorador de Datos", icon: "📁" }
  ];

  // KEY MAP PARA OBTENER LAS SECCIONES DENTRO DEL JSON NATIVO
  const keyMap = useMemo<Record<string, string>>(() => ({
    "AES": "AES",
    "RSA": "RSA",
    "SHA-256": "SHA",
    "MD5": "MD5"
  }), []);

  const activeRawKey = keyMap[activeTab];

  // 1. INFORMACIÓN GENERAL DE LA FICHA TÉCNICA
  const infoGeneral = useMemo(() => getGeneralInfo(activeTab), [activeTab]);

  // 2. EXTRAER KPI's DESDE LAS HOJAS ESTADÍSTICAS DEL JSON
  const kpis = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const algoObj = rawData[activeRawKey];
    
    // Obtener estadísticas de cifrado/hashing refinado
    const refFile = `${activeRawKey.toLowerCase() === 'sha' ? 'sha' : activeRawKey.toLowerCase()}_metrics_refined.csv`;
    const execTimeStat = algoObj?.statistics?.execution_time?.find((s: any) => s.file === refFile);
    const throughputStat = algoObj?.statistics?.throughput?.find((s: any) => s.file === refFile);

    // Obtener estadísticas globales de fuerza bruta
    const globalAttackDS = rawData["RESULTADOS_GLOBALES"]?.datasets?.find((d: any) => d.file === "attack_statistics.csv")?.data || [];
    const attackRow = globalAttackDS.find((r: any) => r.algoritmo === activeTab);

    // Obtener espacio de búsqueda teórico
    const unknownDS = rawData["UNKNOWN"]?.datasets || [];
    const combData = unknownDS.find((d: any) => d.file === "analisis_combinatorio.csv")?.data || [];
    const combRows = combData.filter((r: any) => r.algoritmo === (activeTab === "SHA-256" ? "SHA" : activeTab));
    
    const combRow = combRows.length > 0 
      ? combRows.reduce((max: any, cur: any) => (Number(cur.espacio_de_b_squeda_te_rico || 0) > Number(max.espacio_de_b_squeda_te_rico || 0)) ? cur : max) 
      : null;

    return {
      execTime: execTimeStat?.mean ?? null,
      throughput: throughputStat?.mean ?? null,
      attackTime: attackRow?.average_time ?? null,
      attackAttempts: attackRow?.average_attempts ?? null,
      attackAttemptsSec: attackRow?.average_attempts_per_second ?? null,
      searchSpace: combRow?.espacio_de_b_squeda_te_rico ?? (attackRow?.average_search_space ?? null),
      searchFormula: combRow?.f_rmula ?? "N/A",
      successRate: attackRow?.success_rate ?? null,
      totalAttacks: attackRow?.total_attacks ?? null,
      refFile,
      combFile: "analisis_combinatorio.csv"
    };
  }, [activeTab, activeRawKey]);

  // 3. DATOS DE RENDIMIENTO (BENCHMARK CRIPTOGRÁFICO DE TAMAÑOS)
  const performanceData = useMemo(() => {
    const rawData = algorithmsRawData as any;
    
    // Si es AES o RSA
    if (activeTab === "AES" || activeTab === "RSA") {
      const fileKey = `${activeTab.toLowerCase()}_statistical_benchmark.csv`;
      const dataset = rawData[activeTab]?.datasets?.find((d: any) => d.file === fileKey);
      if (dataset?.data) {
        return dataset.data.map((row: any) => ({
          name: row.tama_o,
          bytes: Number(row.bytes),
          time: Number(row.promedio),
          throughput: row.bytes / row.promedio
        }));
      }
    } else {
      // Si es MD5 o SHA-256
      const dataset = rawData["UNKNOWN"]?.datasets?.find((d: any) => d.file === "hashes_statistical_benchmark.csv");
      if (dataset?.data) {
        const hashAlgoKey = activeTab === "SHA-256" ? "SHA256" : "MD5";
        return dataset.data
          .filter((row: any) => row.algoritmo === hashAlgoKey)
          .map((row: any) => ({
            name: row.tama_o,
            bytes: Number(row.bytes),
            time: Number(row.promedio),
            throughput: row.bytes / row.promedio
          }));
      }
    }

    // Fallback: agrupar
    const refFile = `${activeRawKey.toLowerCase() === 'sha' ? 'sha' : activeRawKey.toLowerCase()}_metrics_refined.csv`;
    const refDataset = rawData[activeRawKey]?.datasets?.find((d: any) => d.file === refFile);
    if (refDataset?.data) {
      const groups: Record<number, { bytes: number; totalTime: number; count: number }> = {};
      refDataset.data.forEach((r: any) => {
        const b = Number(r.data_size_bytes);
        if (!groups[b]) groups[b] = { bytes: b, totalTime: 0, count: 0 };
        groups[b].totalTime += Number(r.execution_time);
        groups[b].count++;  
      });
      return Object.values(groups)
        .map((g: any) => ({
          name: g.bytes < 1024 ? `${g.bytes} B` : `${(g.bytes / 1024).toFixed(0)} KB`,
          bytes: g.bytes,
          time: g.totalTime / g.count,
          throughput: g.bytes / (g.totalTime / g.count)
        }))
        .sort((a: any, b: any) => a.bytes - b.bytes);
    }
    return [];
  }, [activeTab, activeRawKey]);

  // 4. DATOS DE SEGURIDAD (ENTROPÍA VS TIEMPO ESTIMADO DE ROTURA)
  const securityEntropyData = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const dataset = rawData["UNKNOWN"]?.datasets?.find((d: any) => d.file === "analisis_vulnerabilidad_final.csv");
    if (!dataset?.data) return [];
    
    const crackColMap: Record<string, string> = {
      "AES": "tiempo_estimado_aes_256",
      "RSA": "tiempo_estimado_rsa",
      "SHA-256": "tiempo_estimado_sha_256",
      "MD5": "tiempo_estimado_md5"
    };
    const crackCol = crackColMap[activeTab];

    return dataset.data
      .map((row: any) => ({
        entropy: Number(row.bits_entropia),
        crackTime: Number(row[crackCol]),
        password: row.password
      }))
      .sort((a: any, b: any) => a.entropy - b.entropy);
  }, [activeTab]);

  // 5. BENCHMARK COMPARATIVO GLOBAL
  const comparativeChartData = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const comparisonDS = rawData["RESULTADOS_GLOBALES"]?.datasets?.find((d: any) => d.file === "algorithm_comparison.csv");
    return comparisonDS?.data || [];
  }, []);

  // RADAR CHART MULTIDIMENSIONAL (Normalizado 0-100)
  const radarData = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const globalComparison = rawData["RESULTADOS_GLOBALES"]?.datasets?.find((d: any) => d.file === "algorithm_comparison.csv")?.data || [];
    const globalAttacks = rawData["RESULTADOS_GLOBALES"]?.datasets?.find((d: any) => d.file === "attack_statistics.csv")?.data || [];

    if (globalComparison.length === 0) return [];

    const maxAttempts = Math.max(...globalAttacks.map((r: any) => Number(r.average_attempts || 0)));
    const maxAttemptsSec = Math.max(...globalAttacks.map((r: any) => Number(r.average_attempts_per_second || 0)));
    const maxTime = Math.max(...globalComparison.map((r: any) => Number(r.average_time || 0)));
    
    const axes = [
      { name: "Resistencia (100 - Éxito)" },
      { name: "Intentos Promedio" },
      { name: "Costo Computacional" },
      { name: "Tiempo de Crack" },
      { name: "Tamaño de Clave" }
    ];

    const algorithmsList = ["AES", "RSA", "SHA-256", "MD5"];
    
    return axes.map(axis => {
      const item: Record<string, any> = { subject: axis.name };
      
      algorithmsList.forEach(algo => {
        const comp = globalComparison.find((r: any) => r.algoritmo === algo);
        const att = globalAttacks.find((r: any) => r.algoritmo === algo);
        
        let value = 0;
        if (axis.name === "Resistencia (100 - Éxito)") {
          value = 100 - (att?.success_rate ?? 0);
        } else if (axis.name === "Intentos Promedio") {
          value = maxAttempts > 0 ? ((att?.average_attempts ?? 0) / maxAttempts) * 100 : 0;
        } else if (axis.name === "Costo Computacional") {
          const rate = att?.average_attempts_per_second ?? 1;
          value = maxAttemptsSec > 0 ? (1 - (rate / maxAttemptsSec)) * 100 : 0;
        } else if (axis.name === "Tiempo de Crack") {
          value = maxTime > 0 ? ((comp?.average_time ?? 0) / maxTime) * 100 : 0;
        } else if (axis.name === "Tamaño de Clave") {
          const kSize = comp?.average_key_size ?? 0;
          value = Math.min((kSize / 2048) * 100, 100);
        }
        item[algo] = Math.round(value);
      });
      
      return item;
    });
  }, []);

  // 6. MATRIZ DE COMPARACIÓN DIRECTA SIDE-BY-SIDE
  const directComparisonMatrix = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const compData = rawData["RESULTADOS_GLOBALES"]?.datasets?.find((d: any) => d.file === "algorithm_comparison.csv")?.data || [];
    
    const rows = [
      { key: "average_key_size", label: "Tamaño de Clave Medio", format: "number", suffix: " bits" },
      { key: "average_time", label: "Tiempo de Ataque Medio", format: "time", suffix: "" },
      { key: "average_attempts", label: "Intentos Realizados Medios", format: "scientific", suffix: "" },
      { key: "average_attempts_per_second", label: "Throughput del Atacante", format: "throughput", suffix: "" },
      { key: "success_rate", label: "Tasa de Éxito de Ataque", format: "percent", suffix: "" },
      { key: "average_plaintext_length", label: "Longitud Media Entrada", format: "number", suffix: " chars" },
      { key: "average_ciphertext_length", label: "Longitud Media Salida", format: "number", suffix: " bytes" }
    ];

    return rows.map(r => {
      const matrixRow: Record<string, any> = { metric: r.label };
      compData.forEach((c: any) => {
        matrixRow[c.algoritmo] = formatValue(c[r.key], r.format as any) + (c[r.key] !== null ? r.suffix : "");
      });
      return matrixRow;
    });
  }, []);

  // 7. EXPLORADOR COMPLETO DE DATASETS (TABLA INTERACTIVA)
  const availableDatasets = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const datasetsList: { file: string; label: string; data: any[] }[] = [];
    
    const algoObj = rawData[activeRawKey];
    if (algoObj?.datasets) {
      algoObj.datasets.forEach((d: any) => {
        datasetsList.push({
          file: d.file,
          label: `[Muestras] ${d.file}`,
          data: d.data || []
        });
      });
    }

    const unknown = rawData["UNKNOWN"];
    if (unknown?.datasets) {
      unknown.datasets.forEach((d: any) => {
        const filterFiles = [
          "estadistica_descriptiva.csv",
          "analisis_combinatorio.csv",
          "modelos_crecimiento_exponencial.csv",
          "distribuciones_estadisticas.csv",
          "intervalos_confianza.csv",
          "modelos_regresion.csv",
          "analysis_summary.csv",
          "probabilidades.csv",
          "all_algorithms_metrics_refined.csv"
        ];
        if (filterFiles.includes(d.file)) {
          datasetsList.push({
            file: d.file,
            label: `[Análisis Global] ${d.file}`,
            data: d.data || []
          });
        }
      });
    }

    return datasetsList;
  }, [activeRawKey]);

  const [selectedDatasetFile, setSelectedDatasetFile] = useState<string>("");
  
  const activeDataset = useMemo(() => {
    const list = availableDatasets;
    if (list.length === 0) return null;
    const found = list.find(d => d.file === selectedDatasetFile);
    if (found) return found;
    return list[0];
  }, [availableDatasets, selectedDatasetFile]);

  // Estados de la tabla interactiva
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    if (!activeDataset || !activeDataset.data) return [];
    let processed = [...activeDataset.data];

    // Búsqueda
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      processed = processed.filter((row: any) =>
        Object.values(row).some((val: any) =>
          String(val).toLowerCase().includes(term)
        )
      );
    }

    // Ordenamiento
    if (sortConfig) {
      processed.sort((a: any, b: any) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        const numA = Number(valA);
        const numB = Number(valB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        }
        
        return sortConfig.direction === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return processed;
  }, [activeDataset, searchTerm, sortConfig]);

  // Paginación
  const totalRows = filteredAndSortedData.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  // Cambiar dataset
  const handleDatasetChange = (file: string) => {
    setSelectedDatasetFile(file);
    setSearchTerm("");
    setSortConfig(null);
    setCurrentPage(1);
  };

  // EXPORTADORES
  const handleExportCSV = () => {
    if (!activeDataset || filteredAndSortedData.length === 0) return;
    const keys = Object.keys(filteredAndSortedData[0]);
    const headers = keys.join(",");
    const rows = filteredAndSortedData.map((row: any) =>
      keys.map(k => {
        const s = String(row[k] === null || row[k] === undefined ? "" : row[k]).replace(/"/g, '""');
        return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s;
      }).join(",")
    );
    const blob = new Blob([[headers, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeDataset.file.replace(".csv", "")}_filtered.csv`;
    link.click();
  };

  const handleExportJSON = () => {
    if (!activeDataset || filteredAndSortedData.length === 0) return;
    const blob = new Blob([JSON.stringify(filteredAndSortedData, null, 2)], { type: "application/json;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeDataset.file.replace(".csv", "")}_filtered.json`;
    link.click();
  };

  // 8. CONCLUSIONES AUTOMÁTICAS DINÁMICAS
  const regressionModel = useMemo(() => {
    const rawData = algorithmsRawData as any;
    const regData = rawData["UNKNOWN"]?.datasets?.find((d: any) => d.file === "modelos_regresion.csv")?.data || [];
    const algoName = activeTab === "SHA-256" ? "SHA" : activeTab;
    return regData.find((row: any) => row.algoritmo === algoName && row.variable_dependiente === "execution_time");
  }, [activeTab]);

  const autoConclusions = useMemo(() => {
    const list: string[] = [];
    if (!kpis) return list;

    if (kpis.successRate === 0) {
      list.push(`Resistencia Absoluta de Seguridad: El algoritmo ha mostrado una vulnerabilidad nula (tasa de éxito del ataque de fuerza bruta de 0%) en todos los experimentos. Esto se correlaciona con la inmensidad del espacio de búsqueda teórico de ${formatValue(kpis.searchSpace, 'scientific')} combinaciones.`);
    } else {
      list.push(`Compromiso de Seguridad Detectado: Se registró una tasa de éxito de vulneración del ${formatValue(kpis.successRate, 'percent')} en ataques de fuerza bruta. Esto demuestra que la longitud o el tamaño de la clave simulada es vulnerable a una exploración exhaustiva en menos de ${formatValue(kpis.attackTime, 'time')}.`);
    }

    if (kpis.throughput) {
      list.push(`Throughput Operativo: La velocidad de procesamiento base del algoritmo es de ${formatValue(kpis.throughput, 'throughput')}. Esto indica que, en despliegues reales, el algoritmo permite procesar flujos de información a tasas de alta velocidad antes de alcanzar cuellos de botella en hardware.`);
    }

    if (kpis.attackAttemptsSec) {
      list.push(`Capacidad de Cómputo del Atacante: Durante la simulación del ataque, el hardware host alcanzó una tasa promedio de procesamiento de ${formatValue(kpis.attackAttemptsSec, 'scientific')} intentos por segundo, lo que evidencia la sobrecarga computacional que impone la función criptográfica al evaluador.`);
    }

    if (regressionModel) {
      list.push(`Comportamiento Teórico de Escalabilidad: El ajuste estadístico de regresión indica que el tiempo de ejecución criptográfico se comporta según un crecimiento de tipo "${regressionModel.mejor_modelo}" (con un ajuste R² de ${regressionModel.mejor_r2.toFixed(4)}), permitiendo predecir el impacto temporal ante cargas de datos masivas.`);
    } else {
      list.push("Comportamiento Teórico de Escalabilidad: No se dispone de un modelo de regresión matemático exclusivo precalculado para este algoritmo en los datos estructurados, requiriendo un modelado empírico ad-hoc.");
    }

    return list;
  }, [kpis, regressionModel]);

  const customTooltipStyle = {
    contentStyle: { backgroundColor: "#0b0f19", borderColor: "rgba(255,255,255,0.08)", borderRadius: "14px" },
    labelStyle: { color: "#94a3b8", fontWeight: "bold" },
  };

  // COLORES DINÁMICOS POR ALGORITMO SELECCIONADO
  const theme = useMemo(() => {
    const mapping: Record<string, { border: string; text: string; bar: string; badge: string; radarFill: string; radarStroke: string }> = {
      "AES": {
        border: "border-cyan-500/20",
        text: "text-cyan-400",
        bar: "bg-cyan-500",
        badge: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
        radarFill: "#06b6d4",
        radarStroke: "#22d3ee"
      },
      "RSA": {
        border: "border-purple-500/20",
        text: "text-purple-400",
        bar: "bg-purple-500",
        badge: "bg-purple-500/10 text-purple-300 border-purple-500/20",
        radarFill: "#a855f7",
        radarStroke: "#c084fc"
      },
      "SHA-256": {
        border: "border-emerald-500/20",
        text: "text-emerald-400",
        bar: "bg-emerald-500",
        badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        radarFill: "#10b981",
        radarStroke: "#34d399"
      },
      "MD5": {
        border: "border-amber-500/20",
        text: "text-amber-400",
        bar: "bg-amber-500",
        badge: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        radarFill: "#f59e0b",
        radarStroke: "#fbbf24"
      }
    };
    return mapping[activeTab];
  }, [activeTab]);

  return (
    <DashboardShell
      eyebrow="Laboratorio Criptográfico"
      title="Análisis Estadístico de Algoritmos"
      description="Evaluación experimental y estadística exhaustiva de los algoritmos AES, RSA, SHA-256 y MD5 basada en datos empíricos."
      badge="Análisis Académico"
    >
      {/* HEADER DE CONTROL PRINCIPAL: SELECCIÓN DE ALGORITMO */}
      <div className="mb-6 rounded-2xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur-md space-y-3">
        {/* Fila 1: Algoritmos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold mr-1 font-mono">Algoritmo</span>
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            const activeClasses: Record<string, string> = {
              "AES":    "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]",
              "RSA":    "bg-purple-500/10 text-purple-300 border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]",
              "SHA-256":"bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
              "MD5":    "bg-amber-500/10 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
            };
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedDatasetFile("");
                  setCurrentPage(1);
                }}
                className={`rounded-xl border px-5 py-2 text-xs font-bold transition-all duration-300 cursor-pointer ${
                  isActive
                    ? activeClasses[tab]
                    : "border-white/5 bg-slate-950/30 text-slate-500 hover:text-slate-200 hover:border-white/10"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>


        {/* Divisor */}
        <div className="h-px bg-white/5" />

        {/* Fila 2: Sub-secciones */}
        <div className="flex overflow-x-auto gap-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold mr-2 font-mono self-center shrink-0">Sección</span>
          {subSections.map((sec) => {
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`relative flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer rounded-lg ${
                  isActive
                    ? `${theme.text} bg-white/5`
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <span className="text-sm leading-none">{sec.icon}</span>
                <span>{sec.label}</span>
                {/* Indicador de línea activa */}
                {isActive && (
                  <span className={`absolute bottom-0 left-2 right-2 h-[2px] ${theme.bar} rounded-full`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN SECCIÓN SELECCIONADA */}
      <div className="space-y-6">
        
        {/* ================= SECCIÓN 1: RESUMEN Y KPIs ================= */}
        {activeSection === "resumen" && (
          <div className="animate-fadeIn space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* FICHA TÉCNICA */}
              <div className={`relative flex flex-col justify-between rounded-[24px] border ${theme.border} bg-slate-900/30 p-5 pl-6 backdrop-blur-md shadow-xl transition-all duration-300 hover:bg-slate-900/40`}>
                <div className={`absolute left-0 top-0 h-full w-[4px] ${theme.bar} rounded-l-full`}></div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-mono font-bold">Ficha Técnica</span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold font-mono ${theme.badge}`}>
                      {infoGeneral.tipo}
                    </span>
                  </div>
                  
                  <h3 className="mt-4 text-3xl font-extrabold text-white tracking-tight">{activeTab}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400 font-sans">{infoGeneral.desc}</p>
                  
                  <div className="mt-6 space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-slate-400">Categoría:</span>
                      <span className="text-slate-200 font-bold">{infoGeneral.cat}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-slate-400">Estándar:</span>
                      <span className="text-slate-300">{infoGeneral.standard}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-slate-400">Tamaño Clave:</span>
                      <span className="text-slate-300">{infoGeneral.keySize}</span>
                    </div>
                    <div className="flex justify-between items-center pb-1">
                      <span className="text-slate-400">Tamaño Bloque:</span>
                      <span className="text-slate-300">{infoGeneral.blockSize}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Estado del Diagnóstico</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-2.5 w-2.5 rounded-full ${kpis?.successRate === 0 ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></div>
                    <span className="text-xs font-semibold text-slate-200">
                      {kpis?.successRate === 0 
                        ? "Verificado - 100% Inexpugnable en Pruebas" 
                        : `Verificado - Explotado al ${formatValue(kpis?.successRate, 'percent')}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* GRID DE KPIs */}
              <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <KpiCard 
                  label="Tiempo Criptográfico" 
                  value={formatValue(kpis.execTime, 'time')}
                  detail="Latencia promedio de cifrado/hash"
                  path={`${activeRawKey}.statistics.execution_time`}
                  variable="mean"
                  icon="⏱"
                  textColor={theme.text}
                  barColor={theme.bar}
                  glowColor={theme.radarFill + "20"}
                />
                <KpiCard 
                  label="Throughput Cripto" 
                  value={formatValue(kpis.throughput, 'throughput')}
                  detail="Velocidad de procesamiento base"
                  path={`${activeRawKey}.statistics.throughput`}
                  variable="mean"
                  icon="🚀"
                  textColor={theme.text}
                  barColor={theme.bar}
                  glowColor={theme.radarFill + "20"}
                />
                <KpiCard 
                  label="Tiempo de Ataque" 
                  value={formatValue(kpis.attackTime, 'time')}
                  detail="Tiempo medio para romper la clave"
                  path="RESULTADOS_GLOBALES › attack_statistics.csv"
                  variable="average_time"
                  icon="⚔️"
                  textColor="text-amber-400"
                  barColor="bg-amber-500"
                  glowColor="rgba(245,158,11,0.12)"
                />
                <KpiCard 
                  label="Intentos Realizados" 
                  value={formatValue(kpis.attackAttempts, 'scientific')}
                  detail="Claves simuladas evaluadas en promedio"
                  path="RESULTADOS_GLOBALES › attack_statistics.csv"
                  variable="average_attempts"
                  icon="🔢"
                  textColor="text-amber-400"
                  barColor="bg-amber-500"
                  glowColor="rgba(245,158,11,0.12)"
                />
                <KpiCard 
                  label="Throughput Ataque" 
                  value={formatValue(kpis.attackAttemptsSec, 'scientific')}
                  detail="Intentos de fuerza bruta por segundo"
                  path="RESULTADOS_GLOBALES › attack_statistics.csv"
                  variable="average_attempts_per_second"
                  icon="💻"
                  textColor="text-violet-400"
                  barColor="bg-violet-500"
                  glowColor="rgba(139,92,246,0.12)"
                />
                <KpiCard 
                  label="Espacio de Búsqueda" 
                  value={formatValue(kpis.searchSpace, 'scientific')}
                  detail={`Teórico · ${kpis.searchFormula}`}
                  path={`UNKNOWN › ${kpis.combFile}`}
                  variable="espacio_de_b_squeda_te_rico"
                  icon="🔭"
                  textColor="text-fuchsia-400"
                  barColor="bg-fuchsia-500"
                  glowColor="rgba(192,132,252,0.12)"
                />
              </div>
            </div>

            {/* CONCLUSIONES AUTOMÁTICAS */}
            <VisualPanel title="Análisis del Algoritmo" subtitle="Diagnóstico Dinámico Automatizado">
              <div className="rounded-xl border border-white/5 bg-slate-950/60 p-5 shadow-inner">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">⚙️</span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Observaciones Computacionales para {activeTab}
                  </h4>
                </div>
                <ul className="space-y-3 font-sans text-xs text-slate-300">
                  {autoConclusions.map((conclusion, index) => (
                    <li key={index} className="flex gap-3 items-start leading-relaxed hover:text-slate-100 transition">
                      <span className="text-cyan-400 font-bold font-mono text-right min-w-[20px]">[{index + 1}]</span>
                      <p>{conclusion}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </VisualPanel>
          </div>
        )}

        {/* ================= SECCIÓN 2: RENDIMIENTO ================= */}
        {activeSection === "rendimiento" && (
          <div className="animate-fadeIn grid gap-6 lg:grid-cols-2">
            <VisualPanel title="Escalabilidad Temporal" subtitle="Tiempo de ejecución según volumen de entrada">
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                Evaluación asintótica experimental. Contrasta el tiempo promedio necesario para la operación criptográfica base (cifrar/hashear, eje Y) frente al tamaño de la entrada de datos en bytes (eje X).
              </p>
              <div className="h-[280px] w-full">
                {performanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} tickFormatter={(v) => formatValue(v, 'time')} />
                      <Tooltip 
                        {...customTooltipStyle} 
                        formatter={(value) => [formatValue(value, 'time'), "Tiempo"]} 
                        labelFormatter={(label) => `Carga: ${label}`} 
                      />
                      <Line type="monotone" dataKey="time" stroke={theme.radarStroke} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500 font-mono">Sin datos de benchmark de rendimiento</div>
                )}
              </div>
            </VisualPanel>

            <VisualPanel title="Tasa de Transferencia" subtitle="Throughput de datos en Bytes procesados por segundo">
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                Tasa de procesamiento en Bytes/segundo (eje Y) computado para cada tamaño de archivo evaluado (eje X). Visualiza el límite de saturación de flujo según la escala de la carga útil.
              </p>
              <div className="h-[280px] w-full">
                {performanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} tickFormatter={(v) => formatValue(v, 'throughput')} />
                      <Tooltip 
                        {...customTooltipStyle} 
                        formatter={(value) => [formatValue(value, 'throughput'), "Throughput"]} 
                        labelFormatter={(label) => `Carga: ${label}`} 
                      />
                      <Bar dataKey="throughput" radius={[3, 3, 0, 0]}>
                        {performanceData.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={theme.radarStroke} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500 font-mono">Sin datos de throughput de rendimiento</div>
                )}
              </div>
            </VisualPanel>
          </div>
        )}

        {/* ================= SECCIÓN 3: SEGURIDAD ================= */}
        {activeSection === "seguridad" && (
          <div className="animate-fadeIn grid gap-6 lg:grid-cols-2">
            <VisualPanel title="Robustez ante Fuerza Bruta" subtitle="Resistencia temporal vs Complejidad de la contraseña (Entropía)">
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                Gráfico logarítmico exponencial que mapea la fuerza de la contraseña en bits de entropía (X) contra el tiempo teórico de crackeo (Y, escala de segundos exponencial) para {activeTab}.
              </p>
              <div className="h-[280px] w-full">
                {securityEntropyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={securityEntropyData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="entropy" stroke="#64748b" fontSize={9} />
                      <YAxis 
                        scale="log" 
                        domain={['auto', 'auto']} 
                        stroke="#64748b" 
                        fontSize={9} 
                        tickFormatter={(v) => v.toExponential(0)}
                      />
                      <Tooltip 
                        {...customTooltipStyle} 
                        formatter={(value) => [formatValue(value, 'default') + " s", "Tiempo Teórico"]}
                        labelFormatter={(label) => `Entropía: ${label} bits`}
                      />
                      <Line type="monotone" dataKey="crackTime" stroke="#f43f5e" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-500 font-mono">Sin datos de análisis de vulnerabilidades</div>
                )}
              </div>
            </VisualPanel>

            <VisualPanel title="Vulnerabilidad de Muestras" subtitle="Porcentaje de éxito del ataque de fuerza bruta">
              <p className="text-xs text-slate-400 mb-4 font-sans leading-relaxed">
                Representación proporcional del éxito en la intrusión. Indica qué porcentaje de contraseñas de prueba fueron vulneradas con éxito frente al porcentaje que resistió íntegro.
              </p>
              <div className="flex h-[280px] flex-col items-center justify-center">
                {kpis?.successRate !== null ? (
                  <div className="flex flex-col items-center">
                    <div className="relative flex items-center justify-center">
                      <svg className="h-40 w-40 transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="65"
                          className="stroke-slate-800/80"
                          strokeWidth="10"
                          fill="transparent"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="65"
                          className={`transition-all duration-1000 ${
                            kpis.successRate === 0
                              ? "stroke-emerald-500"
                              : kpis.successRate < 50
                              ? "stroke-amber-500"
                              : "stroke-rose-500"
                          }`}
                          strokeWidth="10"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 65}
                          strokeDashoffset={2 * Math.PI * 65 * (1 - (kpis.successRate / 100))}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black text-white tracking-tight">{formatValue(kpis.successRate, 'percent')}</span>
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">Vulnerado</span>
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <p className="text-xs font-semibold text-slate-300 font-mono">
                        {kpis.successRate === 0
                          ? "Robusto: 0 de 9 muestras comprometidas"
                          : `${formatValue((kpis.successRate / 100) * kpis.totalAttacks, 'number')} de ${kpis.totalAttacks} muestras vulneradas`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 font-mono">Sin datos de ataque</div>
                )}
              </div>
            </VisualPanel>
          </div>
        )}

        {/* ================= SECCIÓN 4: BENCHMARK Y COMPARACIÓN ================= */}
        {activeSection === "benchmark" && (
          <div className="animate-fadeIn space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* RADAR CHART */}
              <div className="rounded-[24px] border border-white/5 bg-slate-900/30 p-5 backdrop-blur-md shadow-xl">
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-mono font-bold">Vectores de Fuerza</span>
                  <h3 className="mt-1 text-base font-bold text-white">Radar Multidimensional</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal font-sans">
                    Evaluación normalizada (0-100) de los 4 algoritmos bajo 5 vectores determinantes.
                  </p>
                </div>

                <div className="h-[230px] w-full">
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                        <PolarGrid stroke="rgba(255,255,255,0.06)" />
                        <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={8} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#334155" fontSize={7} />
                        <Radar name="AES" dataKey="AES" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
                        <Radar name="RSA" dataKey="RSA" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} />
                        <Radar name="SHA-256" dataKey="SHA-256" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                        <Radar name="MD5" dataKey="MD5" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500 font-mono">Sin datos de radar</div>
                  )}
                </div>
                
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 pt-3 border-t border-white/5 text-[9px] font-mono">
                  <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500"></span> <span className="text-slate-400">AES</span></div>
                  <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span> <span className="text-slate-400">RSA</span></div>
                  <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> <span className="text-slate-400">SHA-256</span></div>
                  <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> <span className="text-slate-400">MD5</span></div>
                </div>
              </div>

              {/* HARDWARE STRESS */}
              <div className="lg:col-span-2 rounded-[24px] border border-white/5 bg-slate-900/30 p-5 backdrop-blur-md shadow-xl">
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-mono font-bold">Simulación de Estrés</span>
                  <h3 className="mt-1 text-base font-bold text-white">Velocidad de Ataque (Throughput del Atacante)</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-normal font-sans">
                    Throughput de fuerza bruta medido en intentos/segundo (escala logarítmica). Muestra qué tan rápido el motor atacante ejecuta la derivación e igualación para cada algoritmo.
                  </p>
                </div>

                <div className="h-[230px] w-full">
                  {comparativeChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparativeChartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="algoritmo" stroke="#64748b" fontSize={9} />
                        <YAxis scale="log" domain={['auto', 'auto']} stroke="#64748b" fontSize={9} tickFormatter={(v) => v.toExponential(0)} />
                        <Tooltip 
                          {...customTooltipStyle} 
                          formatter={(value) => [formatValue(value, 'scientific') + " intentos/s", "Throughput"]}
                        />
                        <Bar dataKey="average_attempts_per_second" radius={[3, 3, 0, 0]}>
                          {comparativeChartData.map((entry: any, index: number) => {
                            const isSelected = entry.algoritmo === activeTab;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={isSelected ? theme.radarFill : "rgba(255,255,255,0.1)"} 
                                className={isSelected ? "filter drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]" : ""}
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500 font-mono">Sin datos comparativos globales</div>
                  )}
                </div>
              </div>
            </div>

            {/* MATRIZ DE COMPARACIÓN SIDE-BY-SIDE */}
            <VisualPanel title="Matriz Comparativa Directa" subtitle="Comparativa analítica de parámetros operacionales cruzados">
              <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-slate-900/60 font-semibold text-slate-200">
                      <th className="p-3">Dimensión Evaluada</th>
                      <th className={`p-3 transition-colors ${activeTab === "AES" ? "text-cyan-300 font-bold bg-cyan-950/20" : "text-slate-400"}`}>AES (Sencillo)</th>
                      <th className={`p-3 transition-colors ${activeTab === "RSA" ? "text-purple-300 font-bold bg-purple-950/20" : "text-slate-400"}`}>RSA (Asimétrico)</th>
                      <th className={`p-3 transition-colors ${activeTab === "SHA-256" ? "text-emerald-300 font-bold bg-emerald-950/20" : "text-slate-400"}`}>SHA-256 (Hash)</th>
                      <th className={`p-3 transition-colors ${activeTab === "MD5" ? "text-amber-300 font-bold bg-amber-950/20" : "text-slate-400"}`}>MD5 (Hash)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                    {directComparisonMatrix.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/10 transition duration-150">
                        <td className="p-3 font-sans text-slate-400 font-semibold">{row.metric}</td>
                        <td className={`p-3 ${activeTab === "AES" ? "text-cyan-300 font-bold bg-cyan-950/10" : ""}`}>{row.AES}</td>
                        <td className={`p-3 ${activeTab === "RSA" ? "text-purple-300 font-bold bg-purple-950/10" : ""}`}>{row.RSA}</td>
                        <td className={`p-3 ${activeTab === "SHA-256" ? "text-emerald-300 font-bold bg-emerald-950/10" : ""}`}>{row["SHA-256"]}</td>
                        <td className={`p-3 ${activeTab === "MD5" ? "text-amber-300 font-bold bg-amber-950/10" : ""}`}>{row.MD5}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </VisualPanel>
          </div>
        )}

        {/* ================= SECCIÓN 5: EXPLORADOR DE DATOS COMPLETOS ================= */}
        {activeSection === "datos" && (
          <div className="animate-fadeIn">
            <VisualPanel title="Explorador Científico" subtitle="Repositorio de Datos Crudos Completos">
              <p className="text-xs text-slate-400 mb-5 font-sans leading-relaxed">
                Acceso directo a las matrices de datos experimentales originales. Permite realizar búsquedas cruzadas, ordenación de columnas, filtros rápidos de lectura y exportación limpia en formatos CSV y JSON para auditorías académicas externas.
              </p>

              {/* CONTROLES */}
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-slate-400 font-semibold font-sans">Dataset:</span>
                  <select
                    value={activeDataset?.file || ""}
                    onChange={(e) => handleDatasetChange(e.target.value)}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono font-bold"
                  >
                    {availableDatasets.map((d) => (
                      <option key={d.file} value={d.file}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Búsqueda rápida..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-slate-500 w-full sm:w-60 font-sans"
                  />
                  
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={handleExportCSV}
                      className="rounded-lg bg-slate-950 hover:bg-slate-800 border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      📥 CSV
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="rounded-lg bg-slate-950 hover:bg-slate-800 border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 flex items-center gap-1 transition cursor-pointer"
                    >
                      📥 JSON
                    </button>
                  </div>
                </div>
              </div>

              {/* RENDER TABLA */}
              {activeDataset && paginatedData.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/60 shadow-inner">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-900/50 text-slate-400 font-semibold uppercase tracking-wider text-[9px] font-sans">
                        {Object.keys(activeDataset.data[0]).map((key) => {
                          const isSorted = sortConfig?.key === key;
                          const isAsc = sortConfig?.direction === "asc";
                          return (
                            <th
                              key={key}
                              onClick={() => handleSort(key)}
                              className="p-3 cursor-pointer hover:bg-slate-800/80 transition duration-150 group select-none whitespace-nowrap"
                            >
                              <div className="flex items-center gap-1">
                                <span>{key}</span>
                                <span className="text-[9px] text-slate-600 group-hover:text-slate-400">
                                  {isSorted ? (isAsc ? "▲" : "▼") : "↕"}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-slate-300 text-[11px]">
                      {paginatedData.map((row: any, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/10 transition duration-75">
                          {Object.keys(row).map((k) => (
                            <td key={k} className="p-3 max-w-[200px] truncate" title={String(row[k])}>
                              {row[k] === null || row[k] === undefined ? "—" : String(row[k])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-900/10 text-slate-500 text-xs font-mono">
                  No se encontraron filas que coincidan con los filtros establecidos.
                </div>
              )}

              {/* PAGINACIÓN */}
              {activeDataset && totalRows > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 text-xs text-slate-400 font-sans">
                  <div>
                    Mostrando <span className="font-bold text-slate-200">{Math.min(totalRows, (currentPage - 1) * pageSize + 1)}</span> a{" "}
                    <span className="font-bold text-slate-200">{Math.min(totalRows, currentPage * pageSize)}</span> de{" "}
                    <span className="font-bold text-slate-200">{totalRows}</span> registros.
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span>Registros:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="rounded bg-slate-900 border border-white/10 text-white px-2 py-1 text-xs"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 border border-white/10 px-2.5 py-1.5 text-xs text-white transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <div className="flex items-center px-1 font-bold text-slate-200 font-mono">
                        {currentPage} / {totalPages}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900 border border-white/10 px-2.5 py-1.5 text-xs text-white transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </VisualPanel>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}