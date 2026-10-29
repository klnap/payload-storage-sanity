import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const result = spawnSync(
  'dependency-cruiser',
  ['src', '--config', 'dependency-cruiser.config.mjs'],
  { cwd: root, stdio: 'inherit' }
)

process.exit(result.status ?? 1)
