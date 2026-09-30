# FlowProof

### A verifiable eligibility and offer layer for payment-active, credit-invisible micro-merchants

> FlowProof turns a micro-merchant's consented payment history into explainable financial signals, matches them with relevant financial products, identifies eligibility gaps, and records the complete journey from consent to offer acceptance and repayment on a shared Drunix ledger.

---

## Overview

Millions of small merchants transact digitally every day but remain **credit-invisible** to formal financial institutions.

They often:

* Have substantial digital payment activity but limited bureau history.
* Don't know which financial products they qualify for.
* Receive rejection without knowing why.
* Have to repeatedly provide the same financial information to different institutions.

**FlowProof addresses this gap by converting consented payment activity into explainable signals and a verifiable financial lifecycle.**

The platform enables merchants to:

1. Give consent to share their payment history.
2. Generate explainable financial signals.
3. Discover relevant financial products.
4. Understand why they match or what is missing.
5. Receive and accept offers.
6. Set up a repayment mandate.
7. Track the complete lifecycle through a permissioned Drunix ledger.
8. Revoke consent and prevent subsequent data requests.

---

## Problem

Payment-active micro-merchants can still struggle to access formal financial services.

The problem is not necessarily a lack of financial activity — their activity simply isn't being used as usable proof.

FlowProof focuses on three major gaps:

### 1. Financial discovery

Merchants don't know which credit, insurance, or savings products they may qualify for.

### 2. Lack of explainability

A merchant may be rejected without knowing what prevented eligibility or how they could improve their position.

### 3. Repeated verification

Users may have to repeatedly prove the same financial information to different institutions.

---

## Solution

FlowProof provides five core capabilities:

### 1. Consented Data Intake

Users explicitly grant consent specifying:

* Data scope
* Purpose
* Recipient
* Expiry

Transaction data is retrieved through a swappable data-source adapter.

### 2. Explainable Financial Signals

The system derives deterministic signals from transaction history, including:

* Income regularity
* Activity trend
* Repayment behaviour
* Savings buffer

Each signal is accompanied by a human-readable explanation.

### 3. Product Matching & Gap Analysis

A rules engine evaluates the signals against product criteria.

Instead of simply returning **"Eligible"** or **"Rejected"**, FlowProof provides:

* Matched products
* Reasons for the match
* Missing criteria
* Suggested ways to address the gaps

### 4. Verifiable Lifecycle

Important lifecycle events are recorded on Drunix, including:

* Consent
* Snapshot hash
* Rule-set version
* Verifier endorsement
* Data requests
* Offers
* Agreement acceptance
* Repayment events

### 5. Closed Repayment Loop

The prototype includes a mocked UPI AutoPay-style mandate and repayment cycle, with repayment events recorded on the same ledger.

---

## What Makes FlowProof Different?

Existing systems such as **Account Aggregator (AA)** and **OCEN** already enable consent-based financial data sharing and cash-flow-based lending.

FlowProof is designed as a layer on top of these concepts.

### Key differentiators

**Reproducible eligibility**

A hash of the signal snapshot and rule-set version is anchored on Drunix and co-signed by the verifier.

This allows participants to determine what information and rules the matching decision was based on.

**Gap analysis**

Instead of simply telling a user they do not qualify, FlowProof identifies the missing criteria and explains what could help address them.

**Closed, auditable lifecycle**

The prototype connects:

`Discovery → Consent → Verification → Matching → Offer → Acceptance → Repayment`

within one verifiable lifecycle.

**User-side discovery**

The experience begins with the merchant asking:

> "What financial products can I access?"

rather than starting from an institution's existing offer.

---

# User Personas

## Ravi — Primary Persona

A kirana shopkeeper who:

* Receives 40–60 UPI credits per day.
* Makes regular supplier payments.
* Has previously repaid a small loan.
* Has limited bureau history.
* Wants working capital, insurance, and savings options.

## Meena — Near-Miss Persona

A merchant with:

* Irregular inflows.
* No repayment history.
* A thin financial buffer.

Meena demonstrates how FlowProof can explain **what is missing** instead of simply rejecting the user.

## Lender

A financial institution that wants:

* Verified inputs.
* Consent-based access.
* Reproducible financial signals.
* Auditable data requests.
* Verifiable offers and agreements.

---

# MVP Features

