import { AES_ADDITIONAL_DATA, Algorithm, deriveAesKey, hashText, jwkModulusToHex, parseAesEnvelope } from "./crypto-systems";

export type AttackStrategy = "dictionary" | "bruteforce" | "trial-division";

export interface AttackOptions {
  strategy: AttackStrategy;
  maxDurationMs: number;
  maxAttempts: number;
  dictionary?: string[];
  charset?: string[];
  maxCandidateLength?: number;
}

export interface AttackSnapshot {
  elapsedMs: number;
  attempts: number;
  speedPerSecond: number;
  progress: number;
  searchSize: bigint | number;
  memoryBytes: number;
  cpuUtilization: number;
  status: "running" | "succeeded" | "failed";
  reason: string;
  currentCandidate?: string;
}

export interface AttackResult extends AttackSnapshot {
  found: boolean;
  foundCandidate?: string;
}

const commonDictionary = [
  "123456",
  "password",
  "123456789",
  "12345678",
  "qwerty",
  "abc123",
  "password1",
  "111111",
  "1234567",
  "iloveyou",
  "admin",
  "welcome",
  "letmein",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "master",
  "shadow",
  "football",
];

function sampleMemoryUsage() {
  const perf = performance as typeof performance & { memory?: { usedJSHeapSize: number } };
  return perf.memory?.usedJSHeapSize ?? 0;
}

function buildCharsetFromText(value: string) {
  const set = new Set<string>();
  for (const char of value) set.add(char);
  if (set.size === 0) {
    return ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
  }
  return Array.from(set);
}

function* bruteForceGenerator(charset: string[], maxLength: number) {
  if (maxLength <= 0) return;
  const length = charset.length;
  for (let targetLength = 1; targetLength <= maxLength; targetLength += 1) {
    const indices = new Array<number>(targetLength).fill(0);
    while (true) {
      yield indices.map((index) => charset[index]).join("");
      let position = targetLength - 1;
      while (position >= 0) {
        indices[position] += 1;
        if (indices[position] < length) break;
        indices[position] = 0;
        position -= 1;
      }
      if (position < 0) break;
    }
  }
}

function formatProgress(attempts: number, total: bigint | number) {
  if (typeof total === "bigint") {
    const zero = BigInt(0);
    const scale = BigInt(10000);
    if (total === zero) return 0;
    return Number((BigInt(attempts) * scale) / total) / 100;
  }
  return total > 0 ? Math.min(100, (attempts / total) * 100) : 0;
}

function calculateCpuUtilization(elapsedMs: number, busyMs: number) {
  if (elapsedMs <= 0) return 0;
  return Math.min(100, (busyMs / elapsedMs) * 100);
}

async function calculateCandidateHash(algorithm: Algorithm, candidate: string): Promise<string> {
  return algorithm === "md5" ? hashText("md5", candidate) : hashText("sha256", candidate);
}

