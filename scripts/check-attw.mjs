import { execSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = mkdtempSync(join(tmpdir(), 'pss-attw-'))

try {
  execSync(`npm pack --pack-destination ${JSON.stringify(tmp)}`, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  const listing = execSync(`ls -1 ${JSON.stringify(tmp)}`, { encoding: 'utf8' })
  const tgzName = listing
    .trim()
    .split('\n')
    .find((line) => line.endsWith('.tgz'))
  if (!tgzName) {
    console.error('npm pack did not produce a tarball')
    process.exit(1)
  }

  // ESM-first package: dual `import`→dist + `default`→src for TypeScript consumers; CSS export is not typed.
  execSync(
    `bunx attw --pack ${JSON.stringify(join(tmp, tgzName))} --profile esm-only --exclude-entrypoints ${JSON.stringify('./styles/admin-tailwind.css')} --ignore-rules internal-resolution-error`,
    {
      cwd: root,
      stdio: 'inherit',
    }
  )
  console.log('[check:attw] Are The Types Wrong passed for packed tarball.')
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
