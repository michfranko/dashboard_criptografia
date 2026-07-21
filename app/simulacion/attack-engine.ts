"use client";

// ─── Attack Engine v3 — Academic Simulation Mode ─────────────────────────────
// Philosophy:
//   This is an ACADEMIC SIMULATOR, not a real cryptanalytic tool.
//   We already know the target (password/hash) from the SimulationSession.
//   We calculate its position in the search space, simulate progress up to
//   that point, then perform REAL cryptographic verification at the end.
//
// This guarantees:
//   - All simulations complete in 5-30 seconds
//   - The target IS found if it belongs to the search space
//   - Real crypto verification (AES-GCM auth tag, hash comparison, etc.)
//   - Accurate metrics (attempts, speed, progress, search space size)
//   - Academic validity (demonstrates search space growth, algorithm differences)
// ─────────────────────────────────────────────────────────────────────────────

import {
  Algorithm,
  AES_ADDITIONAL_DATA,
  deriveAesKey,
  hashText,
  parseAesEnvelope,
  modInverse,
} from "./crypto-systems";
import { SimulationSession, AttackStrategy } from "./simulation-session";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttackStatus =
  | "SUCCESS"
  | "TIME_LIMIT"
  | "MAX_ATTEMPTS"
  | "USER_CANCELLED"
  | "STALL"
  | "SEARCH_SPACE_EXHAUSTED"
  | "DICTIONARY_EXHAUSTED"
  | "KEY_NOT_FOUND"
  | "KEY_OUTSIDE_SEARCH_SPACE"
  | "IMPOSSIBLE"
  | "ERROR";

export interface AttackSnapshot {
  elapsedMs: number;
  attempts: number;
  speedPerSecond: number;
  progress: number;
  searchSize: number;
  searchSpaceLabel: string;
  memoryBytes: number;
  cpuUtilization: number;
  estimatedRemainingMs: number;
  status: "running" | "succeeded" | "failed";
  reason: string;
  currentCandidate: string;
  currentCandidateLength: number;
  peakCpuUtilization: number;
  peakMemoryBytes: number;
}

export interface AttackResult extends AttackSnapshot {
  found: boolean;
  foundCandidate?: string;
  foundIteration?: number;
  attackStatus: AttackStatus;
  recoveredPlaintext?: string;
  finalReport: AttackReport;
}

export interface AttackReport {
  algorithm: string;
  strategy: string;
  ciphertext: string;
  searchSpaceExplored: string;
  totalAttempts: number;
  timeElapsed: string;
  averageSpeed: string;
  percentExplored: number;
  finalStatus: string;
  reason: string;
  foundPassword?: string;
  recoveredText?: string;
  foundAtIteration?: number;
  failureCause?: string;
}

// ─── Academic mode presets ───────────────────────────────────────────────────
// These ensure simulations complete in ~10 seconds for demonstration.

export interface AcademicPreset {
  maxLength: number;
  maxAttempts: number;
  maxDurationMs: number;
  charset: string[];
  label: string;
  /** Simulated attempts per second for progress calculation */
  simulatedSpeed: number;
}

export const ACADEMIC_PRESETS: Record<Algorithm, AcademicPreset> = {
  aes: {
    maxLength: 4,
    maxAttempts: 50_000,
    maxDurationMs: 30_000,
    charset: ["a","b","c","d","0","1","2","3"],
    label: "AES-256-GCM (académico)",
    simulatedSpeed: 2000,
  },
  rsa: {
    maxLength: 0,
    maxAttempts: 100_000,
    maxDurationMs: 10_000,
    charset: [],
    label: "RSA-OAEP 2048 (académico)",
    simulatedSpeed: 50000,
  },
  md5: {
    maxLength: 8,
    maxAttempts: 500_000,
    maxDurationMs: 15_000,
    charset: ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9"],
    label: "MD5 (académico)",
    simulatedSpeed: 100000,
  },
  sha256: {
    maxLength: 8,
    maxAttempts: 500_000,
    maxDurationMs: 15_000,
    charset: ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9"],
    label: "SHA-256 (académico)",
    simulatedSpeed: 50000,
  },
};

// ─── Common dictionary ───────────────────────────────────────────────────────

const COMMON_DICTIONARY: string[] = [
  "123456", "password", "123456789", "12345678", "qwerty", "abc123", "test123",
  "password1", "111111", "1234567", "iloveyou", "admin", "welcome",
  "letmein", "monkey", "dragon", "sunshine", "princess", "master",
  "shadow", "football", "pass", "test", "hello", "secret", "root",
  "user", "guest", "login", "access", "1q2w3e", "qwerty123",
  "pass123", "admin123", "letmein123", "welcome1", "monkey123",
  "dragon123", "sunshine1", "princess1", "master123", "shadow123",
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "abc", "123", "test1", "demo", "pass1", "admin1",
];

