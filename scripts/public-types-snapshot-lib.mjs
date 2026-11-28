import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const ENTRY_SUBPATHS = [
  '.',
  './admin',
  './client',
  './folders',
  './upload-protocol',
  './consumers',
  './consumers/next',
  './consumers/next/loader',
]

export function distTypesPath(root, pkg, subpath) {
  const entry = pkg.exports[subpath]
  if (!entry?.types) {
    throw new Error(`Missing types export for ${subpath}`)
  }
  return join(root, entry.types)
}

const NAMED_EXPORT_RE = /^export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"];?/gm

export function collectExportsFromDts(dtsPath) {
  const content = readFileSync(dtsPath, 'utf8')
  const symbols = []

  for (const match of content.matchAll(NAMED_EXPORT_RE)) {
    const blockIsTypeOnly = Boolean(match[1])
    const specifiers = match[2]?.split(',') ?? []
    for (const rawSpecifier of specifiers) {
      const declaration = rawSpecifier.trim()
      if (!declaration) continue

      const isTypeOnly = blockIsTypeOnly || declaration.startsWith('type ')
      const resolved = isTypeOnly ? declaration.replace(/^type\s+/, '') : declaration
      const [localName, alias] = resolved.split(/\s+as\s+/)
      const name = (alias ?? localName)?.trim()
      if (!name) continue

      symbols.push({
        name,
        kind: isTypeOnly ? 'type' : 'value',
        declaration,
      })
    }
  }

  if (symbols.length === 0 && content.includes('export default')) {
    symbols.push({ name: 'default', kind: 'value', declaration: 'export default' })
  }

  symbols.sort((a, b) => a.name.localeCompare(b.name))
  return symbols
}

export function buildPublicTypesSnapshot(root) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const snapshot = {}
  for (const subpath of ENTRY_SUBPATHS) {
    snapshot[subpath] = collectExportsFromDts(distTypesPath(root, pkg, subpath))
  }
  return snapshot
}

export function symbolKey(s) {
  return `${s.kind}:${s.name}:${s.declaration}`
}
