import type { SignalResult, SignalVisuals } from '../api/types';
import { Pill } from './ui';

function Calendar({ days, active }: { days: boolean[]; active: number }) {
  return (
    <div className="cal" aria-label={`${active} active days out of ${days.length}`}>
      {days.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}
    </div>
  );
}

function Sparkline({ weekly, festivalWeek }: { weekly: number[]; festivalWeek?: number }) {
  const W = 460, H = 90, max = Math.max(...weekly) * 1.1;
  const pts = weekly.map((v, i) => [i * (W / (weekly.length - 1)), H - (v / max) * H] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const fest = festivalWeek !== undefined ? pts[festivalWeek] : null;
  const label = { fontSize: 11, fontFamily: 'Figtree, sans-serif' };
  return (
    <svg className="spark" viewBox={`-4 -16 ${W + 8} ${H + 34}`} role="img" aria-label="Weekly UPI sales, last 26 weeks">
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" />
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" strokeDasharray="2 4" />
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="var(--primary)" fillOpacity={0.14} />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={2.2} strokeLinejoin="round" />
      {fest && (
        <>
          <line x1={fest[0]} x2={fest[0]} y1={fest[1]} y2={H} stroke="var(--faint)" strokeDasharray="2 3" />
          <text x={fest[0] - 6} y={fest[1] - 6} textAnchor="end" fill="var(--muted)" {...label}>festival week</text>
        </>
      )}
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--accent)" />
      <text x={0} y={H + 16} fill="var(--faint)" {...label}>26 weeks ago</text>
      <text x={W} y={H + 16} textAnchor="end" fill="var(--faint)" {...label}>this week</text>
    </svg>
  );
}

function Emis({ months }: { months: string[] }) {
  return (
    <div className="emis">
      {months.length
        ? months.map((m) => <span key={m} title="EMI paid on time">{m}</span>)
        : [...Array(6)].map((_, i) => <span key={i} className="none">—</span>)}
    </div>
  );
}

function Gauge({ days, threshold }: { days: number; threshold: number }) {
  const max = 30;
  return (
    <div>
      <div className="gauge">
        <i style={{ width: `${Math.min(days / max, 1) * 100}%` }} />
        <b style={{ left: `${(threshold / max) * 100}%` }} title={`${threshold}-day threshold`} />
      </div>
      <div className="gauge-scale num"><span>0</span><span>{threshold}-day threshold</span><span>{max} days</span></div>
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
    <article className="card sig">
      <header>
        <span className="sig-name">{signal.name}</span>
        <Pill tone={signal.tone}>{signal.label}</Pill>
      </header>
      <div className="sig-big num">{signal.display}<small>{signal.unitLabel}</small></div>
      <div className="viz">{viz}</div>
      <p className="sig-reason">{signal.reason}</p>
    </article>
  );
}
