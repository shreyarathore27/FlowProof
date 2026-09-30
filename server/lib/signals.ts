/**
 * Shared signal computation and product evaluation.
 * Used by both the platform (to produce FetchSummary) and the verifier
 * (to independently recompute the snapshot hash from raw signals).
 */

import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canon, sha256 } from '../lib/hash.js';
import type { RawSignals } from '../data/DataSource.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(`${__dir}/../config/rules.json`, 'utf-8'));

export const SIGNAL_CFG = cfg.signalCfg as {
  version: string;
  regularity: { strong: number; ok: number };
  trend: { growing: number; shrinking: number };
  buffer: { healthy: number; ok: number };
};

export const RULES = cfg.rules as {
  version: string;
  products: Array<{
    id: string; name: string; blurb: string;
    criteria: Array<{ signal: string; min: number; label: string; unit: string; fix: string }>;
  }>;
};

export const LENDER_NAME: string = cfg.lenderName;

/** Computed once at boot — ruleSetVersion = sha256(canon({ SIGNAL_CFG, RULES })) */
export const ruleSetVersion: string = sha256(canon({ SIGNAL_CFG, RULES }));

type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

export interface SignalResult {
  key: string; name: string; value: number; display: string;
  unitLabel: string; label: string; tone: Tone; reason: string;
}

function fmtUnit(v: number, u: string): string {
  if (u === 'pct') return `${Math.round(v * 100)}%`;
  if (u === 'days') return `${v} days`;
  return String(v);
}

export function computeSignals(s: RawSignals): SignalResult[] {
  const c = SIGNAL_CFG;
  const reg: [string, Tone] = s.regularity >= c.regularity.strong ? ['Very regular', 'ok'] : s.regularity >= c.regularity.ok ? ['Regular', 'ok'] : ['Irregular', 'warn'];
  const tr: [string, Tone] = s.trendPct >= c.trend.growing ? ['Growing', 'ok'] : s.trendPct <= c.trend.shrinking ? ['Shrinking', 'bad'] : ['Steady', 'neutral'];
  const rp: [string, Tone] = s.repaymentTotal === 0 ? ['No history', 'neutral'] : s.onTimeRepayments === s.repaymentTotal ? ['On time', 'ok'] : ['Some late', 'warn'];
  const bf: [string, Tone] = s.bufferDays >= c.buffer.healthy ? ['Healthy', 'ok'] : s.bufferDays >= c.buffer.ok ? ['Adequate', 'neutral'] : ['Thin', 'warn'];
  const abs = Math.abs(s.trendPct);
  return [
    { key: 'incomeRegularity', name: 'Income regularity', value: s.regularity, display: String(Math.round(s.regularity * 100)), unitLabel: '% of days', label: reg[0], tone: reg[1], reason: `Money came in on ${s.activeDays} of the last ${s.windowDays} days.` },
    { key: 'activityTrend', name: 'Activity trend', value: s.trendPct, display: `${s.trendPct > 0 ? '+' : '−'}${abs}`, unitLabel: '% vs previous 8 weeks', label: tr[0], tone: tr[1], reason: `Sales in the last 8 weeks were ${abs}% ${s.trendPct > 0 ? 'higher' : 'lower'} than in the 8 weeks before.` },
    { key: 'repaymentBehaviour', name: 'Repayment behaviour', value: s.onTimeRepayments, display: s.repaymentTotal ? `${s.onTimeRepayments}/${s.repaymentTotal}` : '0', unitLabel: s.repaymentTotal ? 'EMIs on time' : 'repayments found', label: rp[0], tone: rp[1], reason: s.repaymentTotal ? `${s.onTimeRepayments} of ${s.repaymentTotal} monthly EMIs were paid on or before the due date.` : 'No loan or EMI repayments appear in the shared data.' },
    { key: 'savingsBuffer', name: 'Savings buffer', value: s.bufferDays, display: String(s.bufferDays), unitLabel: 'days of spending', label: bf[0], tone: bf[1], reason: `Your usual balance would cover about ${s.bufferDays} days of normal spending.` },
  ];
}

interface Gap { criterion: string; current: string; needed: string; howToFix: string; }
interface MatchResult { productId: string; name: string; blurb: string; matched: boolean; reasons: string[]; gaps: Gap[]; }

export function evaluate(s: RawSignals): MatchResult[] {
  return RULES.products.map(p => {
    const reasons: string[] = [], gaps: Gap[] = [];
    for (const c of p.criteria) {
      const cur = (s as unknown as Record<string, number>)[c.signal];
      if (cur >= c.min) reasons.push(`${c.label}: ${fmtUnit(cur, c.unit)} (needs ${fmtUnit(c.min, c.unit)})`);
      else gaps.push({ criterion: c.label, current: fmtUnit(cur, c.unit), needed: fmtUnit(c.min, c.unit), howToFix: c.fix });
    }
    return { productId: p.id, name: p.name, blurb: p.blurb, matched: gaps.length === 0, reasons, gaps };
  });
}

/** seeded RNG for deterministic signal visuals */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeVisuals(userId: string, signals: RawSignals) {
  const r = rng(userId === 'ravi' ? 7 : 19);
  const weekly: number[] = [];
  for (let i = 0; i < 26; i++) {
    if (userId === 'ravi') {
      let v = 36 + i * 0.36 + (r() - 0.5) * 4;
      if (i === 21) v += 15;
      if (i === 22) v += 5;
      weekly.push(v);
    } else {
      weekly.push(Math.max(0.6, 2 + r() * 6 + (i % 5 === 0 ? -1.5 : 0)));
    }
  }
  const r2 = rng((userId === 'ravi' ? 7 : 19) + 3);
  const idx = [...Array(signals.windowDays).keys()];
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r2() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const off = new Set(idx.slice(0, signals.windowDays - signals.activeDays));
  return {
    activeCalendar: [...Array(signals.windowDays).keys()].map(i => !off.has(i)),
    weeklySales: weekly,
    festivalWeek: userId === 'ravi' ? 21 : undefined,
    emiMonths: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].slice(0, signals.onTimeRepayments),
    bufferDays: signals.bufferDays,
    bufferThreshold: 10,
  };
}

/**
 * Compute the snapshot hash in exactly the same way as mockClient.ts.
 * The salt is random, stored off-chain by the platform, and passed to the verifier.
 */
export function computeSnapshotHash(consentId: string, signals: RawSignals, salt: string): string {
  return sha256(canon({ consentId, ruleSetVersion, signals, window: '182d', salt }));
}
