import { execSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const consumersRoot = join(root, 'release-consumers')

/** @type {{ id: string, nextBuild?: boolean }[]} */
const FIXTURES = [
  { id: 'payload-main' },
  { id: 'client-only' },
  { id: 'admin' },
  { id: 'next-app', nextBuild: true },
  { id: 'next-asset-mapping' },
]

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env })
}

function packTarball(destDir) {
  run(`npm pack --ignore-scripts --pack-destination ${JSON.stringify(destDir)}`, root)
  const listing = execSync(`ls -1 ${JSON.stringify(destDir)}`, { encoding: 'utf8' })
  const tgzName = listing
    .trim()
    .split('\n')
    .find((line) => line.endsWith('.tgz'))
  if (!tgzName) {
    throw new Error('npm pack did not produce a tarball')
  }
  return join(destDir, tgzName)
}

function prepareFixtureWorkdir(fixtureId, tgzPath) {
  const src = join(consumersRoot, fixtureId)
  const workDir = mkdtempSync(join(tmpdir(), `pss-matrix-${fixtureId}-`))
  cpSync(src, workDir, {
    recursive: true,
    filter: (path) => !path.split('/').includes('node_modules'),
  })
  const pkgPath = join(workDir, 'package.json')
  const pkgRaw = readFileSync(pkgPath, 'utf8').replaceAll('__PSS_TARBALL__', tgzPath)
  writeFileSync(pkgPath, pkgRaw)
  return workDir
}

console.log('release matrix: build dist')
run('bun run build:dist', root)

const packDir = mkdtempSync(join(tmpdir(), 'pss-matrix-pack-'))
let tgzPath
try {
  tgzPath = packTarball(packDir)
  const packErrors = validatePackedTarball(tgzPath)
  if (packErrors.length > 0) {
    console.error(packErrors.join('\n'))
    process.exit(1)
  }
  console.log(`release matrix: packed ${tgzPath}`)

  for (const fixture of FIXTURES) {
    const workDir = prepareFixtureWorkdir(fixture.id, tgzPath)
    try {
      console.log(`\n=== fixture: ${fixture.id} ===`)
      run('bun install', workDir)
      run('bun run typecheck', workDir)
      if (fixture.nextBuild) {
        run('bun run build', workDir)
      }
      run('bun run smoke', workDir)
      console.log(`fixture ${fixture.id}: OK`)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
} finally {
  rmSync(packDir, { recursive: true, force: true })
}

console.log('\nrelease matrix: all fixtures passed')
