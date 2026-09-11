import type { Field, SanitizedConfig } from 'payload'
import { traverseFields } from 'payload'

export type MediaUploadTarget = {
  collectionSlug: string
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

/** Upload / relationship fields that can point at a media collection. */
export function collectMediaUploadTargets(
  config: SanitizedConfig,
  mediaCollectionSlug: string
): MediaUploadTarget[] {
  const targets: MediaUploadTarget[] = []
  const seen = new Set<string>()

  for (const collection of config.collections) {
    if (collection.slug === mediaCollectionSlug) continue

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

        const key = `${collection.slug}:${fieldPath}`
        if (seen.has(key)) return
        seen.add(key)

        targets.push({
          collectionSlug: collection.slug,
          fieldPath,
          fieldLabel: fieldLabel(field),
          hasMany: Boolean(field.hasMany),
        })
      },
    })
  }

  return targets
}
