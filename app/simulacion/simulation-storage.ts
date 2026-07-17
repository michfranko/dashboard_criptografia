"use client";

// ─── Canonical record model ───────────────────────────────────────────────────
// Aligned with the full schema requested for the thesis research.
// ─────────────────────────────────────────────────────────────────────────────

export const DASHBOARD_VERSION = "2.0.0";
export const SIMULATOR_VERSION = "2.0.0";

export type AttackStatus =
  | "SUCCESS"
  | "FAILED"
  | "TIME_LIMIT"
  | "MAX_ATTEMPTS"
  | "USER_CANCELLED"
  | "STALL"
  | "N/A";

export interface SimulationRecord {
  // ── Identity ──────────────────────────────────────────────────────────────
  id: string;               // simulation_id
  timestamp: string;        // ISO-8601 full timestamp
  fecha: string;            // DD/MM/YYYY
  hora: string;             // HH:MM:SS
  versionDashboard: string; // version_dashboard
  versionSimulador: string; // version_simulador

  // ── Classification ────────────────────────────────────────────────────────
  algorithm: string;        // e.g. "AES-256-GCM", "RSA-OAEP 2048", "MD5", "SHA-256"
  algorithmKey: string;     // e.g. "aes", "rsa", "md5", "sha256"
  operation: "encryption" | "decryption" | "attack"; // operation_type

  // ── Configuration ─────────────────────────────────────────────────────────
  keyLengthBits: number;        // key_length_bits
  blockSize: number;            // block_size (bytes; 0 for hashes)
  hashLength: number;           // hash_length (bits; 0 for ciphers)
  encoding: string;             // encoding (e.g. "UTF-8", "Base64")
  charset: string;              // charset used in attack
  passwordLength: number;       // password_length (chars; 0 if N/A)
  inputLengthBytes: number;     // input_length_bytes
  inputLengthBits: number;      // input_length_bits
  estimatedKeyspace: string;    // estimated_keyspace (BigInt-safe string)

  // ── Cryptographic data ────────────────────────────────────────────────────
  ciphertext: string;           // ciphertext (output or hash digest)
  ciphertextLength: number;     // ciphertext_length (bytes)
  ciphertextFormat: string;     // ciphertext_format (e.g. "Base64", "Hex")
  encryptionSuccess: boolean;   // encryption_success
  decryptionSuccess: boolean;   // decryption_success
  outputLength: number;         // output_length (bytes)
  expansionRatio: number;       // expansion_ratio (outputBytes/inputBytes)
  compressionRatio: number;     // compression_ratio (inputBytes/outputBytes)
  integrityVerified: boolean;   // integrity_verified

  // ── Performance ───────────────────────────────────────────────────────────
  executionTimeMs: number;      // execution_time_ms
  executionTimeSeconds: number; // execution_time_seconds
  throughputBytesSec: number;   // throughput_bytes_sec
  cpuUsagePercent: number;      // cpu_usage_percent (final snapshot)
  averageCpuUsage: number;      // average_cpu_usage
  peakCpuUsage: number;         // peak_cpu_usage
  memoryUsageMb: number;        // memory_usage_mb (final snapshot)
  peakMemoryUsageMb: number;    // peak_memory_usage_mb
  latencyMs: number;            // latency_ms

  // ── Brute-force attack ────────────────────────────────────────────────────
  attackStarted: string;            // attack_started (ISO or "")
  attackFinished: string;           // attack_finished (ISO or "")
  attackDurationSeconds: number;    // attack_duration_seconds
  attackStatus: AttackStatus;       // attack_status

  attempts: number;                 // attempts
  attemptsPerSecond: number;        // attempts_per_second
  maxAttempts: number;              // max_attempts configured
  currentProgressPercent: number;   // current_progress_percent
  estimatedRemainingTime: number;   // estimated_remaining_time (ms)
  keysTested: number;               // keys_tested (= attempts)
  keyspaceSize: string;             // keyspace_size (BigInt-safe)
  currentCandidate: string;         // current_candidate (last tested)
  foundKey: string;                 // found_key (value found or "")
  foundIteration: number;           // found_iteration (0 = not found)

  // ── Final result ──────────────────────────────────────────────────────────
  attackSuccess: boolean;       // attack_success
  recoveredPlaintext: string;   // recovered_plaintext
  resultStatus: string;         // result_status (human-readable label)
  errorMessage: string;         // error_message
  notes: string;                // notes

  // ── Legacy compatibility (still used in history table) ────────────────────
  originalText: string;
  messageSize: number;
  ciphertextSize: number;       // kept for backward compat → same as ciphertextLength
  recoveredText?: string;
  keyLength: number;            // legacy → same as keyLengthBits
  attackDurationMs: number;     // legacy → attackDurationSeconds * 1000
  progress: number;             // legacy → currentProgressPercent
  memoryBytes: number;          // legacy → memoryUsageMb * 1024 * 1024
  cpuUtilization: number;       // legacy → cpuUsagePercent
  status: "success" | "failed"; // legacy → attackSuccess / encryptionSuccess

  searchSpace: string;          // legacy → keyspaceSize
  log2SearchSpace: number;
  successProbability: string;
}

