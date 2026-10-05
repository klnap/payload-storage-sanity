import type { CollectionBeforeOperationHook } from 'payload'

import {
  countDeleteTargetsFromWhere,
  isBulkMediaDeleteFromWhere,
} from '../utils/bulkDelete'
import {
  mergeSanityStorageContext,
  SANITY_STORAGE_CONTEXT_KEY,
} from '../populate/requestContext'

/** Marks bulk media delete on `req.context` for compact reference-integrity errors. */
export function createSanityMediaBulkDeleteBeforeOperationHook(): CollectionBeforeOperationHook {
  return ({ args, operation, req }) => {
    if (operation !== 'delete') {
      return args
    }

    const where = 'where' in args ? (args as { where?: unknown }).where : undefined
    const whereClause =
      where != null && typeof where === 'object' ? (where as Parameters<typeof countDeleteTargetsFromWhere>[0]) : undefined

    if (!isBulkMediaDeleteFromWhere(whereClause)) {
      return args
    }

    const bulkDeleteTargetCount = countDeleteTargetsFromWhere(whereClause)

    if (!req.context) {
      req.context = {}
    }

    const record = req.context as Record<string, unknown>
    record[SANITY_STORAGE_CONTEXT_KEY] = mergeSanityStorageContext(record[SANITY_STORAGE_CONTEXT_KEY], {
      bulkDelete: true,
      bulkDeleteTargetCount,
    })

    return args
  }
}
