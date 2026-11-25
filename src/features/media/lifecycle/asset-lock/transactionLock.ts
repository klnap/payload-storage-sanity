import type { PayloadRequest } from 'payload'

const POSTGRES_ADAPTER_PATTERN = /postgres/
const LOCK_KEY_PATTERN = /^[A-Za-z0-9:_-]+$/

type TransactionQueryable = {
  execute: (query: string) => Promise<{ rows: Array<Record<string, unknown>> }>
}

/**
 * Takes a transaction-scoped Postgres advisory lock for `key` on the request's own transaction. The lock
 * lasts until that transaction commits or rolls back, so two transactions that lock the same key run one
 * after the other. Returns false on adapters without advisory locks. On Postgres it throws when the
 * transaction is unreachable or not READ COMMITTED, because the lock then does not close the race.
 * `label` names the caller in those errors.
 */
export async function lockTransactionKey(
  req: Partial<PayloadRequest> | undefined,
  key: string,
  label: string
): Promise<boolean> {
  // Keys are inlined into the SQL text, so they must be a plain token.
  if (!LOCK_KEY_PATTERN.test(key)) {
    throw new Error(`${label} key contains characters that are not allowed.`)
  }

  const db = req?.payload?.db
  if (db == null) {
    throw new Error(`${label} needs the Payload request; refusing without it.`)
  }
  if (!POSTGRES_ADAPTER_PATTERN.test(db.packageName)) return false

  const transactionID = await req?.transactionID
  const session = transactionID == null ? undefined : db.sessions?.[String(transactionID)]
  const tx = session?.db as TransactionQueryable | undefined
  if (tx == null || typeof tx.execute !== 'function') {
    throw new Error(`${label} needs the request transaction; refusing without it.`)
  }

  // Reject snapshot-isolated transactions before taking a lock they would hold until transaction end.
  const isolation = await tx.execute('show transaction_isolation')
  if (isolation.rows[0]?.transaction_isolation !== 'read committed') {
    throw new Error(`${label} requires READ COMMITTED transactions.`)
  }
  // A snapshot taken before the lock would not see a row committed by the lock holder.
  await tx.execute(`select pg_advisory_xact_lock(hashtext('${key}'))`)
  return true
}
