import type { PayloadRequest } from 'payload'

import { enTestT } from './enTestT'

/** Minimal `req` for adapter/hook tests that need `req.t`. */
export function mockPayloadReq(overrides: Partial<PayloadRequest> = {}): PayloadRequest {
  return {
    t: enTestT,
    ...overrides,
  } as PayloadRequest
}
