import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

export const ENTRY_SUBPATHS = ['.', './admin', './client', './next', './next/loader']

export function distTypesPath(root, pkg, subpath) {
  const entry = pkg.exports[subpath]
  if (!entry?.types) {
    throw new Error(`Missing types export for ${subpath}`)
  }
  return join(root, entry.types)
}

export function collectExportsFromDts(dtsPath) {
  const content = readFileSync(dtsPath, 'utf8')
  const sf = ts.createSourceFile(dtsPath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const symbols = []

  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt)) continue
    const clause = stmt.exportClause
    if (!clause || !ts.isNamedExports(clause)) continue
    for (const el of clause.elements) {
      symbols.push({
        name: el.name.text,
        kind: el.isTypeOnly || stmt.isTypeOnly ? 'type' : 'value',
        declaration: el.getText(sf).trim(),
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