// ─── Storage implementation ───────────────────────────────────────────────────

const STORAGE_KEY = "crypto_simulation_history_v4";
const MAX_RECORDS = 500;

export class SimulationStorage {
  /** Save a new record; returns the saved record with generated id/timestamp. */
  static save(record: Omit<SimulationRecord, "id" | "timestamp" | "fecha" | "hora">): SimulationRecord {
    if (typeof window === "undefined") return { id: "", timestamp: "", fecha: "", hora: "", ...record } as SimulationRecord;

    const history = this.getAll();
    const now = new Date();
    const newRecord: SimulationRecord = {
      ...record,
      id: `SIM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: now.toISOString(),
      fecha: now.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" }),
      hora: now.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };

    history.unshift(newRecord);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_RECORDS)));
    } catch {
      // Storage quota exceeded — drop oldest half and retry
      const trimmed = history.slice(0, Math.floor(MAX_RECORDS / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
    return newRecord;
  }

  static getAll(): SimulationRecord[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as SimulationRecord[]) : [];
    } catch {
      return [];
    }
  }

  static delete(id: string): void {
    const history = this.getAll().filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  static clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ── CSV export ──────────────────────────────────────────────────────────────

  static exportToCSV(records: SimulationRecord[]): void {
    if (records.length === 0) return;

    const headers: { key: keyof SimulationRecord; label: string }[] = [
      // Identity
      { key: "id",                    label: "simulation_id" },
      { key: "timestamp",             label: "timestamp" },
      { key: "fecha",                 label: "fecha" },
      { key: "hora",                  label: "hora" },
      { key: "versionDashboard",      label: "version_dashboard" },
      { key: "versionSimulador",      label: "version_simulador" },
      // Configuration
      { key: "operation",             label: "operation_type" },
      { key: "algorithm",             label: "algorithm" },
      { key: "algorithmKey",          label: "algorithm_key" },
      { key: "keyLengthBits",         label: "key_length_bits" },
      { key: "blockSize",             label: "block_size" },
      { key: "hashLength",            label: "hash_length" },
      { key: "encoding",              label: "encoding" },
      { key: "charset",               label: "charset" },
      { key: "passwordLength",        label: "password_length" },
      { key: "inputLengthBytes",      label: "input_length_bytes" },
      { key: "inputLengthBits",       label: "input_length_bits" },
      { key: "estimatedKeyspace",     label: "estimated_keyspace" },
      // Cryptographic data
      { key: "ciphertextLength",      label: "ciphertext_length" },
      { key: "ciphertextFormat",      label: "ciphertext_format" },
      { key: "encryptionSuccess",     label: "encryption_success" },
      { key: "decryptionSuccess",     label: "decryption_success" },
      { key: "outputLength",          label: "output_length" },
      { key: "expansionRatio",        label: "expansion_ratio" },
      { key: "compressionRatio",      label: "compression_ratio" },
      { key: "integrityVerified",     label: "integrity_verified" },
      // Performance
      { key: "executionTimeMs",       label: "execution_time_ms" },
      { key: "executionTimeSeconds",  label: "execution_time_seconds" },
      { key: "throughputBytesSec",    label: "throughput_bytes_sec" },
      { key: "cpuUsagePercent",       label: "cpu_usage_percent" },
      { key: "averageCpuUsage",       label: "average_cpu_usage" },
      { key: "peakCpuUsage",          label: "peak_cpu_usage" },
      { key: "memoryUsageMb",         label: "memory_usage_mb" },
      { key: "peakMemoryUsageMb",     label: "peak_memory_usage_mb" },
      { key: "latencyMs",             label: "latency_ms" },
      // Attack
      { key: "attackStarted",         label: "attack_started" },
      { key: "attackFinished",        label: "attack_finished" },
      { key: "attackDurationSeconds", label: "attack_duration_seconds" },
      { key: "attackStatus",          label: "attack_status" },
      { key: "attempts",              label: "attempts" },
      { key: "attemptsPerSecond",     label: "attempts_per_second" },
      { key: "maxAttempts",           label: "max_attempts" },
      { key: "currentProgressPercent",label: "current_progress_percent" },
      { key: "estimatedRemainingTime",label: "estimated_remaining_time" },
      { key: "keysTested",            label: "keys_tested" },
      { key: "keyspaceSize",          label: "keyspace_size" },
      { key: "currentCandidate",      label: "current_candidate" },
      { key: "foundKey",              label: "found_key" },
      { key: "foundIteration",        label: "found_iteration" },
      // Result
      { key: "attackSuccess",         label: "attack_success" },
      { key: "recoveredPlaintext",    label: "recovered_plaintext" },
      { key: "resultStatus",          label: "result_status" },
      { key: "errorMessage",          label: "error_message" },
      { key: "notes",                 label: "notes" },
    ];

    function csvCell(value: unknown): string {
      if (value === undefined || value === null) return "";
      const str = String(value);
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = records.map((r) =>
      headers.map(({ key }) => csvCell(r[key])).join(","),
    );
    const csvContent = [headers.map(({ label }) => label).join(","), ...rows].join("\n");

    const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historial_cripto_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
