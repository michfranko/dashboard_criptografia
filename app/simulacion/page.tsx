"use client";

import { useMemo, useState } from "react";
import DashboardShell from "../components/dashboard-shell";
import MetricCard from "../components/metric-card";
import VisualPanel from "../components/visual-panel";

type AlgorithmOption = "aes" | "sha" | "md5" | "rsa";

type SimulationResult = {
  algorithm: string;
  encrypted: string;
  decrypted: string | null;
  analysis: {
    length: number;
    entropy: number;
    diversity: number;
    searchSpace: number;
    probability: number;
    riskLevel: string;
  };
};

const algorithmOptions = [
  { value: "aes", label: "AES" },
  { value: "sha", label: "SHA" },
  { value: "md5", label: "MD5" },
  { value: "rsa", label: "RSA" },
] as const;

function byteArrayToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToByteArray(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function calculateEntropy(text: string) {
  if (!text) {
    return 0;
  }

  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const length = text.length;
  frequencies.forEach((count) => {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  });

  return entropy;
}

function calculateAnalysis(text: string) {
  const length = text.length;
  const entropy = calculateEntropy(text);
  const uniqueChars = new Set(text).size;
  const diversity = length > 0 ? uniqueChars / length : 0;
  const charset = 95;
  const searchSpace = length > 0 ? charset ** length : 1;
  const probability = searchSpace > 1 ? 1 / searchSpace : 0;
  const riskLevel = entropy > 4.5 ? "Alto" : entropy > 3 ? "Medio" : "Bajo";

  return {
    length,
    entropy,
    diversity,
    searchSpace,
    probability,
    riskLevel,
  };
}

async function encryptWithAes(text: string) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await crypto.subtle.importKey("raw", encoder.encode("crypto-lab-passphrase"), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(16), iterations: 100000, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);

  return {
    encrypted: byteArrayToBase64(new Uint8Array(encrypted)),
    decrypted: new TextDecoder().decode(decrypted),
  };
}

async function encryptWithRsa(text: string) {
  const encoder = new TextEncoder();
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"],
  );
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, keyPair.publicKey, encoder.encode(text));
  const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, keyPair.privateKey, encrypted);

  return {
    encrypted: byteArrayToBase64(new Uint8Array(encrypted)),
    decrypted: new TextDecoder().decode(decrypted),
  };
}

async function hashWithSha(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return {
    encrypted: toHex(new Uint8Array(digest)),
    decrypted: null,
  };
}

