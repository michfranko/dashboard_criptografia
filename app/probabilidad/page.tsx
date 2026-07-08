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
  type CsvRow,
} from "../lib/csv-analytics";

const entropyCandidates = ["bits_entropia", "entropia", "bits_entropy", "entropy"];
const successCandidates = ["success", "prob_success", "probability_success", "success_rate", "attack_success"];
const failureCandidates = ["failure", "prob_failure", "probability_failure", "failure_rate", "attack_failure"];
const factorCandidates = [
  { label: "Tamaño de clave", options: ["key_size_bits", "key_bits", "key_length_bits", "keysize_bits"] },
  { label: "Texto plano", options: ["plaintext_length", "plain_text_length", "input_length", "message_length"] },
  { label: "Longitud del hash", options: ["hash_length", "digest_length", "hash_bits"] },
  { label: "Espacio de búsqueda", options: ["search_space", "search_space_size", "key_space"] },
];

function getCellValue(row: CsvRow, candidates: readonly string[]) {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
}

function parseNumericValue(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().replaceAll(",", ".");
  if (!normalized) {
    return null;
  }

  const lowered = normalized.toLowerCase();
  if (lowered === "true") {
    return 1;
  }
  if (lowered === "false") {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseProbabilityValue(value: string | null | undefined): number | null {
  const parsed = parseNumericValue(value);
  if (parsed === null) {
    return null;
  }

  return parsed > 1 ? parsed / 100 : parsed;
}

function matchesAlgorithm(row: CsvRow, algorithm: string) {
  const value = getCellValue(row, ["algorithm", "algoritmo", "algo", "cipher", "name", "method"]);
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (algorithm === "MD5") {
    return normalized.includes("md5");
  }

  if (algorithm === "RSA") {
    return normalized.includes("rsa");
  }

  if (algorithm === "AES") {
    return normalized.includes("aes");
  }

  return normalized.includes(algorithm.toLowerCase());
}

function toPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${(value * 100).toFixed(0)}%`;
}

function computeConfidenceInterval(values: number[], confidence: number) {
  if (values.length < 2) {
    return null;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  let zScore = 2.576;

  if (confidence >= 0.95 && confidence < 0.99) {
    zScore = 1.96;
  } else if (confidence >= 0.9 && confidence < 0.95) {
    zScore = 1.645;
  }

  const margin = (stdDev / Math.sqrt(values.length)) * zScore;

  return {
    mean,
    lower: mean - margin,
    upper: mean + margin,
  };
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
  const aesBenchmarkRows = csvData.aesBenchmark?.data?.rows ?? [];
  const rsaBenchmarkRows = csvData.rsaBenchmark?.data?.rows ?? [];
  const hashesBenchmarkRows = csvData.hashesBenchmark?.data?.rows ?? [];
  const entropySummary = summarizeNumeric(vulnerabilityRows, entropyCandidates);
  const histogram = entropySummary ? buildHistogram(vulnerabilityRows.map((row) => Number(row["bits_entropia"] ?? row["entropia"] ?? row["entropy"] ?? 0)).filter((value) => Number.isFinite(value)), 6) : [];
  const hasConfiguredSources = Boolean(sourceMap.vulnerability || sourceMap.aesBenchmark || sourceMap.rsaBenchmark || sourceMap.hashesBenchmark);

  const probabilitySeries = useMemo(() => {
    return ["AES", "RSA", "MD5"].map((algorithm) => {
      const rows = vulnerabilityRows.filter((row) => matchesAlgorithm(row, algorithm));
      const successValues = rows
        .map((row) => parseProbabilityValue(getCellValue(row, successCandidates)))
        .filter((value): value is number => value !== null);
      const failureValues = rows
        .map((row) => parseProbabilityValue(getCellValue(row, failureCandidates)))
        .filter((value): value is number => value !== null);

      const successRate = successValues.length
        ? successValues.reduce((sum, value) => sum + value, 0) / successValues.length
        : null;
      const failureRate = failureValues.length
        ? failureValues.reduce((sum, value) => sum + value, 0) / failureValues.length
        : null;

      return {
        name: algorithm,
        successRate,
        failureRate,
        count: rows.length,
      };
    });
  }, [vulnerabilityRows]);

  const conditionalSeries = useMemo(() => {
    return factorCandidates
      .map((factor) => {
        const values = vulnerabilityRows
          .map((row) => parseNumericValue(getCellValue(row, factor.options)))
          .filter((value): value is number => value !== null);
        const successValues = vulnerabilityRows
          .map((row) => parseProbabilityValue(getCellValue(row, successCandidates)))
          .filter((value): value is number => value !== null);

        return {
          label: factor.label,
          value: values.length ? values.reduce((sum, entry) => sum + entry, 0) / values.length : null,
          probability: successValues.length ? successValues.reduce((sum, entry) => sum + entry, 0) / successValues.length : null,
        };
      })
      .filter((item) => item.value !== null || item.probability !== null);
  }, [vulnerabilityRows]);

  const searchSpaceSeries = [
    { label: "AES-128", value: Math.pow(2, 128), width: 60 },
    { label: "AES-256", value: Math.pow(2, 256), width: 100 },
    { label: "RSA-2048", value: Math.pow(2, 2048), width: 98 },
    { label: "MD5-128", value: Math.pow(2, 128), width: 58 },
  ];

  const confidenceSeries = [
    {
      name: "AES",
      rows: aesBenchmarkRows,
      candidates: ["execution_time", "encryption_time", "encryption_time_seconds", "time_seconds"],
      accent: "bg-cyan-400",
    },
    {
      name: "RSA",
      rows: rsaBenchmarkRows,
      candidates: ["execution_time", "encryption_time", "encryption_time_seconds", "time_seconds"],
      accent: "bg-fuchsia-400",
    },
    {
      name: "MD5",
      rows: hashesBenchmarkRows,
      candidates: ["execution_time", "hash_time", "time_seconds"],
      accent: "bg-emerald-400",
    },
  ].map((item) => {
    const values = item.rows
      .map((row) => parseNumericValue(getCellValue(row, item.candidates)))
      .filter((value): value is number => value !== null);

    return {
      ...item,
      values,
      interval90: computeConfidenceInterval(values, 0.9),
      interval95: computeConfidenceInterval(values, 0.95),
      interval99: computeConfidenceInterval(values, 0.99),
    };
  });

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
            <MetricCard label="Varianza" value={entropySummary ? formatMetric(entropySummary.average !== null && entropySummary.count > 0 ? (entropySummary.average ** 2) / Math.max(1, entropySummary.count) : null) : "—"} detail="Medida de dispersión" accent="text-cyan-200" />
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

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <VisualPanel title="Probabilidades" subtitle="Éxito y fracaso estimados">
          <div className="space-y-4">
            {probabilitySeries.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.name}</span>
                  <span className="text-cyan-200">{item.count > 0 ? `${item.count} registros` : "Sin datos"}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Éxito</span>
                      <span>{toPercent(item.successRate)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${item.successRate !== null ? Math.max(8, item.successRate * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span>Fracaso</span>
                      <span>{toPercent(item.failureRate)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-rose-400" style={{ width: `${item.failureRate !== null ? Math.max(8, item.failureRate * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </VisualPanel>

        <VisualPanel title="Factores condicionales" subtitle="Impacto de las variables del experimento">
          <div className="space-y-4">
            {conditionalSeries.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="text-fuchsia-200">{item.probability !== null ? toPercent(item.probability) : "—"}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-fuchsia-400" style={{ width: `${item.probability !== null ? Math.max(8, item.probability * 100) : 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {item.value !== null ? `Valor medio observado: ${formatMetric(item.value)}` : "Sin valor numérico detectado"}
                </p>
              </div>
            ))}
          </div>
        </VisualPanel>

        <VisualPanel title="Espacio de búsqueda" subtitle="Crecimiento teórico del ataque">
          <div className="space-y-4">
            {searchSpaceSeries.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.label}</span>
                  <span className="text-cyan-200">2^ {Math.log2(item.value).toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.max(8, item.width)}%` }} />
                </div>
              </div>
            ))}
            <p className="text-sm leading-7 text-slate-400">
              El crecimiento del espacio de búsqueda explica por qué los ataques de fuerza bruta se vuelven exponencialmente más costosos al aumentar la longitud o el tamaño de la clave.
            </p>
          </div>
        </VisualPanel>

        <VisualPanel title="Intervalos de confianza" subtitle="Estimación probabilística de la media">
          <div className="space-y-4">
            {confidenceSeries.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-white">{item.name}</span>
                  <span className="text-amber-200">{item.values.length ? `${item.values.length} muestras` : "Sin datos"}</span>
                </div>
                {item.interval90 ? (
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>90%</span>
                      <span>{`${formatMetric(item.interval90.lower)} – ${formatMetric(item.interval90.upper)}`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>95%</span>
                      <span>{`${formatMetric(item.interval95?.lower)} – ${formatMetric(item.interval95?.upper)}`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>99%</span>
                      <span>{`${formatMetric(item.interval99?.lower)} – ${formatMetric(item.interval99?.upper)}`}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No hay suficientes valores para estimar intervalos.</p>
                )}
              </div>
            ))}
          </div>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
