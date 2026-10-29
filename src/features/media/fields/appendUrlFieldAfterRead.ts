import type { Field, FieldHook } from 'payload'

/** Appends an `afterRead` hook to the upload collection's hidden `url` field (cloud-storage). */
export function appendAfterReadToUrlField(fields: Field[], hook: FieldHook): Field[] {
  return fields.map((field) => {
    if ('name' in field && field.name === 'url' && 'hooks' in field) {
      const existing = field.hooks?.afterRead ?? []
      return {
        ...field,
        hooks: {
          ...field.hooks,
          afterRead: [...existing, hook],
        },
      }
    }

    return field
  })
}
