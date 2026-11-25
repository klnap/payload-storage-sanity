import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(tmpdir(), 'pss-attw-'))

try {
  const packArgs = ['pm', 'pack', '--destination', tmp]
  if (process.argv.includes('--use-dist')) packArgs.push('--ignore-scripts')
  execFileSync('bun', packArgs, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const tgzName = readdirSync(tmp).find((line) => line.endsWith('.tgz'))
  if (!tgzName) {
    throw new Error('bun pm pack did not produce a tarball')
  }

  // ESM-first package: dual `import`→dist + `default`→src for TypeScript consumers; CSS export is not typed.
  execFileSync(
    'bunx',
    [
      'attw',
      '--pack',
      join(tmp, tgzName),
      '--profile',
      'esm-only',
      '--exclude-entrypoints',
      './styles/admin-tailwind.css',
      '--ignore-rules',
      'internal-resolution-error',
    ],
    { cwd: root, stdio: 'inherit' }
  )
  console.log('[check:attw] Are The Types Wrong passed for packed tarball.')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
