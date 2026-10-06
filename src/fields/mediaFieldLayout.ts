import type { Field } from 'payload'
import { fieldIsSidebar } from 'payload/shared'

const STRIPPED_DEFAULT_FIELD_NAMES = new Set(['name', 'description'])
const PLUGIN_SIDEBAR_FIELD_NAMES = new Set(['originalFilename', 'sync'])

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
 * Keeps consumer sidebar fields above plugin `originalFilename` / `sync`.
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

export function finalizeSanityMediaCollectionFields(
  fields: Field[],
  userFieldNames: ReadonlySet<string>
): Field[] {
  return prioritizeUserSidebarFields(
    stripDefaultMediaEditorFields(fields, userFieldNames),
    userFieldNames
  )
}
