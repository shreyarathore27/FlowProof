# Drunix Integration & Architecture — FlowProof

> **NPCI x Citi Hackathon · Problem Statement 4: Financial Inclusion**  
> *Transforming Consented Micro-Merchant UPI Cashflows into Verifiable Credit on the Drunix Multi-Party Ledger.*

---

## 1. Executive Summary & The Role of Drunix

### What is Drunix?
**Drunix** is a high-performance, permissioned Distributed Ledger Technology (DLT) framework initiated by the **National Payments Corporation of India (NPCI)** designed to handle multi-party financial workflows, inter-bank settlement, digital identity, and verifiable consent at national scale.

### Why is Drunix Essential for FlowProof?
In traditional lending, micro-merchants (kirana stores, tailors, vendors) are excluded from formal credit because:
1. They lack audited financial statements, property collateral, or formal credit bureau scores (CIBIL).
2. However, they generate **consistent, daily UPI transaction volumes** demonstrating clear cashflow and debt serviceability.
3. Lenders cannot simply trust a platform's database export of transaction logs (which could easily be manipulated or forged).
4. Merchants cannot risk exposing their raw UPI customer transactions to third-party lenders due to privacy and regulatory constraints (India's Digital Personal Data Protection Act / DPDP).

**Drunix bridges this trust deficit without compromising data privacy.** It acts as an immutable, shared truth layer across three distinct organizations:
- **PlatformOrg**: The UPI merchant aggregator / platform where transactions occur.
- **VerifierOrg**: An independent auditing authority that independently recomputes and co-signs analytical signals.
- **LenderOrg**: The financial institution (bank / NBFC) issuing credit.

Neither party can rewrite history, forge financial signals, or access data outside explicit, cryptographic merchant consent.

---

## 2. Core Use Cases of Drunix in FlowProof

| Use Case | How Drunix Solves It | Privacy & Efficiency Mechanism |
|---|---|---|
| **1. Verifiable & Revocable Consent** | Consent parameters (`scope`, `expiry`, `grantedTo`, `dataTypes`) are recorded on-chain. Revocation is immediately committed and stops all subsequent data access across the network. | Pseudonymous `merchantId` on-chain. Scope specified as granular field names. |
| **2. Dual-Endorsed Financial Snapshots** | Aggregated financial signals (regularity, growth trend, repayment buffer) are committed as a SHA-256 hash with an off-chain salt. Both **PlatformOrg** and **VerifierOrg** must endorse the block. | Raw transactions **never touch the ledger**. Only the deterministic hash and `ruleSetVersion` are on-chain. |
| **3. Transparent Algorithmic Credit Scoring** | The exact rules engine version (`ruleSetVersion = sha256(canonical(rules.json))`) is anchored alongside the snapshot. | Proves to auditors and regulators which algorithmic thresholds evaluated the loan eligibility. |
| **4. On-Chain Access Enforcement (`RequestData`)** | Lenders cannot pull data arbitrarily. The chaincode enforces five sequential checks (`CONSENT_NOT_FOUND`, `WRONG_CALLER_ORG`, `CONSENT_REVOKED`, `CONSENT_EXPIRED`, `PURPOSE_OUT_OF_SCOPE`). | Refusals are recorded on-chain with reason codes for complete compliance auditing. |
| **5. Private Offer & Agreement Lifecycle** | Lenders post offers using `termsHash` (salted hash). Full terms remain off-chain in private collections; only commitments and acceptance events go on-chain. | Prevents competing lenders from front-running commercial loan pricing. |
| **6. Closed-Loop Repayment & AutoPay Tracking** | Mandate registration (`MND-...`) and weekly debit events (`RecordRepayment`) are written as sequential blocks on the ledger. | Establishes a verifiable repayment track record that merchants can use for future credit upgrades. |

---

## 3. High-Efficiency Architectural Design

### The "Off-Chain Data, On-Chain Commitment" Pattern
Blockchains are notoriously inefficient for storing high-frequency payment transactions. FlowProof achieves **ultra-high throughput and DPDP compliance** via strict separation:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          OFF-CHAIN LAYER                               │
│  - Raw UPI Transactions (9,000+ per merchant)                          │
│  - Sensitive Persona Data (Name, Phone, UPI VPA, Bank Details)         │
│  - Detailed Loan Contract Terms & Random Salts                         │
│  - Physical Data Shredding on Consent Revocation                       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ SHA-256 Hash + Salt Commitment
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DRUNIX LEDGER LAYER                             │
│  - Cryptographic Commitments (SnapshotHash, TermsHash)                 │
│  - Rule Engine Version (ruleSetVersion)                                │
│  - Multi-Party Endorsements (PlatformOrg + VerifierOrg Signatures)     │
│  - Consent Status (ACTIVE / REVOKED) & Expiry Date                     │
│  - Immutable Audit Hash-Chain (prev.hash -> block.hash)                │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Zero Raw Financial Data On-Chain:** Even if a malicious actor dumps the ledger, they obtain only irreversible SHA-256 hashes and pseudonymous IDs.
2. **DPDP Compliance & "Right to be Forgotten":** When a merchant clicks **Revoke Consent**, the backend physically purges off-chain transaction files. Drunix commits a `RevokeConsent` event documenting that `N` transactions were deleted.
3. **Fixed Transaction Payload ($O(1)$ Storage):** Every block is small and predictable (under 1 KB), regardless of whether the merchant has 10 transactions or 10,000,000 transactions.

---

## 4. Multi-Party Network Topology

The project is structured into three isolated service listeners running dedicated organizational contexts:

```
                            ┌────────────────────────────────┐
                            │      Merchant Web Client       │
                            │   (React + Vite on Port 5173)  │
                            └───────────────┬────────────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               │ HTTP: 4000                 │ HTTP: 4100                 │ HTTP: 4200
               ▼                            ▼                            ▼
   ┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
   │     PlatformOrg       │    │       LenderOrg       │    │      VerifierOrg      │
   │   (Port 4000 HTTP)    │    │   (Port 4100 HTTP)    │    │   (Port 4200 HTTP)    │
   │  - Merchant Login     │    │  - Applicant Explorer │    │  - Independent Data   │
   │  - Consent Grant/Rev  │    │  - Data Request Check │    │    Pull from Source   │
   │  - Signal Computation │    │  - Private Offer Post │    │  - Hash Verification  │
   │  - Mandate/Repayment  │    │  - Agreement Monitor  │    │  - Snapshot Co-Sign   │
   └───────────┬───────────┘    └───────────┬───────────┘    └───────────┬───────────┘
               │                            │                            │
               │   Calls Ledger as          │   Calls Ledger as          │   Calls Ledger as
               │   'PlatformOrg'            │   'LenderOrg'              │   'VerifierOrg'
               ▼                            ▼                            ▼
   ┌─────────────────────────────────────────────────────────────────────────────────┐
   │                             Drunix Ledger Engine                                │
   │                     (SimulatedLedger / Fabric Gateway ABI)                      │
   │                                                                                 │
   │  Channel: `flowproof-channel`                                                   │
   │  Chaincode: `flowproof v0.3 (Go Specification)`                                 │
   │  Storage: `server/storage/ledger.json` (SHA-256 Hash Chain)                     │
   │  Endorsement Policy: `AnchorSnapshot: PlatformOrg AND VerifierOrg`              │
   └─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Codebase Implementation Breakdown

Every piece of the Drunix architecture is implemented in the repository:

### 1. `server/ledger/Ledger.ts` — The 10 Chaincode Methods
Defines the `Ledger` interface and `SimulatedLedger` implementation with cryptographic SHA-256 block chaining:
- **`init()`**: Writes genesis block `0: ChannelConfig` declaring channel name, chaincode version, and endorsement policies.
- **`grantConsent(callerOrg, params, userId, now)`**: Enforces `callerOrg === 'PlatformOrg'`, records consent parameters with pseudonymous `merchantId`.
- **`revokeConsent(callerOrg, params, userId, now)`**: Enforces `callerOrg === 'PlatformOrg'`, records off-chain data deletion count.
- **`anchorSnapshot(callerOrg, params, userId, now)`**: Platform anchors initial snapshot hash; status marked `pendingCosign`.
- **`cosignSnapshot(callerOrg, params, now)`**: Enforces `callerOrg === 'VerifierOrg'`. Verifier verifies independent hash and attaches second signature.
- **`requestData(callerOrg, params, now, resolveConsent, latestSnapshotId)`**: Evaluates 5 refusal checks. Writes `ALLOWED` or `REFUSED` event.
- **`postOffer(callerOrg, params, userId, now)`**: Enforces `callerOrg === 'LenderOrg'`. Confirms valid prior `ALLOWED` data request before posting terms hash.
- **`acceptOffer(callerOrg, params, userId, now)`**: Enforces `callerOrg === 'PlatformOrg'`. Converts open offer into legally binding agreement.
- **`recordMandate(callerOrg, params, userId, now)`**: Records recurring UPI AutoPay authorization reference.
- **`recordRepayment(callerOrg, params, userId, now)`**: Records debit outcome (`SUCCESS` or `FAILED`), cycle number, and timestamp.
- **`getHistory(consentId)`**: Returns the cryptographic event timeline.

### 2. `server/data/DataSource.ts` — Privacy & Data Isolation
- Houses synthetic payment histories for personas (`ravi`, `meena`).
- Maps `userId` to a pseudonymous `merchantId: MER-...` stored on-chain.
- Physical revocation logic: `revokeConsent()` permanently clears off-chain transaction records from memory/cache.

### 3. `server/verifier/verifierApp.ts` & `verifierInternal.ts` — Independent Verification
- Runs on port 4200.
- Implements `POST /cosign`.
- **Key Security Guarantee**: The verifier **does not trust** the signals provided by the platform. It independently queries `DataSource.fetchTransactions(consentId)`, runs `computeSignals()`, re-computes `sha256(canon({ consentId, signals, salt }))`, and rejects the transaction with `HTTP 422 Hash Mismatch` if there is any discrepancy.

### 4. `server/lender/lenderApp.ts` — Chain-Restricted Lender View
- Runs on port 4100.
- `GET /applicants`: Only reads publicly anchored ledger events (`GrantConsent`, `AnchorSnapshot`). Never accesses raw platform databases.
- `POST /data-requests`: Submits request to Drunix chaincode. Only if the chaincode returns `ALLOWED` does the lender proceed to offer creation.
- `POST /offers`: Generates off-chain `termsSalt`, records `termsHash = sha256(canon({ ...terms, salt }))` on-chain.

### 5. `server/config/rules.json` & `server/lib/signals.ts` — Rule-Set Anchoring
- Credit criteria and product thresholds live in JSON.
- `ruleSetVersion` is computed at boot as:
  $$\text{ruleSetVersion} = \text{SHA-256}(\text{canonical}(\text{SIGNAL\_CFG} + \text{RULES}))$$
- This guarantees algorithmic auditability: if the lending criteria change, the hash changes, preventing retroactive rule manipulation.

### 6. `src/pages/LedgerPage.tsx` — Front-End Ledger Explorer
- Provides a real-time, block-by-block visual explorer of the Drunix ledger.
- Displays block numbers, transaction hashes, previous block hashes, organization badges (`PlatformOrg`, `VerifierOrg`, `LenderOrg`), status stamps (`VALID`, `ALLOWED`, `REFUSED`, `FAILED`), and human-readable field breakdowns.

---

## 6. Detailed Chaincode Function Reference

| # | Chaincode Function | Authorized Caller | Key Inputs | Event Recorded | Drunix State Transition |
|---|---|---|---|---|---|
| 0 | `ChannelConfig` | Network Admin | Channel specs, endorsement rules | `VALID` | Genesis block created with `0000...` previous hash. |
| 1 | `GrantConsent` | `PlatformOrg` | `consentId`, `merchantId`, `scope`, `expiresAt` | `VALID` | Consent registered; status marked `ACTIVE`. |
| 2 | `RevokeConsent` | `PlatformOrg` | `consentId`, `txCountDeleted` | `VALID` | Consent status updated to `REVOKED`; data deleted. |
| 3 | `AnchorSnapshot` | `PlatformOrg` | `snapshotId`, `consentId`, `snapshotHash`, `ruleSetVersion` | `VALID` | Initial snapshot anchored; pending verifier endorsement. |
| 4 | `CosignSnapshot` | `VerifierOrg` | `snapshotId`, `snapshotHash` | `VALID` | Verifier co-signs; snapshot achieves dual endorsement. |
| 5 | `RequestData` | `LenderOrg` | `consentId`, `requesterOrg`, `purpose` | `ALLOWED` / `REFUSED` | Evaluates consent rules; logs refusal reason if failed. |
| 6 | `PostOffer` | `LenderOrg` | `offerId`, `consentId`, `termsHash` | `VALID` | Offer committed; verified against prior data request. |
| 7 | `AcceptOffer` | `PlatformOrg` | `offerId`, `agreementId`, `termsHash` | `VALID` | Offer status set to `ACCEPTED`; Agreement created. |
| 8 | `RecordMandate` | `PlatformOrg` | `agreementId`, `mandateRef` | `VALID` | UPI AutoPay mandate linked to active agreement. |
| 9 | `RecordRepayment` | `PlatformOrg` | `agreementId`, `mandateRef`, `cycle`, `result` | `VALID` / `FAILED` | Repayment debit outcome committed to audit trail. |

---

## 7. How to Verify the Drunix Integration

### Method A: Automated Integration Suite
Run the 17-step end-to-end test suite that exercises every single chaincode function:
```bash
node server/test-flow.js
```
**Expected Output:**
```
--- Testing FlowProof Backend End-to-End ---
1. Dev reset complete.
2. Login: Logged in as Ravi Kumar (Ravi General Store)
3. Consent created: id=CNS-RAV-..., status=ACTIVE
4. Signals summary: 9214 transactions, 4 computed signals
5. Snapshot anchored & cosigned: id=SNP-..., cosignedBy=PlatformOrg, VerifierOrg
6. Product matches evaluated: 3 products, explanation source=template
7. Lender applicants: 2 applicant(s) found
8. Lender data request: status=ALLOWED
9. Lender posted offer: id=OFR-..., status=OPEN, termsHash=...
10. Merchant retrieved offer: Micro Working Capital
11. Offer accepted: agreementId=AGR-...
12. Mandate created: ref=MND-...
13. Repayment 1: cycle=1, status=SUCCESS
14. Repayment 2 (fail test): cycle=2, status=FAILED, reason=Insufficient balance
15. Ledger timeline: 10 events recorded in hash-chain.
    Events recorded: ChannelConfig -> GrantConsent -> AnchorSnapshot -> AnchorSnapshot -> RequestData -> PostOffer -> AcceptOffer -> RecordMandate -> RecordRepayment -> RecordRepayment
    [VERIFIED] SHA-256 hash-chain integrity 100% valid!
16. Revocation: consent status=REVOKED
17. Post-revocation data request: status=REFUSED, reason="CONSENT_REVOKED: revoked by the merchant"

>>> ALL 17 END-TO-END FLOW TESTS PASSED PERFECTLY! <<<
```

### Method B: Live Storage Inspection
Inspect the persisted hash chain directly in:
```bash
server/storage/ledger.json
```
Verify that:
- Each block's `prev` matches the prior block's `hash`.
- Each block's `hash` equals `SHA256(canonicalJSON(blockFields))`.

### Method C: Visual UI Verification
1. Start the backend: `npm run server`
2. Start the frontend: `npm run dev`
3. Open `http://localhost:5173` in your browser.
4. Click **Ledger** in the navigation header to view the live, animated Drunix Hash-Chain explorer.
