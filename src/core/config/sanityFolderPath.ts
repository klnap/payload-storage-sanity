import * as v from 'valibot'

const folderPathSchema = v.pipe(
  v.string('Sanity media folder must be a non-empty path.'),
  v.transform((path) =>
    path
      .split('/')
      .map((name) => name.trim())
      .filter(Boolean)
  ),
  v.minLength(1, 'Sanity media folder must be a non-empty path.')
)

export function parseSanityAssetFolderPath(path: unknown): string[] {
  return v.parse(folderPathSchema, path)
}
