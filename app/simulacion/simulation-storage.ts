"use client";

// ─── Canonical record model ───────────────────────────────────────────────────
// Field names are intentionally kept in English camelCase so they align with
// what page.tsx already reads (id, algorithm, operation, status, durationMs …).
// Legacy keys (attack_id, algoritmo, attack_type …) are no longer used.
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationRecord {
  // Identity
  id: string;
  timestamp: string; // ISO-8601

  // Classification
  algorithm: string;         // e.g. "AES-256-GCM", "RSA-OAEP 2048", "MD5", "SHA-256"
  algorithmKey: string;      // e.g. "aes", "rsa", "md5", "sha256"
  operation: "encryption" | "decryption" | "attack";

  // Payload
  originalText: string;      // plaintext / attacked value
  messageSize: number;       // bytes of original text
  ciphertext: string;        // ciphered output or hash digest
  ciphertextSize: number;    // bytes of ciphertext
  recoveredText?: string;    // text recovered after attack / decryption

  // Key
  keyLength: number;         // bits

  // Timing
  executionTimeMs: number;   // time for the crypto op itself
  attackDurationMs: number;  // total time spent on attack (0 for enc/dec)

  // Attack metrics
  attempts: number;
  attemptsPerSecond: number;
  progress: number;          // 0-100 %

  // Resources
  cpuUtilization: number;   // 0-100 %
  memoryBytes: number;

  // Outcome
  status: "success" | "failed";

  // Theoretical
  searchSpace: string;       // BigInt-safe string
  log2SearchSpace: number;
  successProbability: string;
}

// ─── Storage implementation ───────────────────────────────────────────────────

const STORAGE_KEY = "crypto_simulation_history_v3";
const MAX_RECORDS = 200;

export class SimulationStorage {
  /** Save a new record; returns the saved record with generated id/timestamp. */
  static save(record: Omit<SimulationRecord, "id" | "timestamp">): SimulationRecord {
    if (typeof window === "undefined") return { id: "", timestamp: "", ...record };

    const history = this.getAll();
    const newRecord: SimulationRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 11).toUpperCase(),
      timestamp: new Date().toISOString(),
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

    const headers: (keyof SimulationRecord)[] = [
      "id",
      "timestamp",
      "algorithm",
      "algorithmKey",
      "operation",
      "originalText",
      "messageSize",
      "ciphertext",
      "ciphertextSize",
      "recoveredText",
      "keyLength",
      "executionTimeMs",
      "attackDurationMs",
      "attempts",
      "attemptsPerSecond",
      "progress",
      "cpuUtilization",
      "memoryBytes",
      "status",
      "searchSpace",
      "log2SearchSpace",
      "successProbability",
    ];

    function csvCell(value: unknown): string {
      if (value === undefined || value === null) return "";
      const str = String(value);
      // Wrap in quotes if the cell contains a comma, newline, or quote
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const rows = records.map((r) => headers.map((h) => csvCell(r[h])).join(","));
    const csvContent = [headers.join(","), ...rows].join("\n");

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
