import type { CollectionBeforeChangeHook, GlobalBeforeChangeHook, SanitizedConfig } from 'payload'
import { ValidationError } from 'payload'
import { lockMediaRow } from '@/features/media/lifecycle/asset-lock/mediaRowLock'
import type { MediaUploadTarget } from '@/features/media/usage/scan/collectMediaUploadTargets'
import { collectMediaUploadTargets } from '@/features/media/usage/scan/collectMediaUploadTargets'

type TargetWithMediaSlug = MediaUploadTarget & { mediaSlug: string }

type RelationshipHookArgs = {
  data: unknown
  localeCodes: string[]
  mediaTargets: TargetWithMediaSlug[]
  req: Parameters<CollectionBeforeChangeHook>[0]['req']
}

function valuesAtPath(value: unknown, path: string, depth = 0): unknown[] {
  if (depth > 64) {
    throw new ValidationError({
      errors: [{ message: 'Media relationship data is nested too deeply to verify', path }],
    })
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => valuesAtPath(item, path, depth + 1))
  }
  const [part, ...rest] = path.split('.')
  if (part == null) return [value]
  if (value == null || typeof value !== 'object' || !(part in value)) return []
  if (rest.length === 0) return [(value as Record<string, unknown>)[part]]
  return valuesAtPath((value as Record<string, unknown>)[part], rest.join('.'), depth + 1)
}

function relationshipIds(
  value: unknown,
  mediaSlug: string,
  polymorphic: boolean,
  localeCodes: ReadonlySet<string>,
  path: string,
  depth = 0
): string[] {
  if (depth > 64) {
    throw new ValidationError({
      errors: [{ message: 'Media relationship data is nested too deeply to verify', path }],
    })
  }
  if (value == null || value === '') return []
  if (typeof value === 'number' || typeof value === 'string') return [String(value)]
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      relationshipIds(item, mediaSlug, polymorphic, localeCodes, path, depth + 1)
    )
  }
  if (typeof value !== 'object') {
    throw new ValidationError({
      errors: [{ message: 'Media relationship has an unsupported value', path }],
    })
  }

  const record = value as Record<string, unknown>
  const localizedKeys = Object.keys(record).filter((key) => localeCodes.has(key))
  if (localizedKeys.length > 0) {
    return localizedKeys.flatMap((key) =>
      relationshipIds(record[key], mediaSlug, polymorphic, localeCodes, path, depth + 1)
    )
  }

  if (polymorphic && typeof record.relationTo === 'string') {
    if (record.relationTo !== mediaSlug) return []
    return relationshipIds(
      record.value ?? record.id,
      mediaSlug,
      false,
      localeCodes,
      path,
      depth + 1
    )
  }
  if (record.id != null) {
    return relationshipIds(record.id, mediaSlug, false, localeCodes, path, depth + 1)
  }

  throw new ValidationError({
    errors: [{ message: 'Media relationship could not be verified', path }],
  })
}

async function guardMediaRelationshipReferences({
  data,
  localeCodes,
  mediaTargets,
  req,
}: RelationshipHookArgs): Promise<void> {
  if (data == null || typeof data !== 'object') return

  const references = new Map<string, Set<string>>()
  for (const target of mediaTargets) {
    for (const value of valuesAtPath(data, target.fieldPath)) {
      for (const id of relationshipIds(
        value,
        target.mediaSlug,
        target.polymorphic,
        new Set(localeCodes),
        target.fieldPath
      )) {
        const ids = references.get(target.mediaSlug) ?? new Set<string>()
        ids.add(id)
        references.set(target.mediaSlug, ids)
      }
    }
  }

  const orderedIds = [...new Set([...references.values()].flatMap((ids) => [...ids]))].sort()
  for (const id of orderedIds) {
    await lockMediaRow(req, id)
  }

  const orderedReferences = [...references.entries()]
    .flatMap(([mediaSlug, ids]) => [...ids].map((id) => ({ mediaSlug, id })))
    .sort(
      (left, right) =>
        left.mediaSlug.localeCompare(right.mediaSlug) || left.id.localeCompare(right.id)
    )

  for (const { mediaSlug, id } of orderedReferences) {
    const media = await req.payload.findByID({
      collection: mediaSlug as never,
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (media == null) {
      throw new ValidationError({
        errors: [{ message: 'Referenced media no longer exists', path: mediaSlug }],
      })
    }
  }
}

function createRelationshipCollectionHook(
  mediaTargets: TargetWithMediaSlug[],
  localeCodes: string[]
): CollectionBeforeChangeHook {
  return async ({ data, req }) => {
    await guardMediaRelationshipReferences({ data, localeCodes, mediaTargets, req })
    return data
  }
}

function createRelationshipGlobalHook(
  mediaTargets: TargetWithMediaSlug[],
  localeCodes: string[]
): GlobalBeforeChangeHook {
  return async ({ data, req }) => {
    await guardMediaRelationshipReferences({ data, localeCodes, mediaTargets, req })
    return data
  }
}

type ConfigLike = {
  collections?: Array<{
    slug: string
    hooks?: { beforeChange?: unknown[] } & Record<string, unknown>
  }>
  globals?: Array<{ slug: string; hooks?: { beforeChange?: unknown[] } & Record<string, unknown> }>
}

/** Serializes new upload/relationship references against guarded media deletion. */
export function applyMediaRelationshipReferenceHooks<T extends ConfigLike>(
  config: T,
  mediaSlugs: readonly string[],
  localeCodes: string[]
): T {
  const collectionTargets = new Map<string, TargetWithMediaSlug[]>()
  const globalTargets = new Map<string, TargetWithMediaSlug[]>()

  for (const mediaSlug of mediaSlugs) {
    const targets = collectMediaUploadTargets(config as unknown as SanitizedConfig, mediaSlug)
    for (const target of targets) {
      const targetMap = target.type === 'collection' ? collectionTargets : globalTargets
      const hostTargets = targetMap.get(target.collectionSlug) ?? []
      hostTargets.push({ ...target, mediaSlug })
      targetMap.set(target.collectionSlug, hostTargets)
    }
  }

  return {
    ...config,
    collections: config.collections?.map((collection) => {
      const targets = collectionTargets.get(collection.slug)
      if (!targets?.length) return collection
      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          beforeChange: [
            ...(collection.hooks?.beforeChange ?? []),
            createRelationshipCollectionHook(targets, localeCodes),
          ],
        },
      }
    }),
    globals: config.globals?.map((global) => {
      const targets = globalTargets.get(global.slug)
      if (!targets?.length) return global
      return {
        ...global,
        hooks: {
          ...global.hooks,
          beforeChange: [
            ...(global.hooks?.beforeChange ?? []),
            createRelationshipGlobalHook(targets, localeCodes),
          ],
        },
      }
    }),
  }
}
