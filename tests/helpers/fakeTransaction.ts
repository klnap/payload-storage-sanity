/**
 * Fake Payload transaction for the Sanity asset lock. Every statement run on it is pushed to `log`
 * in order, so tests can assert the lock is taken before the scan, upload or delete.
 */
export function fakeTransaction(log: string[] = []) {
  const execute = async (query: string) => {
    log.push(query)
    const rows =
      query === 'show transaction_isolation' ? [{ transaction_isolation: 'read committed' }] : []
    return { rows }
  }

  return {
    transactionID: 'tx-1',
    db: {
      packageName: '@payloadcms/db-postgres',
      sessions: {
        'tx-1': { db: { execute }, reject: async () => {}, resolve: async () => {} },
      },
    },
  }
}
