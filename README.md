# FlowProof web (Module E)

React + Vite + TypeScript + Tailwind frontend for FlowProof (Drunix Hackathon, PS4 Financial Inclusion).
It has a merchant portal, a lender portal and a shared ledger timeline, plus a one-click demo of the section 17 script.

## Run

```bash
npm install
cp .env.example .env      # VITE_USE_MOCK=true by default
npm run dev               # http://localhost:5173
```

Other commands: `npm run build` (typecheck + production build into `dist/`), `npm run preview`, `npm run typecheck`.

## Mock vs real backend

| `VITE_USE_MOCK` | What the UI talks to |
| --- | --- |
| `true` (default) | `src/mock/mockClient.ts`, an in-browser stand-in for the platform service, lender service, verifier, mock AutoPay and chaincode. No services needed. |
| `false` | `src/api/httpClient.ts`, which calls `VITE_API_BASE` (platform, Module B) and `VITE_LENDER_API_BASE` (lender, Module D). |

Both implement the `ApiClient` interface in `src/api/client.ts`, so no page code changes when you switch.
The mock enforces the same rules the chaincode must: RequestData refuses on no consent, wrong org, revoked, expired and out-of-scope, and AnchorSnapshot needs the verifier's recomputed hash to match.

The "Advance ledger clock +91 days" button and **Reset** only exist on the mock (`api.demo`). They are hidden against real services.

## Layout

```
src/
  api/        types.ts (UI contract), client.ts (ApiClient + mock flag), httpClient.ts
  mock/       config.ts (illustrative rules/thresholds, demo profiles), mockClient.ts
  state/      store.ts (small external store), actions.ts (all API calls), demo.ts (demo script)
  components/ Chrome.tsx (top bar, sidebar, toasts, narrator), SignalCard.tsx, ui.tsx
  pages/      merchant/* (Landing, Consent, Signals, Options, Offer, Account), lender/ApplicantsPage, LedgerPage
  styles/     tailwind.css, app.css (design tokens + component classes, light and dark)
```

Styling: `app.css` holds the design tokens and component classes ported from the prototype. `tailwind.config.js` maps the same tokens (`bg-surface`, `text-muted`, `text-primary` and so on), so Tailwind utilities and the component classes share one palette. Pages use the component classes for the designed pieces and Tailwind utilities for small layout needs.

## Contract deviations to confirm (add to CONTRACTS.md or change)

These are used by `httpClient.ts` but are not in the section 14 endpoint list given in the prompt pack:

1. `GET /auth/profiles` returns the seeded demo users for the sign-in screen.
2. `POST /consents/:id/fetch` returns a **signals summary** (`FetchSummary`: transaction count, four signals with label and reason, chart aggregates, ruleSetVersion), never raw transactions.
3. `GET /consents/:id/offer` lets the merchant read the offer posted against their consent.
4. `POST /agreements/:id/repayments?forceFail=true|false` triggers one mock AutoPay debit and records `RecordRepayment`.
5. `GET /ledger/timeline/all` gives a whole-channel view for the demo. Per-consent `GET /ledger/timeline/:consentId` is unchanged.
6. `GET /applicants` (lender service) returns merchants with chain-visible consent and snapshot fields only.
7. `POST /data-requests` body is `{ userId, consentId?, callerOrg, purpose }`. In production `callerOrg` must come from the service's Drunix identity, not the request body. The UI only sends it so the demo can show the wrong-org refusal.

## Known limitations

- The explanation text in the mock is a fixed template (`source: 'template'`). The real LLM explainer is Module C.
- The lender name (Kosh Capital), offer defaults and product thresholds are illustrative placeholders.
- No routing library: pages are switched from app state to keep the demo simple. Add React Router if you need deep links.
- Timestamps display in IST.
