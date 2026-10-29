import type { Field } from 'payload'
import { fieldIsSidebar } from 'payload/shared'
import {
  MEDIA_REFERENCES_INSPECTOR_IMPORT,
  sanityHiddenPersistenceFields,
} from '@/features/media/fields'
import { mediaTabsFieldStyles } from './mediaTabsFieldStyles'

const STRIPPED_DEFAULT_FIELD_NAMES = new Set(['name', 'description'])
const PLUGIN_SIDEBAR_FIELD_NAMES = new Set(['sync'])

function fieldName(field: Field): string | undefined {
  if (!('name' in field) || field.name == null || field.name === '') {
    return undefined
  }
  return field.name
}

/** Drop plugin-default `name` / `description` unless the collection defines them explicitly. */
export function stripDefaultMediaEditorFields(
  fields: Field[],
  userFieldNames: ReadonlySet<string>
): Field[] {
  return fields.filter((field) => {
    const name = fieldName(field)
    if (name == null) {
      return true
    }
    if (STRIPPED_DEFAULT_FIELD_NAMES.has(name) && !userFieldNames.has(name)) {
      return false
    }
    return true
  })
}

/**
 * Sidebar fields render in schema order (`DocumentFields` reduce).
 * Keeps consumer sidebar fields above any remaining plugin sidebar fields.
 */
export function prioritizeUserSidebarFields(
  fields: Field[],
  userFieldNames: ReadonlySet<string>
): Field[] {
  const sidebarInOrder: Field[] = []

  for (const field of fields) {
    if (fieldIsSidebar(field)) {
      sidebarInOrder.push(field)
    }
  }

  if (sidebarInOrder.length === 0) {
    return fields
  }

  const userSidebar: Field[] = []
  const otherSidebar: Field[] = []
  const pluginSidebar: Field[] = []

  for (const field of sidebarInOrder) {
    const name = fieldName(field)
    if (name != null && userFieldNames.has(name)) {
      userSidebar.push(field)
    } else if (name != null && PLUGIN_SIDEBAR_FIELD_NAMES.has(name)) {
      pluginSidebar.push(field)
    } else {
      otherSidebar.push(field)
    }
  }

  const reorderedSidebar = [...userSidebar, ...otherSidebar, ...pluginSidebar]
  let sidebarIndex = 0

  return fields.map((field) => {
    if (!fieldIsSidebar(field)) {
      return field
    }
    const next = reorderedSidebar[sidebarIndex]
    sidebarIndex += 1
    return next ?? field
  })
}

/** Root names that stay out of the Asset tab (sync hidden; sanity re-injected for persistence). */
const PLUGIN_INJECTED_ROOT_NAMES = new Set([
  'sanity',
  'sync',
  // Legacy slots — strip if an old build left them on the collection
  'mediaMetadataInspector',
  'mediaReferences',
  'mediaTabsChrome', // legacy injected tab slot id (pre–field-className layout)
  'sanityAssetMeta',
])

/**
 * Cloud-storage always injects `_objectKey` for S3-style folders.
 * Sanity identity lives in `sanity.asset` — drop the null key from the schema.
 */
export function stripCloudStorageObjectKeyField(fields: Field[]): Field[] {
  return fields.filter((field) => !('name' in field && field.name === '_objectKey'))
}

/** Remove legacy mirror group if an old plugin build left it on the collection. */
export function stripLegacySanityAssetMetaField(fields: Field[]): Field[] {
  return fields.filter((field) => !('name' in field && field.name === 'sanityAssetMeta'))
}

export function wrapSanityMediaMainFieldsInTabs(assetTabFields: Field[]): Field[] {
  return [
    {
      type: 'tabs',
      admin: {
        // Payload Tabs only apply `admin.className` (not `admin.style`)
        className: mediaTabsFieldStyles(),
      },
      tabs: [
        {
          label: 'Asset',
          fields: assetTabFields,
        },
        {
          label: 'References',
          fields: [
            {
              name: 'mediaReferences',
              type: 'ui',
              admin: {
                components: {
                  Field: MEDIA_REFERENCES_INSPECTOR_IMPORT,
                },
              },
            },
          ],
        },
      ],
    },
  ]
}

export function splitSanityMediaCollectionFields(fields: Field[]): {
  mainColumnFields: Field[]
  sidebarAndHiddenFields: Field[]
} {
  const mainColumnFields: Field[] = []
  const sidebarAndHiddenFields: Field[] = []

  for (const field of fields) {
    const name = fieldName(field)
    if (name != null && PLUGIN_INJECTED_ROOT_NAMES.has(name)) {
      if (name === 'sanity' || name === 'sanityAssetMeta' || name === 'mediaMetadataInspector') {
        continue
      }
      sidebarAndHiddenFields.push(field)
      continue
    }
    if (fieldIsSidebar(field)) {
      sidebarAndHiddenFields.push(field)
      continue
    }
    mainColumnFields.push(field)
  }

  return { mainColumnFields, sidebarAndHiddenFields }
}

export function finalizeSanityMediaCollectionFields(
  fields: Field[],
  userFieldNames: ReadonlySet<string>
): Field[] {
  const withoutObjectKey = stripCloudStorageObjectKeyField(fields)
  const withoutLegacyMeta = stripLegacySanityAssetMetaField(withoutObjectKey)
  const stripped = stripDefaultMediaEditorFields(withoutLegacyMeta, userFieldNames)
  const { mainColumnFields, sidebarAndHiddenFields } = splitSanityMediaCollectionFields(stripped)
  const tabbedMain = wrapSanityMediaMainFieldsInTabs(mainColumnFields)

  return prioritizeUserSidebarFields(
    [...tabbedMain, ...sidebarAndHiddenFields, ...sanityHiddenPersistenceFields()],
    userFieldNames
  )
}
