import slugifyFn from 'slugify'

type SlugifyModule = typeof slugifyFn & { default?: typeof slugifyFn }

// SAFETY: Handle default or direct ESM/CJS export from slugify module
const slugify = (slugifyFn as SlugifyModule).default ?? slugifyFn

export function slugifyFilename(filename?: string | null): string {
  if (!filename || filename.trim() === '') return ''
  const trimmed = filename.trim()
  const lastDotIndex = trimmed.lastIndexOf('.')

  if (lastDotIndex <= 0) {
    return (
      slugify(trimmed, {
        lower: true,
        strict: true,
        trim: true,
      }) || trimmed
    )
  }

  const namePart = trimmed.slice(0, lastDotIndex)
  const extPart = trimmed.slice(lastDotIndex + 1).toLowerCase()
  // Replace dots in the name part with hyphens so they survive strict slugification
  const slugifiedName =
    slugify(namePart.replace(/\./g, '-'), {
      lower: true,
      strict: true,
      trim: true,
    }) || 'file'

  return `${slugifiedName}.${extPart}`
}