| Feature             | Description                                    |
| ------------------- | ---------------------------------------------- |
| Consent Management  | Scope, purpose and expiry                      |
| Consent Revocation  | Prevents subsequent data requests              |
| Data Source Adapter | Synthetic AA-shaped data backend               |
| Signal Engine       | Four deterministic financial signals           |
| Snapshot Anchoring  | Hash + rule-set version + verifier endorsement |
| Rules Engine        | Matches users against illustrative products    |
| AI Explanations     | Plain-language explanations                    |
| Lender Requests     | Consent-controlled data requests               |
| Offers              | Lender-generated offers                        |
| Acceptance          | User acceptance recorded on ledger             |
| Mock Repayment      | Simulated mandate and repayment cycle          |
| Ledger Timeline     | Human-readable lifecycle history               |
| Dashboards          | Merchant and lender views                      |

---

# User Flow

## Merchant Flow

```text
Login
  ↓
Connect Payment History
  ↓
Grant Consent
  ↓
Fetch Transaction History
  ↓
Generate Financial Signals
  ↓
Verify & Anchor Snapshot
  ↓
View Financial Products
  ↓
Understand Matches & Gaps
  ↓
Select Product
  ↓
Receive Offer
  ↓
Accept Offer
  ↓
Create Repayment Mandate
  ↓
Record Repayment
  ↓
Revoke Consent
  ↓
Future Data Request → REFUSED
```

## Lender Flow

```text
View User Interest
       ↓
Request Data
       ↓
Check Consent on Drunix
       ↓
Request Allowed / Refused
       ↓
View Verified Snapshot
       ↓
Post Offer
       ↓
Track Acceptance
       ↓
Track Mandate & Repayment
```

---

# System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                          │
│                                                             │
│     Ravi Web App                    Lender Dashboard        │
│        React                            React               │
└───────────────┬───────────────────────────────┬─────────────┘
                │ REST                          │ REST
                ▼                               ▼
┌─────────────────────────────┐      ┌────────────────────────┐
│   PLATFORM BACKEND          │      │    LENDER SERVICE      │
│   Node.js + Express         │      │    Node.js              │
│                             │      │                         │
│ Auth · Consent              │      │ Requests · Offers       │
│ Signals · Rules             │      │ Drunix Identity         │
│ LLM Explainer               │      └────────────┬────────────┘
│ Data Adapter · Drunix       │                   │
└──────┬──────────┬───────────┘                   │
       │          │                               │
       ▼          ▼                               ▼