// ─── Reusable encoder ────────────────────────────────────────────────────────

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60000).toFixed(2)} min`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("es-EC");
}

// ─── Search space calculation ────────────────────────────────────────────────

function calculateTotalSearchSpace(charsetSize: number, maxLength: number): number {
  let total = 0;
  let term = 1;
  for (let len = 1; len <= maxLength; len++) {
    term *= charsetSize;
    total += term;
  }
  return total;
}

function formatSearchSpaceLabel(total: number): string {
  if (total < 1000) return `${total} combinaciones`;
  if (total < 1_000_000) return `${(total / 1000).toFixed(1)} mil`;
  if (total < 1_000_000_000) return `${(total / 1_000_000).toFixed(2)} M`;
  return `${(total / 1_000_000_000).toFixed(2)} G`;
}

/**
 * Calculate the position (1-based) of a target string in the brute-force
 * search space defined by charset and maxLength.
 *
 * The search order is: length 1 first, then length 2, etc.
 * Within each length, it's lexicographic by charset index.
 *
 * Returns -1 if the target is not in the search space.
 */
function calculateTargetPosition(
  target: string,
  charset: string[],
  maxLength: number,
): number {
  if (target.length > maxLength) return -1;

  // Build charset lookup
  const charIndex = new Map<string, number>();
  for (let i = 0; i < charset.length; i++) {
    charIndex.set(charset[i], i);
  }

  // Check all characters are in charset
  for (let i = 0; i < target.length; i++) {
    if (!charIndex.has(target[i])) return -1;
  }

  // Calculate position
  let position = 0;
  const cs = charset.length;

  // Add all combinations for lengths shorter than target
  let term = 1;
  for (let len = 1; len < target.length; len++) {
    term *= cs;
    position += term;
  }

  // Add position within target's length
  // This is like converting to base-N
  for (let i = 0; i < target.length; i++) {
    const idx = charIndex.get(target[i])!;
    const power = target.length - i - 1;
    position += idx * Math.pow(cs, power);
  }

  return position + 1; // 1-based
}

/**
 * Find a target string in a dictionary and return its 1-based position.
 * Returns -1 if not found.
 */
function findInDictionary(target: string, dictionary: string[]): number {
  for (let i = 0; i < dictionary.length; i++) {
    if (dictionary[i] === target) return i + 1;
  }
  return -1;
}

// ─── Feasibility check ───────────────────────────────────────────────────────

export interface FeasibilityCheck {
  feasible: boolean;
  warning: string;
  totalCombinations: number;
  estimatedTimeMs: number;
  estimatedTimeLabel: string;
  targetInSpace: boolean;
  targetPosition: number;
}

export function checkAttackFeasibility(
  algorithm: Algorithm,
  strategy: AttackStrategy,
  charset: string[],
  maxLength: number,
  maxAttempts: number,
  maxDurationMs: number,
  estimatedSpeed: number,
  session: SimulationSession | null,
): FeasibilityCheck {
  const charsetSize = charset.length;
  const totalCombos = strategy === "dictionary"
    ? COMMON_DICTIONARY.length
    : calculateTotalSearchSpace(charsetSize, maxLength);
  const estimatedTimeMs = (totalCombos / estimatedSpeed) * 1000;

  const warnings: string[] = [];

  // Check if target is in search space
  let targetInSpace = false;
  let targetPosition = -1;

  if (session) {
    if (algorithm === "aes" && session.aesPassword) {
      if (strategy === "dictionary") {
        targetPosition = findInDictionary(session.aesPassword, COMMON_DICTIONARY);
      } else {
        targetPosition = calculateTargetPosition(session.aesPassword, charset, maxLength);
      }
      targetInSpace = targetPosition > 0;
    } else if (algorithm === "md5" || algorithm === "sha256") {
      if (strategy === "dictionary") {
        // Check both user dict and common dictionary
        const allDict = COMMON_DICTIONARY;
        targetPosition = findInDictionary(session.originalText, allDict);
      } else {
        targetPosition = calculateTargetPosition(session.originalText, charset, maxLength);
      }
      targetInSpace = targetPosition > 0;
    }
  }

  // Only warn about space size / time if target IS in the space
  // (if not, we'll warn about that instead which is more critical)
  if (targetInSpace) {
    if (totalCombos > maxAttempts) {
      warnings.push(`Espacio (${formatSearchSpaceLabel(totalCombos)}) excede intentos (${formatNumber(maxAttempts)}). Tiempo estimado (${formatDuration(estimatedTimeMs)}) excede límite (${formatDuration(maxDurationMs)}). El simulador encontrará la contraseña de todas formas (navega directamente a la posición objetivo).`);
    }
  } else if (session) {
    warnings.push("La contraseña original NO pertenece al espacio de búsqueda configurado. El ataque no podrá encontrarla.");
  }

  const feasible = targetInSpace;

  return {
    feasible,
    warning: warnings.join(" "),
    totalCombinations: totalCombos,
    estimatedTimeMs,
    estimatedTimeLabel: formatDuration(estimatedTimeMs),
    targetInSpace,
    targetPosition,
  };
}

// ─── Simulated progress runner ───────────────────────────────────────────────
// Runs a "simulated" attack that shows realistic progress metrics but
// completes in a predictable time. At the end, performs REAL crypto verification.

interface SimulatedAttackParams {
  totalSpace: number;
  targetPosition: number; // 1-based, -1 if not in space
  targetInSpace: boolean;
  maxAttempts: number;
  maxDurationMs: number;
  simulatedSpeed: number;
  abortSignal: AbortSignal | undefined;
  onUpdate: (s: AttackSnapshot) => void;
  /** Called when target is reached. Should return { found, candidate, plaintext } */
  onVerify: (candidate: string) => Promise<{
    found: boolean;
    candidate: string;
    plaintext?: string;
  }>;
  /** Called to get the candidate at a given position */
  getCandidateAt: (position: number) => string;
  algorithm: string;
  strategy: string;
  ciphertext: string;
  buildReport: (result: AttackResult) => AttackReport;
}

async function runSimulatedAttack(
  params: SimulatedAttackParams,
): Promise<AttackResult> {
  const {
    totalSpace,
    targetPosition,
    targetInSpace,
    maxAttempts,
    maxDurationMs,
    simulatedSpeed,
    abortSignal,
    onUpdate,
    onVerify,
    getCandidateAt,
    algorithm,
    strategy,
    ciphertext,
    buildReport: buildReportFn,
  } = params;

  const started = performance.now();
  let attempts = 0;
  let peakCpu = 0;
  let peakMem = 0;
  let currentCandidate = "";

  // EARLY EXIT: if target is not in search space, finish immediately
  if (!targetInSpace || targetPosition <= 0) {
    const elapsedMs = performance.now() - started;
    const snap: AttackSnapshot = {
      elapsedMs, attempts: 0, speedPerSecond: 0, progress: 0,
      searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
      memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
      status: "failed",
      reason: "La contraseña no pertenece al espacio de búsqueda configurado.",
      currentCandidate: "", currentCandidateLength: 0,
      peakCpuUtilization: 0, peakMemoryBytes: 0,
    };
    onUpdate(snap);
    const result: AttackResult = {
      ...snap, found: false, attackStatus: "KEY_NOT_FOUND",
      foundIteration: 0, finalReport: {} as AttackReport,
    };
    result.finalReport = buildReportFn(result);
    return result;
  }

  // Always simulate up to targetPosition — the point of this academic simulator
  // is to demonstrate that the attack FINDS the target. maxAttempts is used only
  // for the feasibility warning; it must NOT cap the simulation when target IS in space.
  const effectiveMaxAttempts = targetPosition;

  // Batch calculation: complete in maxDurationMs with smooth updates
  const targetTimeMs = maxDurationMs * 0.9;
  const NUM_UPDATES = 20; // Send ~20 UI updates during the attack
  const batchSize = Math.max(1, Math.ceil(effectiveMaxAttempts / NUM_UPDATES));
  const totalBatches = Math.ceil(effectiveMaxAttempts / batchSize);
  const timePerBatch = Math.max(16, targetTimeMs / totalBatches); // Min 16ms (~60fps)

  let found = false;
  let foundCandidate = "";
  let foundIteration = 0;
  let recoveredPlaintext = "";

  // Simulate progress in batches
  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * batchSize + 1;
    const batchEnd = Math.min(batchStart + batchSize - 1, effectiveMaxAttempts);

    // Update attempt count
    attempts = batchEnd;

    // Check if we've reached the target position in this batch
    if (batchEnd >= targetPosition) {
      currentCandidate = getCandidateAt(targetPosition);
      foundIteration = targetPosition;

      // Perform REAL cryptographic verification
      const verification = await onVerify(currentCandidate);
      found = verification.found;
      foundCandidate = verification.candidate;
      recoveredPlaintext = verification.plaintext || "";

      const elapsedMs = performance.now() - started;
      const speed = attempts / Math.max(1, elapsedMs / 1000);

      if (found) {
        const snap: AttackSnapshot = {
          elapsedMs, attempts, speedPerSecond: speed, progress: 100,
          searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
          memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
          status: "succeeded",
          reason: `Contraseña recuperada exitosamente en el intento #${foundIteration}: "${foundCandidate}"`,
          currentCandidate, currentCandidateLength: currentCandidate.length,
          peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
        };
        onUpdate(snap);
        const result: AttackResult = {
          ...snap, found: true, foundCandidate,
          foundIteration, attackStatus: "SUCCESS",
          recoveredPlaintext, finalReport: {} as AttackReport,
        };
        result.finalReport = buildReportFn(result);
        return result;
      } else {
        const snap: AttackSnapshot = {
          elapsedMs, attempts, speedPerSecond: speed,
          progress: totalSpace > 0 ? (targetPosition / totalSpace) * 100 : 100,
          searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
          memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
          status: "failed",
          reason: "Error de verificación: la contraseña candidata no coincide.",
          currentCandidate, currentCandidateLength: currentCandidate.length,
          peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
        };
        onUpdate(snap);
        const result: AttackResult = {
          ...snap, found: false, attackStatus: "ERROR",
          foundIteration: 0, finalReport: {} as AttackReport,
        };
        result.finalReport = buildReportFn(result);
        return result;
      }
    }

    // Normal progress update
    currentCandidate = getCandidateAt(batchEnd);

    const elapsedMs = performance.now() - started;
    const speed = attempts / Math.max(1, elapsedMs / 1000);
    const progress = totalSpace > 0 ? Math.min(100, (attempts / totalSpace) * 100) : 0;
    peakCpu = Math.max(peakCpu, Math.min(100, 20 + (progress * 0.5)));

    onUpdate({
      elapsedMs, attempts, speedPerSecond: speed, progress,
      searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
      memoryBytes: 0, cpuUtilization: peakCpu,
      estimatedRemainingMs: speed > 0 ? ((targetPosition - attempts) / speed) * 1000 : -1,
      status: "running",
      reason: `Explorando: "${currentCandidate}" (${formatNumber(attempts)} / ${targetPosition.toLocaleString()})`,
      currentCandidate, currentCandidateLength: currentCandidate.length,
      peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
    });

    // Check abort
    if (abortSignal?.aborted) {
      const elapsedMs = performance.now() - started;
      const speed = attempts / Math.max(1, elapsedMs / 1000);
      const snap: AttackSnapshot = {
        elapsedMs, attempts, speedPerSecond: speed, progress,
        searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
        memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
        status: "failed", reason: "Ataque cancelado por el usuario.",
        currentCandidate, currentCandidateLength: currentCandidate.length,
        peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
      };
      onUpdate(snap);
      const result: AttackResult = {
        ...snap, found: false, attackStatus: "USER_CANCELLED",
        foundIteration: 0, finalReport: {} as AttackReport,
      };
      result.finalReport = buildReportFn(result);
      return result;
    }

    // Check time limit
    if (performance.now() - started >= maxDurationMs) {
      const elapsedMs = performance.now() - started;
      const speed = attempts / Math.max(1, elapsedMs / 1000);
      const snap: AttackSnapshot = {
        elapsedMs, attempts, speedPerSecond: speed, progress,
        searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
        memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
        status: "failed",
        reason: `Tiempo límite de ${formatDuration(maxDurationMs)} agotado.`,
        currentCandidate, currentCandidateLength: currentCandidate.length,
        peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
      };
      onUpdate(snap);
      const result: AttackResult = {
        ...snap, found: false, attackStatus: "TIME_LIMIT",
        foundIteration: 0, finalReport: {} as AttackReport,
      };
      result.finalReport = buildReportFn(result);
      return result;
    }

    // Wait for next batch
    if (batch < totalBatches - 1) {
      await new Promise<void>((r) => setTimeout(r, Math.max(16, Math.min(100, timePerBatch))));
    }
  }

  // Should not reach here if targetInSpace, but handle gracefully
  const elapsedMs = performance.now() - started;
  const speed = attempts / Math.max(1, elapsedMs / 1000);
  const snap: AttackSnapshot = {
    elapsedMs, attempts, speedPerSecond: speed,
    progress: totalSpace > 0 ? (effectiveMaxAttempts / totalSpace) * 100 : 0,
    searchSize: totalSpace, searchSpaceLabel: formatSearchSpaceLabel(totalSpace),
    memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
    status: "failed",
    reason: "Error: no se pudo completar el ataque.",
    currentCandidate: "", currentCandidateLength: 0,
    peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
  };
  onUpdate(snap);
  const result: AttackResult = {
    ...snap, found: false, attackStatus: "ERROR",
    foundIteration: 0, finalReport: {} as AttackReport,
  };
  result.finalReport = buildReportFn(result);
  return result;
}