function hashWithMd5(text: string) {
  const md5 = (value: string) => {
    const rotateLeft = (value: number, shift: number) => (value << shift) | (value >>> (32 - shift));
    const utf8 = unescape(encodeURIComponent(value));
    const bytes = new Uint8Array(utf8.length);
    for (let index = 0; index < utf8.length; index += 1) {
      bytes[index] = utf8.charCodeAt(index);
    }

    const words = [] as number[];
    for (let index = 0; index < bytes.length; index += 1) {
      words[index >> 2] |= bytes[index] << ((index % 4) * 8);
    }

    words[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
    words[(((bytes.length + 8) >>> 6) << 4) + 14] = bytes.length * 8;

    let a = 0x67452301;
    let b = 0xefcdab89;
    let c = 0x98badcfe;
    let d = 0x10325476;

    for (let index = 0; index < words.length; index += 16) {
      let aa = a;
      let bb = b;
      let cc = c;
      let dd = d;

      for (let step = 0; step < 64; step += 1) {
        let f = 0;
        let g = 0;
        if (step < 16) {
          f = (b & c) | (~b & d);
          g = step;
        } else if (step < 32) {
          f = (d & b) | (~d & c);
          g = (5 * step + 1) % 16;
        } else if (step < 48) {
          f = b ^ c ^ d;
          g = (3 * step + 5) % 16;
        } else {
          f = c ^ (b | ~d);
          g = (7 * step) % 16;
        }

        const temp = d;
        d = c;
        c = b;
        b = (b + rotateLeft((a + f + ((0x0fffffff & (Math.imul(2, 0x5a827999))) + words[index + g]) >>> 0) | 0, 7)) >>> 0;
        a = temp;
      }

      a = (a + aa) >>> 0;
      b = (b + bb) >>> 0;
      c = (c + cc) >>> 0;
      d = (d + dd) >>> 0;
    }

    return [a, b, c, d]
      .map((value) => value.toString(16).padStart(8, "0"))
      .join("");
  };

  return {
    encrypted: md5(text),
    decrypted: null,
  };
}

export default function SimulacionPage() {
  const [algorithm, setAlgorithm] = useState<AlgorithmOption | "">("");
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysisSummary = useMemo(() => calculateAnalysis(inputValue), [inputValue]);

  const handleExecute = async () => {
    if (!algorithm || !inputValue.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let payload: { encrypted: string; decrypted: string | null };

      if (algorithm === "aes") {
        payload = await encryptWithAes(inputValue.trim());
      } else if (algorithm === "rsa") {
        payload = await encryptWithRsa(inputValue.trim());
      } else if (algorithm === "sha") {
        payload = await hashWithSha(inputValue.trim());
      } else {
        payload = hashWithMd5(inputValue.trim());
      }

      setResult({
        algorithm: algorithmOptions.find((item) => item.value === algorithm)?.label ?? algorithm,
        encrypted: payload.encrypted,
        decrypted: payload.decrypted,
        analysis: analysisSummary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible ejecutar la simulación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell
      eyebrow="Módulo interactivo"
      title="Laboratorio de simulación en tiempo real"
      description="El usuario elige un algoritmo, ingresa un dato, ejecuta el proceso y obtiene una vista de cifrado, descifrado y análisis probabilístico del contenido." 
      badge="Simulación activa"
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <VisualPanel title="Entrada del usuario" subtitle="Elige el algoritmo y ejecuta el análisis">
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">
              <span className="mb-2 block">Tipo de algoritmo</span>
              <select
                value={algorithm}
                onChange={(event) => setAlgorithm(event.target.value as AlgorithmOption)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none ring-0"
              >
                <option value="">Selecciona un algoritmo</option>
                {algorithmOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            {algorithm ? (
              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Información a procesar</span>
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  rows={8}
                  placeholder={`Ingresa el dato que deseas procesar con ${algorithmOptions.find((item) => item.value === algorithm)?.label}`}
                  className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-3 text-sm text-white outline-none"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={handleExecute}
              disabled={!algorithm || !inputValue.trim() || loading}
              className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {loading ? "Ejecutando..." : "Ejecutar"}
            </button>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          </div>
        </VisualPanel>

        <VisualPanel title="Resultados" subtitle="Cifrado, descifrado y análisis probabilístico">
          <div className="space-y-3 text-sm leading-7 text-slate-400">
            <MetricCard label="Algoritmo" value={result?.algorithm ?? "—"} detail="Seleccionado por el usuario" accent="text-cyan-200" />
            <MetricCard label="Longitud" value={result ? String(result.analysis.length) : "—"} detail="Cantidad de caracteres ingresados" accent="text-emerald-200" />
            <MetricCard label="Entropía" value={result ? result.analysis.entropy.toFixed(2) : "—"} detail="Medida de incertidumbre del texto" accent="text-fuchsia-200" />
            <MetricCard label="Riesgo estimado" value={result ? result.analysis.riskLevel : "—"} detail="Nivel de dificultad para un ataque probabilístico" accent="text-amber-200" />
          </div>

          {result ? (
            <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm">
              <div>
                <p className="mb-1 font-medium text-white">Resultado del proceso</p>
                <p className="break-all text-slate-300">{result.encrypted}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-white">Desencriptación</p>
                <p className="break-all text-slate-300">{result.decrypted ?? "No aplica para hashing (SHA/MD5)"}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-white">Análisis probabilístico</p>
                <ul className="space-y-1 text-slate-400">
                  <li>• Diversidad de caracteres: {(result.analysis.diversity * 100).toFixed(0)}%</li>
                  <li>• Espacio de búsqueda aproximado: {result.analysis.searchSpace.toExponential(2)}</li>
                  <li>• Probabilidad estimada de éxito por fuerza bruta: {(result.analysis.probability * 100).toExponential(2)}%</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Cuando ejecutes el proceso, aquí aparecerá el resultado del algoritmo elegido, la recuperación del dato y un resumen probabilístico del contenido.
            </p>
          )}
        </VisualPanel>
      </div>
    </DashboardShell>
  );
}
