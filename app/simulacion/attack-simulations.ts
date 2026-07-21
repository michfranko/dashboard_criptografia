import {
  AES_ADDITIONAL_DATA,
  Algorithm,
  deriveAesKey,
  hashText,
  jwkModulusToHex,
  parseAesEnvelope,
} from "./crypto-systems";

// ─── Public types ─────────────────────────────────────────────────────────────

export type AttackStrategy = "dictionary" | "bruteforce" | "trial-division";

export interface AttackOptions {
  strategy: AttackStrategy;
  /** Maximum wall-clock duration before the attack is stopped. */
  maxDurationMs: number;
  /** Maximum number of candidate evaluations. */
  maxAttempts: number;
  dictionary?: string[];
  charset?: string[];
  maxCandidateLength?: number;
  /** Pass an AbortSignal to cancel the attack from outside. */
  abortSignal?: AbortSignal;
  /**
   * How long (ms) without any progress before the attack is considered stalled.
   * A value of 0 disables stall detection.
   * Default: 15 000 ms.
   */
  stallTimeoutMs?: number;
}

export interface AttackSnapshot {
  elapsedMs: number;
  attempts: number;
  speedPerSecond: number;
  /** 0-100 */
  progress: number;
  searchSize: bigint | number;
  memoryBytes: number;
  cpuUtilization: number;
  /** Estimated remaining milliseconds (-1 = unknown). */
  estimatedRemainingMs: number;
  status: "running" | "succeeded" | "failed";
  reason: string;
  currentCandidate?: string;
  /** Peak CPU utilization observed during this attack session. */
  peakCpuUtilization: number;
  /** Peak memory usage (bytes) observed during this attack session. */
  peakMemoryBytes: number;
}

export type AttackStatus =
  | "SUCCESS"
  | "FAILED"
  | "TIME_LIMIT"
  | "MAX_ATTEMPTS"
  | "USER_CANCELLED"
  | "STALL";

export interface AttackResult extends AttackSnapshot {
  found: boolean;
  foundCandidate?: string;
  /** Specific termination status. */
  attackStatus: AttackStatus;
  /** The attempt number where the key was found (0 if not found). */
  foundIteration?: number;
}

// ─── Common word list for dictionary attacks ──────────────────────────────────