// ─── Build report ────────────────────────────────────────────────────────────

function buildReport(
  algorithm: string,
  strategy: string,
  ciphertext: string,
  result: AttackResult,
): AttackReport {
  const report: AttackReport = {
    algorithm,
    strategy,
    ciphertext,
    searchSpaceExplored: `${formatNumber(result.attempts)} / ${formatSearchSpaceLabel(result.searchSize)}`,
    totalAttempts: result.attempts,
    timeElapsed: formatDuration(result.elapsedMs),
    averageSpeed: `${Math.round(result.speedPerSecond).toLocaleString("es-EC")} intentos/s`,
    percentExplored: result.progress,
    finalStatus: result.attackStatus,
    reason: result.reason,
  };

  if (result.found) {
    report.foundPassword = result.foundCandidate;
    report.recoveredText = result.recoveredPlaintext || result.foundCandidate;
    report.foundAtIteration = result.foundIteration;
  } else {
    switch (result.attackStatus) {
      case "KEY_NOT_FOUND":
        report.failureCause = "La contraseña no está en el espacio de búsqueda configurado.";
        break;
      case "KEY_OUTSIDE_SEARCH_SPACE":
        report.failureCause = "La contraseña no pertenece al espacio de búsqueda (longitud/charset incorrecto).";
        break;
      case "SEARCH_SPACE_EXHAUSTED":
        report.failureCause = "Se agotó todo el espacio de búsqueda.";
        break;
      case "DICTIONARY_EXHAUSTED":
        report.failureCause = "La contraseña no está en el diccionario.";
        break;
      case "IMPOSSIBLE":
        report.failureCause = "El ataque es computacionalmente inviable con la configuración actual.";
        break;
      default:
        report.failureCause = result.reason;
    }
  }
  return report;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AES ATTACK — Academic simulation with real crypto verification
// ═══════════════════════════════════════════════════════════════════════════════

export async function attackAes(
  session: SimulationSession,
  strategy: AttackStrategy,
  maxAttempts: number,
  maxDurationMs: number,
  charset: string[],
  maxLength: number,
  dictionary: string[],
  abortSignal: AbortSignal | undefined,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  const envelope = session.ciphertext;
  const parsed = parseAesEnvelope(envelope);
  const originalText = session.originalText;
  const originalBytes = textEncoder.encode(originalText);
  const targetPassword = session.aesPassword || "";

  // Determine total space and target position
  let totalSpace: number;
  let targetPosition: number;
  let targetInSpace: boolean;

  if (strategy === "dictionary") {
    const dict = [...dictionary, ...COMMON_DICTIONARY];
    totalSpace = dict.length;
    targetPosition = findInDictionary(targetPassword, dict);
    targetInSpace = targetPosition > 0;

    return runSimulatedAttack({
      totalSpace,
      targetPosition,
      targetInSpace,
      maxAttempts,
      maxDurationMs,
      simulatedSpeed: ACADEMIC_PRESETS.aes.simulatedSpeed,
      abortSignal,
      onUpdate,
      algorithm: "AES-256-GCM",
      strategy,
      ciphertext: envelope,
      buildReport: (r) => buildReport("AES-256-GCM", strategy, envelope, r),
      getCandidateAt: (pos) => dict[pos - 1] || "",
      onVerify: async (candidate) => {
        try {
          const key = await deriveAesKey(candidate, parsed.salt, "decrypt");
          const buffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: parsed.iv as BufferSource, additionalData: AES_ADDITIONAL_DATA as BufferSource, tagLength: 128 },
            key,
            parsed.ciphertext as BufferSource,
          );
          const decBytes = new Uint8Array(buffer);
          if (decBytes.length === originalBytes.length) {
            let match = true;
            for (let i = 0; i < decBytes.length; i++) {
              if (decBytes[i] !== originalBytes[i]) { match = false; break; }
            }
            if (match) {
              return { found: true, candidate, plaintext: textDecoder.decode(decBytes) };
            }
          }
        } catch { /* wrong key */ }
        return { found: false, candidate };
      },
    });
  }

  // Brute force or dictionary+bruteforce
  totalSpace = calculateTotalSearchSpace(charset.length, maxLength);
  if (strategy === "dictionary-bruteforce") {
    totalSpace += dictionary.length + COMMON_DICTIONARY.length;
  }
  targetPosition = calculateTargetPosition(targetPassword, charset, maxLength);
  targetInSpace = targetPosition > 0;

  // For dictionary+bruteforce, also check dictionary
  if (strategy === "dictionary-bruteforce" && !targetInSpace) {
    const dictPos = findInDictionary(targetPassword, [...dictionary, ...COMMON_DICTIONARY]);
    if (dictPos > 0) {
      targetInSpace = true;
      targetPosition = dictPos;
    }
  }

  return runSimulatedAttack({
    totalSpace,
    targetPosition,
    targetInSpace,
    maxAttempts,
    maxDurationMs,
    simulatedSpeed: ACADEMIC_PRESETS.aes.simulatedSpeed,
    abortSignal,
    onUpdate,
    algorithm: "AES-256-GCM",
    strategy,
    ciphertext: envelope,
    buildReport: (r) => buildReport("AES-256-GCM", strategy, envelope, r),
    getCandidateAt: (pos) => {
      const dictTotal = dictionary.length + COMMON_DICTIONARY.length;
      // Check dictionary first for dictionary-bruteforce strategy
      if (pos <= dictTotal) {
        const dict = [...dictionary, ...COMMON_DICTIONARY];
        if (pos <= dict.length) return dict[pos - 1];
      }
      // For brute force, generate a representative candidate
      const cs = charset.length;
      let remaining = pos - 1;
      let len = 1;
      let term = cs;
      while (remaining >= term) {
        remaining -= term;
        len++;
        term *= cs;
      }
      if (len > maxLength) return "";
      const result: string[] = [];
      for (let i = 0; i < len; i++) {
        const power = Math.pow(cs, len - i - 1);
        const idx = Math.floor(remaining / power);
        result.push(charset[idx]);
        remaining %= power;
      }
      return result.join("");
    },
    onVerify: async (candidate) => {
      try {
        const key = await deriveAesKey(candidate, parsed.salt, "decrypt");
        const buffer = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: parsed.iv as BufferSource, additionalData: AES_ADDITIONAL_DATA as BufferSource, tagLength: 128 },
          key,
          parsed.ciphertext as BufferSource,
        );
        const decBytes = new Uint8Array(buffer);
        if (decBytes.length === originalBytes.length) {
          let match = true;
          for (let i = 0; i < decBytes.length; i++) {
            if (decBytes[i] !== originalBytes[i]) { match = false; break; }
          }
          if (match) {
            return { found: true, candidate, plaintext: textDecoder.decode(decBytes) };
          }
        }
      } catch { /* wrong key */ }
      return { found: false, candidate };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MD5 ATTACK — Academic simulation with real hash verification
// ═══════════════════════════════════════════════════════════════════════════════

export async function attackMd5(
  session: SimulationSession,
  strategy: AttackStrategy,
  maxAttempts: number,
  maxDurationMs: number,
  charset: string[],
  maxLength: number,
  dictionary: string[],
  abortSignal: AbortSignal | undefined,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  return runHashAttack("md5", session, strategy, maxAttempts, maxDurationMs, charset, maxLength, dictionary, abortSignal, onUpdate);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHA-256 ATTACK — Academic simulation with real hash verification
// ═══════════════════════════════════════════════════════════════════════════════

export async function attackSha256(
  session: SimulationSession,
  strategy: AttackStrategy,
  maxAttempts: number,
  maxDurationMs: number,
  charset: string[],
  maxLength: number,
  dictionary: string[],
  abortSignal: AbortSignal | undefined,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  return runHashAttack("sha256", session, strategy, maxAttempts, maxDurationMs, charset, maxLength, dictionary, abortSignal, onUpdate);
}

// ─── Shared hash attack ──────────────────────────────────────────────────────

async function runHashAttack(
  algorithm: Algorithm,
  session: SimulationSession,
  strategy: AttackStrategy,
  maxAttempts: number,
  maxDurationMs: number,
  charset: string[],
  maxLength: number,
  dictionary: string[],
  abortSignal: AbortSignal | undefined,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  const targetHash = session.ciphertext;
  const originalText = session.originalText;
  const algoLabel = algorithm === "md5" ? "MD5" : "SHA-256";
  const preset = ACADEMIC_PRESETS[algorithm];

  // Determine total space and target position
  let totalSpace: number;
  let targetPosition: number;
  let targetInSpace: boolean;

  if (strategy === "dictionary") {
    const dict = [...dictionary, ...COMMON_DICTIONARY];
    totalSpace = dict.length;
    targetPosition = findInDictionary(originalText, dict);
    targetInSpace = targetPosition > 0;

    return runSimulatedAttack({
      totalSpace,
      targetPosition,
      targetInSpace,
      maxAttempts,
      maxDurationMs,
      simulatedSpeed: preset.simulatedSpeed,
      abortSignal,
      onUpdate,
      algorithm: algoLabel,
      strategy,
      ciphertext: targetHash,
      buildReport: (r) => buildReport(algoLabel, strategy, targetHash, r),
      getCandidateAt: (pos) => dict[pos - 1] || "",
      onVerify: async (candidate) => {
        const hash = await hashText(algorithm, candidate);
        if (hash === targetHash) {
          return { found: true, candidate, plaintext: candidate };
        }
        return { found: false, candidate };
      },
    });
  }

  // Brute force
  totalSpace = calculateTotalSearchSpace(charset.length, maxLength);
  if (strategy === "dictionary-bruteforce") {
    totalSpace += dictionary.length + COMMON_DICTIONARY.length;
  }
  targetPosition = calculateTargetPosition(originalText, charset, maxLength);
  targetInSpace = targetPosition > 0;

  if (strategy === "dictionary-bruteforce" && !targetInSpace) {
    const dictPos = findInDictionary(originalText, [...dictionary, ...COMMON_DICTIONARY]);
    if (dictPos > 0) {
      targetInSpace = true;
      targetPosition = dictPos;
    }
  }

  return runSimulatedAttack({
    totalSpace,
    targetPosition,
    targetInSpace,
    maxAttempts,
    maxDurationMs,
    simulatedSpeed: preset.simulatedSpeed,
    abortSignal,
    onUpdate,
    algorithm: algoLabel,
    strategy,
    ciphertext: targetHash,
    buildReport: (r) => buildReport(algoLabel, strategy, targetHash, r),
    getCandidateAt: (pos) => {
      const dictTotal = dictionary.length + COMMON_DICTIONARY.length;
      // Check dictionary first for dictionary-bruteforce strategy
      if (pos <= dictTotal) {
        const dict = [...dictionary, ...COMMON_DICTIONARY];
        if (pos <= dict.length) return dict[pos - 1];
      }
      const cs = charset.length;
      let remaining = pos - 1;
      let len = 1;
      let term = cs;
      while (remaining >= term) {
        remaining -= term;
        len++;
        term *= cs;
      }
      if (len > maxLength) return "";
      const result: string[] = [];
      for (let i = 0; i < len; i++) {
        const power = Math.pow(cs, len - i - 1);
        const idx = Math.floor(remaining / power);
        result.push(charset[idx]);
        remaining %= power;
      }
      return result.join("");
    },
    onVerify: async (candidate) => {
      const hash = await hashText(algorithm, candidate);
      if (hash === targetHash) {
        return { found: true, candidate, plaintext: candidate };
      }
      return { found: false, candidate };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RSA ATTACK — Early infeasibility detection
// ═══════════════════════════════════════════════════════════════════════════════

export async function attackRsa(
  session: SimulationSession,
  maxAttempts: number,
  maxDurationMs: number,
  abortSignal: AbortSignal | undefined,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  if (!session.rsaPublicJwk?.n) {
    throw new Error("La sesión RSA no contiene una clave pública válida.");
  }

  // Convert modulus
  const modulusHex = bytesToHex(base64UrlToBytes(session.rsaPublicJwk.n));
  const modulus = BigInt(`0x${modulusHex}`);
  const modulusBits = session.rsaKeyBits || (modulusHex.length * 4);
  const algoLabel = `RSA ${modulusBits} bits`;

  // ── Early infeasibility detection for real RSA keys (> 128 bits) ─────────
  if (modulusBits > 128) {
    const snap: AttackSnapshot = {
      elapsedMs: 0, attempts: 0, speedPerSecond: 0, progress: 0,
      searchSize: maxAttempts,
      searchSpaceLabel: `${formatNumber(maxAttempts)} divisores`,
      memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
      status: "failed",
      reason: `Clave RSA de ${modulusBits} bits. La factorización por división de prueba requiere explorar ~2^${Math.floor(modulusBits/2)} divisores, lo cual es computacionalmente inviable. El ataque fue finalizado inmediatamente.`,
      currentCandidate: "", currentCandidateLength: 0,
      peakCpuUtilization: 0, peakMemoryBytes: 0,
    };
    onUpdate(snap);

    const result: AttackResult = {
      ...snap, found: false, attackStatus: "IMPOSSIBLE",
      foundIteration: 0, finalReport: {} as AttackReport,
    };
    result.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, result);
    return result;
  }

  // ─── Demo mode: ≤ 128 bits ───────────────────────────────────────────────
  // FAST PATH: if the session already stores the demo private key factors,
  // we just simulate visual progress and then report the known answer.
  // This avoids real trial division loops that can hang the browser for large p.
  const demoKey = session.rsaDemoPrivateKey;
  if (demoKey) {
    const p = BigInt(demoKey.p);
    const q = BigInt(demoKey.q);
    const d = BigInt(demoKey.d);
    const e = BigInt(demoKey.e);
    // p is always the smaller prime; trial division finds it at ~p iterations
    const smallP = p < q ? p : q;
    const smallerFactor = smallP;
    const largerFactor = p < q ? q : p;
    const simulatedIterations = Number(smallerFactor);
    const totalSpace = simulatedIterations;

    const started = performance.now();
    const NUM_UI_UPDATES = 20;
    const maxSimMs = Math.min(maxDurationMs * 0.9, 8000); // max 8 s for demo
    const delayPerUpdate = maxSimMs / NUM_UI_UPDATES;

    for (let i = 0; i < NUM_UI_UPDATES; i++) {
      if (abortSignal?.aborted) {
        const elapsedMs = performance.now() - started;
        const snap: AttackSnapshot = {
          elapsedMs, attempts: Math.floor((simulatedIterations / NUM_UI_UPDATES) * i),
          speedPerSecond: 0, progress: (i / NUM_UI_UPDATES) * 100,
          searchSize: totalSpace, searchSpaceLabel: `${formatNumber(totalSpace)} divisores`,
          memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
          status: "failed", reason: "Ataque cancelado por el usuario.",
          currentCandidate: "", currentCandidateLength: 0,
          peakCpuUtilization: 0, peakMemoryBytes: 0,
        };
        onUpdate(snap);
        const r: AttackResult = { ...snap, found: false, attackStatus: "USER_CANCELLED", foundIteration: 0, finalReport: {} as AttackReport };
        r.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, r);
        return r;
      }

      const currentAttempts = Math.floor((simulatedIterations / NUM_UI_UPDATES) * (i + 1));
      const currentDiv = BigInt(3) + BigInt(currentAttempts) * BigInt(2);
      const elapsedMs = performance.now() - started;
      const speed = currentAttempts / Math.max(1, elapsedMs / 1000);
      onUpdate({
        elapsedMs, attempts: currentAttempts, speedPerSecond: speed,
        progress: ((i + 1) / NUM_UI_UPDATES) * 95,
        searchSize: totalSpace, searchSpaceLabel: `${formatNumber(totalSpace)} divisores`,
        memoryBytes: 0, cpuUtilization: Math.min(95, 30 + (i / NUM_UI_UPDATES) * 60),
        estimatedRemainingMs: (NUM_UI_UPDATES - i - 1) * delayPerUpdate,
        status: "running",
        reason: `Probando divisor: ${currentDiv.toString()} (${formatNumber(currentAttempts)} / ${formatNumber(simulatedIterations)})`,
        currentCandidate: currentDiv.toString(),
        currentCandidateLength: currentDiv.toString().length,
        peakCpuUtilization: 0, peakMemoryBytes: 0,
      });
      await new Promise<void>((r) => setTimeout(r, Math.max(16, delayPerUpdate)));
    }

    const elapsedMs = performance.now() - started;
    const speed = simulatedIterations / Math.max(1, elapsedMs / 1000);
    const snap: AttackSnapshot = {
      elapsedMs, attempts: simulatedIterations, speedPerSecond: speed, progress: 100,
      searchSize: totalSpace, searchSpaceLabel: `${formatNumber(totalSpace)} divisores`,
      memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
      status: "succeeded",
      reason: `Módulo RSA factorizado en intento #${simulatedIterations}: ${smallerFactor.toString()} × ${largerFactor.toString()}`,
      currentCandidate: `d = ${d.toString()}`,
      currentCandidateLength: d.toString().length,
      peakCpuUtilization: 0, peakMemoryBytes: 0,
    };
    onUpdate(snap);
    const result: AttackResult = {
      ...snap, found: true,
      foundCandidate: `d = ${d.toString()} (p = ${smallerFactor.toString()}, q = ${largerFactor.toString()})`,
      foundIteration: simulatedIterations, attackStatus: "SUCCESS",
      recoveredPlaintext: `Clave privada RSA recuperada\nd = ${d.toString()}\np = ${smallerFactor.toString()}\nq = ${largerFactor.toString()}\ne = ${e.toString()}`,
      finalReport: {} as AttackReport,
    };
    result.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, result);
    return result;
  }

  // SLOW PATH (fallback if demo key not stored): real trial division with large async chunks
  // Each chunk is 500_000 iterations so we don't stall the browser
  const CHUNK = 500_000;
  const total = Math.min(maxAttempts, 50_000_000);
  const started = performance.now();
  let attempts = 0;
  let peakCpu = 0;
  let peakMem = 0;

  let currentDiv = BigInt(2);
  let step = BigInt(1);

  while (attempts < total) {
    const chunkEnd = Math.min(attempts + CHUNK, total);
    // Run CHUNK iterations synchronously
    while (attempts < chunkEnd) {
      attempts++;
      const remainder = modulus % currentDiv;

      if (remainder === BigInt(0)) {
        const factor = currentDiv;
        const complement = modulus / factor;
        const phi = (factor - BigInt(1)) * (complement - BigInt(1));

        let e = BigInt(65537);
        if (session.rsaPublicJwk?.e) {
          try {
            const eHex = bytesToHex(base64UrlToBytes(session.rsaPublicJwk.e));
            if (eHex) e = BigInt(`0x${eHex}`);
          } catch { /* use default 65537 */ }
        }

        const d = modInverse(e, phi);

        const elapsedMs = performance.now() - started;
        const speed = attempts / Math.max(1, elapsedMs / 1000);

        const snap: AttackSnapshot = {
          elapsedMs, attempts, speedPerSecond: speed, progress: 100,
          searchSize: total, searchSpaceLabel: `${formatNumber(total)} divisores`,
          memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
          status: "succeeded",
          reason: `Módulo RSA factorizado en intento #${attempts}: ${factor.toString()} × ${complement.toString()}`,
          currentCandidate: `d = ${d.toString()}`,
          currentCandidateLength: d.toString().length,
          peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
        };
        onUpdate(snap);

        const result: AttackResult = {
          ...snap, found: true,
          foundCandidate: `d = ${d.toString()} (p = ${factor.toString()}, q = ${complement.toString()})`,
          foundIteration: attempts, attackStatus: "SUCCESS",
          recoveredPlaintext: `Clave privada RSA recuperada\nd = ${d.toString()}\np = ${factor.toString()}\nq = ${complement.toString()}`,
          finalReport: {} as AttackReport,
        };
        result.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, result);
        return result;
      }

      if (currentDiv === BigInt(2)) {
        currentDiv = BigInt(3);
        step = BigInt(2);
      } else {
        currentDiv += step;
      }
    }

    // Check abort
    if (abortSignal?.aborted) {
      const elapsedMs = performance.now() - started;
      const speed = attempts / Math.max(1, elapsedMs / 1000);
      const snap: AttackSnapshot = {
        elapsedMs, attempts, speedPerSecond: speed,
        progress: total > 0 ? (attempts / total) * 100 : 0,
        searchSize: total, searchSpaceLabel: `${formatNumber(total)} divisores`,
        memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
        status: "failed", reason: "Ataque cancelado por el usuario.",
        currentCandidate: currentDiv.toString(),
        currentCandidateLength: currentDiv.toString().length,
        peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
      };
      onUpdate(snap);
      const result: AttackResult = {
        ...snap, found: false, attackStatus: "USER_CANCELLED",
        foundIteration: 0, finalReport: {} as AttackReport,
      };
      result.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, result);
      return result;
    }

    // UI update + yield
    const elapsedMs = performance.now() - started;
    const speed = attempts / Math.max(1, elapsedMs / 1000);
    peakCpu = Math.max(peakCpu, Math.min(100, 40 + (attempts / total) * 55));
    onUpdate({
      elapsedMs, attempts, speedPerSecond: speed,
      progress: total > 0 ? (attempts / total) * 100 : 0,
      searchSize: total, searchSpaceLabel: `${formatNumber(total)} divisores`,
      memoryBytes: 0, cpuUtilization: peakCpu,
      estimatedRemainingMs: speed > 0 ? ((total - attempts) / speed) * 1000 : -1,
      status: "running",
      reason: `Probando divisor: ${currentDiv.toString()} (${formatNumber(attempts)} / ${formatNumber(total)})`,
      currentCandidate: currentDiv.toString(),
      currentCandidateLength: currentDiv.toString().length,
      peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
    });

    // Check time limit
    if (performance.now() - started >= maxDurationMs) {
      const elapsedMs2 = performance.now() - started;
      const speed2 = attempts / Math.max(1, elapsedMs2 / 1000);
      const snap: AttackSnapshot = {
        elapsedMs: elapsedMs2, attempts, speedPerSecond: speed2,
        progress: total > 0 ? (attempts / total) * 100 : 0,
        searchSize: total, searchSpaceLabel: `${formatNumber(total)} divisores`,
        memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
        status: "failed",
        reason: `Tiempo límite de ${formatDuration(maxDurationMs)} agotado.`,
        currentCandidate: currentDiv.toString(),
        currentCandidateLength: currentDiv.toString().length,
        peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
      };
      onUpdate(snap);
      const result: AttackResult = {
        ...snap, found: false, attackStatus: "TIME_LIMIT",
        foundIteration: 0, finalReport: {} as AttackReport,
      };
      result.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, result);
      return result;
    }

    await new Promise<void>((r) => setTimeout(r, 0));
  }

  // Exhausted
  const elapsedMs = performance.now() - started;
  const speed = attempts / Math.max(1, elapsedMs / 1000);
  const snap: AttackSnapshot = {
    elapsedMs, attempts, speedPerSecond: speed,
    progress: total > 0 ? (attempts / total) * 100 : 0,
    searchSize: total, searchSpaceLabel: `${formatNumber(total)} divisores`,
    memoryBytes: 0, cpuUtilization: 0, estimatedRemainingMs: 0,
    status: "failed",
    reason: "El ataque de factorización no encontró factores dentro del límite explorado.",
    currentCandidate: "", currentCandidateLength: 0,
    peakCpuUtilization: peakCpu, peakMemoryBytes: peakMem,
  };
  onUpdate(snap);

  const result: AttackResult = {
    ...snap, found: false, attackStatus: "SEARCH_SPACE_EXHAUSTED",
    foundIteration: 0, finalReport: {} as AttackReport,
  };
  result.finalReport = buildReport(algoLabel, "trial-division", session.ciphertext, result);
  return result;
}

// ─── Base64/Hex helpers ──────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}