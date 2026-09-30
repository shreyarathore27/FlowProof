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

export interface DashboardMonth { label: string; income: number; expenses: number; savings: number }
export interface DashboardCategory { label: string; value: number; tone: 'ok' | 'warn' | 'neutral' }
export interface HealthMetric { label: string; score: number; description: string; tone: 'ok' | 'warn' | 'neutral' }
export interface RecommendationItem { title: string; category: string; fit: string; reason: string; organization: string; notApproval: string }
export interface FinancialDashboard {
  overview: {
    income: number; expenses: number; savings: number; cashFlow: number; accountActivity: number;
  };
  trend: { months: DashboardMonth[]; yearly: { income: number; expenses: number; savings: number } };
  categories: DashboardCategory[];
  insights: string[];
  assistant: { headline: string; prompt: string; answer: string };
  health: { summary: string; narrative: string; metrics: HealthMetric[] };
  recommendations: RecommendationItem[];
}

export interface Person { profile: MerchantProfile; seed: number; signals: RawSignals; finance: FinancialDashboard; en: string; hi: string }

export const PEOPLE: Record<UserId, Person> = {
  ravi: {
    profile: { id: 'ravi', name: 'Ravi Kumar', first: 'Ravi', biz: 'Ravi General Store', kind: 'Kirana shop · Jaipur', upi: 'ravi.store@okmock', initials: 'RK', txCount: 9214, tag: { label: 'Strong profile', tone: 'ok' } },
    seed: 7,
    signals: { regularity: 0.967, activeDays: 176, windowDays: 182, trendPct: 12, onTimeRepayments: 6, repaymentTotal: 6, bufferDays: 18 },
    finance: {
      overview: { income: 86000, expenses: 48000, savings: 38000, cashFlow: 24000, accountActivity: 128 },
      trend: { months: [
        { label: 'Jan', income: 72000, expenses: 46000, savings: 26000 },
        { label: 'Feb', income: 76000, expenses: 47000, savings: 29000 },
        { label: 'Mar', income: 81000, expenses: 50000, savings: 31000 },
        { label: 'Apr', income: 85000, expenses: 52000, savings: 33000 },
        { label: 'May', income: 89000, expenses: 55000, savings: 34000 },
        { label: 'Jun', income: 94000, expenses: 57000, savings: 37000 },
      ], yearly: { income: 514000, expenses: 307000, savings: 207000 } },
      categories: [
        { label: 'Inventory', value: 38, tone: 'ok' },
        { label: 'Utilities', value: 18, tone: 'neutral' },
        { label: 'Transport', value: 12, tone: 'neutral' },
        { label: 'Staff & wages', value: 15, tone: 'ok' },
        { label: 'Savings buffer', value: 17, tone: 'warn' },
      ],
      insights: [
        'Your income is growing consistently, with a 12% increase in the last 8 weeks.',
        'The shop is converting roughly 44% of monthly inflow into savings and buffer protection.',
        'Your AutoPay history makes your repayment profile stronger than your current credit file suggests.',
      ],
      assistant: {
        headline: 'AI financial assistant',
        prompt: 'How can I maximise my monthly savings while keeping stock fresh?',
        answer: 'Your strongest improvement would be to keep 10–15% of each month’s inflow in the cash buffer and trim ad-hoc stock purchases during slower weeks. The current trend shows your business can support a stronger savings rate without hurting daily operations.',
      },
      health: {
        summary: 'Your income is stable and your savings rate is improving over the recent period.',
        narrative: 'Your income has remained relatively stable over the selected period. Savings and buffer coverage are strong, and the pattern supports a healthy operating rhythm.',
        metrics: [
          { label: 'Income stability', score: 88, description: 'Strong and steady inflow history across the last six months.', tone: 'ok' },
          { label: 'Expense stability', score: 76, description: 'Costs are controlled and aligned with business growth.', tone: 'ok' },
          { label: 'Savings trend', score: 84, description: 'Monthly savings are trending higher with wider seasonal buffer.', tone: 'ok' },
          { label: 'Cash flow', score: 82, description: 'Positive monthly cash flow supports growth and debt servicing.', tone: 'ok' },
        ],
      },
      recommendations: [
        { title: 'Business Working Capital', category: 'Business Banking', fit: 'Strong fit', reason: 'Shown because your business has consistent inflow, a healthy buffer, and strong repayment discipline.', organization: 'Kosh Capital', notApproval: 'Recommended based on your selected need and available service information.' },
        { title: 'Emergency Fund Plan', category: 'Savings', fit: 'Good fit', reason: 'Shown because your savings buffer is growing but still benefits from a dedicated reserve strategy.', organization: 'Astra Savings', notApproval: 'Recommended based on your selected need and available service information.' },
      ],
    },
    en: 'Over the last six months money came in on almost every day, sales are growing, and all six EMIs were paid on time. That is why the working-capital line, shop insurance and savings plan match your profile. This is not an approval; the lender makes the final decision.',
    hi: 'पिछले छह महीनों में लगभग हर दिन आपको भुगतान मिला, बिक्री बढ़ रही है, और सभी छह किस्तें समय पर चुकाई गईं। इसी वजह से कार्यशील पूंजी लाइन, दुकान बीमा और बचत योजना आपकी प्रोफ़ाइल से मेल खाते हैं। यह स्वीकृति नहीं है; अंतिम निर्णय ऋणदाता का है।',
  },
  meena: {
    profile: { id: 'meena', name: 'Meena Devi', first: 'Meena', biz: 'Meena Tailors', kind: 'Tailoring · Lucknow', upi: 'meena.tailors@okmock', initials: 'MD', txCount: 312, tag: { label: 'Thin file', tone: 'warn' } },
    seed: 19,
    signals: { regularity: 0.533, activeDays: 97, windowDays: 182, trendPct: -4, onTimeRepayments: 0, repaymentTotal: 0, bufferDays: 4 },
    finance: {
      overview: { income: 36000, expenses: 29000, savings: 7000, cashFlow: 4000, accountActivity: 42 },
      trend: { months: [
        { label: 'Jan', income: 26000, expenses: 22000, savings: 4000 },
        { label: 'Feb', income: 28000, expenses: 24000, savings: 4000 },
        { label: 'Mar', income: 30000, expenses: 25000, savings: 5000 },
        { label: 'Apr', income: 33000, expenses: 26000, savings: 7000 },
        { label: 'May', income: 35000, expenses: 27500, savings: 7500 },
        { label: 'Jun', income: 36000, expenses: 29000, savings: 7000 },
      ], yearly: { income: 192000, expenses: 153000, savings: 39000 } },
      categories: [
        { label: 'Fabric & trims', value: 36, tone: 'ok' },
        { label: 'Rent & utilities', value: 22, tone: 'neutral' },
        { label: 'Maintenance', value: 14, tone: 'warn' },
        { label: 'Travel', value: 11, tone: 'neutral' },
        { label: 'Savings buffer', value: 17, tone: 'warn' },
      ],
      insights: [
        'Incoming revenue is steady, but the buffer remains thin and cash flow is sensitive to seasonal order delays.',
        'A small recurring transfer into a dedicated savings plan would improve your eligibility without major lifestyle changes.',
        'Your current pattern suggests a stronger repayment history would unlock a wider set of product options.',
      ],
      assistant: {
        headline: 'AI financial assistant',
        prompt: 'What should I do to qualify for a larger working-capital line?',
        answer: 'To improve your score, maintain a 10–15 day buffer and keep regular monthly deposits into a savings account. Your business has a viable baseline, but a more consistent pattern of inflows and a smaller low-balance period would reduce the lender’s risk.',
      },
      health: {
        summary: 'The profile is stable but needs stronger emergency buffer protection and repayment consistency.',
        narrative: 'Your income has remained moderately stable, with a thin cash buffer and lower cash-flow consistency than the strongest profiles. A disciplined savings plan and more regular cash flow would improve the profile.',
        metrics: [
          { label: 'Income stability', score: 62, description: 'Income is consistent but more seasonal than ideal.', tone: 'neutral' },
          { label: 'Expense stability', score: 58, description: 'Operations are manageable, but spending varies with orders and maintenance.', tone: 'neutral' },
          { label: 'Savings trend', score: 54, description: 'Savings are present but still limited by seasonal dips.', tone: 'warn' },
          { label: 'Cash flow', score: 61, description: 'Cash flow stays positive but is more sensitive than desired.', tone: 'neutral' },
        ],
      },
      recommendations: [
        { title: 'Emergency Fund Plan', category: 'Savings', fit: 'Strong fit', reason: 'Shown because a small, recurring transfer would improve stability and create a protected buffer for slower periods.', organization: 'Astra Savings', notApproval: 'Recommended based on your selected need and available service information.' },
        { title: 'Business Insurance', category: 'Insurance', fit: 'Good fit', reason: 'Shown because your operations are seasonal and a small buffer plus protection plan would reduce risk during quiet periods.', organization: 'SecureCover', notApproval: 'Recommended based on your selected need and available service information.' },
      ],
    },
    en: 'Payments come in on about half of all days, and there is no repayment record in the shared data yet. Shop insurance and the savings plan match now. For the working-capital line, a steady savings plan paid on time and a slightly bigger balance would close the gaps shown below.',
    hi: 'लगभग आधे दिनों में आपको भुगतान मिलता है, और साझा डेटा में अभी चुकौती का कोई रिकॉर्ड नहीं है। दुकान बीमा और बचत योजना अभी मेल खाते हैं। कार्यशील पूंजी लाइन के लिए, समय पर भरी गई बचत योजना और थोड़ा बड़ा बैलेंस नीचे दिखाई गई कमियों को दूर करेंगे।',
  },
};
