import type { Field } from 'payload'

/**
 * Optional asset `title`. Hidden in the field list because the upload component renders it
 * above the preview; the value still persists with the form.
 */
export function plainTitleField(): Field {
  return { name: 'title', type: 'text', admin: { hidden: true } }
}

export function collectionHasTitleField(fields: Field[] | undefined): boolean {
  return Boolean(fields?.some((field) => 'name' in field && field.name === 'title'))
}
