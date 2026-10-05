export type PayloadDocumentId = number | string

export function isPayloadDocumentId(value: unknown): value is PayloadDocumentId {
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return false
}

export function payloadDocumentIdsEqual(
  a: PayloadDocumentId,
  b: PayloadDocumentId
): boolean {
  if (a === b) return true
  return String(a) === String(b)
}
