"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import {
  Shield,
  Zap,
  Cpu,
  Database,
  Lock,
  Hash,
  Clock,
  Activity,
  FileText,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  StopCircle
} from "lucide-react";
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
  AttackStatus,
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

function snippetOf(value: string, len = 40): string {
  if (!value) return "—";
  return value.length <= len ? value : `${value.slice(0, len - 3)}…`;
}

function algorithmKeyOf(alg: Algorithm): string {
  return alg;
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
          algorithmKey: algorithmKeyOf(algorithm),
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
        algorithmKey: algorithmKeyOf(algorithm),
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
        algorithmKey: algorithmKeyOf(algorithm),
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
        algorithmKey: algorithmKeyOf(algorithm),
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
        averageCpuUsage: attack.cpuUtilization, // simplification
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

  // ────────────────────────────────────────────────────────────────────────────
  // Render Helpers
  // ────────────────────────────────────────────────────────────────────────────

  const renderStatusBadge = (status: string, success: boolean) => {
    let color = "bg-slate-800 text-slate-400";
    let label = status || (success ? "ÉXITO" : "FALLO");

    if (status === "SUCCESS" || label === "ÉXITO") color = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    else if (status === "FAILED" || label === "FALLO") color = "bg-rose-500/20 text-rose-400 border border-rose-500/30";
    else if (status === "TIME_LIMIT") color = "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    else if (status === "USER_CANCELLED") color = "bg-slate-500/20 text-slate-300 border border-slate-500/30";

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
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
          { id: "crypto", label: "Cifrado y Hashing", icon: Lock },
          { id: "attack", label: "Ataques de Fuerza Bruta", icon: Shield },
          { id: "history", label: "Historial de Experimentos", icon: FileText },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id as LabMode)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
              mode === t.id ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-slate-800/50"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CRYPTO TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "crypto" && (
        <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <aside className="space-y-6">
            <VisualPanel title="Configuración" icon={Database}>
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
                  <span className="mt-1 block text-right text-[10px] text-slate-500 uppercase tracking-wider">{inputBytes} bytes</span>
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
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-4 font-bold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Zap className="h-5 w-5" />}
                  PROCESAR AHORA
                </button>
                {error && <p className="text-xs text-rose-400">{error}</p>}
              </div>
            </VisualPanel>

            {/* FASE 4 - Tarjeta Técnica */}
            <VisualPanel title="Ficha Técnica" icon={Info}>
              <div className="grid grid-cols-2 gap-y-4 text-xs">
                <div>
                  <p className="text-slate-500">Tipo</p>
                  <p className="font-semibold text-slate-200">{ALGO_TECH_INFO[algorithm].type}</p>
                </div>
                <div>
                  <p className="text-slate-500">Longitud Clave</p>
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
                <div className="col-span-2">
                  <p className="text-slate-500">Complejidad Teórica</p>
                  <p className="font-mono text-slate-300">{ALGO_TECH_INFO[algorithm].complexity}</p>
                </div>
              </div>
            </VisualPanel>
          </aside>

          <main className="space-y-6">
            {result ? (
              <>
                {/* FASE 4 - KPIs de Cifrado */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <MetricCard label="Tiempo" value={`${result.durationMs.toFixed(2)} ms`} icon={Clock} color="cyan" />
                  <MetricCard label="Throughput" value={formatBytes(result.inputBytes / (result.durationMs / 1000 || 0.001)) + "/s"} icon={Activity} color="blue" />
                  <MetricCard label="Salida" value={`${result.outputBytes} B`} icon={FileText} color="purple" />
                  <MetricCard label="Expansión" value={`${(result.expansion / Math.max(1, result.inputBytes) * 100).toFixed(1)}%`} icon={Zap} color="amber" />
                </div>

                <VisualPanel title="Resultado de la Operación" icon={CheckCircle2}>
                  <div className="space-y-4">
                    <div className="relative group">
                      <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-all rounded-xl border border-white/5 bg-slate-950/50 p-4 font-mono text-xs text-cyan-200">
                        {result.output}
                      </pre>
                      <button
                        onClick={() => { navigator.clipboard.writeText(result.output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="absolute right-4 top-4 rounded-lg bg-slate-900/80 px-3 py-1.5 text-[10px] font-bold text-cyan-400 backdrop-blur transition hover:bg-cyan-400 hover:text-slate-950"
                      >
                        {copied ? "COPIADO" : "COPIAR"}
                      </button>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4">
                      <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Detalles del proceso</h4>
                      <ul className="space-y-2">
                        {result.details.map((d, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
                            <div className="h-1 w-1 rounded-full bg-cyan-500" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {result.reversible && (
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6">
                        <h4 className="mb-4 text-sm font-bold text-white">Prueba de descifrado (Reversibilidad)</h4>
                        <div className="flex gap-3">
                          {algorithm === "aes" && (
                            <input
                              type="password"
                              placeholder="Introduce la clave para revertir..."
                              className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
                              value={decryptPassword}
                              onChange={(e) => setDecryptPassword(e.target.value)}
                            />
                          )}
                          <button
                            onClick={executeDecrypt}
                            disabled={loading}
                            className="rounded-xl bg-slate-800 px-6 py-2 text-sm font-bold text-white hover:bg-slate-700"
                          >
                            DESCIFRAR
                          </button>
                        </div>
                        {decryptedText && (
                          <div className="mt-4 rounded-lg bg-emerald-500/10 p-4 text-xs text-emerald-400">
                            <p className="mb-1 font-bold">RECUPERADO:</p>
                            <p className="font-mono">{decryptedText}</p>
                          </div>
                        )}
                        {decryptError && <p className="mt-3 text-xs text-rose-400">{decryptError}</p>}
                      </div>
                    )}
                  </div>
                </VisualPanel>
              </>
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/5 bg-slate-950/20 text-center p-10">
                <div className="mb-4 rounded-full bg-slate-900 p-6">
                  <Lock className="h-10 w-10 text-slate-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-300">Esperando ejecución</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">Configura los parámetros a la izquierda y presiona "Procesar" para ver los resultados y métricas.</p>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ATTACK TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "attack" && (
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
            <VisualPanel title="Simulador de Ataque" icon={Shield}>
              <div className="space-y-5">
                <label className="block text-sm">
                  <span className="mb-2 block text-slate-400">Estrategia</span>
                  <select
                    value={attackStrategy}
                    onChange={(e) => setAttackStrategy(e.target.value as AttackStrategy)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                  >
                    {attackStrategies.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block text-slate-400">{algorithm === "aes" ? "Texto esperado" : "Texto original"}</span>
                  <input
                    type="text"
                    value={attackValue}
                    onChange={(e) => setAttackValue(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                    placeholder="Ingresa el valor..."
                  />
                  <p className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                    {attackStrategies.find(s => s.value === attackStrategy)?.description}
                  </p>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs">
                    <span className="mb-1 block text-slate-500">Intentos máx.</span>
                    <input
                      type="number"
                      value={customMaxAttempts}
                      onChange={(e) => setCustomMaxAttempts(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/5 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block text-slate-500">Tiempo máx (ms)</span>
                    <input
                      type="number"
                      value={customMaxDurationMs}
                      onChange={(e) => setCustomMaxDurationMs(Number(e.target.value))}
                      className="w-full rounded-lg border border-white/5 bg-slate-950 px-3 py-2 text-white"
                    />
                  </label>
                </div>

                {!loading ? (
                  <button
                    onClick={startAttack}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-600 py-4 font-bold text-white hover:scale-[1.01] active:scale-95 transition-all"
                  >
                    <Zap className="h-5 w-5 fill-current" />
                    INICIAR SIMULACIÓN
                  </button>
                ) : (
                  <button
                    onClick={() => abortControllerRef.current?.abort()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-4 font-bold text-white hover:bg-rose-600 transition-all"
                  >
                    <StopCircle className="h-5 w-5" />
                    DETENER ATAQUE
                  </button>
                )}
                {attackError && <p className="text-xs text-rose-400">{attackError}</p>}
              </div>
            </VisualPanel>

            <div className="space-y-6">
              {/* KPIs de Ataque */}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard
                  label="Progreso"
                  value={`${(attackSnapshot?.progress || 0).toFixed(2)}%`}
                  icon={Activity}
                  color="cyan"
                />
                <MetricCard
                  label="Velocidad"
                  value={`${Math.round(attackSnapshot?.speedPerSecond || 0).toLocaleString()} i/s`}
                  icon={Zap}
                  color="amber"
                />
                <MetricCard
                  label="Intentos"
                  value={(attackSnapshot?.attempts || 0).toLocaleString()}
                  icon={Database}
                  color="blue"
                />
                <MetricCard
                  label="Restante"
                  value={formatDurationMs(attackSnapshot?.estimatedRemainingMs || 0)}
                  icon={Clock}
                  color="purple"
                />
              </div>

              {/* FASE 5 - Gráficos dinámicos */}
              <div className="grid gap-6 lg:grid-cols-2">
                <VisualPanel title="Velocidad de Ataque (i/s)" icon={Activity}>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="step" hide />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "12px" }} />
                        <Area type="monotone" dataKey="speed" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSpeed)" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </VisualPanel>

                <VisualPanel title="Carga del Sistema (%)" icon={Cpu}>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="step" hide />
                        <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "12px" }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                        <Line type="monotone" dataKey="cpu" name="CPU" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="memory" name="RAM (MB)" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </VisualPanel>
              </div>

              {/* FASE 5 - Espacio de búsqueda y Intentos acumulados */}
              <div className="grid gap-6 lg:grid-cols-3">
                <VisualPanel title="Espacio de Búsqueda" icon={PieChart}>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={spaceExplorationData}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {spaceExplorationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => value.toLocaleString()}
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "10px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 text-center text-[10px] text-slate-500">
                    {attackSnapshot ? formatSearchSize(attackSnapshot.searchSize) : "Sin datos"} total
                  </div>
                </VisualPanel>

                <div className="lg:col-span-2">
                  <VisualPanel title="Intentos Acumulados" icon={BarChart}>
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="step" hide />
                          <YAxis stroke="#475569" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", fontSize: "12px" }} />
                          <Area type="step" dataKey="attempts" stroke="#818cf8" fill="#818cf8" fillOpacity={0.1} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </VisualPanel>
                </div>
              </div>
            </div>
          </div>

          {/* FASE 7 - Resumen Final (Panel que aparece al terminar) */}
          {showSummary && attackResult && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <VisualPanel
                title="Resumen Final del Experimento"
                icon={CheckCircle2}
                className="border-2 border-cyan-400/30 bg-cyan-400/5 shadow-2xl shadow-cyan-900/20"
              >
                <div className="grid gap-8 md:grid-cols-3">
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Resultado</h5>
                      <div className="mt-1 flex items-center gap-2">
                        {attackResult.found ? (
                          <>
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            <span className="text-xl font-bold text-emerald-400">EXITOSO</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-rose-400" />
                            <span className="text-xl font-bold text-rose-400">FALLIDO</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{attackResult.reason}</p>
                    </div>
                    {attackResult.found && (
                      <div className="rounded-xl bg-emerald-400/10 p-4">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase">Clave recuperada</p>
                        <p className="mt-1 font-mono text-lg text-emerald-200 break-all">{attackResult.foundCandidate}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Tiempo Total</p>
                      <p className="text-sm font-bold text-slate-200">{formatDurationMs(attackResult.elapsedMs)}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Intentos</p>
                      <p className="text-sm font-bold text-slate-200">{attackResult.attempts.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Velocidad Prom.</p>
                      <p className="text-sm font-bold text-slate-200">{Math.round(attackResult.speedPerSecond).toLocaleString()} i/s</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Espacio Recorrido</p>
                      <p className="text-sm font-bold text-slate-200">{attackResult.progress.toFixed(4)}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Pico CPU</p>
                      <p className="text-sm font-bold text-cyan-400">{attackResult.peakCpuUtilization.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-slate-900/40 p-3">
                      <p className="text-[10px] text-slate-500 uppercase">Pico Memoria</p>
                      <p className="text-sm font-bold text-blue-400">{formatBytes(attackResult.peakMemoryBytes)}</p>
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/5 bg-slate-900/40 p-3 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase">Estado Final</span>
                      {renderStatusBadge(attackResult.attackStatus, attackResult.found)}
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowSummary(false)}
                    className="rounded-xl bg-slate-800 px-6 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    DESCARTAR RESUMEN
                  </button>
                </div>
              </VisualPanel>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          HISTORY TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {mode === "history" && (
        <div className="space-y-6">
          <VisualPanel title="Historial de Simulaciones" icon={FileText}>
            {/* Filters */}
            <div className="mb-6 grid gap-4 md:grid-cols-4 lg:grid-cols-5">
              <input
                type="text"
                placeholder="Buscar por ID o texto..."
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              <select
                value={historyAlgoFilter}
                onChange={(e) => setHistoryAlgoFilter(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
              >
                <option value="all">Todos los algoritmos</option>
                {algorithms.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <select
                value={historyOpFilter}
                onChange={(e) => setHistoryOpFilter(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
              >
                <option value="all">Todas las operaciones</option>
                <option value="encryption">Encriptación</option>
                <option value="decryption">Desencriptación</option>
                <option value="attack">Ataques</option>
              </select>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white"
              >
                <option value="all">Todos los estados</option>
                <option value="success">Éxitos</option>
                <option value="failed">Fallos</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => SimulationStorage.exportToCSV(filteredHistory)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
                >
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button
                  onClick={() => { if(confirm("¿Limpiar todo el historial?")) { SimulationStorage.clear(); refreshHistory(); } }}
                  className="flex items-center justify-center rounded-xl bg-rose-500/10 px-4 py-2 text-rose-500 hover:bg-rose-500 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="cursor-pointer p-4 hover:text-white" onClick={() => toggleSort("timestamp")}>Fecha/Hora</th>
                    <th className="cursor-pointer p-4 hover:text-white" onClick={() => toggleSort("algorithm")}>Algoritmo</th>
                    <th className="cursor-pointer p-4 hover:text-white" onClick={() => toggleSort("operation")}>Operación</th>
                    <th className="p-4">Estado</th>
                    <th className="cursor-pointer p-4 hover:text-white" onClick={() => toggleSort("executionTimeMs")}>Tiempo</th>
                    <th className="cursor-pointer p-4 hover:text-white" onClick={() => toggleSort("attempts")}>Intentos</th>
                    <th className="p-4">CPU/Mem</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pagedHistory.map((r) => (
                    <tr key={r.id} className="group hover:bg-white/[0.02]">
                      <td className="p-4">
                        <p className="font-semibold text-slate-200">{r.fecha}</p>
                        <p className="text-[10px] text-slate-500">{r.hora}</p>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-cyan-400">{r.algorithm}</span>
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] font-bold uppercase">
                          {r.operation === "encryption" ? "🔒 Cifrado" : r.operation === "decryption" ? "🔓 Descifrado" : "⚔️ Ataque"}
                        </span>
                      </td>
                      <td className="p-4">
                        {r.operation === "attack"
                          ? renderStatusBadge(r.attackStatus, r.attackSuccess)
                          : renderStatusBadge("", r.status === "success")}
                      </td>
                      <td className="p-4">{formatDurationMs(r.executionTimeMs)}</td>
                      <td className="p-4">{r.attempts.toLocaleString()}</td>
                      <td className="p-4">
                        <p className="text-[10px] text-slate-400">Peak: {r.peakCpuUsage.toFixed(1)}%</p>
                        <p className="text-[10px] text-slate-400">{formatBytes(r.peakMemoryUsageMb * 1024 * 1024)}</p>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setDeleteConfirmId(r.id)}
                          className="rounded-lg p-2 text-slate-600 hover:bg-rose-500/10 hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pagedHistory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-500">No hay registros que coincidan con los filtros.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-slate-500">Mostrando {pagedHistory.length} de {filteredHistory.length} experimentos</p>
                <div className="flex gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`h-8 w-8 rounded-lg text-xs font-bold transition ${
                        currentPage === i + 1 ? "bg-cyan-400 text-slate-950" : "border border-white/10 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {i + 1}
                    </button>
                  )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </VisualPanel>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">¿Eliminar registro?</h3>
            <p className="mt-2 text-sm text-slate-400">Esta acción no se puede deshacer. Se eliminará el experimento de la base de datos local.</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700"
              >
                CANCELAR
              </button>
              <button
                onClick={() => deleteRecord(deleteConfirmId)}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-500"
              >
                ELIMINAR
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
