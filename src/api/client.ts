import type {
  Agreement, Applicant, Consent, DataRequestInput, DataRequestResult, FetchSummary, LedgerEvent,
  Mandate, MatchesResponse, MerchantProfile, Offer, OfferTerms, Repayment, Snapshot, UserId,
} from './types';
import { MockClient } from '../mock/mockClient';
import { HttpClient } from './httpClient';

/** One interface for the whole UI. MockClient and HttpClient both implement it. */
export interface ApiClient {
  readonly mode: 'mock' | 'http';

  // Platform service (Module B)
  listProfiles(): Promise<MerchantProfile[]>;
  login(userId: UserId): Promise<{ token: string; profile: MerchantProfile }>;
  createConsent(input: { userId: UserId; expiryDays: number }): Promise<Consent>;
  getConsent(id: string): Promise<Consent>;
  revokeConsent(id: string): Promise<Consent>;
  fetchConsentData(id: string): Promise<FetchSummary>;
  createSnapshot(consentId: string): Promise<Snapshot>;
  getMatches(snapshotId: string): Promise<MatchesResponse>;
  getOfferForConsent(consentId: string): Promise<Offer | null>;
  acceptOffer(offerId: string): Promise<Agreement>;
  createMandate(agreementId: string): Promise<Mandate>;
  runRepayment(agreementId: string, opts: { forceFail: boolean }): Promise<Repayment>;
  getTimeline(consentId: string | 'all'): Promise<LedgerEvent[]>;

  // Lender service (Module D)
  listApplicants(): Promise<Applicant[]>;
  requestData(input: DataRequestInput): Promise<DataRequestResult>;
  postOffer(input: { consentId: string; terms: OfferTerms }): Promise<Offer>;
  listAgreements(): Promise<Agreement[]>;

  // Demo-only controls. Present on the mock; undefined against real services.
  demo?: {
    reset(): Promise<void>;
    setClockOffsetDays(days: number): void;
  };
}

const useMock = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false';

export const api: ApiClient = useMock
  ? new MockClient()
  : new HttpClient(
      import.meta.env.VITE_API_BASE ?? 'http://localhost:4000',
      import.meta.env.VITE_LENDER_API_BASE ?? 'http://localhost:4100',
    );
