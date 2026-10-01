/**
 * FlowProof Server Bootstrap
 *
 * Runs Platform, Lender, and Verifier services
 * through one Express server for deployment.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';

import { SyntheticDataSource } from './data/DataSource.js';
import { SimulatedLedger, type FinancialWorkflowEvent, type UserId } from './ledger/Ledger.js';
import { canon, sha256 } from './lib/hash.js';
import { initVerifierInternal } from './verifier/verifierInternal.js';
import { createPlatformApp } from './platform/platformApp.js';
import { createLenderApp } from './lender/lenderApp.js';
import { createVerifierApp } from './verifier/verifierApp.js';

const PORT = Number(process.env.PORT ?? 4000);
const assistantLimits = new Map<string, { count: number; resetAt: number }>();

function safeText(value: unknown, maxLength = 80) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

function financialContext(value: unknown) {
  if (!value || typeof value !== 'object') return '{}';
  const input = value as Record<string, unknown>;
  const overview = input.overview && typeof input.overview === 'object' ? input.overview as Record<string, unknown> : {};
  const months = Array.isArray(input.months) ? input.months.slice(0, 12).map((entry) => {
    const month = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return { label: safeText(month.label, 12), income: safeNumber(month.income), expenses: safeNumber(month.expenses), savings: safeNumber(month.savings) };
  }) : [];
  const categories = Array.isArray(input.categories) ? input.categories.slice(0, 12).map((entry) => {
    const category = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return { label: safeText(category.label, 40), percent: safeNumber(category.value) };
  }) : [];
  return JSON.stringify({
    business: safeText(input.business),
    selectedPeriod: safeText(input.selectedPeriod, 30),
    overview: {
      income: safeNumber(overview.income), expenses: safeNumber(overview.expenses), savings: safeNumber(overview.savings),
      cashFlow: safeNumber(overview.cashFlow), accountActivity: safeNumber(overview.accountActivity),
    },
    months,
    spendingCategories: categories,
  });
}

function allowAssistantRequest(ip: string) {
  const now = Date.now();
  const current = assistantLimits.get(ip);
  if (!current || current.resetAt <= now) {
    assistantLimits.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 15) return false;
  current.count++;
  return true;
}

const sharingOrganizations = {
  'kosh-capital': { name: 'Kosh Capital', service: 'Business Working Capital' },
  'astra-savings': { name: 'Astra Savings', service: 'Savings and emergency funds' },
  'securecover': { name: 'SecureCover', service: 'Business insurance' },
  'sampada-bank': { name: 'Sampada Bank', service: 'Business banking' },
} as const;

type OrganizationId = keyof typeof sharingOrganizations;
type SharedMetric = number | string;
interface FinancialCredential {
  credentialId: string;
  consentId: string;
  userId: UserId;
  userRef: string;
  organizationId: OrganizationId;
  organization: string;
  purpose: string;
  scope: string[];
  metrics: Record<string, SharedMetric>;
  analysisPeriod: string;
  createdAt: string;
  expiresAt: string;
  credentialHash: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REVOKED';
  verificationId?: string;
  verifiedAt?: string;
}

const sharedMetricKeys = new Set([
  'monthlyInflow', 'monthlyOutflow', 'monthlySavings', 'savingsRate', 'cashFlowStability', 'financialHealth',
]);

function validMetrics(value: unknown): Record<string, SharedMetric> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metrics = value as Record<string, unknown>;
  const entries = Object.entries(metrics);
  if (entries.length === 0 || entries.length > sharedMetricKeys.size || entries.some(([key]) => !sharedMetricKeys.has(key))) return null;
  const result: Record<string, SharedMetric> = {};
  for (const [key, metric] of entries) {
    if (typeof metric === 'number' && Number.isFinite(metric) && metric >= 0 && metric <= 1_000_000_000) result[key] = Math.round(metric * 100) / 100;
    else if (key === 'cashFlowStability' && (metric === 'Stable' || metric === 'Variable')) result[key] = metric;
    else if (key === 'financialHealth' && typeof metric === 'string' && metric.length <= 48) result[key] = metric;
    else return null;
  }
  return result;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function normaliseQuestion(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fallbackAssistantAnswer(question: string, context: unknown) {
  const normalized = normaliseQuestion(question);
  const input = context && typeof context === 'object' ? context as Record<string, unknown> : {};
  const overview = input.overview && typeof input.overview === 'object' ? input.overview as Record<string, unknown> : {};
  const months = Array.isArray(input.months) ? input.months as Record<string, unknown>[] : [];
  const categories = Array.isArray(input.categories) ? input.categories as Record<string, unknown>[] : [];
  const income = safeNumber(overview.income);
  const expenses = safeNumber(overview.expenses);
  const savings = safeNumber(overview.savings);
  const savingsRate = income > 0 ? Math.round((savings / income) * 1000) / 10 : 0;
  const biggestCategory = categories.reduce<Record<string, unknown> | null>((current, category) => {
    if (!category || typeof category !== 'object') return current;
    const value = safeNumber(category.value);
    if (!current || value > safeNumber(current.value)) return category;
    return current;
  }, null);
  const lastMonth = months[months.length - 1] && typeof months[months.length - 1] === 'object' ? months[months.length - 1] : null;

  if (!normalized) {
    return 'I can help with your savings, spending, and stock-planning questions based on the current dashboard snapshot.';
  }

  if (/save|savings/.test(normalized) && /this month|month/.test(normalized)) {
    return `You saved ${formatCurrency(savings)} this month. That is ${savingsRate}% of your inflow and is a strong buffer for inventory and operating costs.`;
  }

  if (/(where|spent|spend).*(most|highest|biggest|largest)|most.*(spent|spend)|highest.*expense/.test(normalized) || /spend the most/.test(normalized)) {
    const label = biggestCategory && typeof biggestCategory.label === 'string' ? biggestCategory.label : 'Inventory';
    const value = biggestCategory ? safeNumber(biggestCategory.value) : 0;
    return `You spent the most on ${label}, which accounts for ${value}% of your spending mix. That makes it the clearest cost area to optimize while keeping shelves stocked.`;
  }

  if (/(grow.*savings|grow savings|saving.*stock|stock.*fresh|keep.*stock.*fresh|fresh.*stock|grow.*savings.*stock)/.test(normalized)) {
    const focus = biggestCategory && typeof biggestCategory.label === 'string' ? biggestCategory.label : 'inventory';
    const focusShare = biggestCategory ? safeNumber(biggestCategory.value) : 0;
    return `Your snapshot shows ${savingsRate}% of inflow is currently saved, and ${focus} is ${focusShare}% of the spending mix. To grow savings without sacrificing freshness, keep minimum stock for fast-moving and perishable items, replenish those more frequently, and trim slow-moving or overstocked lines by 5–10%. Review sell-through and expiry weekly, then transfer the released cash into your savings buffer instead of making a blanket stock cut.`;
  }

  return `Based on your overview, your monthly inflow is ${formatCurrency(income)}, expenses are ${formatCurrency(expenses)}, and savings are ${formatCurrency(savings)}. The biggest spending category is ${biggestCategory && typeof biggestCategory.label === 'string' ? biggestCategory.label : 'inventory'}, which suggests the clearest opportunity is to tighten that cost centre while preserving stock turnover.`;
}

async function main() {
  console.log('--- Initializing FlowProof Backend ---');

  const ds = new SyntheticDataSource();
  const ledger = new SimulatedLedger();

  await ledger.init();

  initVerifierInternal(ds, ledger);

  const { app: platformApp } = createPlatformApp(ds, ledger);
  const { app: lenderApp } = createLenderApp(ds, ledger);
  const verifierApp = createVerifierApp();

  const app = express();
  const credentials = new Map<string, FinancialCredential>();
  const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((origin) => origin.trim());
  app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)) }));
  app.use(express.json({ limit: '24kb' }));

  app.get('/', (_req, res) => {
    res.json({
      message: 'FlowProof backend is running',
    });
  });

  app.post('/assistant', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const input = req.body as { messages?: unknown; context?: unknown };
    if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > 12) {
      res.status(400).json({ error: 'Send between 1 and 12 chat messages.' });
      return;
    }

    const messages: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const entry of input.messages) {
      if (!entry || typeof entry !== 'object') {
        res.status(400).json({ error: 'Invalid chat message.' });
        return;
      }
      const message = entry as Record<string, unknown>;
      if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 2000) {
        res.status(400).json({ error: 'Each message must have a supported role and contain at most 2,000 characters.' });
        return;
      }
      messages.push({ role: message.role, content: message.content.trim() });
    }
    if (messages[messages.length - 1].role !== 'user') {
      res.status(400).json({ error: 'The last message must be a user question.' });
      return;
    }
    if (!allowAssistantRequest(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'You have reached the assistant message limit. Please wait a minute and try again.' });
      return;
    }
    if (!apiKey) {
      res.json({ answer: fallbackAssistantAnswer(messages[messages.length - 1].content, input.context) });
      return;
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
          max_tokens: 700,
          system: `You are FinBridge, a clear and careful personal-finance assistant. Use the provided financial snapshot to answer questions about the user's cash flow, income, expenses, savings, and spending patterns. The snapshot is synthetic demo data, not live bank activity. Do not invent transactions or figures; distinguish general guidance from facts in the snapshot. Never claim to detect fraud, guarantee loan approval, or describe this as an official credit score. Keep answers concise, explain arithmetic, and encourage explicit consent before accessing real account data. Current snapshot: ${financialContext(input.context)}`,
          messages,
        }),
      });
      if (!response.ok) {
        console.error(`Anthropic assistant request failed with status ${response.status}.`);
        res.status(502).json({ error: 'The AI assistant could not answer right now. Please try again.' });
        return;
      }
      const result = await response.json() as { content?: { type: string; text?: string }[] };
      const answer = result.content?.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('').trim();
      if (!answer) {
        res.status(502).json({ error: 'The AI assistant returned an empty answer. Please try again.' });
        return;
      }
      res.json({ answer });
    } catch {
      res.status(502).json({ error: 'The AI assistant is temporarily unavailable. Please try again.' });
    }
  });

  app.post('/credentials', async (req, res) => {
    const input = req.body as Record<string, unknown>;
    const userId = input.userId;
    const organizationId = input.organizationId;
    const organization = typeof organizationId === 'string' && organizationId in sharingOrganizations
      ? sharingOrganizations[organizationId as OrganizationId]
      : null;
    const metrics = validMetrics(input.metrics);
    const userRef = safeText(input.userRef, 32);
    const purpose = safeText(input.purpose, 80);
    const analysisPeriod = safeText(input.analysisPeriod, 40);
    if ((userId !== 'ravi' && userId !== 'meena') || !organization || !metrics || !userRef || !purpose || !analysisPeriod || input.consent !== true) {
      res.status(400).json({ error: 'A valid user, organization, purpose, selected metrics, period and explicit consent are required.' });
      return;
    }
    const now = new Date();
    const credentialId = `FC-${now.getFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    const consentId = `FCS-${randomBytes(5).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(now.getTime() + 30 * 864e5).toISOString();
    const credentialHash = sha256(canon({ credentialId, userRef, organizationId, purpose, metrics, analysisPeriod }));
    const credential: FinancialCredential = {
      credentialId, consentId, userId, userRef, organizationId: organizationId as OrganizationId,
      organization: organization.name, purpose, scope: Object.keys(metrics), metrics, analysisPeriod,
      createdAt: now.toISOString(), expiresAt, credentialHash, status: 'PENDING_VERIFICATION',
    };
    credentials.set(credentialId, credential);
    try {
      const eventParams = { credentialId, organization: credential.organization, purpose, scope: credential.scope, credentialHash };
      const events = [];
      events.push(await ledger.recordFinancialWorkflowEvent('PlatformOrg', 'FinancialCredentialCreated', eventParams, userId, now));
      events.push(await ledger.recordFinancialWorkflowEvent('PlatformOrg', 'FinancialConsentRecorded', eventParams, userId, now));
      events.push(await ledger.recordFinancialWorkflowEvent('PlatformOrg', 'FinancialShareRequestCreated', eventParams, userId, now));
      res.status(201).json({ credential, events });
    } catch {
      credentials.delete(credentialId);
      res.status(500).json({ error: 'Could not record the financial credential on DRUNIX.' });
    }
  });

  app.get('/credentials', (req, res) => {
    const userRef = safeText(req.query.userRef, 32);
    if (!userRef) {
      res.status(400).json({ error: 'A FinBridge user reference is required.' });
      return;
    }
    const items = [...credentials.values()].filter((credential) => credential.userRef === userRef);
    res.json({ credentials: items });
  });

  app.post('/credentials/:credentialId/verify', async (req, res) => {
    const credential = credentials.get(req.params.credentialId);
    const organizationId = req.body?.organizationId;
    if (!credential || credential.organizationId !== organizationId) {
      res.status(404).json({ error: 'Credential not found for this organization.' });
      return;
    }
    if (credential.status === 'REVOKED' || new Date(credential.expiresAt) <= new Date()) {
      res.status(409).json({ error: 'Consent is revoked or expired. The credential cannot be verified.' });
      return;
    }
    if (credential.status === 'VERIFIED') {
      res.json({ credential, events: (await ledger.getHistory('all')).filter((event) => event.fields.credentialId === credential.credentialId) });
      return;
    }
    const expectedHash = sha256(canon({
      credentialId: credential.credentialId,
      userRef: credential.userRef,
      organizationId: credential.organizationId,
      purpose: credential.purpose,
      metrics: credential.metrics,
      analysisPeriod: credential.analysisPeriod,
    }));
    if (expectedHash !== credential.credentialHash) {
      res.status(409).json({ error: 'Credential integrity check failed.' });
      return;
    }
    const now = new Date();
    const params = {
      credentialId: credential.credentialId, organization: credential.organization,
      purpose: credential.purpose, scope: credential.scope, credentialHash: credential.credentialHash,
    };
    try {
      await ledger.recordFinancialWorkflowEvent('LenderOrg', 'FinancialCredentialVerified', params, credential.userId, now);
      await ledger.recordFinancialWorkflowEvent('LenderOrg', 'OrganizationAssessmentStarted', params, credential.userId, now);
      credential.status = 'VERIFIED';
      credential.verificationId = `VER-${randomBytes(4).toString('hex').toUpperCase()}`;
      credential.verifiedAt = now.toISOString();
      res.json({ credential, events: (await ledger.getHistory('all')).filter((event) => event.fields.credentialId === credential.credentialId) });
    } catch {
      res.status(500).json({ error: 'Organization verification could not be recorded.' });
    }
  });

  app.post('/credentials/:credentialId/revoke', async (req, res) => {
    const credential = credentials.get(req.params.credentialId);
    if (!credential || credential.userRef !== req.body?.userRef) {
      res.status(404).json({ error: 'Credential not found for this user.' });
      return;
    }
    if (credential.status === 'REVOKED') {
      res.json({ credential });
      return;
    }
    try {
      const event: FinancialWorkflowEvent = 'FinancialConsentRevoked';
      await ledger.recordFinancialWorkflowEvent('PlatformOrg', event, {
        credentialId: credential.credentialId, organization: credential.organization,
        purpose: credential.purpose, scope: credential.scope, credentialHash: credential.credentialHash,
      }, credential.userId, new Date());
      credential.status = 'REVOKED';
      res.json({ credential });
    } catch {
      res.status(500).json({ error: 'Consent could not be revoked.' });
    }
  });

  app.use('/platform', platformApp);
  app.use('/lender', lenderApp);
  app.use('/verifier', verifierApp);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`FlowProof backend listening on port ${PORT}`);
    console.log(`Platform: /platform`);
    console.log(`Lender: /lender`);
    console.log(`Verifier: /verifier`);
  });

  const shutdown = () => {
    console.log('\nShutting down FlowProof server...');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start FlowProof backend:', err);
  process.exit(1);
});
