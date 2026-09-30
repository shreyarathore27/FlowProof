// Mock-only copies of the backend configs (Modules B and C own the real ones).
// All thresholds are illustrative and versioned.
import type { MerchantProfile, UserId } from '../api/types';

export const SIGNAL_CFG = {
  version: 'signals-2026.09.1',
  regularity: { strong: 0.85, ok: 0.6 },
  trend: { growing: 5, shrinking: -5 },
  buffer: { healthy: 14, ok: 7 },
} as const;

export type RawSignalKey = 'regularity' | 'activeDays' | 'bufferDays' | 'onTimeRepayments';

export interface Criterion { signal: RawSignalKey; min: number; label: string; unit: 'pct' | 'days' | 'count'; fix: string }
export interface Product { id: string; name: string; blurb: string; criteria: Criterion[] }

export const RULES: { version: string; products: Product[] } = {
  version: 'rules-2026.09.1',
  products: [
    { id: 'wc-line', name: 'Working-capital line', blurb: 'Up to ₹50,000 for stock, repaid weekly from UPI sales.', criteria: [
      { signal: 'regularity', min: 0.7, label: 'Days with payments received', unit: 'pct', fix: 'Accept UPI on more days each week. Small sales count too.' },
      { signal: 'bufferDays', min: 10, label: 'Savings buffer', unit: 'days', fix: 'Leave a little of each day’s sales in the account until it covers 10 days of spending.' },
      { signal: 'onTimeRepayments', min: 3, label: 'On-time repayments on record', unit: 'count', fix: 'Pay a recurring savings plan on time for 3 months to build a record.' },
    ] },
    { id: 'micro-ins', name: 'Shop micro-insurance', blurb: 'Cover for stock and fire damage, paid monthly.', criteria: [
      { signal: 'activeDays', min: 90, label: 'Days of payment activity', unit: 'days', fix: 'Keep taking UPI payments until you have 90 active days.' },
      { signal: 'regularity', min: 0.5, label: 'Days with payments received', unit: 'pct', fix: 'Accept UPI on more days each week.' },
    ] },
    { id: 'rd-plan', name: 'Recurring savings plan', blurb: 'Auto-save a small amount each day from UPI sales.', criteria: [
      { signal: 'activeDays', min: 60, label: 'Days of payment activity', unit: 'days', fix: 'Keep taking UPI payments until you have 60 active days.' },
    ] },
  ],
};

export const LENDER_NAME = 'Kosh Capital';

export interface RawSignals {
  regularity: number; activeDays: number; windowDays: number; trendPct: number;
  onTimeRepayments: number; repaymentTotal: number; bufferDays: number;
}

export interface Person { profile: MerchantProfile; seed: number; signals: RawSignals; en: string; hi: string }

export const PEOPLE: Record<UserId, Person> = {
  ravi: {
    profile: { id: 'ravi', name: 'Ravi Kumar', first: 'Ravi', biz: 'Ravi General Store', kind: 'Kirana shop · Jaipur', upi: 'ravi.store@okmock', initials: 'RK', txCount: 9214, tag: { label: 'Strong profile', tone: 'ok' } },
    seed: 7,
    signals: { regularity: 0.967, activeDays: 176, windowDays: 182, trendPct: 12, onTimeRepayments: 6, repaymentTotal: 6, bufferDays: 18 },
    en: 'Over the last six months money came in on almost every day, sales are growing, and all six EMIs were paid on time. That is why the working-capital line, shop insurance and savings plan match your profile. This is not an approval; the lender makes the final decision.',
    hi: 'पिछले छह महीनों में लगभग हर दिन आपको भुगतान मिला, बिक्री बढ़ रही है, और सभी छह किस्तें समय पर चुकाई गईं। इसी वजह से कार्यशील पूंजी लाइन, दुकान बीमा और बचत योजना आपकी प्रोफ़ाइल से मेल खाते हैं। यह स्वीकृति नहीं है; अंतिम निर्णय ऋणदाता का है।',
  },
  meena: {
    profile: { id: 'meena', name: 'Meena Devi', first: 'Meena', biz: 'Meena Tailors', kind: 'Tailoring · Lucknow', upi: 'meena.tailors@okmock', initials: 'MD', txCount: 312, tag: { label: 'Thin file', tone: 'warn' } },
    seed: 19,
    signals: { regularity: 0.533, activeDays: 97, windowDays: 182, trendPct: -4, onTimeRepayments: 0, repaymentTotal: 0, bufferDays: 4 },
    en: 'Payments come in on about half of all days, and there is no repayment record in the shared data yet. Shop insurance and the savings plan match now. For the working-capital line, a steady savings plan paid on time and a slightly bigger balance would close the gaps shown below.',
    hi: 'लगभग आधे दिनों में आपको भुगतान मिलता है, और साझा डेटा में अभी चुकौती का कोई रिकॉर्ड नहीं है। दुकान बीमा और बचत योजना अभी मेल खाते हैं। कार्यशील पूंजी लाइन के लिए, समय पर भरी गई बचत योजना और थोड़ा बड़ा बैलेंस नीचे दिखाई गई कमियों को दूर करेंगे।',
  },
};
