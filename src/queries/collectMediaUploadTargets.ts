import type { Field, SanitizedConfig } from 'payload'
import { traverseFields } from 'payload'

export type MediaUploadTarget = {
  type: 'collection' | 'global'
  collectionSlug: string
  label: string
  fieldPath: string
  fieldLabel: string
  hasMany: boolean
}

function fieldLabel(field: Field): string {
  if ('label' in field && field.label != null && field.label !== '') {
    return String(field.label)
  }
  if ('name' in field && field.name != null && field.name !== '') {
    return field.name
  }
  return 'field'
}

function relationIncludesMedia(
  relationTo: string | string[] | undefined,
  mediaCollectionSlug: string
): boolean {
  if (relationTo === mediaCollectionSlug) return true
  if (Array.isArray(relationTo)) {
    return relationTo.includes(mediaCollectionSlug)
  }
  return false
}

function pathForField(parentPath: string, field: Field): string | null {
  if (!('name' in field) || field.name == null || field.name === '') {
    return null
  }
  return `${parentPath}${field.name}`
}

/** Upload / relationship fields that can point at a media collection (both collections and globals). */
export function collectMediaUploadTargets(
  config: SanitizedConfig,
  mediaCollectionSlug: string
): MediaUploadTarget[] {
  const targets: MediaUploadTarget[] = []
  const seen = new Set<string>()

  // 1. Scan collections
  for (const collection of config.collections ?? []) {
    if (collection.slug === mediaCollectionSlug) continue

    const collLabel =
      collection.labels?.singular != null && collection.labels.singular !== ''
        ? String(collection.labels.singular)
        : collection.slug

    traverseFields({
      config,
      fields: collection.fields,
      fillEmpty: true,
      callback: ({ field, parentPath }) => {
        if (field.type !== 'upload' && field.type !== 'relationship') return

        const relationTo = field.relationTo
        if (!relationIncludesMedia(relationTo, mediaCollectionSlug)) return

        const fieldPath = pathForField(parentPath, field)
        if (!fieldPath) return

        const key = `collection:${collection.slug}:${fieldPath}`
        if (seen.has(key)) return
        seen.add(key)

        targets.push({
          type: 'collection',
          collectionSlug: collection.slug,
          label: collLabel,
          fieldPath,
          fieldLabel: fieldLabel(field),
          hasMany: Boolean(field.hasMany),
        })
      },
    })
  }

  // 2. Scan globals
  for (const global of config.globals ?? []) {
    const globLabel =
      global.label != null && global.label !== ''
        ? String(global.label)
        : global.slug

    traverseFields({
      config,
      fields: global.fields,
      fillEmpty: true,
      callback: ({ field, parentPath }) => {
        if (field.type !== 'upload' && field.type !== 'relationship') return

        const relationTo = field.relationTo
        if (!relationIncludesMedia(relationTo, mediaCollectionSlug)) return

        const fieldPath = pathForField(parentPath, field)
        if (!fieldPath) return

        const key = `global:${global.slug}:${fieldPath}`
        if (seen.has(key)) return
        seen.add(key)

        targets.push({
          type: 'global',
          collectionSlug: global.slug,
          label: globLabel,
          fieldPath,
          fieldLabel: fieldLabel(field),
          hasMany: Boolean(field.hasMany),
        })
      },
    })
  }

  return targets
}
