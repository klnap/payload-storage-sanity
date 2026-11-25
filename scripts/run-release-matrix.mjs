import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const consumersRoot = join(root, 'release-consumers')

/** @type {{ id: string, nextBuild?: boolean, requiresPostgres?: boolean }[]} */
const FIXTURES = [
  { id: 'payload-main' },
  { id: 'payload-postgres', requiresPostgres: true },
  { id: 'client-only' },
  { id: 'admin' },
  { id: 'next-app', nextBuild: true },
  { id: 'next-asset-mapping' },
]
const fixtureArg = process.argv.indexOf('--fixture')
const requestedFixture = fixtureArg === -1 ? undefined : process.argv[fixtureArg + 1]
const postgresURL = process.env.PSS_POSTGRES_CONSUMER_DATABASE_URL?.trim()
const requirePostgres = process.env.PSS_REQUIRE_POSTGRES_CONSUMER === '1'
if (requirePostgres && !postgresURL) {
  throw new Error('PSS_POSTGRES_CONSUMER_DATABASE_URL is required for CI release qualification')
}
const requestedDefinition = FIXTURES.find(({ id }) => id === requestedFixture)
if (requestedFixture && !requestedDefinition) {
  throw new Error(`Unknown release consumer fixture: ${requestedFixture}`)
}
if (requestedDefinition?.requiresPostgres && !postgresURL) {
  throw new Error(`${requestedFixture} requires PSS_POSTGRES_CONSUMER_DATABASE_URL`)
}
const eligibleFixtures = FIXTURES.filter(({ requiresPostgres }) => !requiresPostgres || postgresURL)
const fixtures = requestedFixture
  ? eligibleFixtures.filter(({ id }) => id === requestedFixture)
  : eligibleFixtures
function run(args, cwd) {
  execFileSync('bun', args, { cwd, stdio: 'inherit', env: process.env })
}

function installFixture(cwd) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })
}

function packTarball(destDir) {
  run(['pm', 'pack', '--destination', destDir], root)
  const tgzName = readdirSync(destDir).find((line) => line.endsWith('.tgz'))
  if (!tgzName) {
    throw new Error('bun pm pack did not produce a tarball')
  }
  return join(destDir, tgzName)
}

function persistVerifiedArtifact(tgzPath) {
  const artifactDir = process.env.PSS_RELEASE_ARTIFACT_DIR?.trim()
  if (!artifactDir) return

  mkdirSync(artifactDir, { recursive: true })
  const name = basename(tgzPath)
  const artifactPath = join(artifactDir, name)
  copyFileSync(tgzPath, artifactPath)
  const sha256 = createHash('sha256').update(readFileSync(artifactPath)).digest('hex')
  writeFileSync(join(artifactDir, `${name}.sha256`), `${sha256}  ${name}\n`)
  const metadata = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  writeFileSync(
    join(artifactDir, 'qualification.json'),
    `${JSON.stringify(
      {
        package: metadata.name,
        version: metadata.version,
        fixtures: fixtures.map(({ id }) => id),
        tarball: name,
        sha256,
        revision: process.env.GITHUB_SHA ?? null,
      },
      null,
      2
    )}\n`
  )
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

if (!process.argv.includes('--use-dist')) {
  console.log('release matrix: build dist')
  run(['run', 'build:dist'], root)
}

const packDir = mkdtempSync(join(tmpdir(), 'pss-matrix-pack-'))
let tgzPath
try {
  tgzPath = packTarball(packDir)
  const packErrors = validatePackedTarball(tgzPath)
  if (packErrors.length > 0) {
    throw new Error(packErrors.join('\n'))
  }
  console.log(`release matrix: packed ${tgzPath}`)

  for (const fixture of fixtures) {
    const workDir = prepareFixtureWorkdir(fixture.id, tgzPath)
    try {
      console.log(`\n=== fixture: ${fixture.id} ===`)
      installFixture(workDir)
      run(['run', 'typecheck'], workDir)
      if (fixture.nextBuild) {
        run(['run', 'build'], workDir)
      }
      run(['run', 'smoke'], workDir)
      console.log(`fixture ${fixture.id}: OK`)
    } finally {
      rmSync(workDir, { recursive: true, force: true })
    }
  }
  persistVerifiedArtifact(tgzPath)
} finally {
  rmSync(packDir, { recursive: true, force: true })
}

console.log('\nrelease matrix: all fixtures passed')
