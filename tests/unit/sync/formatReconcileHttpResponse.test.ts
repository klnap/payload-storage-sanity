import { describe, expect, test } from 'bun:test'

import { formatReconcileHttpResponse } from '../../../src/sync/reconcile.js'

describe('formatReconcileHttpResponse', () => {
  test('dry run returns wouldUpdate', () => {
    expect(
      formatReconcileHttpResponse({
        dryRun: true,
        scanned: 10,
        synced: 2,
        markedUnavailable: 1,
        skipped: 7,
        errors: 0,
        duplicates: 2,
        rows: [],
      })
    ).toEqual({ dryRun: true, scanned: 10, wouldUpdate: 3, duplicates: 2 })
  })

  test('live run returns updated', () => {
    expect(
      formatReconcileHttpResponse({
        dryRun: false,
        scanned: 5,
        synced: 1,
        markedUnavailable: 0,
        skipped: 4,
        errors: 0,
        duplicates: 0,
        rows: [],
      })
    ).toEqual({ dryRun: false, scanned: 5, updated: 1, duplicates: 0 })
  })
})
