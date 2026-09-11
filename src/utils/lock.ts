const activeLocks = new Map<string, Promise<void>>()

/**
 * Serializes async operations for a given hash key so concurrent uploads do not race.
 */
export async function withContentHashLock<T>(
  contentHash: string,
  fn: () => Promise<T>
): Promise<T> {
  const current = activeLocks.get(contentHash)
  if (current) {
    await current
  }

  let resolveLock!: () => void
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve
  })
  activeLocks.set(contentHash, lockPromise)

  try {
    return await fn()
  } finally {
    activeLocks.delete(contentHash)
    resolveLock()
  }
}
