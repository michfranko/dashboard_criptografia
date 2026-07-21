"use client";

// ─── Complete simulation session ─────────────────────────────────────────────
// Stores ALL data from an encryption operation so attacks can use it
// without asking the user to re-enter anything.
// ─────────────────────────────────────────────────────────────────────────────

import { Algorithm } from "./crypto-systems";

export type AttackStrategy = "dictionary" | "bruteforce" | "dictionary-bruteforce" | "trial-division";

export interface SimulationSession {
  // ── Identity ──────────────────────────────────────────────────────────────
  id: string;
  createdAt: string; // ISO-8601

  // ── Algorithm ─────────────────────────────────────────────────────────────
  algorithm: Algorithm;
  algorithmLabel: string;

  // ── Input data ────────────────────────────────────────────────────────────
  originalText: string;
  originalTextBytes: number;

  // ── Cryptographic output ──────────────────────────────────────────────────
  ciphertext: string;       // The encrypted text or hash digest
  ciphertextBytes: number;
  ciphertextFormat: string; // "Base64" | "Hex" | "Envelope"

  // ── Algorithm-specific secrets ────────────────────────────────────────────
  // AES
  aesPassword?: string;
  aesSalt?: string;         // Base64
  aesIv?: string;           // Base64
  aesIterations?: number;

  // RSA
  rsaPublicJwk?: JsonWebKey & { keyBits?: number };
  rsaPrivateKey?: CryptoKey; // stored in memory only (not serializable)
  rsaKeyBits?: number;       // 32, 64, 128 (demo) or 2048 (real)
  rsaDemoPrivateKey?: { p: string; q: string; n: string; e: string; d: string; keyBits: number };

  // MD5 / SHA-256 — no secrets, just the hash

  // ── Performance (encryption) ──────────────────────────────────────────────
  encryptionDurationMs: number;

  // ── Attack configuration (set by user before attack) ──────────────────────
  attackStrategy?: AttackStrategy;
  attackCharset?: string[];
  attackMaxLength?: number;
  attackMaxAttempts?: number;
  attackMaxDurationMs?: number;
  attackDictionary?: string[];
}

// ─── Session storage (in-memory + localStorage for persistence) ──────────────

const SESSION_KEY = "crypto_active_session_v1";

export class SessionManager {
  private static currentSession: SimulationSession | null = null;

  /** Create a new session, replacing any previous one. */
  static create(data: Omit<SimulationSession, "id" | "createdAt">): SimulationSession {
    const session: SimulationSession = {
      ...data,
      id: `SES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };
    this.currentSession = session;
    // Persist to localStorage (except non-serializable fields)
    try {
      const serializable = { ...session };
      delete (serializable as any).rsaPrivateKey;
      localStorage.setItem(SESSION_KEY, JSON.stringify(serializable));
    } catch {
      // Storage may be full; session still works in-memory
    }
    return session;
  }

  /** Get the current active session. */
  static get(): SimulationSession | null {
    if (this.currentSession) return this.currentSession;
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        this.currentSession = JSON.parse(stored) as SimulationSession;
        return this.currentSession;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  /** Clear the current session. */
  static clear(): void {
    this.currentSession = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore
    }
  }

  /** Check if a session exists and matches the given algorithm. */
  static hasValidSession(algorithm: Algorithm): boolean {
    const session = this.get();
    return session !== null && session.algorithm === algorithm;
  }

  /** Get the RSA private key (only available in-memory). */
  static rsaPrivateKey: CryptoKey | null = null;
}