async function runDictionaryAttack(targetHash: string, algorithm: Algorithm, options: AttackOptions, onUpdate: (snapshot: AttackSnapshot) => void): Promise<AttackResult> {
  const dictionary = [...(options.dictionary ?? []), ...commonDictionary];
  const total = dictionary.length;
  const started = performance.now();
  let attempts = 0;
  let busyMs = 0;

  for (const candidate of dictionary) {
    const stepStart = performance.now();
    attempts += 1;
    const candidateHash = await calculateCandidateHash(algorithm, candidate);
    busyMs += performance.now() - stepStart;

    const elapsedMs = performance.now() - started;
    const progress = formatProgress(attempts, total);
    onUpdate({
      elapsedMs,
      attempts,
      speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
      progress,
      searchSize: total,
      memoryBytes: sampleMemoryUsage(),
      cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
      status: "running",
      reason: "Explorando diccionario de contraseñas.",
      currentCandidate: candidate,
    });

    if (candidateHash === targetHash) {
      return {
        elapsedMs: performance.now() - started,
        attempts,
        speedPerSecond: attempts / Math.max(1, (performance.now() - started) / 1000),
        progress: 100,
        searchSize: total,
        memoryBytes: sampleMemoryUsage(),
        cpuUtilization: calculateCpuUtilization(performance.now() - started, busyMs),
        status: "succeeded",
        reason: "Valor recuperado por ataque de diccionario.",
        found: true,
        foundCandidate: candidate,
      };
    }

    if (attempts >= options.maxAttempts || elapsedMs >= options.maxDurationMs) {
      break;
    }

    if (attempts % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const elapsedMs = performance.now() - started;
  return {
    elapsedMs,
    attempts,
    speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
    progress: formatProgress(attempts, total),
    searchSize: total,
    memoryBytes: sampleMemoryUsage(),
    cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
    status: "failed",
    reason: "El valor no fue encontrado dentro del diccionario explorado.",
    found: false,
  };
}

async function runBruteForceHashAttack(targetHash: string, algorithm: Algorithm, options: AttackOptions, onUpdate: (snapshot: AttackSnapshot) => void): Promise<AttackResult> {
  const charset = options.charset && options.charset.length > 0 ? options.charset : ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const maxLength = options.maxCandidateLength ?? 5;
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;
  const totalCandidates = BigInt(charset.length) ** BigInt(maxLength);

  for (const candidate of bruteForceGenerator(charset, maxLength)) {
    const stepStart = performance.now();
    attempts += 1;
    const candidateHash = await calculateCandidateHash(algorithm, candidate);
    busyMs += performance.now() - stepStart;

    const elapsedMs = performance.now() - started;
    const progress = formatProgress(attempts, totalCandidates);
    onUpdate({
      elapsedMs,
      attempts,
      speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
      progress,
      searchSize: totalCandidates,
      memoryBytes: sampleMemoryUsage(),
      cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
      status: "running",
      reason: "Explorando el espacio de búsqueda por fuerza bruta.",
      currentCandidate: candidate,
    });

    if (candidateHash === targetHash) {
      return {
        elapsedMs: performance.now() - started,
        attempts,
        speedPerSecond: attempts / Math.max(1, (performance.now() - started) / 1000),
        progress: 100,
        searchSize: totalCandidates,
        memoryBytes: sampleMemoryUsage(),
        cpuUtilization: calculateCpuUtilization(performance.now() - started, busyMs),
        status: "succeeded",
        reason: "Valor recuperado por fuerza bruta.",
        found: true,
        foundCandidate: candidate,
      };
    }

    if (attempts >= options.maxAttempts || elapsedMs >= options.maxDurationMs) {
      break;
    }

    if (attempts % 20 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const elapsedMs = performance.now() - started;
  return {
    elapsedMs,
    attempts,
    speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
    progress: formatProgress(attempts, totalCandidates),
    searchSize: totalCandidates,
    memoryBytes: sampleMemoryUsage(),
    cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
    status: "failed",
    reason: "El valor no fue encontrado dentro del espacio de búsqueda explorado.",
    found: false,
  };
}

export async function attackHash(algorithm: Algorithm, plainText: string, strategy: AttackStrategy, options: AttackOptions, onUpdate: (snapshot: AttackSnapshot) => void): Promise<AttackResult> {
  const targetHash = await hashText(algorithm, plainText);
  if (strategy === "dictionary") {
    return runDictionaryAttack(targetHash, algorithm, options, onUpdate);
  }
  return runBruteForceHashAttack(targetHash, algorithm, options, onUpdate);
}

async function* trialDivisorGenerator(maxAttempts: number) {
  let divisor = BigInt(3);
  const step = BigInt(2);
  let attempts = 0;
  while (attempts < maxAttempts) {
    yield divisor;
    divisor += step;
    attempts += 1;
  }
}

export async function attackRsa(publicJwk: JsonWebKey, options: AttackOptions, onUpdate: (snapshot: AttackSnapshot) => void): Promise<AttackResult> {
  if (!publicJwk.n) {
    throw new Error("Clave pública RSA sin módulo.");
  }
  const modulusHex = jwkModulusToHex(publicJwk);
  const modulus = BigInt(`0x${modulusHex}`);
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;
  const total = BigInt(options.maxAttempts);

  for await (const divisor of trialDivisorGenerator(options.maxAttempts)) {
    const stepStart = performance.now();
    attempts += 1;
    const remainder = modulus % divisor;
    busyMs += performance.now() - stepStart;

    const elapsedMs = performance.now() - started;
    const progress = formatProgress(attempts, total);
    onUpdate({
      elapsedMs,
      attempts,
      speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
      progress,
      searchSize: total,
      memoryBytes: sampleMemoryUsage(),
      cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
      status: "running",
      reason: "Attempting to factor modulus with trial division.",
      currentCandidate: divisor.toString(),
    });

    if (remainder === BigInt(0)) {
      const factor = divisor;
      const complement = modulus / factor;
      return {
        elapsedMs: performance.now() - started,
        attempts,
        speedPerSecond: attempts / Math.max(1, (performance.now() - started) / 1000),
        progress: 100,
        searchSize: total,
        memoryBytes: sampleMemoryUsage(),
        cpuUtilization: calculateCpuUtilization(performance.now() - started, busyMs),
        status: "succeeded",
        reason: "Clave privada reconstruida mediante factorización.",
        found: true,
        foundCandidate: `${factor.toString()} × ${complement.toString()}`,
      };
    }

    if (elapsedMs >= options.maxDurationMs) {
      break;
    }

    if (attempts % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const elapsedMs = performance.now() - started;
  return {
    elapsedMs,
    attempts,
    speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
    progress: formatProgress(attempts, total),
    searchSize: total,
    memoryBytes: sampleMemoryUsage(),
    cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
    status: "failed",
    reason: "El ataque de factorización alcanzó el límite de exploración sin recuperar la clave privada.",
    found: false,
  };
}

export async function attackAes(envelope: string, knownPlaintext: string | null, options: AttackOptions, onUpdate: (snapshot: AttackSnapshot) => void): Promise<AttackResult> {
  const parsed = parseAesEnvelope(envelope);
  const charset = options.charset && options.charset.length > 0 ? options.charset : ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
  const targetLength = options.maxCandidateLength ?? 6;
  const totalSpace = BigInt(charset.length) ** BigInt(targetLength);
  const started = performance.now();
  let busyMs = 0;
  let attempts = 0;

  for (const candidate of bruteForceGenerator(charset, targetLength)) {
    const stepStart = performance.now();
    attempts += 1;
    try {
      const key = await deriveAesKey(candidate, parsed.salt, "decrypt");
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: parsed.iv as BufferSource, additionalData: AES_ADDITIONAL_DATA as BufferSource, tagLength: 128 },
        key,
        parsed.ciphertext as BufferSource,
      );
      const decrypted = new TextDecoder().decode(decryptedBuffer);
      if (knownPlaintext !== null && decrypted === knownPlaintext) {
        busyMs += performance.now() - stepStart;
        const elapsedMs = performance.now() - started;
        return {
          elapsedMs,
          attempts,
          speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
          progress: 100,
          searchSize: totalSpace,
          memoryBytes: sampleMemoryUsage(),
          cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
          status: "succeeded",
          reason: "Clave AES recuperada con éxito.",
          found: true,
          foundCandidate: candidate,
        };
      }
    } catch {
      // decryption failed, continue
    }
    busyMs += performance.now() - stepStart;

    const elapsedMs = performance.now() - started;
    onUpdate({
      elapsedMs,
      attempts,
      speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
      progress: formatProgress(attempts, totalSpace),
      searchSize: totalSpace,
      memoryBytes: sampleMemoryUsage(),
      cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
      status: "running",
      reason: "Explorando el espacio de contraseñas para AES.",
      currentCandidate: candidate,
    });

    if (attempts >= options.maxAttempts || elapsedMs >= options.maxDurationMs) {
      break;
    }
    if (attempts % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const elapsedMs = performance.now() - started;
  return {
    elapsedMs,
    attempts,
    speedPerSecond: attempts / Math.max(1, elapsedMs / 1000),
    progress: formatProgress(attempts, totalSpace),
    searchSize: totalSpace,
    memoryBytes: sampleMemoryUsage(),
    cpuUtilization: calculateCpuUtilization(elapsedMs, busyMs),
    status: "failed",
    reason: "El ataque de fuerza bruta a AES no encontró la clave dentro del presupuesto de cómputo.",
    found: false,
  };
}
