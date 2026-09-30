/**
 * Canonical JSON and SHA-256 — exact port of src/lib/hash.ts using Node crypto.
 * Same algorithm guarantees the same hash for the same input on both client and server.
 */
import { createHash } from 'node:crypto';

/** Canonical JSON: stable key order, so the same input always hashes the same. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

/** Synchronous SHA-256 via Node crypto — no async needed on the server. */
export function sha256(str: string): string {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

/** Async wrapper for compatibility with callers that await it. */
export async function sha256Async(str: string): Promise<string> {
  return sha256(str);
}
