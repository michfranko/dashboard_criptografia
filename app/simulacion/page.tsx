"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { SimulationRecord, SimulationStorage, DASHBOARD_VERSION, SIMULATOR_VERSION } from "./simulation-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

type LabMode = "crypto" | "attack" | "history";
type SortField = keyof SimulationRecord;
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const algorithms = [
  { value: "aes" as const, label: "AES-256-GCM", description: "Cifrado simétrico autenticado con clave secreta." },
  { value: "rsa" as const, label: "RSA-OAEP 2048", description: "Cifrado asimétrico para mensajes breves." },
  { value: "md5" as const, label: "MD5", description: "Hash irreversible de 128 bits." },
  { value: "sha256" as const, label: "SHA-256", description: "Hash irreversible de 256 bits." },
];

const ALGO_TECH_INFO: Record<Algorithm, {
  type: string;
  keyLength: string;
  blockSize: string;
  mode: string;
  complexity: string;
  securityLevel: string;
}> = {
  aes: {
    type: "Simétrico (Bloque)",
    keyLength: "256 bits",
    blockSize: "128 bits (16 bytes)",
    mode: "GCM (Galois/Counter Mode)",
    complexity: "2^256 (O(2^n))",
    securityLevel: "Muy alto (Estándar militar)",
  },
  rsa: {
    type: "Asimétrico (Clave pública)",
    keyLength: "2048 bits",
    blockSize: "Variable (Máx 190 bytes con OAEP)",
    mode: "OAEP (SHA-256)",
    complexity: "Basada en factorización (GNFS)",
    securityLevel: "Alto (Estándar corporativo)",
  },
  md5: {
    type: "Hash (Digest)",
    keyLength: "N/A",
    blockSize: "512 bits (Mensaje interno)",
    mode: "Merkle-Damgård",
    complexity: "2^128 (Colisiones: 2^18)",
    securityLevel: "Obsoleto (Solo integridad básica)",
  },
  sha256: {
    type: "Hash (Digest)",
    keyLength: "N/A",
    blockSize: "512 bits (Mensaje interno)",
    mode: "Merkle-Damgård",
    complexity: "2^256 (Resistencia pre-imagen)",
    securityLevel: "Alto (Estándar actual)",
  },
};

const attackStrategies: { value: AttackStrategy; label: string; description: string }[] = [
  { value: "dictionary", label: "Diccionario", description: "Busca coincidencias en una lista de valores comunes." },
  { value: "bruteforce", label: "Fuerza bruta", description: "Prueba todas las combinaciones posibles en el espacio definido." },
  { value: "trial-division", label: "Factorización", description: "Ataca el módulo RSA con divisores primos de prueba." },
];

const defaultCharset = [
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p",
  "q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9",
];

const ALGO_DEFAULTS: Record<Algorithm, { maxAttempts: number; maxDurationMs: number }> = {
  aes:    { maxAttempts: 50_000,     maxDurationMs: 300_000 },  // 5 min
  rsa:    { maxAttempts: 500_000,    maxDurationMs: 600_000 },  // 10 min
  md5:    { maxAttempts: 1_000_000,  maxDurationMs: 180_000 },  // 3 min
  sha256: { maxAttempts: 1_000_000,  maxDurationMs: 180_000 },  // 3 min
};

const ITEMS_PER_PAGE = 25;

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

