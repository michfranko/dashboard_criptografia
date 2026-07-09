"use client";

import { useMemo, useState } from "react";
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

type LabMode = "crypto" | "attack";
type AttackProfileKey = "online" | "cpu" | "gpu";

type AttackProfile = {
  label: string;
  detail: string;
  maxAttempts: number;
  maxDurationMs: number;
};

const algorithms = [
  { value: "aes" as const, label: "AES-256-GCM", description: "Cifrado simétrico autenticado con clave secreta." },
  { value: "rsa" as const, label: "RSA-OAEP 2048", description: "Cifrado asimétrico para mensajes breves." },
  { value: "md5" as const, label: "MD5", description: "Hash irreversible de 128 bits." },
  { value: "sha256" as const, label: "SHA-256", description: "Hash irreversible de 256 bits." },
];

const attackProfiles: Record<AttackProfileKey, AttackProfile> = {
  online: { label: "Atacante en línea", detail: "30s / 500 intentos", maxAttempts: 500, maxDurationMs: 30_000 },
  cpu: { label: "CPU local", detail: "60s / 120k intentos", maxAttempts: 120_000, maxDurationMs: 60_000 },
  gpu: { label: "GPU dedicada", detail: "120s / 1M intentos", maxAttempts: 1_000_000, maxDurationMs: 120_000 },
};

const attackStrategies: { value: AttackStrategy; label: string; description: string }[] = [
  { value: "dictionary", label: "Diccionario", description: "Busca coincidencias en una lista de valores comunes." },
  { value: "bruteforce", label: "Fuerza bruta", description: "Prueba todas las combinaciones posibles en el espacio definido." },
  { value: "trial-division", label: "Factorización", description: "Ataca el módulo RSA con divisores primos de prueba." },
];

const defaultCharset = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

