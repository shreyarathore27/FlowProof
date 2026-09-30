import type { ApiClient } from './client';
import type {
  Agreement, Applicant, Consent, DataRequestInput, DataRequestResult, FetchSummary, LedgerEvent,
  Mandate, MatchesResponse, MerchantProfile, Offer, OfferTerms, Repayment, Snapshot, UserId,
} from './types';

/**
 * Real-service client. Paths follow section 14 of the solution doc.
 * Endpoints marked DEVIATION are not in section 14 yet; add them to CONTRACTS.md
 * (or change the UI) before wiring the backend.
 */
export class HttpClient implements ApiClient {
  readonly mode = 'http' as const;
  private token: string | null = null;

  constructor(private platformBase: string, private lenderBase: string) {}

  private async req<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }
  private get = <T>(b: string, p: string) => this.req<T>(b, p);
  private post = <T>(b: string, p: string, body?: unknown) =>
    this.req<T>(b, p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

  // DEVIATION: demo login screen needs the seeded profiles.
  listProfiles() { return this.get<MerchantProfile[]>(this.platformBase, '/auth/profiles'); }

  async login(userId: UserId) {
    const r = await this.post<{ token: string; profile: MerchantProfile }>(this.platformBase, '/auth/login', { userId });
    this.token = r.token;
    return r;
  }
  createConsent(input: { userId: UserId; expiryDays: number }) {
    return this.post<Consent>(this.platformBase, '/consents', {
      grantedTo: ['LenderOrg'], scope: ['credit-assessment'], expiryDays: input.expiryDays,
    });
  }
  getConsent(id: string) { return this.get<Consent>(this.platformBase, `/consents/${id}`); }
  revokeConsent(id: string) { return this.post<Consent>(this.platformBase, `/consents/${id}/revoke`); }
  // Returns the computed signals summary (never raw transactions).
  fetchConsentData(id: string) { return this.post<FetchSummary>(this.platformBase, `/consents/${id}/fetch`); }
  createSnapshot(consentId: string) { return this.post<Snapshot>(this.platformBase, '/snapshots', { consentId }); }
  getMatches(snapshotId: string) { return this.get<MatchesResponse>(this.platformBase, `/snapshots/${snapshotId}/matches`); }
  // DEVIATION: merchant needs to read the offer posted against their consent.
  async getOfferForConsent(consentId: string) {
    const r = await this.get<{ offer: Offer | null }>(this.platformBase, `/consents/${consentId}/offer`);
    return r.offer;
  }
  acceptOffer(offerId: string) { return this.post<Agreement>(this.platformBase, `/offers/${offerId}/accept`); }
  createMandate(agreementId: string) { return this.post<Mandate>(this.platformBase, `/agreements/${agreementId}/mandate`); }
  // DEVIATION: triggers one debit on the mock AutoPay and records RecordRepayment.
  runRepayment(agreementId: string, opts: { forceFail: boolean }) {
    return this.post<Repayment>(this.platformBase, `/agreements/${agreementId}/repayments${opts.forceFail ? '?forceFail=true' : ''}`);
  }
  // 'all' is a DEVIATION (whole-channel view for the demo); per-consent is in section 14.
  getTimeline(consentId: string | 'all') {
    return this.get<LedgerEvent[]>(this.platformBase, `/ledger/timeline/${consentId}`);
  }

  // Lender service
  // DEVIATION: list of merchants with chain-visible consent + snapshot fields.
  listApplicants() { return this.get<Applicant[]>(this.lenderBase, '/applicants'); }
  requestData(input: DataRequestInput) { return this.post<DataRequestResult>(this.lenderBase, '/data-requests', input); }
  postOffer(input: { consentId: string; terms: OfferTerms }) { return this.post<Offer>(this.lenderBase, '/offers', input); }
  listAgreements() { return this.get<Agreement[]>(this.lenderBase, '/agreements'); }

  // Demo controls wired to platform dev endpoints
  readonly demo = {
    reset: async () => {
      await this.post(this.platformBase, '/dev/reset');
    },
    setClockOffsetDays: (days: number) => {
      this.post(this.platformBase, '/dev/clock', { offsetDays: days }).catch(console.error);
    },
  };
}
