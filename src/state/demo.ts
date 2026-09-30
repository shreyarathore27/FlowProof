import { getState, setState, type AppState } from './store';
import * as A from './actions';

/**
 * Paced sleep that accounts for demoSpeed and pauses indefinitely if demoPaused is true.
 * Returns false if demo was stopped/cancelled while waiting.
 */
async function controlledSleep(baseMs: number): Promise<boolean> {
  let elapsedEffective = 0;
  let lastTick = Date.now();

  while (elapsedEffective < baseMs) {
    if (!getState().playing) return false;
    await new Promise((r) => setTimeout(r, 40));
    if (!getState().playing) return false;

    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    if (!getState().demoPaused) {
      const speed = getState().demoSpeed || 1;
      elapsedEffective += delta * speed;
    }
  }
  return getState().playing;
}

/** Demo script checklist (section 17). Each item is done when its event is on the ledger. */
export const SCRIPT: { k: string; lbl: string; view: 'merchant' | 'lender'; page?: 'consent' | 'signals' | 'offer' | 'account'; refused?: boolean; done: (s: AppState) => boolean }[] = [
  { k: 'login', lbl: 'Merchant signs in', view: 'merchant', done: (s) => !!s.merchant || s.ledger.length > 1 },
  { k: 'grant', lbl: 'Grant consent', view: 'merchant', page: 'consent', done: (s) => has(s, 'GrantConsent') },
  { k: 'anchor', lbl: 'Anchor snapshot', view: 'merchant', page: 'signals', done: (s) => has(s, 'AnchorSnapshot') },
  { k: 'allowed', lbl: 'Request → ALLOWED', view: 'lender', done: (s) => has(s, 'RequestData', 'ALLOWED') },
  { k: 'offer', lbl: 'Post offer', view: 'lender', done: (s) => has(s, 'PostOffer') },
  { k: 'accept', lbl: 'Accept offer', view: 'merchant', page: 'offer', done: (s) => has(s, 'AcceptOffer') },
  { k: 'mandate', lbl: 'AutoPay mandate', view: 'merchant', page: 'offer', done: (s) => has(s, 'RecordMandate') },
  { k: 'repay', lbl: 'First repayment', view: 'merchant', page: 'offer', done: (s) => has(s, 'RecordRepayment') },
  { k: 'revoke', lbl: 'Revoke consent', view: 'merchant', page: 'account', done: (s) => has(s, 'RevokeConsent') },
  { k: 'refused', lbl: 'Request → REFUSED', view: 'lender', refused: true, done: (s) => has(s, 'RequestData', 'REFUSED') },
];

function has(s: AppState, fn: string, status?: string) {
  return s.ledger.some((e) => e.fn === fn && (!status || e.status === status));
}

export function jump(k: string) {
  const m = SCRIPT.find((x) => x.k === k);
  if (!m) return;
  setState((s) => ({
    view: m.view,
    pages: m.view === 'lender' ? { ...s.pages, lender: 'desk' } : s.merchant && m.page ? { ...s.pages, merchant: m.page } : s.pages,
  }));
  window.scrollTo({ top: 0 });
}

const toMerchant = (page: 'options' | 'offer' | 'account') => { A.setView('merchant'); A.goto(page); };
const toLender = () => {
  A.setView('lender'); A.goto('desk');
  setState((s) => ({ lender: { ...s.lender, selected: 'ravi', caller: 'LenderOrg', purpose: 'credit-assessment' } }));
};

export async function playDemo() {
  if (getState().playing) return;
  await A.reset();
  setState({ playing: true, demoPaused: false });
  const steps: [string, () => Promise<unknown> | void][] = [
    ['Ravi signs in to the FlowProof merchant portal', () => A.login('ravi')],
    ['He shares 6 months of UPI data with Kosh Capital, for credit assessment only, for 90 days', A.grantConsent],
    ['Four signals are computed. The snapshot hash is anchored and VerifierOrg co-signs it', A.anchorSnapshot],
    ['Ravi sees which products match and why', () => toMerchant('options')],
    ['Kosh Capital requests data. The chaincode checks consent first', async () => {
      toLender();
      if (!(await controlledSleep(1400))) return;
      await A.requestData();
    }],
    ['Kosh Capital posts an offer. Only the terms hash is public', A.postOffer],
    ['Ravi accepts the offer', async () => {
      toMerchant('offer');
      await A.loadOffer();
      if (!(await controlledSleep(1400))) return;
      await A.acceptOffer();
    }],
    ['A weekly AutoPay mandate is set up (mock UPI AutoPay)', A.setupMandate],
    ['The first weekly repayment goes through', A.runRepayment],
    ['Ravi revokes consent. His transactions are deleted from FlowProof', async () => {
      toMerchant('account');
      if (!(await controlledSleep(1400))) return;
      await A.revokeConsent();
    }],
    ['Kosh Capital tries again and is refused', async () => {
      A.setView('lender');
      A.goto('desk');
      if (!(await controlledSleep(1400))) return;
      await A.requestData();
    }],
  ];

  for (let i = 0; i < steps.length; i++) {
    if (!getState().playing) return;
    setState({ narr: { i, n: steps.length, text: steps[i][0] } });
    
    // Generous reading delay so user and judges can read the narration text comfortably
    if (!(await controlledSleep(2800))) return;
    if (!getState().playing) return;

    // Trigger the actual step action
    await steps[i][1]();

    // Generous soak delay so user can see and inspect the updated view, co-signatures, offers, or refusal
    if (!(await controlledSleep(3800))) return;
  }

  if (!getState().playing) return;
  setState((s) => ({
    playing: false,
    demoPaused: false,
    pages: { ...s.pages, lender: 'ledger' },
    narr: { i: steps.length - 1, n: steps.length, text: 'Demo complete. The full trail is on the ledger, including the refusal.', done: true },
  }));
  window.scrollTo({ top: 0 });
}

export const stopDemo = () => setState({ playing: false, demoPaused: false, narr: null });
