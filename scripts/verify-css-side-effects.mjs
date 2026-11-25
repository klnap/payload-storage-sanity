/**
 * Ensures packed package.json marks CSS as side-effectful (webpack/Turbopack tree-shaking).
 * Set PSS_CSS_WEBPACK=1 for the production webpack bundle (CI: `bun run check:css-side-effects`).
 */
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePackedTarball } from './validate-packed-artifact.mjs'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const generatedRoot = join(packageRoot, '.test-output')
const fixtureSource = join(packageRoot, 'scripts', 'css-sidefx-fixture')

function assertCssSideEffectsInPackageJson(pkg) {
  const se = pkg.sideEffects
  if (se === false) {
    return 'package.json sideEffects must not be false when exporting ./styles/admin-tailwind.css'
  }
  if (se === true) {
    return null
  }
  if (!Array.isArray(se) || se.length === 0) {
    return 'package.json sideEffects should list **/*.css (or equivalent) for the admin CSS export'
  }
  const joined = se.join(' ')
  if (!/\.css/.test(joined)) {
    return 'package.json sideEffects array must include a *.css pattern'
  }
  return null
}

function runWebpackCssRetentionCheck(tgzPath, fixtureDir) {
  for (const file of ['entry.js', 'package.json', 'webpack.config.cjs']) {
    copyFileSync(join(fixtureSource, file), join(fixtureDir, file))
  }
  copyFileSync(tgzPath, join(fixtureDir, 'package.tgz'))
  execFileSync('bun', ['install', '--ignore-scripts'], {
    cwd: fixtureDir,
    stdio: 'inherit',
  })

  // Bun hoists binaries to the workspace root, so fall back to it when the package has none.
  const localWebpack = join(packageRoot, 'node_modules', '.bin', 'webpack')
  const webpackBin = existsSync(localWebpack)
    ? localWebpack
    : join(packageRoot, '..', '..', 'node_modules', '.bin', 'webpack')
  execFileSync(webpackBin, ['--config', 'webpack.config.cjs'], {
    cwd: fixtureDir,
    stdio: 'inherit',
  })

  const bundle = readFileSync(join(fixtureDir, 'out', 'bundle.js'), 'utf8')
  if (!/tailwind|@layer|--tw-/.test(bundle)) {
    throw new Error('CSS missing from production webpack bundle')
  }
  console.log('[verify-css-side-effects] Production webpack bundle retains admin CSS.')
}

mkdirSync(generatedRoot, { recursive: true })
const workDir = mkdtempSync(join(generatedRoot, 'pss-css-'))
try {
  const packArgs = process.argv.includes('--use-dist') ? ['--ignore-scripts'] : []
  execFileSync('bun', ['pm', 'pack', ...packArgs, '--destination', workDir, '--quiet'], {
    cwd: packageRoot,
    stdio: 'ignore',
  })
  const filename = readdirSync(workDir).find((entry) => entry.endsWith('.tgz'))
  if (!filename) throw new Error('bun pm pack did not produce a tarball')
  const tgzPath = join(workDir, filename)
  const packErrors = validatePackedTarball(tgzPath)
  if (packErrors.length) throw new Error(packErrors.join('\n'))

  const packedJson = execFileSync('tar', ['-xOf', tgzPath, 'package/package.json'], {
    encoding: 'utf8',
  })
  const sideEffectsError = assertCssSideEffectsInPackageJson(JSON.parse(packedJson))
  if (sideEffectsError) throw new Error(sideEffectsError)
  console.log('[verify-css-side-effects] Packed package.json marks CSS as side-effectful.')

  if (process.env.PSS_CSS_WEBPACK === '1') {
    runWebpackCssRetentionCheck(tgzPath, workDir)
  }
} finally {
  rmSync(workDir, { recursive: true, force: true })
}
