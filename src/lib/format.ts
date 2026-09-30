const IST = 'Asia/Kolkata';

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const short = (h: string | undefined | null, n = 8) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : '—');

export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleString('en-IN', {
    timeZone: IST, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' });

export const count = (n: number) => n.toLocaleString('en-IN');

/** Weekly instalment for a reducing-balance loan. Display only; the lender service owns the real terms. */
export function weeklyInstalment(principal: number, aprPct: number, weeks: number) {
  const r = aprPct / 100 / 52;
  if (!weeks) return 0;
  return r === 0 ? principal / weeks : (principal * r) / (1 - Math.pow(1 + r, -weeks));
}
