import type { CollectionAfterOperationHook } from 'payload'

export const MEDIA_REFERENCED_ERROR_CODE = 'MEDIA_REFERENCED' as const

type BulkDeleteShape = {
  docs?: unknown
  errors?: unknown
}

/** Ensures bulk delete responses always include `docs` and `errors` arrays for admin `DeleteMany`. */
export function createSanityMediaDeleteAfterOperationHook(): CollectionAfterOperationHook {
  return ({ operation, result }) => {
    if (operation !== 'delete') {
      return result
    }

    if (result == null || typeof result !== 'object') {
      return { docs: [], errors: [] } as typeof result
    }

    const bulk = result as BulkDeleteShape & Record<string, unknown>
    const docs = Array.isArray(bulk.docs) ? bulk.docs : []
    const errors = Array.isArray(bulk.errors) ? bulk.errors : []

    if (docs === bulk.docs && errors === bulk.errors) {
      return result
    }

    return {
      ...bulk,
      docs,
      errors,
    } as typeof result
  }
}
