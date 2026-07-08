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
  type CsvData,
  type CsvRow,
} from "../lib/csv-analytics";

const successCandidates = ["success", "prob_success", "probability_success", "success_rate", "attack_success"];
const failureCandidates = ["failure", "prob_failure", "probability_failure", "failure_rate", "attack_failure"];
const factorCandidates = [
  { label: "Tamaño de clave", options: ["key_size_bits", "key_bits", "key_length_bits", "keysize_bits"] },
  { label: "Texto plano", options: ["plaintext_length", "plain_text_length", "input_length", "message_length"] },
  { label: "Hash", options: ["hash_length", "digest_length", "hash_bits"] },
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

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${(value * 100).toFixed(0)}%`;
}

function BarChart({ items, color }: { items: { label: string; value: number | null; detail?: string }[]; color: string }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value ?? 0));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-300">{item.label}</span>
            <span className="text-white">{item.value !== null ? `${(item.value * 100).toFixed(0)}%` : "—"}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div className={`h-2 rounded-full ${color}`} style={{ width: `${item.value !== null ? Math.max(6, (item.value / maxValue) * 100) : 6}%` }} />
          </div>
          {item.detail ? <p className="mt-1 text-xs text-slate-500">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ConfidenceBars({ items }: { items: { label: string; value: number | null; detail: string }[] }) {
  const maxValue = Math.max(1, ...items.map((item) => item.value ?? 0));

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-300">{item.label}</span>
            <span className="text-white">{item.value !== null ? formatMetric(item.value) : "—"}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-amber-400" style={{ width: `${item.value !== null ? Math.max(8, (item.value / maxValue) * 100) : 8}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export default function GraficasPage() {
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
  const aesRows = csvData.aesBenchmark?.data?.rows ?? [];
  const rsaRows = csvData.rsaBenchmark?.data?.rows ?? [];
  const hashRows = csvData.hashesBenchmark?.data?.rows ?? [];
  const hasConfiguredSources = Boolean(sourceMap.vulnerability || sourceMap.aesBenchmark || sourceMap.rsaBenchmark || sourceMap.hashesBenchmark);

  const probabilityBars = useMemo(() => {
    return ["AES", "RSA", "MD5"].map((algorithm) => {
      const rows = vulnerabilityRows.filter((row) => matchesAlgorithm(row, algorithm));
      const successValues = rows
        .map((row) => parseProbabilityValue(getCellValue(row, successCandidates)))
        .filter((value): value is number => value !== null);
      const failureValues = rows
        .map((row) => parseProbabilityValue(getCellValue(row, failureCandidates)))
        .filter((value): value is number => value !== null);

      const successRate = successValues.length ? successValues.reduce((sum, value) => sum + value, 0) / successValues.length : null;
      const failureRate = failureValues.length ? failureValues.reduce((sum, value) => sum + value, 0) / failureValues.length : null;

      return {
        label: algorithm,
        value: successRate ?? failureRate ?? 0,
        detail: `Éxito ${percent(successRate)} · Fracaso ${percent(failureRate)}`,
      };
    });
  }, [vulnerabilityRows]);

  const factorBars = useMemo(() => {
    return factorCandidates.map((factor) => {
      const values = vulnerabilityRows
        .map((row) => parseNumericValue(getCellValue(row, factor.options)))
        .filter((value): value is number => value !== null);
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      return {
        label: factor.label,
        value: average !== null ? Math.min(1, average / 1000) : null,
        detail: average !== null ? `Promedio: ${formatMetric(average)}` : "Sin datos",
      };
    });
  }, [vulnerabilityRows]);

  const confidenceBars = useMemo(() => {
    const buildSeries = (label: string, rows: CsvRow[], candidates: readonly string[]) => {
      const values = rows
        .map((row) => parseNumericValue(getCellValue(row, candidates)))
        .filter((value): value is number => value !== null);
      const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      return {
        label,
        value: mean !== null ? mean / Math.max(1, Math.max(...values)) : null,
        detail: mean !== null ? `Media aprox. ${formatMetric(mean)}` : "Sin datos",
      };
    };

    return [
      buildSeries("AES", aesRows, ["execution_time", "encryption_time", "encryption_time_seconds", "time_seconds"]),
      buildSeries("RSA", rsaRows, ["execution_time", "encryption_time", "encryption_time_seconds", "time_seconds"]),
      buildSeries("MD5", hashRows, ["execution_time", "hash_time", "time_seconds"]),
    ];
  }, [aesRows, rsaRows, hashRows]);

  return (
    <DashboardShell
      eyebrow="Módulo académico"
      title="Gráficas visuales"
      description="Se presentan gráficos de barras y comparativas para resumir de forma intuitiva los resultados probabilísticos, el crecimiento del espacio de búsqueda y las tendencias observadas en los experimentos."
      badge="Visualización estadística"
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <VisualPanel title="Probabilidad" subtitle="Éxito por algoritmo">
          {loading ? (
            <p className="text-sm text-slate-400">Cargando gráficos desde Google Drive...</p>
          ) : (
            <BarChart items={probabilityBars} color="bg-emerald-400" />
          )}
        </VisualPanel>

        <VisualPanel title="Factores" subtitle="Variables del experimento">
          {loading ? (
            <p className="text-sm text-slate-400">Preparando comparativas...</p>
          ) : (
            <BarChart items={factorBars} color="bg-fuchsia-400" />
          )}
        </VisualPanel>

        <VisualPanel title="Espacio de búsqueda" subtitle="Crecimiento teórico">
          <div className="space-y-3">
            {[{ label: "AES-128", value: 0.6 }, { label: "AES-256", value: 1 }, { label: "RSA-2048", value: 0.98 }, { label: "MD5-128", value: 0.58 }].map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="text-cyan-200">{(item.value * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${item.value * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="text-sm leading-7 text-slate-400">
              El crecimiento del espacio de búsqueda se refleja en la dificultad de romper la seguridad del sistema al aumentar los parámetros del experimento.
            </p>
          </div>
        </VisualPanel>

        <VisualPanel title="Confianza" subtitle="Tendencia de los resultados">
          {loading ? (
            <p className="text-sm text-slate-400">Calculando tendencias...</p>
          ) : (
            <ConfidenceBars items={confidenceBars} />
          )}
        </VisualPanel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <VisualPanel title="Resumen" subtitle="Interpretación rápida">
          <div className="space-y-3">
            <MetricCard label="Fuente activa" value={hasConfiguredSources ? "Google Drive" : "Sin configuración"} detail="Datos cargados desde CSV" accent="text-cyan-200" />
            <MetricCard label="Registros analizados" value={vulnerabilityRows.length ? String(vulnerabilityRows.length) : "0"} detail="Filas de la tabla probabilística" accent="text-emerald-200" />
            <MetricCard label="Enfoque visual" value="Barras y comparativas" detail="Diseñado para explicar resultados" accent="text-fuchsia-200" />
          </div>
        </VisualPanel>

        <VisualPanel title="Conclusión" subtitle="Qué se puede inferir">
          <p className="text-sm leading-7 text-slate-400">
            Estas gráficas ayudan a comunicar de forma más clara cómo cambian las probabilidades de éxito, cuáles factores influyen más y qué tan sensibles son los resultados ante la variación de los parámetros del experimento.
          </p>
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
