/*export interface CsvRow {
  [key: string]: string;
}

export interface CsvData {
  headers: string[];
  rows: CsvRow[];
}

export interface NumericSummary {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
}

export interface HistogramBucket {
  label: string;
  count: number;
}

function detectDelimiter(headerLine: string): string {
  const commaMatches = (headerLine.match(/,/g) ?? []).length;
  const semicolonMatches = (headerLine.match(/;/g) ?? []).length;
  const tabMatches = (headerLine.match(/\t/g) ?? []).length;

  if (semicolonMatches > commaMatches) {
    return ";";
  }

  if (tabMatches > commaMatches) {
    return "\t";
  }

  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCsv(text: string): CsvData {
  const sanitized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = sanitized.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map((header) => header.trim());

  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: CsvRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
      row[normalizeHeader(header)] = values[index] ?? "";
    });

    return row;
  });

  return { headers, rows };
}

function getCellValue(row: CsvRow, candidates: readonly string[]) {
  for (const candidate of candidates) {
    if (row[candidate] !== undefined) {
      return row[candidate];
    }
  }

  return null;
}

export function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function summarizeNumeric(rows: CsvRow[], candidates: readonly string[]): NumericSummary | null {
  const values = rows
    .map((row) => toNumber(getCellValue(row, candidates)))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  const count = values.length;
  const average = values.reduce((sum, value) => sum + value, 0) / count;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / count;

  return {
    count,
    average,
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev: Math.sqrt(variance),
  };
}

export function buildHistogram(values: number[], buckets = 5): HistogramBucket[] {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const bucketSize = span / buckets;

  const histogram = Array.from({ length: buckets }, (_, index) => ({
    label: `${(min + index * bucketSize).toFixed(1)}-${(min + (index + 1) * bucketSize).toFixed(1)}`,
    count: 0,
  }));

  values.forEach((value) => {
    const bucketIndex = Math.min(buckets - 1, Math.max(0, Math.floor((value - min) / bucketSize)));
    histogram[bucketIndex].count += 1;
  });

  return histogram;
}

export function formatMetric(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return value.toFixed(digits);
}

export interface DriveSourceMap {
  [key: string]: string;
  aesMetrics: string;
  rsaMetrics: string;
  md5Metrics: string;
  shaMetrics: string;
  vulnerability: string;
  aesBenchmark: string;
  rsaBenchmark: string;
  hashesBenchmark: string;
}

export const DRIVE_SOURCE_UPDATE_EVENT = "cryptolab-drive-source-updated";
const DRIVE_SOURCE_STORAGE_KEY = "cryptolab-drive-source-map";

export function getDriveCsvSourceMap(): DriveSourceMap {
  return {
    aesMetrics: process.env.NEXT_PUBLIC_AES_METRICS_URL ?? "",
    rsaMetrics: process.env.NEXT_PUBLIC_RSA_METRICS_URL ?? "",
    md5Metrics: process.env.NEXT_PUBLIC_MD5_METRICS_URL ?? "",
    shaMetrics: process.env.NEXT_PUBLIC_SHA256_METRICS_URL ?? "",
    vulnerability: process.env.NEXT_PUBLIC_VULNERABILITY_URL ?? "",
    aesBenchmark: process.env.NEXT_PUBLIC_AES_BENCHMARK_URL ?? "",
    rsaBenchmark: process.env.NEXT_PUBLIC_RSA_BENCHMARK_URL ?? "",
    hashesBenchmark: process.env.NEXT_PUBLIC_HASHES_BENCHMARK_URL ?? "",
  };
}

export function getConfiguredDriveSources(): DriveSourceMap {
  const envSources = getDriveCsvSourceMap();

  if (typeof window === "undefined") {
    return envSources;
  }

  try {
    const stored = window.localStorage.getItem(DRIVE_SOURCE_STORAGE_KEY);
    if (!stored) {
      return envSources;
    }

    const parsed = JSON.parse(stored) as Partial<DriveSourceMap>;
    return {
      ...envSources,
      ...Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === "string" && value.trim() !== "")
      ),
    } as DriveSourceMap;
  } catch {
    return envSources;
  }
}

export function saveDriveSourceConfig(sourceMap: Partial<DriveSourceMap>) {
  if (typeof window === "undefined") {
    return getDriveCsvSourceMap();
  }

  const normalized = Object.fromEntries(
    Object.entries(sourceMap).filter(([, value]) => typeof value === "string" && value.trim() !== "")
  );

  window.localStorage.setItem(DRIVE_SOURCE_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(DRIVE_SOURCE_UPDATE_EVENT));
  return getConfiguredDriveSources();
}

export async function fetchDriveCsv(url: string): Promise<CsvData> {
  if (!url) {
    throw new Error("No se configuró una URL de CSV para esta fuente.");
  }

  const response = await fetch(`/api/drive-csv?url=${encodeURIComponent(url)}`);
  const payload = await response.json();

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? "No fue posible cargar el archivo desde Google Drive.");
  }

  return parseCsv(payload?.data ?? "");
}

export async function fetchDriveCsvs(sourceMap: Record<string, string | undefined>) {
  const entries = Object.entries(sourceMap).filter(([, url]) => typeof url === "string" && url.trim() !== "");

  const results = await Promise.all(
    entries.map(async ([key, url]) => {
      try {
        return [key, await fetchDriveCsv(url as string)] as const;
      } catch (error) {
        return [key, null, error instanceof Error ? error.message : "No fue posible cargar el CSV."] as const;
      }
    }),
  );

  return Object.fromEntries(
    results.map(([key, data, error]) => [key, { data, error }]),
  ) as Record<string, { data: CsvData | null; error: string | null }>;
}
*/