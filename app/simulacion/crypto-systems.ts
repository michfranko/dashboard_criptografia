const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type Algorithm = "aes" | "rsa" | "md5" | "sha256";

export interface CryptoOperationResult {
  algorithm: Algorithm;
  algorithmLabel: string;
  output: string;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
  reversible: boolean;
  details: string[];
  metadata: Record<string, string | number>;
}

const AES_PREFIX = "CRYPTOLAB:AES-GCM:V1";
const AES_ITERATIONS = 310_000;
const AES_SALT_BYTES = 16;
const AES_IV_BYTES = 12;
export const AES_ADDITIONAL_DATA = encoder.encode("dashboard-criptografia/aes-gcm/v1");

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64UrlToBytes(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  return base64ToBytes(base64);
}

export function calculateSha256Hash(value: string) {
  return crypto.subtle.digest("SHA-256", encoder.encode(value)).then((digest) => bytesToHex(new Uint8Array(digest)));
}

const md5Constants = (() => {
  const k = new Uint32Array(64);
  for (let i = 0; i < 64; i += 1) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);
  }
  return k;
})();

function leftRotate(value: number, amount: number) {
  return ((value << amount) | (value >>> (32 - amount))) >>> 0;
}

function md5(data: Uint8Array) {
  const originalLength = data.length;
  const withPadding = new Uint8Array(((originalLength + 8) >> 6) * 64 + 64);
  withPadding.set(data);
  withPadding[originalLength] = 0x80;
  const bitLength = originalLength * 8;
  for (let i = 0; i < 8; i += 1) {
    withPadding[withPadding.length - 8 + i] = (bitLength >>> (8 * i)) & 0xff;
  }

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const shiftAmounts = [
    7, 12, 17, 22,
    5, 9, 14, 20,
    4, 11, 16, 23,
    6, 10, 15, 21,
  ];

  for (let chunkStart = 0; chunkStart < withPadding.length; chunkStart += 64) {
    const w = new Uint32Array(16);
    for (let i = 0; i < 16; i += 1) {
      w[i] = withPadding[chunkStart + i * 4] |
        (withPadding[chunkStart + i * 4 + 1] << 8) |
        (withPadding[chunkStart + i * 4 + 2] << 16) |
        (withPadding[chunkStart + i * 4 + 3] << 24);
    }

    let aa = a;
    let bb = b;
    let cc = c;
    let dd = d;

    for (let i = 0; i < 64; i += 1) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (bb & cc) | (~bb & dd);
        g = i;
      } else if (i < 32) {
        f = (dd & bb) | (~dd & cc);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * i + 5) % 16;
      } else {
        f = cc ^ (bb | ~dd);
        g = (7 * i) % 16;
      }

      const rotate = shiftAmounts[(i % 4) + Math.floor(i / 16) * 4];
      const temp = dd;
      dd = cc;
      cc = bb;
      const sum = (aa + f + md5Constants[i] + w[g]) >>> 0;
      bb = (bb + leftRotate(sum, rotate)) >>> 0;
      aa = temp;
    }

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }

  const output = new Uint8Array(16);
  const words = [a, b, c, d];
  for (let i = 0; i < words.length; i += 1) {
    output[i * 4] = words[i] & 0xff;
    output[i * 4 + 1] = (words[i] >>> 8) & 0xff;
    output[i * 4 + 2] = (words[i] >>> 16) & 0xff;
    output[i * 4 + 3] = (words[i] >>> 24) & 0xff;
  }

  return output;
}

export async function deriveAesKey(password: string, salt: Uint8Array, usage: KeyUsage) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: AES_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export function parseAesEnvelope(envelope: string) {
  const parts = envelope.split("$");
  if (parts.length !== 5 || parts[0] !== AES_PREFIX) {
    throw new Error("El paquete AES no tiene un formato válido.");
  }
  const [, iterationsStr, saltB64, ivB64, ciphertextB64] = parts;
  const iterations = Number(iterationsStr);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    throw new Error("El paquete AES contiene un número de iteraciones inválido.");
  }
  return {
    iterations,
    salt: base64ToBytes(saltB64),
    iv: base64ToBytes(ivB64),
    ciphertext: base64ToBytes(ciphertextB64),
  };
}

export async function encryptAes(plaintext: string, password: string): Promise<{ result: CryptoOperationResult; envelope: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(AES_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const started = performance.now();
  const key = await deriveAesKey(password, salt, "encrypt");
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: AES_ADDITIONAL_DATA as BufferSource, tagLength: 128 },
    key,
    encoder.encode(plaintext),
  );
  const ciphertext = new Uint8Array(encrypted);
  const envelope = [AES_PREFIX, AES_ITERATIONS, bytesToBase64(salt), bytesToBase64(iv), bytesToBase64(ciphertext)].join("$");

  return {
    envelope,
    result: {
      algorithm: "aes",
      algorithmLabel: "AES-256-GCM",
      output: envelope,
      inputBytes: encoder.encode(plaintext).length,
      outputBytes: ciphertext.length,
      durationMs: performance.now() - started,
      reversible: true,
      details: [
        "Clave AES de 256 bits derivada con PBKDF2-SHA-256",
        `${AES_ITERATIONS.toLocaleString("es-EC")} iteraciones de derivación`,
        `Salt de ${AES_SALT_BYTES * 8} bits`,
        `IV de ${AES_IV_BYTES * 8} bits`,
        "Modo AES-GCM con autenticación integrada",
      ],
      metadata: {
        keySize: 256,
        mode: "GCM",
        saltBits: AES_SALT_BYTES * 8,
        ivBits: AES_IV_BYTES * 8,
        iterations: AES_ITERATIONS,
      },
    },
  };
}

export async function decryptAes(envelope: string, password: string) {
  const parsed = parseAesEnvelope(envelope);
  const key = await deriveAesKey(password, parsed.salt, "decrypt");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: parsed.iv as BufferSource, additionalData: AES_ADDITIONAL_DATA as BufferSource, tagLength: 128 },
    key,
    parsed.ciphertext as BufferSource,
  );
  return decoder.decode(decrypted);
}

export async function generateRsaKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    false,
    ["encrypt", "decrypt"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, publicJwk };
}

export async function encryptRsa(plaintext: string, publicKey: CryptoKey) {
  const started = performance.now();
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, encoder.encode(plaintext));
  const ciphertext = new Uint8Array(encrypted);
  return {
    ciphertext: bytesToBase64(ciphertext),
    outputBytes: ciphertext.length,
    durationMs: performance.now() - started,
  };
}

export async function decryptRsa(ciphertextB64: string, privateKey: CryptoKey) {
  const ciphertext = base64ToBytes(ciphertextB64);
  const decrypted = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, ciphertext as BufferSource);
  return decoder.decode(decrypted);
}

export function md5Digest(value: string) {
  return bytesToHex(md5(encoder.encode(value)));
}

export async function sha256Digest(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashText(algorithm: Algorithm, text: string) {
  if (algorithm === "md5") {
    return md5Digest(text);
  }
  return sha256Digest(text);
}

export function jwkModulusToHex(jwk: JsonWebKey) {
  if (!jwk.n) throw new Error("JWK no contiene módulo.");
  return bytesToHex(base64UrlToBytes(jwk.n));
}

export function safeFormatBinarySize(value: bigint) {
  const units = ["", "K", "M", "G", "T", "P"];
  let current = value;
  let index = 0;
  const divisor = BigInt(1024);
  while (current >= divisor && index < units.length - 1) {
    current /= divisor;
    index += 1;
  }
  return `${current.toString()} ${units[index]}B`;
}