┌──────────┐ ┌──────────────┐        ┌────────────────────────┐
│ MongoDB  │ │ Data Sources │        │   VERIFIER SERVICE     │
│          │ │              │        │   Node.js               │
│ App Data │ │ Synthetic    │        │                         │
└──────────┘ │ AA (future)  │        │ Snapshot Co-signing     │
             │ SMS (future) │        └────────────┬────────────┘
             └──────────────┘                     │
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    DRUNIX NETWORK                           │
│                                                             │
│ PlatformOrg       VerifierOrg        LenderOrg              │
│                                                             │
│ Consent · Snapshots · Requests · Offers · Agreements        │
│                    Repayments · Audit Trail                 │
└─────────────────────────────────────────────────────────────┘
```

---

# Drunix Layer

FlowProof uses Drunix as the shared, permissioned state layer between the platform, verifier, and lender.

### Why Drunix?

MongoDB stores application data controlled by the application.

Drunix provides a shared multi-party ledger where important lifecycle events can be independently verified and attributed.

The prototype uses three separate organisational identities:

* `PlatformOrg`
* `VerifierOrg`
* `LenderOrg`

### Stored on Drunix

* Consent status
* Consent scope and expiry
* Snapshot hash
* Rule-set version
* Verifier endorsement
* Data requests
* Offer references
* Agreement acceptance
* Repayment events
* Audit history

### Stored off-chain

* Raw transactions
* Full signal values
* User profiles
* Product catalogue
* LLM explanations
* UI state

Offer terms are intended to be stored in private data accessible only to the relevant organisations, while their hash is recorded on the public ledger.

---

# Chaincode

The proposed chaincode model includes:

```text
ConsentRecord
SnapshotAnchor
DataRequest
Offer
Agreement
RepaymentEvent
```

### Core Functions

| Function          | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `GrantConsent`    | Creates a valid consent                      |
| `RevokeConsent`   | Revokes active consent                       |
| `AnchorSnapshot`  | Anchors a verified signal snapshot           |
| `RequestData`     | Checks whether a lender can access data      |
| `PostOffer`       | Creates an offer against a verified snapshot |
| `AcceptOffer`     | Records user acceptance                      |
| `RecordMandate`   | Records repayment mandate                    |
| `RecordRepayment` | Records repayment events                     |
| `GetHistory`      | Returns the ledger timeline                  |

`AnchorSnapshot` requires endorsement from both the platform and verifier organisations.

---

# Data Source Layer

The system uses a common data-source interface so that synthetic data can eventually be replaced with real sources without rewriting the application.

```text
DataSource {
  createConsent(userId, scope, purpose, expiry)
  getConsentStatus(consentRef)
  fetchTransactions(consentRef)
  revokeConsent(consentRef)
}
```

### Current & Future Sources

| Source                          | Status |
| ------------------------------- | ------ |
| Synthetic transaction generator | MVP    |
| AA sandbox adapter              | Future |
| SMS export parser               | Future |

The MVP uses synthetic data modelled around UPI/AA-style transaction structures.

---

# Financial Signals

FlowProof currently uses four deterministic signals:

| Signal              | What it measures                       |
| ------------------- | -------------------------------------- |
| Income Regularity   | Consistency of weekly inflows          |
| Activity Trend      | Change in transaction activity         |
| Repayment Behaviour | Recurring repayment behaviour          |
| Savings Buffer      | Available balance relative to outflows |

These signals are **indicators rather than verified business income**, since personal and business transactions may coexist in the same account.

Thresholds are configurable and versioned.

---

# Matching Engine

The rules engine evaluates:

```text
eligible(signals, product.criteria)
```

and produces:

```json
{
  "matched": false,
  "reasons": [
    "Income regularity: High",
    "Activity: Growing"
  ],
  "gaps": [
    {
      "criterion": "Repayment behaviour",
      "current": "None",
      "needed": "At least Mixed",
      "howToFix": "Complete one small loan repayment on time"
    }
  ]
}
```

### Illustrative Products

* Working-capital line
* Micro-insurance
* Recurring savings plan

The product thresholds are **illustrative** and should be replaced with verified criteria before real financial products or schemes are named.

---

# AI Layer

AI is intentionally **not responsible for eligibility decisions**.

### AI is used for:

* Converting structured results into plain-language explanations.
* Providing English/Hindi explanations.
* Future parsing of messy transaction/SMS formats.
* Future abnormal transaction detection.

### AI does NOT:

* Decide eligibility.
* Approve loans.
* Replace financial institutions.
* Create unsupported facts or numbers.

The LLM receives structured results from the rules engine. If the LLM call fails, the system falls back to template-based explanations.

---

# Tech Stack

| Layer          | Technology              |
| -------------- | ----------------------- |
| Frontend       | React + Vite + Tailwind |
| Backend        | Node.js + Express       |
| Language       | TypeScript              |
| Database       | MongoDB + Mongoose      |
| Ledger         | Drunix                  |
| Chaincode      | Go                      |
| Ledger Client  | Fabric Gateway SDK      |
| AI             | Anthropic API           |
| Authentication | JWT + Fabric identities |
| Infrastructure | Docker Compose          |

---

# Repository Structure

```text
flowproof/
│
├── chaincode/
│   └── Go chaincode
│
├── network/
│   └── Drunix network configuration
│
├── services/
│   ├── platform/
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   ├── signals/
│   │   │   ├── rules/
│   │   │   ├── ledger/
│   │   │   └── routes/
│   │   └── ...
│   │
│   ├── verifier/
│   ├── lender/
│   └── mock-upi-autopay/
│
├── web/
│   └── React application
│
├── data/
│   └── generator/
│
├── docs/
│
└── docker-compose.yml
```

---

# API Overview

## Platform

| Method | Endpoint                      | Purpose                      |
| ------ | ----------------------------- | ---------------------------- |
| POST   | `/auth/login`                 | Demo login                   |
| POST   | `/consents`                   | Create consent               |
| GET    | `/consents/:id`               | Get consent status           |
| POST   | `/consents/:id/revoke`        | Revoke consent               |
| POST   | `/consents/:id/fetch`         | Fetch transactions           |
| POST   | `/snapshots`                  | Generate and anchor snapshot |
| GET    | `/snapshots/:id/matches`      | Get matches and explanations |
| POST   | `/offers/:id/accept`          | Accept offer                 |
| POST   | `/agreements/:id/mandate`     | Create repayment mandate     |
| GET    | `/ledger/timeline/:consentId` | Get ledger history           |

## Verifier

```text
POST /cosign
```

Validates the snapshot and endorses its hash.

## Lender

```text
POST /data-requests
POST /offers
GET  /agreements
```

## Mock UPI AutoPay

```text
POST /mandates
POST /mandates/:id/debit
```

---

# Security & Privacy

FlowProof follows a data-minimisation approach.

### Key principles

* Raw transactions never go onto the ledger.
* Consent includes scope, purpose and expiry.
* Every data request checks consent status.
* Verifier and lender use separate identities.
* Snapshot anchoring requires verifier endorsement.
* Revocation blocks subsequent authorised requests.
* Off-chain data is stopped from being served and deleted after revocation or expiry.
* LLM explanations are restricted to structured inputs.
* Synthetic data is clearly disclosed during the demo.

---

# Real vs Mocked Integrations

| Component        | MVP                            |
| ---------------- | ------------------------------ |
| Drunix network   | **Real, local Docker network** |
| Chaincode        | **Real Go chaincode**          |
| Transaction data | **Synthetic**                  |
| AA integration   | Future                         |
| SMS ingestion    | Future                         |
| NPCI APIs        | Mock where required            |
| UPI AutoPay      | Mock                           |
| Product criteria | Illustrative                   |
| LLM              | Real Anthropic API             |
| KYC              | Skipped                        |

---

# Demo Flow

The prototype is designed around a **5-minute end-to-end demonstration**.

### 1. Merchant Profile

Introduce Ravi as a payment-active but credit-invisible merchant.

### 2. Consent

Ravi grants consent and the consent record appears on the ledger.

### 3. Signals

The system generates four financial signals and anchors the snapshot with a verifier co-signature.

### 4. Product Matching

Ravi sees:

* Matched products.
* Reasons for matching.
* A near-miss product.
* Missing criteria and possible fixes.

### 5. Lender Interaction

The lender requests data.

Drunix checks consent before allowing the request.

The lender then posts an offer.

### 6. Acceptance & Repayment

Ravi accepts the offer, creates a mock repayment mandate, and records a repayment.

### 7. Consent Revocation

Ravi revokes consent.

The lender attempts another request.

The request is rejected by the ledger.

---

# Build Plan

Development is ordered by technical risk:

| Phase | Focus                                |
| ----- | ------------------------------------ |
| 0     | Drunix network + three organisations |
| 1     | Consent and revocation               |
| 2     | Synthetic data + signals             |
| 3     | Snapshot anchoring + verifier        |
| 4     | Matching + gap analysis              |
| 5     | Offers + repayment                   |
| 6     | Frontend dashboards                  |
| 7     | Polish + documentation               |

The Drunix flow and consent revocation are core MVP components and should not be cut.

---

# Risks & Mitigations

| Risk                        | Mitigation                                            |
| --------------------------- | ----------------------------------------------------- |
| Drunix setup complexity     | Validate the network first                            |
| Unsupported Drunix features | Fall back to hashes/channels and document limitations |
| Scope creep                 | Freeze the MVP                                        |
| Similar projects            | Emphasise reproducible eligibility and gap analysis   |
| Synthetic data limitations  | Clearly disclose synthetic data                       |
| Arbitrary thresholds        | Keep thresholds versioned and illustrative            |
| LLM errors                  | Structured input + template fallback                  |
| Limited development time    | Cut secondary features before core ledger flow        |

---

# What We Do Not Claim

FlowProof does **not** claim to:

* Automatically approve loans.
* Replace financial institutions.
* Use AI to determine creditworthiness.
* Make lending safer simply because blockchain is used.
* Access real bank/UPI transaction data in the MVP.
* Provide live NPCI integrations.
* Replace Account Aggregator or OCEN infrastructure.
* Be the first consented portable financial profile.

### What we do claim

A working prototype demonstrating:

> **Consented data → Explainable signals → Gap-aware matching → Verifiable offers → Repayment → Auditable lifecycle**

on a permissioned Drunix network.

---

# Roadmap

### Phase 1 — Real Data

Integrate an AA sandbox such as Setu, Finvu, or OneMoney.

### Phase 2 — Payment Rails

Replace the mocked repayment flow with an appropriate NPCI sandbox integration.

### Phase 3 — More Financial Products

Expand beyond lending into:

* Insurance
* Savings
* Government benefit schemes

### Phase 4 — Advanced Signals

Add explainable anomaly detection and richer financial indicators.

### Phase 5 — Regulatory Hardening

Strengthen:

* DPDP consent artefacts
* Audit exports
* Data retention controls
* Regulatory workflows

---

# Current Open Items

Before production-oriented claims are made, the following need verification:

* Actual Drunix support for private data collections.
* Drunix endorsement-policy capabilities.
* Multi-organisation local network behaviour.
* Fabric Gateway SDK compatibility.
* Available NPCI APIs/sandboxes.
* Real product and scheme eligibility criteria.
* AA sandbox availability and suitability.
* Final hackathon judging criteria.

---

## Disclaimer

This project is a **hackathon prototype**. Transaction data, product criteria, and certain external integrations are mocked or illustrative unless explicitly stated otherwise.

Financial eligibility decisions in a production environment would remain subject to the relevant financial institution, regulatory requirements, verified data sources, and applicable policies.
