import { Check, CheckCircle2 } from 'lucide-react';
import type { SignalResult, SignalVisuals } from '../api/types';
import { Pill } from './ui';
import { SpotlightCard } from './reactbits/SpotlightCard';

function Calendar({ days, active }: { days: boolean[]; active: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
        <span>Activity Grid (180 days)</span>
        <span className="font-mono text-primary font-semibold">{active} Active Days</span>
      </div>
      <div className="cal grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto py-1" aria-label={`${active} active days out of ${days.length}`}>
        {days.map((on, i) => (
          <i
            key={i}
            className={`w-2.5 h-2.5 rounded-[2px] transition-all duration-200 ${
              on
                ? 'bg-gradient-to-tr from-teal-500 to-emerald-400 shadow-[0_0_6px_rgba(45,212,191,0.5)] scale-[1.05]'
                : 'bg-[var(--surface2)] opacity-60 hover:opacity-100'
            }`}
            title={`Day ${i + 1}: ${on ? 'Transaction activity recorded' : 'No transactions'}`}
          />
        ))}
      </div>
    </div>
  );
}

function Sparkline({ weekly, festivalWeek }: { weekly: number[]; festivalWeek?: number }) {
  const W = 460, H = 85, max = Math.max(...weekly) * 1.15;
  const pts = weekly.map((v, i) => [i * (W / (weekly.length - 1)), H - (v / max) * H] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const fest = festivalWeek !== undefined ? pts[festivalWeek] : null;

  return (
    <div className="w-full">
      <svg className="spark w-full h-auto overflow-visible" viewBox={`-6 -18 ${W + 12} ${H + 36}`} role="img" aria-label="Weekly UPI sales curve">
        <defs>
          <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" strokeWidth={1} />
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" strokeDasharray="3 4" strokeWidth={1} />

        {/* Gradient area */}
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#sparkGradient)" />

        {/* Stroke line with glow */}
        <path d={line} fill="none" stroke="#2DD4BF" strokeWidth={2.4} strokeLinejoin="round" filter="url(#glow)" />

        {/* Festival week marker */}
        {fest && (
          <g>
            <line x1={fest[0]} x2={fest[0]} y1={fest[1]} y2={H} stroke="#F59E0B" strokeDasharray="2 3" strokeWidth={1.5} />
            <circle cx={fest[0]} cy={fest[1]} r={4} fill="#F59E0B" />
            <rect x={fest[0] - 42} y={fest[1] - 18} width="84" height="14" rx="4" fill="rgba(245, 158, 11, 0.2)" stroke="#F59E0B" strokeWidth="0.8" />
            <text x={fest[0]} y={fest[1] - 8} textAnchor="middle" fill="#FBBF24" fontSize="8.5" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
              festive surge
            </text>
          </g>
        )}

        {/* Pulse beacon on latest week */}
        <circle cx={last[0]} cy={last[1]} r={7} fill="#FB7185" opacity="0.3" className="animate-ping" />
        <circle cx={last[0]} cy={last[1]} r={4} fill="#FB7185" />

        {/* Axes labels */}
        <text x={0} y={H + 18} fill="var(--faint)" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          W-26
        </text>
        <text x={W} y={H + 18} textAnchor="end" fill="var(--faint)" fontSize="10" fontFamily="IBM Plex Mono, monospace">
          W-0 (Current)
        </text>
      </svg>
    </div>
  );
}

function Emis({ months }: { months: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-1">
        <span>Consecutive On-Time Payments</span>
        <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> 100% Repaid
        </span>
      </div>
      <div className="emis flex gap-2 flex-wrap">
        {months.length ? (
          months.map((m) => (
            <div
              key={m}
              className="flex-1 min-w-[50px] p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col items-center justify-center gap-1"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[0.7rem] font-bold text-emerald-300">{m}</span>
            </div>
          ))
        ) : (
          [...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-1 min-w-[50px] p-2 rounded-xl bg-[var(--surface2)] border border-dashed border-[var(--line)] text-center text-xs text-[var(--faint)]"
            >
              —
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Gauge({ days, threshold }: { days: number; threshold: number }) {
  const max = 30;
  const pct = Math.min((days / max) * 100, 100);
  const threshPct = (threshold / max) * 100;
  const isHealthy = days >= threshold;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--muted)]">Safety Cushion</span>
        <span className={`font-mono font-bold ${isHealthy ? 'text-teal-400' : 'text-amber-400'}`}>
          {isHealthy ? 'Above Underwriting Floor' : 'Near Threshold'}
        </span>
      </div>

      <div className="relative h-4 rounded-full bg-[var(--surface2)] overflow-hidden border border-[var(--line)] p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isHealthy
              ? 'bg-gradient-to-r from-teal-500 via-teal-400 to-emerald-400 shadow-[0_0_10px_rgba(45,212,191,0.5)]'
              : 'bg-gradient-to-r from-amber-500 to-amber-400'
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Threshold target bar */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-400 z-10 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
          style={{ left: `${threshPct}%` }}
          title={`Underwriting threshold: ${threshold} days`}
        />
      </div>

      <div className="flex justify-between items-center text-[0.7rem] font-mono text-[var(--faint)]">
        <span>0 days</span>
        <span className="text-rose-400 font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Min. {threshold}d Req.
        </span>
        <span>{max} days</span>
      </div>
    </div>
  );
}

export function SignalCard({ signal, visuals }: { signal: SignalResult; visuals: SignalVisuals }) {
  const active = visuals.activeCalendar.filter(Boolean).length;
  const viz = {
    incomeRegularity: <Calendar days={visuals.activeCalendar} active={active} />,
    activityTrend: <Sparkline weekly={visuals.weeklySales} festivalWeek={visuals.festivalWeek} />,
    repaymentBehaviour: <Emis months={visuals.emiMonths} />,
    savingsBuffer: <Gauge days={visuals.bufferDays} threshold={visuals.bufferThreshold} />,
  }[signal.key];

  return (
    <SpotlightCard
      spotlightColor="rgba(45, 212, 191, 0.12)"
      className="p-5 sm:p-6 bg-[var(--surface)]/80 backdrop-blur-xl flex flex-col justify-between gap-4 border-[var(--line)]"
    >
      <div>
        <header className="flex justify-between items-start gap-3 mb-2">
          <span className="font-display font-bold text-sm sm:text-base text-[var(--ink)] tracking-tight">
            {signal.name}
          </span>
          <Pill tone={signal.tone}>{signal.label}</Pill>
        </header>

        <div className="sig-big font-display font-extrabold text-2xl sm:text-3xl tracking-tight text-[var(--ink)] flex items-baseline gap-1.5">
          <span>{signal.display}</span>
          <small className="font-sans text-xs sm:text-sm font-medium text-[var(--muted)]">
            {signal.unitLabel}
          </small>
        </div>
      </div>

      <div className="viz my-2 min-h-[110px] flex flex-col justify-center">{viz}</div>

      <p className="sig-reason text-xs sm:text-sm text-[var(--muted)] leading-relaxed pt-3 border-t border-[var(--line)]/60">
        {signal.reason}
      </p>
    </SpotlightCard>
  );
}
