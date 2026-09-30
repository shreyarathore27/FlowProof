import { api } from '../api/client';
import type { OrgId, Purpose, UserId } from '../api/types';
import { weeklyInstalment } from '../lib/format';
import { getState, initialState, setState, setUser, type LenderPage, type MerchantPage, type View } from './store';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let toastSeq = 0;

function me(): UserId {
  const m = getState().merchant;
  if (!m) throw new Error('No merchant signed in');
  return m;
}

/** Wraps an action so failures show a message instead of breaking the page. */
async function guard(fn: () => Promise<void>) {
  try { await fn(); }
  catch (e) { setState({ error: e instanceof Error ? e.message : String(e) }); }
}

/** Pull the ledger + lender views after any write. New blocks animate and raise a toast. */
export async function refresh() {
  const [ledger, applicants, agreements] = await Promise.all([api.getTimeline('all'), api.listApplicants(), api.listAgreements()]);
  const known = new Set(getState().ledger.map((e) => e.n));
  const added = getState().ledger.length ? ledger.filter((e) => !known.has(e.n)) : [];
  const toasts = added.map((ev) => ({ id: ++toastSeq, ev }));
  setState((s) => ({ ledger, applicants, agreements, freshBlocks: added.map((e) => e.n), toasts: [...s.toasts, ...toasts].slice(-3) }));
  toasts.forEach((t) => setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 4200));
  if (added.length) setTimeout(() => setState({ freshBlocks: [] }), 1500);
}

export async function boot() {
  const profiles = await api.listProfiles();
  setState(initialState(profiles));
  await refresh();
}

// ---------- navigation ----------
export const setView = (view: View) => { setState({ view }); window.scrollTo({ top: 0 }); };
export function goto(page: MerchantPage | LenderPage) {
  setState((s) => ({ pages: { ...s.pages, [s.view]: page } as typeof s.pages }));
  const m = getState().merchant;
  if (m) setUser(m, { revokeConfirm: false });
  window.scrollTo({ top: 0 });
}
export async function login(userId: UserId) {
  await api.login(userId);
  setState((s) => ({ merchant: userId, view: 'merchant', pages: { ...s.pages, merchant: 'consent' } }));
}
export const logout = () => setState((s) => ({ merchant: null, pages: { ...s.pages, merchant: 'consent' } }));

// ---------- merchant ----------
export const setExpiry = (d: number) => setUser(me(), { expiryDays: d });

export const grantConsent = () => guard(async () => {
  const uid = me();
  const consent = await api.createConsent({ userId: uid, expiryDays: getState().users[uid].expiryDays });
  setUser(uid, { consent, dataDeleted: false, snapshot: null, matches: null, anchorStage: null, summary: null, offer: null, agreement: null, fetching: true });
  await refresh();
  const summary = await api.fetchConsentData(consent.id);
  setUser(uid, { summary, fetching: false });
  goto('signals');
});

export const anchorSnapshot = () => guard(async () => {
  const uid = me(), u = getState().users[uid];
  if (!u.consent || u.consent.status !== 'ACTIVE' || u.anchorStage) return;
  setUser(uid, { anchorStage: 'platform' });
  await sleep(800);
  setUser(uid, { anchorStage: 'verifier' });
  const [snapshot] = await Promise.all([api.createSnapshot(u.consent.id), sleep(1100)]);
  const matches = await api.getMatches(snapshot.id);
  setUser(uid, { snapshot, matches, anchorStage: 'done' });
  setState({ scrambleHash: snapshot.hash });
  await refresh();
});

export async function loadOffer() {
  const uid = getState().merchant;
  if (!uid) return;
  const c = getState().users[uid].consent;
  if (!c) return;
  const offer = await api.getOfferForConsent(c.id);
  setUser(uid, { offer });
}

export const acceptOffer = () => guard(async () => {
  const uid = me(), o = getState().users[uid].offer;
  if (!o) return;
  const agreement = await api.acceptOffer(o.id);
  setUser(uid, { agreement, offer: { ...o, status: 'ACCEPTED' } });
  await refresh();
});

export const setupMandate = () => guard(async () => {
  const uid = me(), a = getState().users[uid].agreement;
  if (!a) return;
  const mandate = await api.createMandate(a.id);
  setUser(uid, { agreement: { ...a, mandate } });
  await refresh();
});

export const setForceFail = (v: boolean) => setState({ forceFail: v });

export const runRepayment = () => guard(async () => {
  const uid = me(), a = getState().users[uid].agreement;
  if (!a) return;
  const r = await api.runRepayment(a.id, { forceFail: getState().forceFail });
  setUser(uid, { agreement: { ...a, repayments: [...a.repayments, r] } });
  await refresh();
});

export const askRevoke = (v: boolean) => setUser(me(), { revokeConfirm: v });

export const revokeConsent = () => guard(async () => {
  const uid = me(), c = getState().users[uid].consent;
  if (!c) return;
  const consent = await api.revokeConsent(c.id);
  setUser(uid, { consent, revokeConfirm: false, dataDeleted: true, summary: null, matches: null });
  await refresh();
});

// ---------- lender ----------
export const pickApplicant = (u: UserId) => setState((s) => ({ lender: { ...s.lender, selected: u } }));
export const setCaller = (caller: OrgId) => setState((s) => ({ lender: { ...s.lender, caller } }));
export const setPurpose = (purpose: Purpose) => setState((s) => ({ lender: { ...s.lender, purpose } }));
export const setOfferField = (k: 'amount' | 'apr' | 'weeks', v: number) =>
  setState((s) => ({ lender: { ...s.lender, form: { ...s.lender.form, [k]: v } } }));

export const requestData = () => guard(async () => {
  const { selected, caller, purpose } = getState().lender;
  const consentId = getState().applicants.find((a) => a.userId === selected)?.consent?.id;
  const res = await api.requestData({ userId: selected, consentId, callerOrg: caller, purpose });
  setState((s) => ({ lender: { ...s.lender, results: { ...s.lender.results, [selected]: { ...res, purpose } } }, resultFresh: true }));
  setTimeout(() => setState({ resultFresh: false }), 1500);
  await refresh();
});

export const postOffer = () => guard(async () => {
  const { selected, form } = getState().lender;
  const consentId = getState().applicants.find((a) => a.userId === selected)?.consent?.id;
  if (!consentId) return;
  const terms = { product: 'wc-line', principal: form.amount, aprPct: form.apr, weeks: form.weeks, weeklyInstalment: Math.round(weeklyInstalment(form.amount, form.apr, form.weeks)) };
  const offer = await api.postOffer({ consentId, terms });
  setUser(selected, { offer });
  await refresh();
});

export function toggleClock() {
  const days = getState().clockDays ? 0 : 91;
  api.demo?.setClockOffsetDays(days);
  setState({ clockDays: days });
}

// ---------- misc ----------
export const setLang = (lang: 'en' | 'hi') => setState({ lang });
export const setFilter = (filter: 'all' | 'refused') => setState({ filter });
export const dismissError = () => setState({ error: null });

export async function reset() {
  setState({ playing: false });
  await api.demo?.reset();
  await boot();
}
