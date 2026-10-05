import type { Where } from 'payload'

import type { SanityStorageRequestContext } from '../populate/requestContext'

function readIdCondition(where: Where | undefined): Record<string, unknown> | undefined {
  if (where == null || typeof where !== 'object') {
    return undefined
  }

  const direct = (where as { id?: unknown }).id
  if (direct != null && typeof direct === 'object') {
    return direct as Record<string, unknown>
  }

  const and = (where as { and?: unknown }).and
  if (!Array.isArray(and)) {
    return undefined
  }

  for (const clause of and) {
    if (clause == null || typeof clause !== 'object') {
      continue
    }
    const id = (clause as { id?: unknown }).id
    if (id != null && typeof id === 'object') {
      return id as Record<string, unknown>
    }
  }

  return undefined
}

/** Number of explicit IDs in a bulk delete `where` (`id.in`), when known. */
export function countDeleteTargetsFromWhere(where: Where | undefined): number | undefined {
  const idCond = readIdCondition(where)
  if (!idCond) {
    return undefined
  }

  const inList = idCond.in
  if (Array.isArray(inList)) {
    return inList.length
  }

  if (idCond.equals != null) {
    return 1
  }

  return undefined
}

export function isBulkMediaDeleteFromWhere(where: Where | undefined): boolean {
  const count = countDeleteTargetsFromWhere(where)
  if (count != null) {
    return count > 1
  }

  const idCond = readIdCondition(where)
  if (idCond?.not_equals != null) {
    return true
  }

  return false
}

export function isBulkMediaDelete(
  context: SanityStorageRequestContext | undefined,
  where: Where | undefined
): boolean {
  if (context?.bulkDelete === true) {
    return true
  }
  return isBulkMediaDeleteFromWhere(where)
}
