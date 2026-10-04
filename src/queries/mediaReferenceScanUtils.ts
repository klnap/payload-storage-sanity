import type { SanitizedConfig, Where } from 'payload'

export function getLocaleCodes(config: SanitizedConfig): string[] {
  const loc = config.localization
  if (!loc || typeof loc !== 'object') return []
  if ('localeCodes' in loc && Array.isArray(loc.localeCodes)) {
    return loc.localeCodes as string[]
  }
  return []
}

export function readLocalesOption(config: SanitizedConfig): 'all' | undefined {
  return getLocaleCodes(config).length > 0 ? 'all' : undefined
}

type EntityWithVersions = { versions?: unknown }

export function hasDraftsEnabledOnEntity(entity: EntityWithVersions | undefined): boolean {
  if (!entity?.versions || typeof entity.versions !== 'object') return false
  return Boolean((entity.versions as { drafts?: unknown }).drafts)
}

export function hasLocalizeStatusOnEntity(entity: EntityWithVersions | undefined): boolean {
  if (!hasDraftsEnabledOnEntity(entity)) return false
  const drafts = (entity!.versions as { drafts?: { localizeStatus?: boolean } }).drafts
  return Boolean(drafts && typeof drafts === 'object' && drafts.localizeStatus)
}

export function versionFieldReferenceWhere(
  fieldPath: string,
  mediaId: number | string,
  hasMany: boolean
): Where {
  const leaf = hasMany
    ? { in: [mediaId] }
    : { equals: mediaId }

  return {
    [`version.${fieldPath}`]: leaf,
  }
}

export function publishedVersionStatusWhere(
  entity: EntityWithVersions,
  localeCodes: string[]
): Where {
  if (hasLocalizeStatusOnEntity(entity)) {
    if (localeCodes.length === 0) {
      return { 'version._status': { equals: 'published' } }
    }
    return {
      or: localeCodes.map((code) => ({
        [`version._status.${code}`]: { equals: 'published' },
      })),
    }
  }
  return { 'version._status': { equals: 'published' } }
}

export function draftVersionStatusWhere(
  entity: EntityWithVersions,
  localeCodes: string[]
): Where {
  if (hasLocalizeStatusOnEntity(entity)) {
    if (localeCodes.length === 0) {
      return { 'version._status': { equals: 'draft' } }
    }
    return {
      or: localeCodes.map((code) => ({
        [`version._status.${code}`]: { equals: 'draft' },
      })),
    }
  }
  return { 'version._status': { equals: 'draft' } }
}

export function combineWhere(and: Where[]): Where {
  const parts = and.filter((part) => Object.keys(part).length > 0)
  if (parts.length === 0) return {}
  if (parts.length === 1) return parts[0]
  return { and: parts }
}

export function extractMediaId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in value && value.id != null) {
    return String((value as { id: unknown }).id)
  }
  return null
}

/** Match upload/relationship values, including localized `{ pl, en }` shapes when `locale: 'all'`. */
export function valueMatchesMediaId(
  value: unknown,
  mediaId: number | string,
  localeCodes: string[] = []
): boolean {
  if (value == null) return false
  const targetId = String(mediaId)

  const direct = extractMediaId(value)
  if (direct === targetId) return true

  if (Array.isArray(value)) {
    return value.some((item) => valueMatchesMediaId(item, mediaId, localeCodes))
  }

  if (typeof value === 'object' && value !== null && localeCodes.length > 0) {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record)
    const looksLocalized = keys.some((key) => localeCodes.includes(key))
    if (looksLocalized) {
      return keys.some(
        (key) => localeCodes.includes(key) && valueMatchesMediaId(record[key], mediaId, localeCodes)
      )
    }
  }

  return false
}
