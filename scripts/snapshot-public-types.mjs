import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPublicTypesSnapshot } from './public-types-snapshot-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'scripts/baselines')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'public-types-snapshot.json')
const snapshot = buildPublicTypesSnapshot(root)
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Wrote ${outPath}`)
