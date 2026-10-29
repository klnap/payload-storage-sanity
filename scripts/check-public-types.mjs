import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildPublicTypesSnapshot,
  ENTRY_SUBPATHS,
  symbolKey,
} from './public-types-snapshot-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'scripts/baselines/public-types-snapshot.json')

const build = spawnSync('bun', ['run', 'build:dist'], { cwd: root, stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status ?? 1)

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const current = buildPublicTypesSnapshot(root)

let failed = false

for (const subpath of ENTRY_SUBPATHS) {
  const exp = baseline[subpath] ?? []
  const act = current[subpath] ?? []
  const expSet = new Set(exp.map(symbolKey))
  const actSet = new Set(act.map(symbolKey))
  const missing = exp.filter((s) => !actSet.has(symbolKey(s)))
  const extra = act.filter((s) => !expSet.has(symbolKey(s)))
  if (missing.length || extra.length) {
    failed = true
    console.error(`[check:public-types] mismatch for ${subpath}`)
    if (missing.length) console.error(`  missing: ${missing.map((s) => s.name).join(', ')}`)
    if (extra.length) console.error(`  extra: ${extra.map((s) => s.name).join(', ')}`)
  }
}

if (failed) process.exit(1)
console.log('[check:public-types] Public type export surface matches baseline.')
