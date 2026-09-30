/** Canonical JSON: stable key order, so the same input always hashes the same. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

export async function sha256(str: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    // Non-secure context fallback (e.g. plain http on a LAN IP). Demo only, not cryptographic.
    let out = '';
    for (let r = 0; r < 8; r++) {
      let h = 0x811c9dc5 ^ r;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
      out += h.toString(16).padStart(8, '0');
    }
    return out;
  }
}
