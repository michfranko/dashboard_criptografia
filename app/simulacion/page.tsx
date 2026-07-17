"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";
import {
  Algorithm,
  CryptoOperationResult,
  decryptAes,
  decryptRsa,
  encryptAes,
  encryptRsa,
  generateRsaKeyPair,
  hashText,
} from "./crypto-systems";
import {
  AttackOptions,
  AttackResult,
  AttackSnapshot,
  AttackStrategy,
  attackAes,
  attackHash,
  attackRsa,
} from "./attack-simulations";
import { SimulationRecord, SimulationStorage } from "./simulation-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

type LabMode = "crypto" | "attack" | "history";
type SortField = keyof Pick<
  SimulationRecord,
  "timestamp" | "algorithm" | "operation" | "status" | "executionTimeMs" | "attackDurationMs" | "attempts" | "attemptsPerSecond" | "progress"
>;
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const algorithms = [
  { value: "aes" as const, label: "AES-256-GCM", description: "Cifrado simétrico autenticado con clave secreta." },
  { value: "rsa" as const, label: "RSA-OAEP 2048", description: "Cifrado asimétrico para mensajes breves." },
  { value: "md5" as const, label: "MD5", description: "Hash irreversible de 128 bits." },
  { value: "sha256" as const, label: "SHA-256", description: "Hash irreversible de 256 bits." },
];

const attackStrategies: { value: AttackStrategy; label: string; description: string }[] = [
  { value: "dictionary", label: "Diccionario", description: "Busca coincidencias en una lista de valores comunes." },
  { value: "bruteforce", label: "Fuerza bruta", description: "Prueba todas las combinaciones posibles en el espacio definido." },
  { value: "trial-division", label: "Factorización", description: "Ataca el módulo RSA con divisores primos de prueba." },
];

const defaultCharset = [
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p",
  "q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9",
];