function formatDurationMs(ms: number) {
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(2)} min`;
  return `${(ms / 3_600_000).toFixed(2)} h`;
}

function formatSearchSize(value: number | bigint) {
  if (typeof value === "bigint") {
    const thousand = BigInt(1000);
    const million = BigInt(1000000);
    const billion = BigInt(1000000000);
    if (value < thousand) return `${value} elementos`;
    if (value < million) return `${Number(value / thousand).toLocaleString("es-EC")} mil`;
    if (value < billion) return `${Number(value / million).toLocaleString("es-EC")} M`;
    return `${Number(value / billion).toLocaleString("es-EC")} G`;
  }
  return value.toLocaleString("es-EC");
}

function compareSnippet(value: string) {
  return value.length <= 40 ? value : `${value.slice(0, 36)}...`;
}

export default function SimulacionPage() {
  const [mode, setMode] = useState<LabMode>("crypto");
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
  const [attackProfileKey] = useState<AttackProfileKey>("cpu");
  const [attackStrategy, setAttackStrategy] = useState<AttackStrategy>("dictionary");
  const [attackValue, setAttackValue] = useState("");
  const [attackSnapshot, setAttackSnapshot] = useState<AttackSnapshot | null>(null);
  const [attackTimeline, setAttackTimeline] = useState<AttackSnapshot[]>([]);
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);
  const [attackError, setAttackError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const profile = attackProfiles[attackProfileKey];
  const inputBytes = useMemo(() => new TextEncoder().encode(input).length, [input]);

  const resetCrypto = () => {
    setResult(null);
    setRsaPrivateKey(null);
    setRsaPublicJwk(null);
    setDecryptPassword("");
    setDecryptedText(null);
    setError(null);
    setDecryptError(null);
    setCopied(false);
  };

  const resetAttack = () => {
    setAttackSnapshot(null);
    setAttackTimeline([]);
    setAttackResult(null);
    setAttackError(null);
  };

  const changeAlgorithm = (value: Algorithm) => {
    setAlgorithm(value);
    resetCrypto();
    resetAttack();
    if (value === "aes") setAttackStrategy("bruteforce");
    else if (value === "rsa") setAttackStrategy("trial-division");
    else setAttackStrategy("dictionary");
  };

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

      if (algorithm === "aes") {
        const { result: operation } = await encryptAes(input, password);
        setResult({
          ...operation,
          durationMs: performance.now() - started,
        });
      } else if (algorithm === "rsa") {
        if (inputBytes > 190) {
          setError("RSA-OAEP 2048 con SHA-256 admite hasta 190 bytes. Usa AES para textos más largos.");
          return;
        }
        const { pair } = await generateRsaKeyPair();
        const encrypted = await encryptRsa(input, pair.publicKey);
        setRsaPrivateKey(pair.privateKey);
        setRsaPublicJwk(await crypto.subtle.exportKey("jwk", pair.publicKey));
        setResult({
          algorithm: "rsa",
          algorithmLabel: "RSA-OAEP 2048",
          output: encrypted.ciphertext,
          inputBytes,
          outputBytes: encrypted.outputBytes,
          durationMs: performance.now() - started,
          reversible: true,
          details: [
            "Clave pública RSA de 2048 bits",
            "Exponente público 65537",
            "OAEP con SHA-256",
            "La clave privada se conserva localmente en memoria",
          ],
          metadata: {
            modulusBits: 2048,
          },
        });
      } else {
        const digest = await hashText(algorithm, input);
        setResult({
          algorithm,
          algorithmLabel: algorithm === "md5" ? "MD5" : "SHA-256",
          output: digest,
          inputBytes,
          outputBytes: algorithm === "md5" ? 16 : 32,
          durationMs: performance.now() - started,
          reversible: false,
          details: [
            `Salida fija de ${algorithm === "md5" ? 128 : 256} bits`,
            "Función unidireccional sin descifrado práctico",
            "Un cambio mínimo modifica el resumen drásticamente",
            "La recuperación solo es posible por búsqueda exhaustiva o diccionario",
          ],
          metadata: {
            hashAlgorithm: algorithm,
          },
        });
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

    try {
      if (algorithm === "aes") {
        if (!decryptPassword) throw new Error("Escribe la contraseña para intentar descifrar.");
        const plaintext = await decryptAes(result.output, decryptPassword);
        setDecryptedText(plaintext);
      } else if (algorithm === "rsa" && rsaPrivateKey) {
        const plaintext = await decryptRsa(result.output, rsaPrivateKey);
        setDecryptedText(plaintext);
      }
    } catch {
      setDecryptError("No se pudo descifrar: la clave es incorrecta o los datos fueron alterados.");
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

  const attackUpdate = (snapshot: AttackSnapshot) => {
    setAttackSnapshot(snapshot);
    setAttackTimeline((current) => [...current.slice(-59), snapshot]);
  };

  const startAttack = async () => {
    if (!attackValue) {
      setAttackError("Ingresa un valor o texto para iniciar la simulación.");
      return;
    }

    setAttackError(null);
    setAttackSnapshot(null);
    setAttackTimeline([]);
    setAttackResult(null);
    setLoading(true);

    const options: AttackOptions = {
      strategy: attackStrategy,
      maxAttempts: profile.maxAttempts,
      maxDurationMs: profile.maxDurationMs,
      charset: algorithm === "md5" || algorithm === "sha256" ? Array.from(new Set(attackValue)).concat(defaultCharset).slice(0, 16) : defaultCharset,
      maxCandidateLength: algorithm === "aes" ? Math.min(6, attackValue.length) : 5,
    };

    try {
      if (algorithm === "aes") {
        if (!result || result.algorithmLabel !== "AES-256-GCM") {
          setAttackError("Genera primero el paquete AES en la sección de cifrado.");
          return;
        }
        const attack = await attackAes(result.output, input, options, attackUpdate);
        setAttackResult(attack);
      } else if (algorithm === "rsa") {
        if (!rsaPublicJwk) {
          setAttackError("Genera primero la clave RSA en la sección de cifrado.");
          return;
        }
        const attack = await attackRsa(rsaPublicJwk, options, attackUpdate);
        setAttackResult(attack);
      } else {
        const attack = await attackHash(algorithm, attackValue, attackStrategy, options, attackUpdate);
        setAttackResult(attack);
      }
    } catch (cause) {
      setAttackError(cause instanceof Error ? cause.message : "La simulación encontró un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = attackTimeline.map((snapshot, index) => ({
    step: index + 1,
    progress: snapshot.progress,
    speed: snapshot.speedPerSecond,
    cpu: snapshot.cpuUtilization,
    memory: snapshot.memoryBytes / 1024 / 1024,
    elapsed: Number((snapshot.elapsedMs / 1000).toFixed(1)),
  }));

  return (
    <DashboardShell
      eyebrow="Laboratorio interactivo"
      title="Simulación criptográfica y de ataques"
      description="Experimenta con primitivas reales y observa métricas de ejecución en cada escenario. AES y RSA respetan su resistencia; MD5 y SHA-256 solo admiten recuperación si el valor está en el espacio explorado."
      badge="Web Crypto API"
    >
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2">
        {([['crypto', 'Cifrado y hashing'], ['attack', 'Simulación de ataques']] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${mode === value ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "crypto" ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <VisualPanel title="Configuración" subtitle="Datos procesados localmente en tu navegador">
            <div className="space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Algoritmo</span>
                <select value={algorithm} onChange={(event) => changeAlgorithm(event.target.value as Algorithm)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60">
                  {algorithms.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs text-slate-500">{algorithms.find((option) => option.value === algorithm)?.description}</span>
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 flex justify-between"><span>Texto a procesar</span><span className="text-slate-500">{inputBytes} bytes</span></span>
                <textarea value={input} onChange={(event) => { setInput(event.target.value); resetCrypto(); }} rows={7} maxLength={10000} placeholder="Escribe el contenido que deseas procesar…" className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60" />
              </label>

              {algorithm === "aes" ? (
                <div className="space-y-3 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 block">Contraseña de cifrado</span>
                    <input type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); resetCrypto(); }} placeholder="Mínimo 8 caracteres" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-400/60" />
                  </label>
                  <label className="block text-sm text-slate-300">
                    <span className="mb-2 block">Confirmar contraseña</span>
                    <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); resetCrypto(); }} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-400/60" />
                  </label>
                  <div>
                    <div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">Fortaleza estimada</span><span className="text-cyan-200">{Math.min(100, Math.max(0, password.length * 10))}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.min(100, Math.max(0, password.length * 10))}%` }} /></div>
                  </div>
                </div>
              ) : null}

              <button type="button" onClick={executeCrypto} disabled={!input || loading} className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                {loading ? "Procesando…" : algorithm === "md5" || algorithm === "sha256" ? "Generar resumen" : "Generar resultado"}
              </button>
              {error ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
              <p className="text-xs leading-5 text-slate-500">Las claves y contraseñas no se envían ni se almacenan. Si las pierdes, no es posible recuperar el contenido AES.</p>
            </div>
          </VisualPanel>

          <VisualPanel title="Resultado criptográfico" subtitle={result ? `${result.algorithmLabel} · operación completada` : "Esperando una operación"}>
            {!result ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-8 text-center text-sm leading-7 text-slate-500">Configura el algoritmo e inicia la operación para ver el resultado y sus métricas.</div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Entrada" value={`${result.inputBytes.toLocaleString("es-EC")} B`} detail="Tamaño UTF-8" accent="text-cyan-200" />
                  <MetricCard label="Salida" value={`${result.outputBytes.toLocaleString("es-EC")} B`} detail="Tamaño de salida" accent="text-emerald-200" />
                  <MetricCard label="Tiempo" value={formatDurationMs(result.durationMs)} detail="Ejecución local" accent="text-fuchsia-200" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3"><p className="font-medium text-white">{result.reversible ? "Paquete cifrado" : "Resumen criptográfico"}</p><button type="button" onClick={copyOutput} className="rounded-lg border border-white/10 px-3 py-1 text-xs text-cyan-200 hover:bg-white/5">{copied ? "Copiado" : "Copiar"}</button></div>
                  <p className="max-h-40 overflow-auto break-all font-mono text-xs leading-6 text-slate-300">{result.output}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="mb-3 text-sm font-medium text-white">Parámetros del algoritmo</p>
                  <ul className="grid gap-2 text-xs text-slate-400 sm:grid-cols-2">{result.details.map((detail) => <li key={detail}>✓ {detail}</li>)}</ul>
                </div>

                {result.reversible ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <p className="font-medium text-amber-100">Descifrado manual</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Solo se recupera el texto si se conoce la clave correcta. En hashes no existe descifrado.</p>
                    {algorithm === "aes" ? (
                      <>
                        <input type="password" value={decryptPassword} onChange={(event) => setDecryptPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void executeDecrypt(); }} placeholder="Contraseña para descifrar" className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400/60" />
                        <button type="button" onClick={executeDecrypt} disabled={loading || !decryptPassword} className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-40">Intentar descifrar</button>
                      </>
                    ) : algorithm === "rsa" ? (
                      <button type="button" onClick={executeDecrypt} disabled={loading || !rsaPrivateKey} className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-40">Descifrar con clave privada</button>
                    ) : null}
                    {decryptError ? <p role="alert" className="mt-3 text-sm text-rose-300">{decryptError}</p> : null}
                    {decryptedText !== null ? <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-xs font-medium text-emerald-200">Autenticación correcta · contenido recuperado</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white">{decryptedText}</p></div> : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-4 text-sm leading-6 text-slate-400"><strong className="text-fuchsia-200">No hay descifrado.</strong> Un hash no contiene una copia reversible del mensaje; solo puede compararse con otros valores.</div>
                )}
              </div>
            )}
          </VisualPanel>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <VisualPanel title="Escenario de fuerza bruta" subtitle="Simulación de ataque con métricas reales">
            <div className="space-y-5">
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Algoritmo objetivo</span>
                <select value={algorithm} onChange={(event) => changeAlgorithm(event.target.value as Algorithm)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60">
                  {algorithms.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Valor objetivo</span>
                <textarea value={attackValue} onChange={(event) => { setAttackValue(event.target.value); resetAttack(); }} rows={5} maxLength={500} placeholder="Ejemplo: Clave-Segura-2026!" className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60" />
              </label>

              {(algorithm === "md5" || algorithm === "sha256") ? (
                <label className="block text-sm text-slate-300">
                  <span className="mb-2 block">Estrategia de ataque</span>
                  <select value={attackStrategy} onChange={(event) => setAttackStrategy(event.target.value as AttackStrategy)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60">
                    {attackStrategies.filter((strategy) => strategy.value !== "trial-division").map((strategy) => (
                      <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                    ))}
                  </select>
                  <span className="mt-2 block text-xs text-slate-500">Diccionario para valores comunes o fuerza bruta para espacios pequeños.</span>
                </label>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                {algorithm === "aes" && "AES se cifra con clave secreta y el ataque intenta encontrarla por fuerza bruta. En condiciones normales, no se recupera la clave."}
                {algorithm === "rsa" && "RSA simula factorización del módulo público. Un módulo de 2048 bits no se rompe dentro del presupuesto realista."}
                {(algorithm === "md5" || algorithm === "sha256") && "Los hashes son irreversibles. La recuperación solo es posible si el valor está en el diccionario o en el espacio explorado."}
              </div>

              <button type="button" onClick={startAttack} disabled={!attackValue || loading} className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
                {loading ? "Simulando ataque…" : "Iniciar simulación de ataque"}
              </button>
              {attackError ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{attackError}</p> : null}
            </div>
          </VisualPanel>

          <VisualPanel title="Informe del ataque" subtitle="Métricas y gráficos dinámicos">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Valor objetivo" value={attackValue ? compareSnippet(attackValue) : "—"} detail="Texto bajo ataque" accent="text-cyan-200" />
                <MetricCard label="Perfil del atacante" value={profile.label} detail={profile.detail} accent="text-emerald-200" />
                <MetricCard label="Estado" value={attackResult ? attackResult.status.toUpperCase() : attackSnapshot ? attackSnapshot.status.toUpperCase() : "LISTO"} detail={attackSnapshot?.reason ?? "Esperando ejecución"} accent="text-fuchsia-200" />
                <MetricCard label="Tiempo" value={attackSnapshot ? formatDurationMs(attackSnapshot.elapsedMs) : "—"} detail="Duración real" accent="text-amber-200" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Intentos" value={attackSnapshot ? attackSnapshot.attempts.toLocaleString("es-EC") : "—"} detail="Intentos realizados" accent="text-cyan-200" />
                <MetricCard label="Velocidad" value={attackSnapshot ? `${attackSnapshot.speedPerSecond.toFixed(1)} c/s` : "—"} detail="Intentos por segundo" accent="text-emerald-200" />
                <MetricCard label="Progreso" value={attackSnapshot ? `${attackSnapshot.progress.toFixed(1)} %` : "—"} detail="Porcentaje explorado" accent="text-fuchsia-200" />
                <MetricCard label="Espacio" value={attackSnapshot ? formatSearchSize(attackSnapshot.searchSize) : "—"} detail="Volumen teórico" accent="text-amber-200" />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-medium text-white">Uso de memoria</p>
                  <p className="text-2xl font-semibold text-white">{attackSnapshot ? `${(attackSnapshot.memoryBytes / 1024 / 1024).toFixed(2)} MiB` : "—"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="mb-3 text-sm font-medium text-white">CPU estimada</p>
                  <p className="text-2xl font-semibold text-white">{attackSnapshot ? `${attackSnapshot.cpuUtilization.toFixed(1)} %` : "—"}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="space-y-4">
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="step" stroke="#94a3b8" fontSize={12} />
                        <YAxis yAxisId="left" stroke="#22d3ee" fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                        <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: "12px" }} />
                        <Line yAxisId="left" type="monotone" dataKey="progress" stroke="#22d3ee" strokeWidth={3} dot={false} name="Progreso (%)" />
                        <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#34d399" strokeWidth={3} dot={false} name="Velocidad (c/s)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="step" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#f97316" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }} />
                        <Area type="monotone" dataKey="cpu" stroke="#fb923c" fill="#fb923c" fillOpacity={0.25} name="CPU (%)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </VisualPanel>
        </div>
      )}
    </DashboardShell>
  );
}
