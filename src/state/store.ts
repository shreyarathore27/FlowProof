import { useSyncExternalStore } from 'react';
import type {
  Agreement, Applicant, Consent, DataRequestResult, FetchSummary, LedgerEvent, MatchesResponse,
  MerchantProfile, Offer, OrgId, Purpose, Snapshot, UserId,
} from '../api/types';

export type View = 'merchant' | 'lender';
export type MerchantPage = 'consent' | 'signals' | 'options' | 'offer' | 'account' | 'ledger';
export type LenderPage = 'desk' | 'ledger';

export interface UserState {
  consent: Consent | null;
  expiryDays: number;
  fetching: boolean;
  summary: FetchSummary | null;
  dataDeleted: boolean;
  anchorStage: null | 'platform' | 'verifier' | 'done';
  snapshot: Snapshot | null;
  matches: MatchesResponse | null;
  offer: Offer | null;
  agreement: Agreement | null;
  revokeConfirm: boolean;
}

export interface Narration { i: number; n: number; text: string; done?: boolean }

export interface AppState {
  view: View;
  pages: { merchant: MerchantPage; lender: LenderPage };
  merchant: UserId | null;
  profiles: MerchantProfile[];
  users: Record<UserId, UserState>;
  lender: {
    selected: UserId;
    purpose: Purpose;
    caller: OrgId;
    results: Record<UserId, (DataRequestResult & { purpose: Purpose }) | null>;
    form: { amount: number; apr: number; weeks: number };
  };
  applicants: Applicant[];
  agreements: Agreement[];
  ledger: LedgerEvent[];
  freshBlocks: number[]; // block numbers that just arrived (entry animation)
  resultFresh: boolean; // lender result just changed (stamp animation)
  toasts: { id: number; ev: LedgerEvent }[];
  narr: Narration | null;
  playing: boolean;
  demoSpeed: number; // 0.75, 1, 1.5
  demoPaused: boolean;
  theme: 'light' | 'dark';
  clockDays: number;
  lang: 'en' | 'hi';
  filter: 'all' | 'refused';
  forceFail: boolean;
  scrambleHash: string | null;
  error: string | null;
}

export const freshUser = (): UserState => ({
  consent: null, expiryDays: 90, fetching: false, summary: null, dataDeleted: false, anchorStage: null,
  snapshot: null, matches: null, offer: null, agreement: null, revokeConfirm: false,
});

export const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('flowproof_theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyThemeToDom = (theme: 'light' | 'dark') => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
};

let activeTheme: 'light' | 'dark' = getStoredTheme();
applyThemeToDom(activeTheme);

export const initialState = (profiles: MerchantProfile[] = []): AppState => {
  applyThemeToDom(activeTheme);
  return {
    view: 'merchant',
    pages: { merchant: 'consent', lender: 'desk' },
    merchant: null,
    profiles,
    users: { ravi: freshUser(), meena: freshUser() },
    lender: {
      selected: 'ravi', purpose: 'credit-assessment', caller: 'LenderOrg',
      results: { ravi: null, meena: null },
      form: { amount: 50000, apr: 18, weeks: 26 },
    },
    applicants: [], agreements: [], ledger: [], freshBlocks: [], resultFresh: false, toasts: [],
    narr: null, playing: false, demoSpeed: 1, demoPaused: false, theme: activeTheme,
    clockDays: 0, lang: 'en', filter: 'all', forceFail: false, scrambleHash: null, error: null,
  };
};

// Tiny external store: actions read the latest state synchronously (no stale closures in the demo script).
let state = initialState();
const listeners = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
export function setUser(userId: UserId, patch: Partial<UserState>) {
  setState((s) => ({ users: { ...s.users, [userId]: { ...s.users[userId], ...patch } } }));
}
export function toggleTheme() {
  const next = activeTheme === 'dark' ? 'light' : 'dark';
  setTheme(next);
}
export function setTheme(next: 'light' | 'dark') {
  activeTheme = next;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('flowproof_theme', next);
  }
  applyThemeToDom(next);
  setState({ theme: next });
}
export function setDemoSpeed(speed: number) {
  setState({ demoSpeed: speed });
}
export function togglePauseDemo() {
  setState((s) => ({ demoPaused: !s.demoPaused }));
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useApp = () => useSyncExternalStore(subscribe, getState);
export const currentPage = (s: AppState) => s.pages[s.view];