// Default limits per algorithm (used when user does not override)
const ALGO_DEFAULTS: Record<Algorithm, { maxAttempts: number; maxDurationMs: number }> = {
  aes:    { maxAttempts: 50_000,     maxDurationMs: 300_000 },  // 5 min
  rsa:    { maxAttempts: 500_000,    maxDurationMs: 600_000 },  // 10 min
  md5:    { maxAttempts: 1_000_000,  maxDurationMs: 180_000 },  // 3 min
  sha256: { maxAttempts: 1_000_000,  maxDurationMs: 180_000 },  // 3 min
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDurationMs(ms: number): string {
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(2)} min`;
  return `${(ms / 3_600_000).toFixed(2)} h`;
}

function formatSearchSize(value: number | bigint): string {
  if (typeof value === "bigint") {
    const k = BigInt(1_000), m = BigInt(1_000_000), g = BigInt(1_000_000_000);
    if (value < k) return `${value} elementos`;
    if (value < m) return `${Number(value / k).toLocaleString("es-EC")} mil`;
    if (value < g) return `${Number(value / m).toLocaleString("es-EC")} M`;
    return `${Number(value / g).toLocaleString("es-EC")} G`;
  }
  return value.toLocaleString("es-EC");
}

function snippetOf(value: string, len = 40): string {
  return value.length <= len ? value : `${value.slice(0, len - 3)}…`;
}

function algorithmKeyOf(alg: Algorithm): string {
  return alg;
}

function algorithmLabelOf(alg: Algorithm): string {
  return algorithms.find((a) => a.value === alg)?.label ?? alg.toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SimulacionPage() {
  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<LabMode>("crypto");

  // ── Crypto tab ────────────────────────────────────────────────────────────
  const [algorithm, setAlgorithm] = useState<Algorithm>("aes");
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [result, setResult] = useState<CryptoOperationResult | null>(null);
  const [rsaPrivateKey, setRsaPrivateKey] = useState<CryptoKey | null>(null);
  const [rsaPublicJwk, setRsaPublicJwk] = useState<JsonWebKey | null>(null);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [decryptPassword, setDecryptPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Attack tab ────────────────────────────────────────────────────────────
  const [attackStrategy, setAttackStrategy] = useState<AttackStrategy>("dictionary");
  const [attackValue, setAttackValue] = useState("");
  const [customMaxAttempts, setCustomMaxAttempts] = useState(ALGO_DEFAULTS.aes.maxAttempts);
  const [customMaxDurationMs, setCustomMaxDurationMs] = useState(ALGO_DEFAULTS.aes.maxDurationMs);
  const [attackSnapshot, setAttackSnapshot] = useState<AttackSnapshot | null>(null);
  const [attackTimeline, setAttackTimeline] = useState<AttackSnapshot[]>([]);
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);
  const [attackError, setAttackError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── History tab ───────────────────────────────────────────────────────────
  const [history, setHistory] = useState<SimulationRecord[]>(() =>
    typeof window !== "undefined" ? SimulationStorage.getAll() : [],
  );
  const [historySearch, setHistorySearch] = useState("");
  const [historyAlgoFilter, setHistoryAlgoFilter] = useState<Algorithm | "all">("all");
  const [historyOpFilter, setHistoryOpFilter] = useState<"all" | "encryption" | "decryption" | "attack">("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const inputBytes = useMemo(() => new TextEncoder().encode(input).length, [input]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const refreshHistory = useCallback(() => {
    setHistory(SimulationStorage.getAll());
  }, []);

  const resetCrypto = useCallback(() => {
    setResult(null);
    setRsaPrivateKey(null);
    setRsaPublicJwk(null);
    setDecryptPassword("");
    setDecryptedText(null);
    setError(null);
    setDecryptError(null);
    setCopied(false);
  }, []);

  const resetAttack = useCallback(() => {
    setAttackSnapshot(null);
    setAttackTimeline([]);
    setAttackResult(null);
    setAttackError(null);
  }, []);

  const changeAlgorithm = useCallback(
    (value: Algorithm) => {
      setAlgorithm(value);
      resetCrypto();
      resetAttack();
      setCustomMaxAttempts(ALGO_DEFAULTS[value].maxAttempts);
      setCustomMaxDurationMs(ALGO_DEFAULTS[value].maxDurationMs);
      if (value === "aes") setAttackStrategy("bruteforce");
      else if (value === "rsa") setAttackStrategy("trial-division");
      else setAttackStrategy("dictionary");
    },
    [resetCrypto, resetAttack],
  );

  const attackUpdate = useCallback((snapshot: AttackSnapshot) => {
    setAttackSnapshot(snapshot);
    setAttackTimeline((prev) => [...prev.slice(-99), snapshot]);
  }, []);

  // ── Sort helper for history ───────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return " ↕";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // ── Filtered & sorted history ─────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    let records = history.filter((r) => {
      const matchesSearch =
        !q ||
        r.originalText.toLowerCase().includes(q) ||
        r.algorithm.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q);
      const matchesAlgo = historyAlgoFilter === "all" || r.algorithmKey === historyAlgoFilter;
      const matchesOp = historyOpFilter === "all" || r.operation === historyOpFilter;
      const matchesStatus = historyStatusFilter === "all" || r.status === historyStatusFilter;
      return matchesSearch && matchesAlgo && matchesOp && matchesStatus;
    });

    records = records.sort((a, b) => {
      let va: string | number = a[sortField] as string | number;
      let vb: string | number = b[sortField] as string | number;
      if (typeof va === "string" && typeof vb === "string") {
        va = va.toLowerCase();
        vb = vb.toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return records;
  }, [history, historySearch, historyAlgoFilter, historyOpFilter, historyStatusFilter, sortField, sortDir]);

  // ── Attack statistics ─────────────────────────────────────────────────────

  const attackStats = useMemo(() => {
    if (!attackSnapshot) return null;
    const space = attackSnapshot.searchSize;
    const log2Space =
      typeof space === "bigint"
        ? Math.round(space.toString().length * 3.32)
        : Math.log2(space);
    const prob =
      typeof space === "bigint"
        ? (1 / Number(space)).toExponential(2)
        : (1 / space).toExponential(2);
    return { log2Space, probability: prob };
  }, [attackSnapshot]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(
    () =>
      attackTimeline.map((s, i) => ({
        step: i + 1,
        progress: +s.progress.toFixed(2),
        speed: +s.speedPerSecond.toFixed(1),
        cpu: +s.cpuUtilization.toFixed(1),
        memory: +(s.memoryBytes / 1024 / 1024).toFixed(2),
        elapsed: +(s.elapsedMs / 1000).toFixed(1),
      })),
    [attackTimeline],
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ────────────────────────────────────────────────────────────────────────────

  const executeCrypto = async () => {
    if (!input) return;
    if (algorithm === "aes") {
      if (password.length < 8) {
        setError("Usa una contraseña de al menos 8 caracteres para AES.");
        return;
      }
      if (password !== confirmPassword) {
        setError("La confirmación de la contraseña no coincide.");
        return;
      }
    }

    setError(null);
    setDecryptError(null);
    setDecryptedText(null);
    resetCrypto();
    setLoading(true);

    try {
      const started = performance.now();
      let opResult: CryptoOperationResult | null = null;
      let ciphertext = "";

      if (algorithm === "aes") {
        const { result: operation, envelope } = await encryptAes(input, password);
        ciphertext = envelope;
        opResult = { ...operation, durationMs: performance.now() - started };
      } else if (algorithm === "rsa") {
        if (inputBytes > 190) {
          setError("RSA-OAEP 2048 con SHA-256 admite hasta 190 bytes. Usa AES para textos más largos.");
          setLoading(false);
          return;
        }
        const { pair } = await generateRsaKeyPair();
        const encrypted = await encryptRsa(input, pair.publicKey);
        ciphertext = encrypted.ciphertext;
        setRsaPrivateKey(pair.privateKey);
        const pubJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
        setRsaPublicJwk(pubJwk);
        opResult = {
          algorithm: "rsa",
          algorithmLabel: "RSA-OAEP 2048",
          output: encrypted.ciphertext,
          inputBytes,
          outputBytes: encrypted.outputBytes,
          expansion: encrypted.outputBytes - inputBytes,
          durationMs: performance.now() - started,
          reversible: true,
          theoreticalComplexity: "Basada en factorización de 2048 bits",
          details: [
            "Clave pública RSA de 2048 bits",
            "Exponente público 65537",
            "OAEP con SHA-256",
            "La clave privada se conserva localmente en memoria",
          ],
          metadata: { modulusBits: 2048 },
        };
      } else {
        const digest = await hashText(algorithm, input);
        ciphertext = digest;
        const outputBytes = algorithm === "md5" ? 16 : 32;
        opResult = {
          algorithm,
          algorithmLabel: algorithm === "md5" ? "MD5" : "SHA-256",
          output: digest,
          inputBytes,
          outputBytes,
          expansion: outputBytes - inputBytes,
          durationMs: performance.now() - started,
          reversible: false,
          theoreticalComplexity: algorithm === "md5" ? "2^128" : "2^256",
          details: [
            `Salida fija de ${algorithm === "md5" ? 128 : 256} bits`,
            "Función unidireccional sin descifrado práctico",
            "Un cambio mínimo modifica el resumen drásticamente",
            "La recuperación solo es posible por búsqueda exhaustiva o diccionario",
          ],
          metadata: { hashAlgorithm: algorithm },
        };
      }

      if (opResult) {
        setResult(opResult);
        const keyBits =
          algorithm === "aes"
            ? 256
            : algorithm === "rsa"
            ? 2048
            : algorithm === "md5"
            ? 128
            : 256;
        const searchSpace =
          algorithm === "aes"
            ? (BigInt(2) ** BigInt(256)).toString()
            : algorithm === "rsa"
            ? (BigInt(2) ** BigInt(2048)).toString()
            : algorithm === "md5"
            ? (BigInt(2) ** BigInt(128)).toString()
            : (BigInt(2) ** BigInt(256)).toString();
        const log2ss = algorithm === "rsa" ? 2048 : algorithm === "md5" ? 128 : 256;

        SimulationStorage.save({
          algorithm: opResult.algorithmLabel,
          algorithmKey: algorithmKeyOf(algorithm),
          operation: "encryption",
          originalText: input,
          messageSize: inputBytes,
          ciphertext,
          ciphertextSize: opResult.outputBytes,
          keyLength: keyBits,
          executionTimeMs: opResult.durationMs,
          attackDurationMs: 0,
          attempts: 1,
          attemptsPerSecond: 0,
          cpuUtilization: 0,
          memoryBytes: 0,
          status: "success",
          progress: 100,
          searchSpace,
          log2SearchSpace: log2ss,
          successProbability: (1 / Number(searchSpace.slice(0, 15))).toExponential(2),
        });
        refreshHistory();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible completar la operación.");
    } finally {
      setLoading(false);
    }
  };

  const executeDecrypt = async () => {
    if (!result) return;
    setLoading(true);
    setDecryptError(null);
    setDecryptedText(null);
    const started = performance.now();

    try {
      let plaintext = "";
      if (algorithm === "aes") {
        if (!decryptPassword) throw new Error("Escribe la contraseña para intentar descifrar.");
        plaintext = await decryptAes(result.output, decryptPassword);
      } else if (algorithm === "rsa" && rsaPrivateKey) {
        plaintext = await decryptRsa(result.output, rsaPrivateKey);
      }
      setDecryptedText(plaintext);
      const elapsed = performance.now() - started;
      SimulationStorage.save({
        algorithm: algorithmLabelOf(algorithm),
        algorithmKey: algorithmKeyOf(algorithm),
        operation: "decryption",
        originalText: algorithm === "aes" ? "Contraseña manual" : "Clave privada",
        messageSize: plaintext.length,
        ciphertext: result.output,
        ciphertextSize: result.outputBytes,
        recoveredText: plaintext,
        keyLength: algorithm === "rsa" ? 2048 : 256,
        executionTimeMs: elapsed,
        attackDurationMs: 0,
        attempts: 1,
        attemptsPerSecond: 0,
        cpuUtilization: 0,
        memoryBytes: 0,
        status: "success",
        progress: 100,
        searchSpace: "1",
        log2SearchSpace: 0,
        successProbability: "1",
      });
      refreshHistory();
    } catch {
      setDecryptError("No se pudo descifrar: la clave es incorrecta o los datos fueron alterados.");
      SimulationStorage.save({
        algorithm: algorithmLabelOf(algorithm),
        algorithmKey: algorithmKeyOf(algorithm),
        operation: "decryption",
        originalText:
          algorithm === "aes" ? `Contraseña: ${decryptPassword}` : "Clave privada",
        messageSize: 0,
        ciphertext: result.output,
        ciphertextSize: result.outputBytes,
        keyLength: algorithm === "rsa" ? 2048 : 256,
        executionTimeMs: performance.now() - started,
        attackDurationMs: 0,
        attempts: 1,
        attemptsPerSecond: 0,
        cpuUtilization: 0,
        memoryBytes: 0,
        status: "failed",
        progress: 0,
        searchSpace: "0",
        log2SearchSpace: 0,
        successProbability: "0",
      });
      refreshHistory();
    } finally {
      setLoading(false);
    }
  };

  const copyOutput = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const startAttack = async () => {
    if (!attackValue) {
      setAttackError("Ingresa un valor o texto para iniciar la simulación.");
      return;
    }

    // For AES/RSA validate pre-requisites
    if (algorithm === "aes" && (!result || result.algorithmLabel !== "AES-256-GCM")) {
      setAttackError("Genera primero el paquete AES en la sección de cifrado.");
      return;
    }
    if (algorithm === "rsa" && !rsaPublicJwk) {
      setAttackError("Genera primero la clave RSA en la sección de cifrado.");
      return;
    }

    resetAttack();
    setAttackError(null);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const options: AttackOptions = {
      strategy: attackStrategy,
      maxAttempts: customMaxAttempts,
      maxDurationMs: customMaxDurationMs,
      charset:
        algorithm === "md5" || algorithm === "sha256"
          ? Array.from(new Set([...attackValue])).concat(defaultCharset).slice(0, 36)
          : defaultCharset,
      maxCandidateLength: algorithm === "aes" ? Math.min(6, attackValue.length || 6) : 5,
      abortSignal: controller.signal,
      stallTimeoutMs: 15_000,
    };

    try {
      let attack: AttackResult;
      if (algorithm === "aes") {
        attack = await attackAes(result!.output, input, options, attackUpdate);
      } else if (algorithm === "rsa") {
        attack = await attackRsa(rsaPublicJwk!, options, attackUpdate);
      } else {
        attack = await attackHash(algorithm, attackValue, attackStrategy, options, attackUpdate);
      }

      setAttackResult(attack);

      const log2Space =
        attack.searchSize > 0
          ? typeof attack.searchSize === "bigint"
            ? Math.round(attack.searchSize.toString().length * 3.32)
            : Math.log2(attack.searchSize)
          : 0;

      const ciphertextForRecord =
        algorithm === "aes"
          ? result?.output ?? ""
          : algorithm === "rsa"
          ? "" // no individual ciphertext per attack
          : await hashText(algorithm, attackValue);

      SimulationStorage.save({
        algorithm: algorithmLabelOf(algorithm),
        algorithmKey: algorithmKeyOf(algorithm),
        operation: "attack",
        originalText: algorithm === "aes" ? input : attackValue,
        messageSize: attackValue.length,
        ciphertext: ciphertextForRecord,
        ciphertextSize:
          algorithm === "aes"
            ? result?.outputBytes ?? 0
            : algorithm === "md5"
            ? 16
            : algorithm === "sha256"
            ? 32
            : 256,
        recoveredText: attack.foundCandidate,
        keyLength:
          algorithm === "rsa" ? 2048 : algorithm === "md5" ? 128 : 256,
        executionTimeMs: attack.elapsedMs,
        attackDurationMs: attack.elapsedMs,
        attempts: attack.attempts,
        attemptsPerSecond: attack.speedPerSecond,
        cpuUtilization: attack.cpuUtilization,
        memoryBytes: attack.memoryBytes,
        status: attack.found ? "success" : "failed",
        progress: attack.progress,
        searchSpace: attack.searchSize.toString(),
        log2SearchSpace: log2Space,
        successProbability:
          attack.searchSize > 0
            ? (1 / Number(typeof attack.searchSize === "bigint" ? attack.searchSize : attack.searchSize)).toExponential(2)
            : "0",
      });
      refreshHistory();
    } catch (cause) {
      setAttackError(
        cause instanceof Error ? cause.message : "La simulación encontró un error inesperado.",
      );
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopAttack = () => {
    abortControllerRef.current?.abort();
  };

  const deleteRecord = (id: string) => {
    SimulationStorage.delete(id);
    setDeleteConfirmId(null);
    refreshHistory();
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <DashboardShell
      eyebrow="Laboratorio interactivo"
      title="Simulación criptográfica y de ataques"
      description="Experimenta con primitivas reales y observa métricas de ejecución en cada escenario. AES y RSA respetan su resistencia; MD5 y SHA-256 solo admiten recuperación si el valor está en el espacio explorado."
      badge="Web Crypto API"
    >
      {/* ── Tab bar ── */}
      <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2">
        {(
          [
            ["crypto", "🔐 Cifrado y hashing"],
            ["attack", "⚔️ Simulación de ataques"],
            ["history", "📋 Historial"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
              mode === value
                ? "bg-cyan-400 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CRYPTO TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "crypto" && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {/* ── Left: config ── */}
          <VisualPanel title="Configuración" subtitle="Datos procesados localmente en tu navegador">
            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Algoritmo</span>
                <select
                  value={algorithm}
                  onChange={(e) => changeAlgorithm(e.target.value as Algorithm)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60"
                >
                  {algorithms.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs text-slate-500">
                  {algorithms.find((o) => o.value === algorithm)?.description}
                </span>
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 flex justify-between">
                  <span>Texto a procesar</span>
                  <span className="text-slate-500">{inputBytes} bytes</span>
                </span>
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    resetCrypto();
                  }}
                  rows={7}
                  maxLength={10000}
                  placeholder="Escribe el contenido que deseas procesar…"
                  className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60"
                />
              </label>

              {algorithm === "aes" && (
                <div className="space-y-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 block">Contraseña de cifrado</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        resetCrypto();
                      }}
                      placeholder="Mínimo 8 caracteres"
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 block">Confirmar contraseña</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        resetCrypto();
                      }}
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-slate-400">Fortaleza estimada</span>
                      <span className="text-cyan-200">
                        {Math.min(100, Math.max(0, password.length * 10))}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, password.length * 10))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={executeCrypto}
                disabled={!input || loading}
                className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {loading
                  ? "Procesando…"
                  : algorithm === "md5" || algorithm === "sha256"
                  ? "Generar resumen"
                  : "Generar resultado"}
              </button>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
                  {error}
                </p>
              )}
              <p className="text-xs leading-5 text-slate-500">
                Las claves y contraseñas no se envían ni se almacenan. Si las pierdes, no es posible recuperar el contenido AES.
              </p>
            </div>
          </VisualPanel>

          {/* ── Right: result ── */}
          <VisualPanel
            title="Resultado criptográfico"
            subtitle={result ? `${result.algorithmLabel} · operación completada` : "Esperando una operación"}
          >
            {!result ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center text-sm leading-7 text-slate-500">
                Configura el algoritmo e inicia la operación para ver el resultado y sus métricas.
              </div>
            ) : (
              <div className="space-y-5">
                {/* ── Key metrics row ── */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label="Mensaje"
                    value={`${result.inputBytes.toLocaleString("es-EC")} B`}
                    detail="Tamaño original (UTF-8)"
                    accent="text-cyan-200"
                  />
                  <MetricCard
                    label="Cifrado"
                    value={`${result.outputBytes.toLocaleString("es-EC")} B`}
                    detail="Tamaño de salida"
                    accent="text-emerald-200"
                  />
                  <MetricCard
                    label="Expansión"
                    value={`${result.expansion > 0 ? "+" : ""}${result.expansion} B`}
                    detail="Diferencia entrada/salida"
                    accent="text-amber-200"
                  />
                  <MetricCard
                    label="Tiempo"
                    value={formatDurationMs(result.durationMs)}
                    detail="Ejecución local"
                    accent="text-fuchsia-200"
                  />
                </div>

                {/* ── Algorithm + complexity ── */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="mb-1 text-xs text-slate-500">Algoritmo</p>
                    <p className="font-mono text-sm font-semibold text-cyan-200">{result.algorithmLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="mb-1 text-xs text-slate-500">Longitud de clave</p>
                    <p className="font-mono text-sm font-semibold text-emerald-200">
                      {algorithm === "rsa" ? "2048 bits" : algorithm === "md5" ? "128 bits" : "256 bits"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="mb-1 text-xs text-slate-500">Complejidad teórica</p>
                    <p className="font-mono text-sm font-semibold text-fuchsia-200">{result.theoreticalComplexity}</p>
                  </div>
                </div>

                {/* ── Ciphertext output ── */}
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-medium text-white">
                      {result.reversible ? "Paquete cifrado" : "Resumen criptográfico"}
                    </p>
                    <button
                      type="button"
                      onClick={copyOutput}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-cyan-200 hover:bg-white/5"
                    >
                      {copied ? "Copiado ✓" : "Copiar"}
                    </button>
                  </div>
                  <p className="max-h-40 overflow-auto break-all font-mono text-xs leading-6 text-slate-300">
                    {result.output}
                  </p>
                </div>

                {/* ── Details ── */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="mb-3 text-sm font-medium text-white">Parámetros del algoritmo</p>
                    <ul className="grid gap-2 text-xs text-slate-400">
                      {result.details.map((d) => (
                        <li key={d}>✓ {d}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                    <p className="mb-3 text-sm font-medium text-white">Seguridad Teórica</p>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Complejidad estimada:</p>
                      <p className="font-mono text-lg font-semibold text-cyan-200">
                        {result.theoreticalComplexity}
                      </p>
                      <p className="text-[10px] italic text-slate-500">
                        Resistencia contra ataques de fuerza bruta genéricos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Decrypt ── */}
                {result.reversible ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <p className="font-medium text-amber-100">Descifrado manual</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Solo se recupera el texto si se conoce la clave correcta.
                    </p>
                    {algorithm === "aes" ? (
                      <>
                        <input
                          type="password"
                          value={decryptPassword}
                          onChange={(e) => setDecryptPassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void executeDecrypt(); }}
                          placeholder="Contraseña para descifrar"
                          className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400/60"
                        />
                        <button
                          type="button"
                          onClick={executeDecrypt}
                          disabled={loading || !decryptPassword}
                          className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-40"
                        >
                          Intentar descifrar
                        </button>
                      </>
                    ) : algorithm === "rsa" ? (
                      <button
                        type="button"
                        onClick={executeDecrypt}
                        disabled={loading || !rsaPrivateKey}
                        className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-40"
                      >
                        Descifrar con clave privada
                      </button>
                    ) : null}
                    {decryptError && (
                      <p role="alert" className="mt-3 text-sm text-rose-300">{decryptError}</p>
                    )}
                    {decryptedText !== null && (
                      <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                        <p className="text-xs font-medium text-emerald-200">
                          Autenticación correcta · contenido recuperado
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">
                          {decryptedText}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 text-sm leading-6 text-slate-400">
                    <strong className="text-fuchsia-200">No hay descifrado.</strong> Un hash no
                    contiene una copia reversible del mensaje; solo puede compararse con otros valores.
                  </div>
                )}
              </div>
            )}
          </VisualPanel>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ATTACK TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "attack" && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {/* ── Left: config ── */}
          <VisualPanel title="Escenario de fuerza bruta" subtitle="Simulación de ataque con métricas reales">
            <div className="space-y-5">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Algoritmo objetivo</span>
                <select
                  value={algorithm}
                  onChange={(e) => changeAlgorithm(e.target.value as Algorithm)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60"
                >
                  {algorithms.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Valor objetivo</span>
                <textarea
                  value={attackValue}
                  onChange={(e) => { setAttackValue(e.target.value); resetAttack(); }}
                  rows={5}
                  maxLength={500}
                  placeholder="Ejemplo: Clave-Segura-2026!"
                  className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60"
                />
              </label>

              {(algorithm === "md5" || algorithm === "sha256") && (
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Estrategia de ataque</span>
                  <select
                    value={attackStrategy}
                    onChange={(e) => setAttackStrategy(e.target.value as AttackStrategy)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60"
                  >
                    {attackStrategies
                      .filter((s) => s.value !== "trial-division")
                      .map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                  </select>
                  <span className="mt-2 block text-xs text-slate-500">
                    {attackStrategies.find((s) => s.value === attackStrategy)?.description}
                  </span>
                </label>
              )}

              {/* ── Custom limits ── */}
              <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <span className="mb-2 block text-sm font-medium text-slate-300">Límites de la simulación</span>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-xs text-slate-400">
                    <span className="mb-1 block">Máx. intentos</span>
                    <input
                      type="number"
                      min={100}
                      value={customMaxAttempts}
                      onChange={(e) => setCustomMaxAttempts(Math.max(100, Number(e.target.value)))}
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    <span className="mb-1 block">Máx. tiempo (ms)</span>
                    <input
                      type="number"
                      min={1000}
                      value={customMaxDurationMs}
                      onChange={(e) => setCustomMaxDurationMs(Math.max(1000, Number(e.target.value)))}
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400/60"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-slate-500">
                  El ataque se detendrá cuando encuentre la clave, agote los intentos, llegue al
                  tiempo máximo, o detecte ausencia de progreso por más de 15 s.
                </p>
              </div>

              {/* ── Context note ── */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                {algorithm === "aes" &&
                  "AES se cifra con clave secreta y el ataque intenta encontrarla por fuerza bruta. En condiciones normales, no se recupera la clave."}
                {algorithm === "rsa" &&
                  "RSA simula factorización del módulo público. Un módulo de 2048 bits no se rompe dentro del presupuesto realista."}
                {(algorithm === "md5" || algorithm === "sha256") &&
                  "Los hashes son irreversibles. La recuperación solo es posible si el valor está en el diccionario o en el espacio explorado."}
              </div>

              {/* ── Start / Stop buttons ── */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={startAttack}
                  disabled={!attackValue || loading}
                  className="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {loading ? "Simulando ataque…" : "Iniciar simulación"}
                </button>
                {loading && (
                  <button
                    type="button"
                    onClick={stopAttack}
                    className="rounded-2xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 font-semibold text-rose-300 transition hover:bg-rose-400/20"
                  >
                    Detener
                  </button>
                )}
              </div>

              {attackError && (
                <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">
                  {attackError}
                </p>
              )}
            </div>
          </VisualPanel>

          {/* ── Right: live metrics + charts ── */}
          <VisualPanel title="Informe del ataque" subtitle="Métricas y gráficos en tiempo real">
            <div className="space-y-5">
              {/* ── Status row ── */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Estado"
                  value={
                    attackResult
                      ? attackResult.status === "succeeded"
                        ? "ÉXITO ✓"
                        : "FALLIDO ✗"
                      : attackSnapshot
                      ? "CORRIENDO"
                      : "LISTO"
                  }
                  detail={attackSnapshot?.reason ?? "Esperando ejecución"}
                  accent={
                    attackResult?.status === "succeeded"
                      ? "text-emerald-200"
                      : attackResult?.status === "failed"
                      ? "text-rose-200"
                      : "text-fuchsia-200"
                  }
                />
                <MetricCard
                  label="Tiempo transcurrido"
                  value={attackSnapshot ? formatDurationMs(attackSnapshot.elapsedMs) : "—"}
                  detail="Duración real"
                  accent="text-amber-200"
                />
                <MetricCard
                  label="Tiempo restante est."
                  value={
                    attackSnapshot && attackSnapshot.estimatedRemainingMs >= 0
                      ? formatDurationMs(attackSnapshot.estimatedRemainingMs)
                      : "—"
                  }
                  detail="Basado en velocidad actual"
                  accent="text-cyan-200"
                />
                <MetricCard
                  label="Candidato actual"
                  value={attackSnapshot?.currentCandidate ? snippetOf(attackSnapshot.currentCandidate, 14) : "—"}
                  detail="Última clave probada"
                  accent="text-slate-300"
                />
              </div>

              {/* ── Progress + speed row ── */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Intentos"
                  value={attackSnapshot ? attackSnapshot.attempts.toLocaleString("es-EC") : "—"}
                  detail="Realizados"
                  accent="text-cyan-200"
                />
                <MetricCard
                  label="Velocidad"
                  value={attackSnapshot ? `${attackSnapshot.speedPerSecond.toFixed(1)}/s` : "—"}
                  detail="Intentos por segundo"
                  accent="text-emerald-200"
                />
                <MetricCard
                  label="Progreso"
                  value={attackSnapshot ? `${attackSnapshot.progress.toFixed(2)} %` : "—"}
                  detail="Del espacio explorado"
                  accent="text-fuchsia-200"
                />
                <MetricCard
                  label="Espacio"
                  value={attackSnapshot ? formatSearchSize(attackSnapshot.searchSize) : "—"}
                  detail="Volumen teórico total"
                  accent="text-amber-200"
                />
              </div>

              {/* ── Progress bar ── */}
              {attackSnapshot && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Progreso del ataque</span>
                    <span>{attackSnapshot.progress.toFixed(3)} %</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        attackResult?.status === "succeeded"
                          ? "bg-emerald-400"
                          : "bg-cyan-400"
                      }`}
                      style={{ width: `${Math.min(100, attackSnapshot.progress)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ── CPU + Memory cards ── */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="mb-2 text-sm font-medium text-white">CPU estimada</p>
                  <p className="mb-2 text-2xl font-semibold text-white">
                    {attackSnapshot ? `${attackSnapshot.cpuUtilization.toFixed(1)} %` : "—"}
                  </p>
                  {attackSnapshot && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-orange-400"
                        style={{ width: `${attackSnapshot.cpuUtilization}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="mb-2 text-sm font-medium text-white">Uso de memoria</p>
                  <p className="mb-2 text-2xl font-semibold text-white">
                    {attackSnapshot ? `${(attackSnapshot.memoryBytes / 1024 / 1024).toFixed(2)} MiB` : "—"}
                  </p>
                  {attackStats && (
                    <p className="text-xs text-slate-500">Entropía: {attackStats.log2Space} bits</p>
                  )}
                </div>
              </div>

              {/* ── Chart: progress + speed ── */}
              {chartData.length > 0 && (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-sm font-medium text-white">Evolución en tiempo real</p>

                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="step" stroke="#94a3b8" fontSize={11} />
                        <YAxis yAxisId="left" stroke="#22d3ee" fontSize={11} />
                        <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: "12px" }} />
                        <Line yAxisId="left" type="monotone" dataKey="progress" stroke="#22d3ee" strokeWidth={2} dot={false} name="Progreso (%)" />
                        <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#34d399" strokeWidth={2} dot={false} name="Velocidad (/s)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart: CPU */}
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="step" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#f97316" fontSize={11} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Area type="monotone" dataKey="cpu" stroke="#fb923c" fill="#fb923c" fillOpacity={0.2} name="CPU (%)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Chart: Memory */}
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="step" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#a78bfa" fontSize={11} unit=" MB" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Area type="monotone" dataKey="memory" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} name="Memoria (MiB)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Result banner ── */}
              {attackResult && (
                <div
                  className={`rounded-2xl border p-4 ${
                    attackResult.found
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-rose-400/30 bg-rose-400/10"
                  }`}
                >
                  <p className={`font-semibold ${attackResult.found ? "text-emerald-200" : "text-rose-200"}`}>
                    {attackResult.found ? "✓ Valor recuperado" : "✗ Ataque finalizado sin éxito"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{attackResult.reason}</p>
                  {attackResult.foundCandidate && (
                    <p className="mt-2 break-all font-mono text-sm text-white">
                      {attackResult.foundCandidate}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500">Intentos</span>
                      <br />
                      {attackResult.attempts.toLocaleString("es-EC")}
                    </div>
                    <div>
                      <span className="text-slate-500">Duración</span>
                      <br />
                      {formatDurationMs(attackResult.elapsedMs)}
                    </div>
                    <div>
                      <span className="text-slate-500">Velocidad</span>
                      <br />
                      {attackResult.speedPerSecond.toFixed(1)}/s
                    </div>
                  </div>
                </div>
              )}
            </div>
          </VisualPanel>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HISTORY TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "history" && (
        <div className="space-y-6">
          <VisualPanel
            title="Historial de simulaciones"
            subtitle={`${filteredHistory.length} / ${history.length} registros`}
          >
            <div className="space-y-4">
              {/* ── Filters row ── */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Buscar por texto, algoritmo o ID…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                />
                <select
                  value={historyAlgoFilter}
                  onChange={(e) => setHistoryAlgoFilter(e.target.value as Algorithm | "all")}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="all">Todos los algoritmos</option>
                  <option value="aes">AES</option>
                  <option value="rsa">RSA</option>
                  <option value="md5">MD5</option>
                  <option value="sha256">SHA-256</option>
                </select>
                <select
                  value={historyOpFilter}
                  onChange={(e) => setHistoryOpFilter(e.target.value as typeof historyOpFilter)}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="all">Todas las operaciones</option>
                  <option value="encryption">Cifrado</option>
                  <option value="decryption">Descifrado</option>
                  <option value="attack">Ataque</option>
                </select>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value as typeof historyStatusFilter)}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="all">Todos los estados</option>
                  <option value="success">Éxito</option>
                  <option value="failed">Fallo</option>
                </select>
              </div>

              {/* ── Action buttons ── */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-xs text-slate-500">
                  {filteredHistory.length} resultado{filteredHistory.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => SimulationStorage.exportToCSV(filteredHistory)}
                  disabled={filteredHistory.length === 0}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-40"
                >
                  ↓ Exportar CSV
                </button>
                <button
                  onClick={() => {
                    if (filteredHistory.length === 0) return;
                    if (window.confirm(`¿Eliminar los ${filteredHistory.length} registros filtrados?`)) {
                      filteredHistory.forEach((r) => SimulationStorage.delete(r.id));
                      refreshHistory();
                    }
                  }}
                  disabled={filteredHistory.length === 0}
                  className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40"
                >
                  Eliminar selección
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("¿Limpiar todo el historial?")) {
                      SimulationStorage.clear();
                      refreshHistory();
                    }
                  }}
                  disabled={history.length === 0}
                  className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-40"
                >
                  Limpiar todo
                </button>
              </div>

              {/* ── Table ── */}
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/50">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/5 text-slate-400">
                    <tr>
                      {(
                        [
                          ["timestamp", "Fecha"],
                          ["algorithm", "Algoritmo"],
                          ["operation", "Operación"],
                          ["status", "Resultado"],
                          ["executionTimeMs", "Tiempo"],
                          ["attempts", "Intentos"],
                          ["attemptsPerSecond", "Velocidad"],
                          ["progress", "Progreso"],
                        ] as [SortField, string][]
                      ).map(([field, label]) => (
                        <th
                          key={field}
                          className="cursor-pointer select-none whitespace-nowrap px-4 py-3 font-medium hover:text-white"
                          onClick={() => toggleSort(field)}
                        >
                          {label}
                          <span className="text-[10px] text-slate-600">{sortIndicator(field)}</span>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                          No se encontraron registros. Ejecuta una simulación para comenzar.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((record) => (
                        <tr key={record.id} className="group transition-colors hover:bg-white/5">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                            <div className="font-mono text-[10px] text-slate-600">{record.id}</div>
                            <div className="text-xs">
                              {new Date(record.timestamp).toLocaleString("es-EC", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-lg bg-slate-800 px-2 py-1 font-mono text-xs uppercase text-cyan-300">
                              {record.algorithmKey}
                            </span>
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-300">
                            {record.operation === "attack"
                              ? "Ataque"
                              : record.operation === "encryption"
                              ? "Cifrado"
                              : "Descifrado"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                                record.status === "success"
                                  ? "bg-emerald-400/10 text-emerald-400"
                                  : "bg-rose-400/10 text-rose-400"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  record.status === "success" ? "bg-emerald-400" : "bg-rose-400"
                                }`}
                              />
                              {record.status === "success" ? "Éxito" : "Fallo"}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                            {record.operation === "attack"
                              ? formatDurationMs(record.attackDurationMs)
                              : formatDurationMs(record.executionTimeMs)}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {record.attempts > 1
                              ? record.attempts.toLocaleString("es-EC")
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                            {record.attemptsPerSecond > 0
                              ? `${record.attemptsPerSecond.toFixed(1)}/s`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {record.operation === "attack"
                              ? `${record.progress.toFixed(2)} %`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {deleteConfirmId === record.id ? (
                              <span className="inline-flex gap-2">
                                <button
                                  onClick={() => deleteRecord(record.id)}
                                  className="text-xs text-rose-400 hover:text-rose-300"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-xs text-slate-400 hover:text-slate-300"
                                >
                                  Cancelar
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(record.id)}
                                className="text-rose-400 opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100"
                              >
                                Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </VisualPanel>
        </div>
      )}
    </DashboardShell>
  );
}