const commonDictionary: string[] = [
  "123456", "password", "123456789", "12345678", "qwerty", "abc123",
  "password1", "111111", "1234567", "iloveyou", "admin", "welcome",
  "letmein", "monkey", "dragon", "sunshine", "princess", "master",
  "shadow", "football", "pass", "test", "hello", "secret", "root",
  "user", "guest", "login", "access", "1q2w3e", "qwerty123",
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function sampleMemoryUsage(): number {
  const perf = performance as typeof performance & {
    memory?: { usedJSHeapSize: number };
  };
  return perf.memory?.usedJSHeapSize ?? 0;
}

function formatProgress(attempts: number, total: bigint | number): number {
  if (typeof total === "bigint") {
    if (total === BigInt(0)) return 0;
    const scale = BigInt(10_000);
    return Number((BigInt(attempts) * scale) / total) / 100;
  }
  return total > 0 ? Math.min(100, (attempts / total) * 100) : 0;
}

function calculateCpuUtilization(elapsedMs: number, busyMs: number): number {
  return elapsedMs <= 0 ? 0 : Math.min(100, (busyMs / elapsedMs) * 100);
}

function estimateRemaining(
  attempts: number,
  total: bigint | number,
  speedPerSecond: number,
): number {
  if (speedPerSecond <= 0) return -1;
  const remaining =
    typeof total === "bigint"
      ? Number(total) - attempts
      : total - attempts;
  if (remaining <= 0) return 0;
  return (remaining / speedPerSecond) * 1000;
}

/**
 * Yields every few iterations to let the event loop breathe, but ONLY if
 * needed (skips the yield when the loop is running fast enough).
 */
async function breathe(attempts: number, every = 20): Promise<void> {
  if (attempts % every === 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

// ─── Termination helpers ──────────────────────────────────────────────────────

type StopReason =
  | "found"
  | "maxAttempts"
  | "maxDuration"
  | "aborted"
  | "stall"
  | "exhausted";

interface StopCheck {
  stopped: boolean;
  reason: StopReason;
}

function checkStop(
  attempts: number,
  elapsedMs: number,
  options: AttackOptions,
  lastProgressMs: number,
): StopCheck {
  if (options.abortSignal?.aborted) {
    return { stopped: true, reason: "aborted" };
  }
  if (attempts >= options.maxAttempts) {
    return { stopped: true, reason: "maxAttempts" };
  }
  if (elapsedMs >= options.maxDurationMs) {
    return { stopped: true, reason: "maxDuration" };
  }
  const stallTimeout = options.stallTimeoutMs ?? 15_000;
  if (stallTimeout > 0 && performance.now() - lastProgressMs > stallTimeout) {
    return { stopped: true, reason: "stall" };
  }
  return { stopped: false, reason: "exhausted" };
}

function reasonLabel(r: StopReason): string {
  switch (r) {
    case "maxAttempts": return "Se alcanzó el límite máximo de intentos configurado.";
    case "maxDuration": return "Se alcanzó el límite máximo de tiempo configurado.";
    case "aborted": return "Ataque cancelado por el usuario.";
    case "stall": return "Ataque detenido por falta de progreso prolongado.";
    case "exhausted": return "Se agotó el espacio de búsqueda sin encontrar el valor.";
    default: return "";
  }
}

function mapStopReasonToStatus(r: StopReason): AttackStatus {
  switch (r) {
    case "maxAttempts": return "MAX_ATTEMPTS";
    case "maxDuration": return "TIME_LIMIT";
    case "aborted": return "USER_CANCELLED";
    case "stall": return "STALL";
    default: return "FAILED";
  }
}

// ─── Brute-force generator ────────────────────────────────────────────────────

function* bruteForceGenerator(charset: string[], maxLength: number): Generator<string> {
  if (maxLength <= 0) return;
  const length = charset.length;
  for (let targetLength = 1; targetLength <= maxLength; targetLength += 1) {
    const indices = new Array<number>(targetLength).fill(0);
    while (true) {
      yield indices.map((i) => charset[i]).join("");
      let pos = targetLength - 1;
      while (pos >= 0) {
        indices[pos] += 1;
        if (indices[pos] < length) break;
        indices[pos] = 0;
        pos -= 1;
      }
      if (pos < 0) break;
    }
  }
}

// ─── Hash candidate helper ────────────────────────────────────────────────────

async function candidateHash(algorithm: Algorithm, candidate: string): Promise<string> {
  return algorithm === "md5" ? hashText("md5", candidate) : hashText("sha256", candidate);
}

// ─── Dictionary attack (MD5 / SHA-256) ───────────────────────────────────────

async function runDictionaryAttack(
  targetHash: string,
  algorithm: Algorithm,
  options: AttackOptions,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  const dictionary = [...(options.dictionary ?? []), ...commonDictionary];
  const total = dictionary.length;
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;
  let lastProgressMs = performance.now();
  let peakCpu = 0;
  let peakMem = 0;

  for (const candidate of dictionary) {
    const stepStart = performance.now();
    attempts += 1;
    const hash = await candidateHash(algorithm, candidate);
    busyMs += performance.now() - stepStart;
    lastProgressMs = performance.now(); // dictionary always makes progress

    const elapsedMs = performance.now() - started;
    const speed = attempts / Math.max(1, elapsedMs / 1000);
    const progress = formatProgress(attempts, total);
    const cpu = calculateCpuUtilization(elapsedMs, busyMs);
    const mem = sampleMemoryUsage();
    peakCpu = Math.max(peakCpu, cpu);
    peakMem = Math.max(peakMem, mem);

    const snap: AttackSnapshot = {
      elapsedMs,
      attempts,
      speedPerSecond: speed,
      progress,
      searchSize: total,
      memoryBytes: mem,
      cpuUtilization: cpu,
      estimatedRemainingMs: estimateRemaining(attempts, total, speed),
      status: "running",
      reason: "Explorando diccionario de contraseñas.",
      currentCandidate: candidate,
      peakCpuUtilization: peakCpu,
      peakMemoryBytes: peakMem,
    };
    onUpdate(snap);

    if (hash === targetHash) {
      return {
        ...snap,
        elapsedMs: performance.now() - started,
        progress: 100,
        status: "succeeded",
        reason: "Valor recuperado por ataque de diccionario.",
        estimatedRemainingMs: 0,
        found: true,
        foundCandidate: candidate,
        attackStatus: "SUCCESS",
        foundIteration: attempts,
      };
    }

    const stop = checkStop(attempts, elapsedMs, options, lastProgressMs);
    if (stop.stopped) {
      return {
        ...snap,
        status: "failed",
        reason: reasonLabel(stop.reason),
        found: false,
        attackStatus: mapStopReasonToStatus(stop.reason),
        foundIteration: 0,
      };
    }

    await breathe(attempts, 10);
  }

  const elapsedMs = performance.now() - started;
  const speed = attempts / Math.max(1, elapsedMs / 1000);
  const cpu = calculateCpuUtilization(elapsedMs, busyMs);
  const mem = sampleMemoryUsage();
  return {
    elapsedMs,
    attempts,
    speedPerSecond: speed,
    progress: formatProgress(attempts, total),
    searchSize: total,
    memoryBytes: mem,
    cpuUtilization: cpu,
    estimatedRemainingMs: 0,
    status: "failed",
    reason: reasonLabel("exhausted"),
    found: false,
    peakCpuUtilization: Math.max(peakCpu, cpu),
    peakMemoryBytes: Math.max(peakMem, mem),
    attackStatus: "FAILED",
    foundIteration: 0,
  };
}

// ─── Brute-force hash attack (MD5 / SHA-256 pre-image search) ────────────────

async function runBruteForceHashAttack(
  targetHash: string,
  algorithm: Algorithm,
  options: AttackOptions,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  const charset =
    options.charset && options.charset.length > 0
      ? options.charset
      : ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p",
         "q","r","s","t","u","v","w","x","y","z","0","1","2","3","4","5","6","7","8","9"];
  const maxLength = options.maxCandidateLength ?? 5;
  const totalCandidates = BigInt(charset.length) ** BigInt(maxLength);
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;
  let lastProgressMs = performance.now();
  let peakCpu = 0;
  let peakMem = 0;

  for (const candidate of bruteForceGenerator(charset, maxLength)) {
    const stepStart = performance.now();
    attempts += 1;
    const hash = await candidateHash(algorithm, candidate);
    busyMs += performance.now() - stepStart;
    lastProgressMs = performance.now();

    const elapsedMs = performance.now() - started;
    const speed = attempts / Math.max(1, elapsedMs / 1000);
    const progress = formatProgress(attempts, totalCandidates);
    const cpu = calculateCpuUtilization(elapsedMs, busyMs);
    const mem = sampleMemoryUsage();
    peakCpu = Math.max(peakCpu, cpu);
    peakMem = Math.max(peakMem, mem);

    const snap: AttackSnapshot = {
      elapsedMs,
      attempts,
      speedPerSecond: speed,
      progress,
      searchSize: totalCandidates,
      memoryBytes: mem,
      cpuUtilization: cpu,
      estimatedRemainingMs: estimateRemaining(attempts, totalCandidates, speed),
      status: "running",
      reason: "Explorando el espacio de búsqueda por fuerza bruta.",
      currentCandidate: candidate,
      peakCpuUtilization: peakCpu,
      peakMemoryBytes: peakMem,
    };
    onUpdate(snap);

    if (hash === targetHash) {
      return {
        ...snap,
        elapsedMs: performance.now() - started,
        progress: 100,
        status: "succeeded",
        reason: "Valor recuperado por fuerza bruta.",
        estimatedRemainingMs: 0,
        found: true,
        foundCandidate: candidate,
        attackStatus: "SUCCESS",
        foundIteration: attempts,
      };
    }

    const stop = checkStop(attempts, elapsedMs, options, lastProgressMs);
    if (stop.stopped) {
      return {
        ...snap,
        status: "failed",
        reason: reasonLabel(stop.reason),
        found: false,
        attackStatus: mapStopReasonToStatus(stop.reason),
        foundIteration: 0,
      };
    }

    await breathe(attempts, 20);
  }

  const elapsedMs = performance.now() - started;
  const speed = attempts / Math.max(1, elapsedMs / 1000);
  const cpu = calculateCpuUtilization(elapsedMs, busyMs);
  const mem = sampleMemoryUsage();
  return {
    elapsedMs,
    attempts,
    speedPerSecond: speed,
    progress: formatProgress(attempts, totalCandidates),
    searchSize: totalCandidates,
    memoryBytes: mem,
    cpuUtilization: cpu,
    estimatedRemainingMs: 0,
    status: "failed",
    reason: reasonLabel("exhausted"),
    found: false,
    peakCpuUtilization: Math.max(peakCpu, cpu),
    peakMemoryBytes: Math.max(peakMem, mem),
    attackStatus: "FAILED",
    foundIteration: 0,
  };
}

// ─── Public: attack hash (MD5 / SHA-256) ─────────────────────────────────────
// NOTE: targetHash is the pre-computed hash digest to attack.
// It should come from the encryption result (result.output), not be recalculated.

export async function attackHash(
  algorithm: Algorithm,
  targetHash: string,
  strategy: AttackStrategy,
  options: AttackOptions,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  if (strategy === "dictionary") {
    return runDictionaryAttack(targetHash, algorithm, options, onUpdate);
  }
  return runBruteForceHashAttack(targetHash, algorithm, options, onUpdate);
}

// ─── RSA trial-division ───────────────────────────────────────────────────────

async function* trialDivisorGenerator(maxAttempts: number): AsyncGenerator<bigint> {
  // Test 2 first, then odd numbers
  yield BigInt(2);
  let divisor = BigInt(3);
  const step = BigInt(2);
  let count = 1;
  while (count < maxAttempts) {
    yield divisor;
    divisor += step;
    count += 1;
  }
}

export async function attackRsa(
  publicJwk: JsonWebKey,
  options: AttackOptions,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  if (!publicJwk.n) throw new Error("Clave pública RSA sin módulo.");

  const modulusHex = jwkModulusToHex(publicJwk);
  const modulus = BigInt(`0x${modulusHex}`);
  const total = BigInt(options.maxAttempts);
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;
  let lastProgressMs = performance.now();
  let peakCpu = 0;
  let peakMem = 0;

  for await (const divisor of trialDivisorGenerator(options.maxAttempts)) {
    const stepStart = performance.now();
    attempts += 1;
    const remainder = modulus % divisor;
    busyMs += performance.now() - stepStart;
    lastProgressMs = performance.now();

    const elapsedMs = performance.now() - started;
    const speed = attempts / Math.max(1, elapsedMs / 1000);
    const progress = formatProgress(attempts, total);
    const cpu = calculateCpuUtilization(elapsedMs, busyMs);
    const mem = sampleMemoryUsage();
    peakCpu = Math.max(peakCpu, cpu);
    peakMem = Math.max(peakMem, mem);

    const snap: AttackSnapshot = {
      elapsedMs,
      attempts,
      speedPerSecond: speed,
      progress,
      searchSize: total,
      memoryBytes: mem,
      cpuUtilization: cpu,
      estimatedRemainingMs: estimateRemaining(attempts, total, speed),
      status: "running",
      reason: "Intentando factorizar el módulo RSA por división de prueba.",
      currentCandidate: divisor.toString(),
      peakCpuUtilization: peakCpu,
      peakMemoryBytes: peakMem,
    };
    onUpdate(snap);

    if (remainder === BigInt(0)) {
      const factor = divisor;
      const complement = modulus / factor;
      return {
        ...snap,
        elapsedMs: performance.now() - started,
        progress: 100,
        status: "succeeded",
        reason: "Clave privada reconstruida mediante factorización.",
        estimatedRemainingMs: 0,
        found: true,
        foundCandidate: `${factor.toString()} × ${complement.toString()}`,
        attackStatus: "SUCCESS",
        foundIteration: attempts,
      };
    }

    const stop = checkStop(attempts, elapsedMs, options, lastProgressMs);
    if (stop.stopped) {
      return {
        ...snap,
        status: "failed",
        reason: reasonLabel(stop.reason),
        found: false,
        attackStatus: mapStopReasonToStatus(stop.reason),
        foundIteration: 0,
      };
    }

    // RSA BigInt arithmetic is slow; yield every 10 iterations
    await breathe(attempts, 10);
  }

  const elapsedMs = performance.now() - started;
  const speed = attempts / Math.max(1, elapsedMs / 1000);
  const cpu = calculateCpuUtilization(elapsedMs, busyMs);
  const mem = sampleMemoryUsage();
  return {
    elapsedMs,
    attempts,
    speedPerSecond: speed,
    progress: formatProgress(attempts, total),
    searchSize: total,
    memoryBytes: mem,
    cpuUtilization: cpu,
    estimatedRemainingMs: 0,
    status: "failed",
    reason: "El ataque de factorización alcanzó el límite de exploración sin recuperar la clave privada.",
    found: false,
    peakCpuUtilization: Math.max(peakCpu, cpu),
    peakMemoryBytes: Math.max(peakMem, mem),
    attackStatus: "FAILED",
    foundIteration: 0,
  };
}

// ─── AES brute-force ──────────────────────────────────────────────────────────

export async function attackAes(
  envelope: string,
  knownPlaintext: string | null,
  options: AttackOptions,
  onUpdate: (s: AttackSnapshot) => void,
): Promise<AttackResult> {
  const parsed = parseAesEnvelope(envelope);
  const charset =
    options.charset && options.charset.length > 0
      ? options.charset
      : ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"];
  const targetLength = options.maxCandidateLength ?? 6;
  const totalSpace = BigInt(charset.length) ** BigInt(targetLength);
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;
  let lastProgressMs = performance.now();
  let peakCpu = 0;
  let peakMem = 0;

  for (const candidate of bruteForceGenerator(charset, targetLength)) {
    const stepStart = performance.now();
    attempts += 1;

    let decrypted: string | null = null;
    try {
      const key = await deriveAesKey(candidate, parsed.salt, "decrypt");
      const buffer = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: parsed.iv as BufferSource,
          additionalData: AES_ADDITIONAL_DATA as BufferSource,
          tagLength: 128,
        },
        key,
        parsed.ciphertext as BufferSource,
      );
      decrypted = new TextDecoder().decode(buffer);
    } catch {
      // Wrong key — decryption failure is expected
    }
    busyMs += performance.now() - stepStart;
    lastProgressMs = performance.now();

    const elapsedMs = performance.now() - started;
    const speed = attempts / Math.max(1, elapsedMs / 1000);
    const progress = formatProgress(attempts, totalSpace);
    const cpu = calculateCpuUtilization(elapsedMs, busyMs);
    const mem = sampleMemoryUsage();
    peakCpu = Math.max(peakCpu, cpu);
    peakMem = Math.max(peakMem, mem);

    const snap: AttackSnapshot = {
      elapsedMs,
      attempts,
      speedPerSecond: speed,
      progress,
      searchSize: totalSpace,
      memoryBytes: mem,
      cpuUtilization: cpu,
      estimatedRemainingMs: estimateRemaining(attempts, totalSpace, speed),
      status: "running",
      reason: "Explorando el espacio de contraseñas para AES.",
      currentCandidate: candidate,
      peakCpuUtilization: peakCpu,
      peakMemoryBytes: peakMem,
    };
    onUpdate(snap);

    // AES-GCM authentication tag validates correctness — if decryption succeeded
    // and (optionally) the plaintext matches, the key is found.
    if (decrypted !== null && (knownPlaintext === null || decrypted === knownPlaintext)) {
      return {
        ...snap,
        elapsedMs: performance.now() - started,
        progress: 100,
        status: "succeeded",
        reason: "Clave AES recuperada con éxito.",
        estimatedRemainingMs: 0,
        found: true,
        foundCandidate: candidate,
        attackStatus: "SUCCESS",
        foundIteration: attempts,
      };
    }

    const stop = checkStop(attempts, elapsedMs, options, lastProgressMs);
    if (stop.stopped) {
      return {
        ...snap,
        status: "failed",
        reason: reasonLabel(stop.reason),
        found: false,
        attackStatus: mapStopReasonToStatus(stop.reason),
        foundIteration: 0,
      };
    }

    // AES-PBKDF2 is expensive; breathe every 5 iterations
    await breathe(attempts, 5);
  }

  const elapsedMs = performance.now() - started;
  const speed = attempts / Math.max(1, elapsedMs / 1000);
  const cpu = calculateCpuUtilization(elapsedMs, busyMs);
  const mem = sampleMemoryUsage();
  return {
    elapsedMs,
    attempts,
    speedPerSecond: speed,
    progress: formatProgress(attempts, totalSpace),
    searchSize: totalSpace,
    memoryBytes: mem,
    cpuUtilization: cpu,
    estimatedRemainingMs: 0,
    status: "failed",
    reason: "El ataque de fuerza bruta a AES no encontró la clave dentro del presupuesto de cómputo.",
    found: false,
    peakCpuUtilization: Math.max(peakCpu, cpu),
    peakMemoryBytes: Math.max(peakMem, mem),
    attackStatus: "FAILED",
    foundIteration: 0,
  };
}
