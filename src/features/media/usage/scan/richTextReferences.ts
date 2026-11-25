/**
 * Lexical stores media embedded in rich text as JSON: an `upload` node, or a `link` node whose document
 * points at a media row. Both are references, and neither has a foreign key, so they are found by walking
 * the JSON. The walk is bounded: a structure deeper than MAX_JSON_DEPTH is reported as `deep` and the
 * callers treat that as a reference (delete guard) or refuse the write (reference hook).
 */
const MAX_JSON_DEPTH = 64

function relationMatchesMedia(relationTo: unknown, mediaCollectionSlug: string): boolean {
  if (relationTo === mediaCollectionSlug) return true
  return Array.isArray(relationTo) && relationTo.includes(mediaCollectionSlug)
}

type LinkDoc = { relationTo?: unknown; value?: unknown }

/** Calls `visit` with the id of every media document referenced from `value`. Returns true if too deep. */
export function forEachMediaReference(
  value: unknown,
  mediaCollectionSlug: string,
  visit: (rawValue: unknown) => void,
  depth = 0
): boolean {
  if (depth > MAX_JSON_DEPTH) return true
  if (Array.isArray(value)) {
    let deep = false
    for (const item of value) {
      if (forEachMediaReference(item, mediaCollectionSlug, visit, depth + 1)) deep = true
    }
    return deep
  }
  if (typeof value !== 'object' || value === null) return false
  const node = value as Record<string, unknown>
  if (node.type === 'upload' && relationMatchesMedia(node.relationTo, mediaCollectionSlug)) {
    visit(node.value)
  }
  const linkDoc = (node.fields as { doc?: LinkDoc } | undefined)?.doc
  if (
    node.type === 'link' &&
    linkDoc != null &&
    relationMatchesMedia(linkDoc.relationTo, mediaCollectionSlug)
  ) {
    visit(linkDoc.value)
  }
  let deep = false
  for (const child of Object.values(node)) {
    if (forEachMediaReference(child, mediaCollectionSlug, visit, depth + 1)) deep = true
  }
  return deep
}
