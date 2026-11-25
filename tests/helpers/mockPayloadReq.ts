import type { PayloadRequest } from 'payload'

import { enTestT } from './enTestT'
import { fakeTransaction } from './fakeTransaction'

/** Minimal `req` for adapter/hook tests that need `req.t`. Carries a fake transaction for the Sanity asset lock. */
export function mockPayloadReq(overrides: Partial<PayloadRequest> = {}): PayloadRequest {
  const { transactionID, db } = fakeTransaction()
  return {
    t: enTestT,
    transactionID,
    payload: { db },
    ...overrides,
  } as PayloadRequest
}