function algorithmLabelOf(alg: Algorithm): string {
  return algorithms.find((a) => a.value === alg)?.label ?? alg.toUpperCase();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ─── Icons (SVG) ─────────────────────────────────────────────────────────────

const IconZap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
);

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
  const [showSummary, setShowSummary] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── History tab ───────────────────────────────────────────────────────────
  const [history, setHistory] = useState<SimulationRecord[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHistory(SimulationStorage.getAll());
    }
  }, []);

  const [historySearch, setHistorySearch] = useState("");
  const [historyAlgoFilter, setHistoryAlgoFilter] = useState<Algorithm | "all">("all");
  const [historyOpFilter, setHistoryOpFilter] = useState<"all" | "encryption" | "decryption" | "attack">("all");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
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
    setShowSummary(false);
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
    setAttackTimeline((prev) => {
      const next = [...prev, snapshot];
      return next.length > 300 ? next.slice(-300) : next;
    });
  }, []);

  // ── Sort & Filter & Paging ───────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase();
    let records = history.filter((r) => {
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.algorithm.toLowerCase().includes(q) ||
        (r.originalText && r.originalText.toLowerCase().includes(q));
      const matchesAlgo = historyAlgoFilter === "all" || r.algorithmKey === historyAlgoFilter;
      const matchesOp = historyOpFilter === "all" || r.operation === historyOpFilter;

      let rStatus: "success" | "failed" = "success";
      if (r.operation === "attack") rStatus = r.attackSuccess ? "success" : "failed";
      else rStatus = r.status as "success" | "failed";

      const matchesStatus = historyStatusFilter === "all" || rStatus === historyStatusFilter;
      return matchesSearch && matchesAlgo && matchesOp && matchesStatus;
    });

    records = records.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];

      if (va === undefined || va === null) return sortDir === "asc" ? -1 : 1;
      if (vb === undefined || vb === null) return sortDir === "asc" ? 1 : -1;

      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return records;
  }, [history, historySearch, historyAlgoFilter, historyOpFilter, historyStatusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [historySearch, historyAlgoFilter, historyOpFilter, historyStatusFilter]);

  // ── Chart data ────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    return attackTimeline.map((s, i) => ({
      step: i + 1,
      progress: +s.progress.toFixed(2),
      speed: +s.speedPerSecond.toFixed(1),
      cpu: +s.cpuUtilization.toFixed(1),
      memory: +(s.memoryBytes / 1024 / 1024).toFixed(2),
      elapsed: +(s.elapsedMs / 1000).toFixed(1),
      attempts: s.attempts,
    }));
  }, [attackTimeline]);

  const spaceExplorationData = useMemo(() => {
    if (!attackSnapshot) return [];
    const explored = attackSnapshot.attempts;
    const total = typeof attackSnapshot.searchSize === "bigint" ? Number(attackSnapshot.searchSize) : attackSnapshot.searchSize;
    const remaining = Math.max(0, total - explored);
    return [
      { name: "Explorado", value: explored, color: "#22d3ee" },
      { name: "Restante", value: remaining, color: "#1e293b" },
    ];
  }, [attackSnapshot]);

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
          setError("RSA-OAEP 2048 admite hasta 190 bytes. Usa AES para textos más largos.");
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
          details: ["Clave RSA 2048", "OAEP con SHA-256"],
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
          details: [`Salida ${algorithm === "md5" ? 128 : 256} bits`],
          metadata: { hashAlgorithm: algorithm },
        };
      }

      if (opResult) {
        setResult(opResult);
        const keyBits = algorithm === "aes" ? 256 : algorithm === "rsa" ? 2048 : algorithm === "md5" ? 128 : 256;
        const searchSpace = algorithm === "aes" ? (BigInt(2) ** BigInt(256)).toString() : algorithm === "rsa" ? (BigInt(2) ** BigInt(2048)).toString() : algorithm === "md5" ? (BigInt(2) ** BigInt(128)).toString() : (BigInt(2) ** BigInt(256)).toString();

        SimulationStorage.save({
          versionDashboard: DASHBOARD_VERSION,
          versionSimulador: SIMULATOR_VERSION,
          algorithm: opResult.algorithmLabel,
          algorithmKey: algorithm === "aes" ? "aes" : algorithm === "rsa" ? "rsa" : algorithm === "md5" ? "md5" : "sha256",
          operation: "encryption",
          keyLengthBits: keyBits,
          blockSize: algorithm === "aes" ? 16 : 0,
          hashLength: algorithm === "md5" ? 128 : algorithm === "sha256" ? 256 : 0,
          encoding: "UTF-8",
          charset: "N/A",
          passwordLength: algorithm === "aes" ? password.length : 0,
          inputLengthBytes: inputBytes,
          inputLengthBits: inputBytes * 8,
          estimatedKeyspace: searchSpace,
          ciphertext,
          ciphertextLength: opResult.outputBytes,
          ciphertextFormat: "Base64/Hex",
          encryptionSuccess: true,
          decryptionSuccess: false,
          outputLength: opResult.outputBytes,
          expansionRatio: +(opResult.outputBytes / Math.max(1, inputBytes)).toFixed(4),
          compressionRatio: +(inputBytes / Math.max(1, opResult.outputBytes)).toFixed(4),
          integrityVerified: algorithm === "aes",
          executionTimeMs: opResult.durationMs,
          executionTimeSeconds: +(opResult.durationMs / 1000).toFixed(6),
          throughputBytesSec: +(inputBytes / (opResult.durationMs / 1000 || 0.001)).toFixed(2),
          cpuUsagePercent: 0,
          averageCpuUsage: 0,
          peakCpuUsage: 0,
          memoryUsageMb: 0,
          peakMemoryUsageMb: 0,
          latencyMs: opResult.durationMs,
          attackStarted: "",
          attackFinished: "",
          attackDurationSeconds: 0,
          attackStatus: "N/A",
          attempts: 1,
          attemptsPerSecond: 0,
          maxAttempts: 1,
          currentProgressPercent: 100,
          estimatedRemainingTime: 0,
          keysTested: 1,
          keyspaceSize: searchSpace,
          currentCandidate: "",
          foundKey: "",
          foundIteration: 0,
          attackSuccess: false,
          recoveredPlaintext: "",
          resultStatus: "Éxito",
          errorMessage: "",
          notes: opResult.details.join("; "),
          // Legacy
          originalText: input,
          messageSize: inputBytes,
          ciphertextSize: opResult.outputBytes,
          keyLength: keyBits,
          attackDurationMs: 0,
          progress: 100,
          memoryBytes: 0,
          cpuUtilization: 0,
          status: "success",
          searchSpace,
          log2SearchSpace: algorithm === "rsa" ? 2048 : algorithm === "md5" ? 128 : 256,
          successProbability: "1.0",
        });
        refreshHistory();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error fatal.");
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
        if (!decryptPassword) throw new Error("Contraseña requerida.");
        plaintext = await decryptAes(result.output, decryptPassword);
      } else if (algorithm === "rsa" && rsaPrivateKey) {
        plaintext = await decryptRsa(result.output, rsaPrivateKey);
      }
      setDecryptedText(plaintext);
      const elapsed = performance.now() - started;
      SimulationStorage.save({
        versionDashboard: DASHBOARD_VERSION,
        versionSimulador: SIMULATOR_VERSION,
        algorithm: algorithmLabelOf(algorithm),
        algorithmKey: algorithm === "aes" ? "aes" : algorithm === "rsa" ? "rsa" : algorithm === "md5" ? "md5" : "sha256",
        operation: "decryption",
        keyLengthBits: algorithm === "rsa" ? 2048 : 256,
        blockSize: algorithm === "aes" ? 16 : 0,
        hashLength: 0,
        encoding: "UTF-8",
        charset: "N/A",
        passwordLength: algorithm === "aes" ? decryptPassword.length : 0,
        inputLengthBytes: result.outputBytes,
        inputLengthBits: result.outputBytes * 8,
        estimatedKeyspace: "1",
        ciphertext: result.output,
        ciphertextLength: result.outputBytes,
        ciphertextFormat: "Base64/Hex",
        encryptionSuccess: false,
        decryptionSuccess: true,
        outputLength: plaintext.length,
        expansionRatio: 1,
        compressionRatio: 1,
        integrityVerified: true,
        executionTimeMs: elapsed,
        executionTimeSeconds: elapsed / 1000,
        throughputBytesSec: plaintext.length / (elapsed / 1000 || 0.001),
        cpuUsagePercent: 0,
        averageCpuUsage: 0,
        peakCpuUsage: 0,
        memoryUsageMb: 0,
        peakMemoryUsageMb: 0,
        latencyMs: elapsed,
        attackStarted: "",
        attackFinished: "",
        attackDurationSeconds: 0,
        attackStatus: "N/A",
        attempts: 1,
        attemptsPerSecond: 0,
        maxAttempts: 1,
        currentProgressPercent: 100,
        estimatedRemainingTime: 0,
        keysTested: 1,
        keyspaceSize: "1",
        currentCandidate: "",
        foundKey: "",
        foundIteration: 0,
        attackSuccess: false,
        recoveredPlaintext: plaintext,
        resultStatus: "Éxito",
        errorMessage: "",
        notes: "",
        // Legacy
        originalText: "Descifrado",
        messageSize: plaintext.length,
        ciphertextSize: result.outputBytes,
        keyLength: algorithm === "rsa" ? 2048 : 256,
        attackDurationMs: 0,
        progress: 100,
        memoryBytes: 0,
        cpuUtilization: 0,
        status: "success",
        searchSpace: "1",
        log2SearchSpace: 0,
        successProbability: "1",
      });
      refreshHistory();
    } catch {
      setDecryptError("Clave incorrecta.");
      SimulationStorage.save({
        versionDashboard: DASHBOARD_VERSION,
        versionSimulador: SIMULATOR_VERSION,
        algorithm: algorithmLabelOf(algorithm),
        algorithmKey: algorithm === "aes" ? "aes" : algorithm === "rsa" ? "rsa" : algorithm === "md5" ? "md5" : "sha256",
        operation: "decryption",
        keyLengthBits: algorithm === "rsa" ? 2048 : 256,
        blockSize: algorithm === "aes" ? 16 : 0,
        hashLength: 0,
        encoding: "UTF-8",
        charset: "N/A",
        passwordLength: algorithm === "aes" ? decryptPassword.length : 0,
        inputLengthBytes: result.outputBytes,
        inputLengthBits: result.outputBytes * 8,
        estimatedKeyspace: "1",
        ciphertext: result.output,
        ciphertextLength: result.outputBytes,
        ciphertextFormat: "Base64/Hex",
        encryptionSuccess: false,
        decryptionSuccess: false,
        outputLength: 0,
        expansionRatio: 0,
        compressionRatio: 0,
        integrityVerified: false,
        executionTimeMs: performance.now() - started,
        executionTimeSeconds: (performance.now() - started) / 1000,
        throughputBytesSec: 0,
        cpuUsagePercent: 0,
        averageCpuUsage: 0,
        peakCpuUsage: 0,
        memoryUsageMb: 0,
        peakMemoryUsageMb: 0,
        latencyMs: performance.now() - started,
        attackStarted: "",
        attackFinished: "",
        attackDurationSeconds: 0,
        attackStatus: "N/A",
        attempts: 1,
        attemptsPerSecond: 0,
        maxAttempts: 1,
        currentProgressPercent: 0,
        estimatedRemainingTime: 0,
        keysTested: 1,
        keyspaceSize: "1",
        currentCandidate: "",
        foundKey: "",
        foundIteration: 0,
        attackSuccess: false,
        recoveredPlaintext: "",
        resultStatus: "Fallo",
        errorMessage: "Clave incorrecta",
        notes: "",
        // Legacy
        originalText: "Fallo descifrado",
        messageSize: 0,
        ciphertextSize: result.outputBytes,
        keyLength: algorithm === "rsa" ? 2048 : 256,
        attackDurationMs: 0,
        progress: 0,
        memoryBytes: 0,
        cpuUtilization: 0,
        status: "failed",
        searchSpace: "1",
        log2SearchSpace: 0,
        successProbability: "0",
      });
      refreshHistory();
    } finally {
      setLoading(false);
    }
  };

  const startAttack = async () => {
    if (!attackValue) {
      setAttackError("Ingresa un valor para la simulación.");
      return;
    }
    if (algorithm === "aes" && (!result || result.algorithmLabel !== "AES-256-GCM")) {
      setAttackError("Genera primero el paquete AES.");
      return;
    }
    if (algorithm === "rsa" && !rsaPublicJwk) {
      setAttackError("Genera primero la clave RSA.");
      return;
    }

    resetAttack();
    setAttackError(null);
    setLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startIso = new Date().toISOString();

    const options: AttackOptions = {
      strategy: attackStrategy,
      maxAttempts: customMaxAttempts,
      maxDurationMs: customMaxDurationMs,
      charset: (algorithm === "md5" || algorithm === "sha256") ? Array.from(new Set([...attackValue])).concat(defaultCharset).slice(0, 36) : defaultCharset,
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
      setShowSummary(true);

      const ciphertextForRecord = algorithm === "aes" ? result?.output ?? "" : (algorithm === "rsa" ? "" : await hashText(algorithm, attackValue));

      SimulationStorage.save({
        versionDashboard: DASHBOARD_VERSION,
        versionSimulador: SIMULATOR_VERSION,
        algorithm: algorithmLabelOf(algorithm),
        algorithmKey: algorithm === "aes" ? "aes" : algorithm === "rsa" ? "rsa" : algorithm === "md5" ? "md5" : "sha256",
        operation: "attack",
        keyLengthBits: algorithm === "rsa" ? 2048 : algorithm === "md5" ? 128 : 256,
        blockSize: algorithm === "aes" ? 16 : 0,
        hashLength: algorithm === "md5" ? 128 : algorithm === "sha256" ? 256 : 0,
        encoding: "UTF-8",
        charset: options.charset?.join("") || "Default",
        passwordLength: attackValue.length,
        inputLengthBytes: attackValue.length,
        inputLengthBits: attackValue.length * 8,
        estimatedKeyspace: attack.searchSize.toString(),
        ciphertext: ciphertextForRecord,
        ciphertextLength: ciphertextForRecord.length,
        ciphertextFormat: "Base64/Hex",
        encryptionSuccess: false,
        decryptionSuccess: false,
        outputLength: attack.foundCandidate?.length || 0,
        expansionRatio: 1,
        compressionRatio: 1,
        integrityVerified: algorithm === "aes",
        executionTimeMs: attack.elapsedMs,
        executionTimeSeconds: attack.elapsedMs / 1000,
        throughputBytesSec: attack.attempts / (attack.elapsedMs / 1000 || 0.001),
        cpuUsagePercent: attack.cpuUtilization,
        averageCpuUsage: attack.cpuUtilization,
        peakCpuUsage: attack.peakCpuUtilization,
        memoryUsageMb: attack.memoryBytes / 1024 / 1024,
        peakMemoryUsageMb: attack.peakMemoryBytes / 1024 / 1024,
        latencyMs: attack.elapsedMs / Math.max(1, attack.attempts),
        attackStarted: startIso,
        attackFinished: new Date().toISOString(),
        attackDurationSeconds: attack.elapsedMs / 1000,
        attackStatus: attack.attackStatus as any,
        attempts: attack.attempts,
        attemptsPerSecond: attack.speedPerSecond,
        maxAttempts: customMaxAttempts,
        currentProgressPercent: attack.progress,
        estimatedRemainingTime: attack.estimatedRemainingMs,
        keysTested: attack.attempts,
        keyspaceSize: attack.searchSize.toString(),
        currentCandidate: attack.currentCandidate || "",
        foundKey: attack.foundCandidate || "",
        foundIteration: attack.foundIteration || 0,
        attackSuccess: attack.found,
        recoveredPlaintext: attack.foundCandidate || "",
        resultStatus: attack.found ? "SUCCESS" : "FAILED",
        errorMessage: attack.reason,
        notes: `Estrategia: ${attackStrategy}`,
        // Legacy
        originalText: algorithm === "aes" ? input : attackValue,
        messageSize: attackValue.length,
        ciphertextSize: ciphertextForRecord.length,
        keyLength: algorithm === "rsa" ? 2048 : 256,
        attackDurationMs: attack.elapsedMs,
        progress: attack.progress,
        memoryBytes: attack.memoryBytes,
        cpuUtilization: attack.cpuUtilization,
        status: attack.found ? "success" : "failed",
        searchSpace: attack.searchSize.toString(),
        log2SearchSpace: 0,
        successProbability: "0",
      });
      refreshHistory();
    } catch (cause) {
      setAttackError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // ─── Render Helpers ──────────────────────────────────────────────────────────

  const renderStatusBadge = (status: string, success: boolean) => {
    let color = "bg-slate-800 text-slate-400";
    let label = status || (success ? "ÉXITO" : "FALLO");

    if (status === "SUCCESS" || label === "ÉXITO") color = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    else if (status === "FAILED" || label === "FALLO") color = "bg-rose-500/20 text-rose-400 border border-rose-500/30";
    else if (status === "TIME_LIMIT") color = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    else if (status === "USER_CANCELLED") color = "bg-slate-500/20 text-slate-300 border border-slate-500/30";

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${color}`}>
        {label}
      </span>
    );
  };

  return (
    <DashboardShell
      eyebrow="Laboratorio interactivo"
      title="Simulación criptográfica y de ataques"
      description="Experimenta con primitivas reales y observa métricas de ejecución en tiempo real."
      badge="Web Crypto API"
    >
      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2">
        {[
          { id: "crypto", label: "Cifrado y Hashing" },
          { id: "attack", label: "Ataques" },
          { id: "history", label: "Historial" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id as LabMode)}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold transition ${
              mode === t.id ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-slate-800/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "crypto" && (
        <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <aside className="space-y-6">
            <VisualPanel title="CONFIGURACIÓN" subtitle="Parámetros de entrada">
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-2 block text-slate-400">Algoritmo</span>
                  <select
                    value={algorithm}
                    onChange={(e) => changeAlgorithm(e.target.value as Algorithm)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                  >
                    {algorithms.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block text-slate-400">Mensaje de entrada</span>
                  <textarea
                    value={input}
                    onChange={(e) => { setInput(e.target.value); resetCrypto(); }}
                    rows={6}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    placeholder="Escribe aquí..."
                  />
                </label>

                {algorithm === "aes" && (
                  <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                    <input
                      type="password"
                      placeholder="Contraseña (mín 8 car.)"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); resetCrypto(); }}
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="password"
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); resetCrypto(); }}
                      className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </div>
                )}

                <button
                  onClick={executeCrypto}
                  disabled={loading || !input}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  PROCESAR AHORA
                </button>
                {error && <p className="text-xs text-rose-400">{error}</p>}
              </div>
            </VisualPanel>

            <VisualPanel title="FICHA TÉCNICA" subtitle={algorithm.toUpperCase()}>
              <div className="grid grid-cols-2 gap-y-4 text-xs">
                <div>
                  <p className="text-slate-500">Tipo</p>
                  <p className="font-semibold text-slate-200">{ALGO_TECH_INFO[algorithm].type}</p>
                </div>
                <div>
                  <p className="text-slate-500">Clave</p>
                  <p className="font-semibold text-slate-200">{ALGO_TECH_INFO[algorithm].keyLength}</p>
                </div>
                <div>
                  <p className="text-slate-500">Bloque</p>
                  <p className="font-semibold text-slate-200">{ALGO_TECH_INFO[algorithm].blockSize}</p>
                </div>
                <div>
                  <p className="text-slate-500">Seguridad</p>
                  <p className="font-semibold text-cyan-400">{ALGO_TECH_INFO[algorithm].securityLevel}</p>
                </div>
              </div>
            </VisualPanel>
          </aside>

          <main className="space-y-6">
            {result ? (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <MetricCard label="Tiempo" value={`${result.durationMs.toFixed(2)} ms`} detail="Latencia real" accent="text-cyan-400" />
                  <MetricCard label="Velocidad" value={formatBytes(result.inputBytes / (result.durationMs / 1000 || 0.001)) + "/s"} detail="Throughput" accent="text-blue-400" />
                  <MetricCard label="Salida" value={`${result.outputBytes} B`} detail="Tamaño final" accent="text-purple-400" />
                  <MetricCard label="Expansión" value={`${(result.expansion / Math.max(1, result.inputBytes) * 100).toFixed(1)}%`} detail="Ratio" accent="text-amber-400" />
                </div>

                <VisualPanel title="RESULTADO" subtitle="Datos procesados">
                  <div className="space-y-4">
                    <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-all rounded-xl border border-white/5 bg-slate-950/50 p-4 font-mono text-xs text-cyan-200">
                      {result.output}
                    </pre>

                    {result.reversible && (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
                        <h4 className="mb-4 text-sm font-bold text-white">Prueba de descifrado</h4>
                        <div className="flex gap-3">
                          {algorithm === "aes" && (
                            <input
                              type="password"
                              placeholder="Contraseña..."
                              className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
                              value={decryptPassword}
                              onChange={(e) => setDecryptPassword(e.target.value)}
                            />
                          )}
                          <button
                            onClick={executeDecrypt}
                            disabled={loading}
                            className="rounded-xl bg-slate-800 px-6 py-2 text-sm font-bold text-white"
                          >
                            DESCIFRAR
                          </button>
                        </div>
                        {decryptedText && <p className="mt-4 text-xs text-emerald-400 font-mono">Recuperado: {decryptedText}</p>}
                        {decryptError && <p className="mt-3 text-xs text-rose-400">{decryptError}</p>}
                      </div>
                    )}
                  </div>
                </VisualPanel>
              </>
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/5 bg-slate-950/20 text-center p-10">
                <p className="text-slate-500">Configura los parámetros y presiona "Procesar".</p>
              </div>
            )}
          </main>
        </div>
      )}

      {mode === "attack" && (
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            <VisualPanel title="ATAQUE" subtitle="Configuración de simulación">
              <div className="space-y-5">
                <label className="block text-sm text-slate-400">
                  Estrategia
                  <select
                    value={attackStrategy}
                    onChange={(e) => setAttackStrategy(e.target.value as AttackStrategy)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                  >
                    {attackStrategies.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>

                <label className="block text-sm text-slate-400">
                  Texto objetivo
                  <input
                    type="text"
                    value={attackValue}
                    onChange={(e) => setAttackValue(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none"
                    placeholder="Valor a buscar..."
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs text-slate-500">
                    Intentos
                    <input type="number" value={customMaxAttempts} onChange={(e) => setCustomMaxAttempts(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/5 bg-slate-950 px-3 py-2 text-white" />
                  </label>
                  <label className="text-xs text-slate-500">
                    Tiempo (ms)
                    <input type="number" value={customMaxDurationMs} onChange={(e) => setCustomMaxDurationMs(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/5 bg-slate-950 px-3 py-2 text-white" />
                  </label>
                </div>

                <button
                  onClick={loading ? () => abortControllerRef.current?.abort() : startAttack}
                  className={`w-full rounded-xl py-4 font-bold text-white transition-all ${loading ? "bg-slate-800 hover:bg-rose-600" : "bg-gradient-to-r from-rose-500 to-orange-600 hover:scale-[1.01]"}`}
                >
                  {loading ? "DETENER" : "INICIAR SIMULACIÓN"}
                </button>
                {attackError && <p className="text-xs text-rose-400">{attackError}</p>}
              </div>
            </VisualPanel>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard label="Progreso" value={`${(attackSnapshot?.progress || 0).toFixed(2)}%`} detail="Completado" accent="text-cyan-400" />
                <MetricCard label="Velocidad" value={`${Math.round(attackSnapshot?.speedPerSecond || 0).toLocaleString()} i/s`} detail="Intentos/seg" accent="text-amber-400" />
                <MetricCard label="Intentos" value={(attackSnapshot?.attempts || 0).toLocaleString()} detail="Acumulado" accent="text-blue-400" />
                <MetricCard label="Restante" value={formatDurationMs(attackSnapshot?.estimatedRemainingMs || 0)} detail="Estimado" accent="text-purple-400" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <VisualPanel title="RENDIMIENTO" subtitle="Velocidad (intentos/s)">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="step" hide />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "12px" }} />
                        <Area type="monotone" dataKey="speed" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </VisualPanel>

                <VisualPanel title="RECURSOS" subtitle="CPU y Memoria">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="step" hide />
                        <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Line type="monotone" dataKey="cpu" name="CPU (%)" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="memory" name="RAM (MB)" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </VisualPanel>
              </div>
            </div>
          </div>

          {showSummary && attackResult && (
            <VisualPanel title="RESUMEN FINAL" subtitle={attackResult.found ? "ÉXITO" : "FALLO"}>
              <div className="grid gap-8 md:grid-cols-3">
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">{attackResult.reason}</p>
                  {attackResult.found && (
                    <div className="rounded-xl bg-emerald-400/10 p-4">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase">Valor recuperado</p>
                      <p className="mt-1 font-mono text-lg text-emerald-200 break-all">{attackResult.foundCandidate}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-900/40 p-3">
                    <p className="text-[10px] text-slate-500 uppercase">Tiempo</p>
                    <p className="text-sm font-bold text-slate-200">{formatDurationMs(attackResult.elapsedMs)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/40 p-3">
                    <p className="text-[10px] text-slate-500 uppercase">Intentos</p>
                    <p className="text-sm font-bold text-slate-200">{attackResult.attempts.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/40 p-3">
                    <p className="text-[10px] text-slate-500 uppercase">Pico CPU</p>
                    <p className="text-sm font-bold text-cyan-400">{attackResult.peakCpuUtilization.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-xl bg-slate-900/40 p-3">
                    <p className="text-[10px] text-slate-500 uppercase">Pico RAM</p>
                    <p className="text-sm font-bold text-blue-400">{formatBytes(attackResult.peakMemoryBytes)}</p>
                  </div>
                </div>

                <div className="flex flex-col justify-center">
                  <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-slate-900/20">
                    <span className="text-[10px] text-slate-500 uppercase">Estado</span>
                    {renderStatusBadge(attackResult.attackStatus, attackResult.found)}
                  </div>
                  <button onClick={() => setShowSummary(false)} className="mt-4 text-[10px] text-slate-600 hover:text-slate-400 font-bold uppercase tracking-widest">Cerrar resumen</button>
                </div>
              </div>
            </VisualPanel>
          )}
        </div>
      )}

      {mode === "history" && (
        <div className="space-y-6">
          <VisualPanel title="HISTORIAL" subtitle="Registros de experimentos">
            <div className="mb-6 grid gap-4 md:grid-cols-4 lg:grid-cols-5">
              <input type="text" placeholder="Buscar..." className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white outline-none" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} />
              <select value={historyAlgoFilter} onChange={(e) => setHistoryAlgoFilter(e.target.value as any)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white">
                <option value="all">Algoritmos</option>
                {algorithms.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <select value={historyOpFilter} onChange={(e) => setHistoryOpFilter(e.target.value as any)} className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white">
                <option value="all">Operaciones</option>
                <option value="encryption">Cifrado</option>
                <option value="decryption">Descifrado</option>
                <option value="attack">Ataques</option>
              </select>
              <div className="flex gap-2">
                <button onClick={() => SimulationStorage.exportToCSV(filteredHistory)} className="flex-1 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700">EXPORTAR CSV</button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead className="bg-slate-900/80 uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="p-4 cursor-pointer" onClick={() => toggleSort("timestamp")}>Fecha</th>
                    <th className="p-4 cursor-pointer" onClick={() => toggleSort("algorithm")}>Algoritmo</th>
                    <th className="p-4">Operación</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4 cursor-pointer" onClick={() => toggleSort("executionTimeMs")}>Tiempo</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedHistory.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.02]">
                      <td className="p-4">{r.fecha} {r.hora}</td>
                      <td className="p-4 font-bold text-cyan-400">{r.algorithm}</td>
                      <td className="p-4 opacity-60 uppercase text-[9px] font-bold">{r.operation}</td>
                      <td className="p-4">{r.operation === "attack" ? renderStatusBadge(r.attackStatus, r.attackSuccess) : renderStatusBadge("", r.status === "success")}</td>
                      <td className="p-4">{formatDurationMs(r.executionTimeMs)}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => { if(confirm("¿Eliminar?")) { SimulationStorage.delete(r.id); refreshHistory(); } }} className="text-rose-500 hover:text-rose-400 font-bold">BORRAR</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center gap-2">
                {[...Array(totalPages)].map((_, i) => (
                  <button key={i} onClick={() => setCurrentPage(i + 1)} className={`px-3 py-1 rounded-lg text-xs font-bold ${currentPage === i + 1 ? "bg-cyan-400 text-slate-950" : "bg-slate-800 text-slate-400"}`}>{i + 1}</button>
                ))}
              </div>
            )}
          </VisualPanel>
        </div>
      )}
    </DashboardShell>
  );
}
