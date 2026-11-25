import type { Field, SanitizedConfig } from 'payload'
import { traverseFields } from 'payload'

export type MediaUploadTarget = {
  type: 'collection' | 'global'
  collectionSlug: string
  label: string
  fieldPath: string
  fieldLabel: string
  hasMany: boolean
  polymorphic: boolean
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
          polymorphic: Array.isArray(relationTo),
        })
      },
    })
  }

  // 2. Scan globals
  for (const global of config.globals ?? []) {
    const globLabel =
      global.label != null && global.label !== '' ? String(global.label) : global.slug

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
          polymorphic: Array.isArray(relationTo),
        })
      },
    })
  }

  return targets
}

/**
 * Collections and globals that contain a rich text field. Lexical stores media embedded in rich text
 * as `upload` nodes inside the JSON value, not in relationship columns, so these hosts are scanned
 * by walking their documents. One target per host; `fieldPath` is the first rich text field found.
 */
export function collectRichTextHosts(
  config: SanitizedConfig,
  mediaCollectionSlug: string
): MediaUploadTarget[] {
  const hosts: MediaUploadTarget[] = []

  const findFirstRichText = (fields: Field[]): { path: string; label: string } | null => {
    let found: { path: string; label: string } | null = null
    traverseFields({
      config,
      fields,
      fillEmpty: true,
      callback: ({ field, parentPath }) => {
        if (found != null || field.type !== 'richText') return
        const fieldPath = pathForField(parentPath, field)
        if (fieldPath) found = { path: fieldPath, label: fieldLabel(field) }
      },
    })
    return found
  }

  for (const collection of config.collections ?? []) {
    if (collection.slug === mediaCollectionSlug) continue
    const rich = findFirstRichText(collection.fields)
    if (!rich) continue
    const collLabel =
      collection.labels?.singular != null && collection.labels.singular !== ''
        ? String(collection.labels.singular)
        : collection.slug
    hosts.push({
      type: 'collection',
      collectionSlug: collection.slug,
      label: collLabel,
      fieldPath: rich.path,
      fieldLabel: rich.label,
      hasMany: false,
      polymorphic: false,
    })
  }

  for (const global of config.globals ?? []) {
    const rich = findFirstRichText(global.fields)
    if (!rich) continue
    hosts.push({
      type: 'global',
      collectionSlug: global.slug,
      label: global.label != null && global.label !== '' ? String(global.label) : global.slug,
      fieldPath: rich.path,
      fieldLabel: rich.label,
      hasMany: false,
      polymorphic: false,
    })
  }

  return hosts
}
