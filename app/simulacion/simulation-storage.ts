"use client";

import { Algorithm } from "./crypto-systems";

export interface SimulationRecord {
  id: string;
  timestamp: number;
  algorithm: Algorithm;
  operation: "encryption" | "decryption" | "attack";
  inputText: string;
  inputBytes: number;
  keyLength?: number;
  durationMs: number;
  status: "success" | "failure";

  // Attack specific fields
  totalAttackTimeMs?: number;
  attempts?: number;
  speedPerSecond?: number;
  cpuUtilization?: number;
  memoryBytes?: number;
  progress?: number;
  resultText?: string;
  recoveredText?: string;
}

const STORAGE_KEY = "crypto_simulation_history";

export class SimulationStorage {
  static save(record: Omit<SimulationRecord, "id" | "timestamp">) {
    if (typeof window === "undefined") return;

    const history = this.getAll();
    const newRecord: SimulationRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
    };

    history.unshift(newRecord);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 100))); // Keep last 100 records
    return newRecord;
  }

  static getAll(): SimulationRecord[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static delete(id: string) {
    const history = this.getAll().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  static clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  static exportToCSV(records: SimulationRecord[]) {
    if (records.length === 0) return;

    const headers = [
      "ID", "Fecha", "Algoritmo", "Operación", "Tamaño Entrada (B)",
      "Duración (ms)", "Estado", "Intentos", "Velocidad (c/s)",
      "CPU (%)", "Memoria (MB)"
    ];

    const rows = records.map(r => [
      r.id,
      new Date(r.timestamp).toLocaleString(),
      r.algorithm,
      r.operation,
      r.inputBytes,
      r.durationMs.toFixed(2),
      r.status,
      r.attempts || "",
      r.speedPerSecond?.toFixed(2) || "",
      r.cpuUtilization?.toFixed(1) || "",
      r.memoryBytes ? (r.memoryBytes / 1024 / 1024).toFixed(2) : ""
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `historial_simulaciones_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
