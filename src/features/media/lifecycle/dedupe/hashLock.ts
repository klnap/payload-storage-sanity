const activeLocks = new Map<string, Promise<void>>()

/**
 * Serializes in-process preflight work for a given hash key.
 */
export async function withContentHashLock<T>(
  contentHash: string,
  fn: () => Promise<T>
): Promise<T> {
  const previous = activeLocks.get(contentHash)
  const { promise: lockPromise, resolve: resolveLock } = Promise.withResolvers<void>()
  activeLocks.set(contentHash, lockPromise)

  try {
    await previous
    return await fn()
  } finally {
    resolveLock()
    if (activeLocks.get(contentHash) === lockPromise) {
      activeLocks.delete(contentHash)
    }
  }
}
