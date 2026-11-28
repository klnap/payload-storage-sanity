import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ScaffoldError } from '../src/cli/errors.js'
import {
  DEFAULT_DIRECTORY,
  DEFAULT_WORKER_NAME,
  generateCloudflareProject,
  MANIFEST_FILE,
} from '../src/cli/generator.js'
import { parseInitArgs } from '../src/cli/index.js'
import { assertWorkerName, effectiveWorkerNames } from '../src/cli/naming.js'

let root: string
let outside: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pss-cloudflare-init-'))
  outside = await mkdtemp(join(tmpdir(), 'pss-cloudflare-outside-'))
  await writeFile(join(root, 'payload.config.ts'), 'export default {};\n')
})

afterEach(async () => {
  await chmod(root, 0o755).catch(() => undefined)
  await rm(root, { recursive: true, force: true })
  await rm(outside, { recursive: true, force: true })
})

const run = (options: { name?: string; directory?: string } = {}) =>
  generateCloudflareProject({ applicationRoot: root, ...options })

const failure = async (promise: Promise<unknown>): Promise<ScaffoldError> => {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(ScaffoldError)
  return error as ScaffoldError
}

const apiPage = (ids: string[], page: number, totalCount: number, perPage = 1) => ({
  success: true,
  result: ids.map((id) => ({ id })),
  result_info: { page, per_page: perPage, count: ids.length, total_count: totalCount },
})

const guardFixture = async () => {
  const { directory } = await run()
  const sandbox = await mkdtemp(join(root, 'guard-fixture-'))
  const configPath = join(directory, 'wrangler.jsonc')
  const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>
  config.account_id = 'account-123'
  await writeFile(configPath, JSON.stringify(config))
  const bin = join(sandbox, 'fake-bin')
  await mkdir(bin)
  const log = join(sandbox, 'commands.log')
  const fakeWrangler = join(bin, 'bunx')
  await writeFile(
    fakeWrangler,
    [
      '#!/bin/sh',
      'token=; if [ -n "$CLOUDFLARE_API_TOKEN" ]; then token=set; fi; printf "%s token=%s\\n" "$*" "$token" >> "$CALL_LOG"',
      'case "$*" in *"whoami"*) exit 0 ;; *"deploy"*) exit 0 ;; esac',
      'exit 9',
      '',
    ].join('\n')
  )
  await chmod(fakeWrangler, 0o755)
  const fetchMock = join(sandbox, 'mock-fetch.mjs')
  await writeFile(
    fetchMock,
    [
      'import { appendFile } from "node:fs/promises";',
      'if (process.env.FORCE_TTY === "1") Object.defineProperty(process.stdin, "isTTY", { value: true });',
      'globalThis.fetch = async (url) => {',
      '  await appendFile(process.env.CALL_LOG, "API " + url + "\\n");',
      '  if (process.env.API_ERROR) throw new Error(process.env.CLOUDFLARE_API_TOKEN);',
      '  const page = Number(new URL(url).searchParams.get("page"));',
      '  const responses = JSON.parse(process.env.API_PAGES);',
      '  const result = responses[page - 1];',
      '  return result ? { ok: true, json: async () => result } : { ok: false, status: 500 };',
      '};',
      '',
    ].join('\n')
  )
  return {
    directory,
    guard: join(directory, 'scripts/predeploy.mjs'),
    log,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      CALL_LOG: log,
      CLOUDFLARE_API_TOKEN: 'secret-api-token',
      API_PAGES: JSON.stringify([apiPage([], 1, 0)]),
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${fetchMock}`.trim(),
    },
  }
}

describe('Cloudflare init CLI', () => {
  test('parses the required command and both supported overrides', () => {
    expect(parseInitArgs(['init', 'cloudflare'])).toEqual({})
    expect(
      parseInitArgs(['init', 'cloudflare', '--name', 'sanity-edge', '--dir', 'workers/edge'])
    ).toEqual({
      name: 'sanity-edge',
      directory: 'workers/edge',
    })
    expect(() => parseInitArgs(['init', 'cloudflare', '--overwrite'])).toThrow(
      'Invalid or incomplete option'
    )
    expect(() => parseInitArgs(['init', 'cloudflare', '--dir'])).toThrow(
      'Invalid or incomplete option'
    )
  })

  test('the executable initializes relative to the consuming Payload application root', async () => {
    const entry = resolve(import.meta.dir, '../src/cli/index.ts')
    const result = spawnSync(process.execPath, [entry, 'init', 'cloudflare'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(join(root, DEFAULT_DIRECTORY))
    expect(await lstat(join(root, DEFAULT_DIRECTORY))).toBeDefined()
  })

  test('the executable runs through package-manager symlinks', async () => {
    const entry = resolve(import.meta.dir, '../src/cli/index.ts')
    const binDirectory = join(root, 'node_modules', '.bin')
    await mkdir(binDirectory, { recursive: true })
    const executable = join(binDirectory, 'payload-storage-sanity')
    await symlink(entry, executable)
    const result = spawnSync(process.execPath, [executable, 'init', 'cloudflare'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(join(root, DEFAULT_DIRECTORY))
    expect(await lstat(join(root, DEFAULT_DIRECTORY))).toBeDefined()
  })
})

describe('Cloudflare project initialization', () => {
  test('writes a minimal package-backed Worker project with safe account and environment names', async () => {
    const result = await run()
    const dir = join(root, DEFAULT_DIRECTORY)
    expect(result.directory).toBe(dir)
    expect(result.unchanged).toBe(false)
    expect(await readFile(join(dir, 'src/index.ts'), 'utf8')).toContain(
      'from "@klnap/payload-storage-sanity/cloudflare"'
    )
    const wrangler = JSON.parse(await readFile(join(dir, 'wrangler.jsonc'), 'utf8')) as {
      name: string
      account_id: string
      env: Record<string, object>
    }
    expect(wrangler.name).toBe(DEFAULT_WORKER_NAME)
    expect(wrangler.account_id).toBe('YOUR_CLOUDFLARE_ACCOUNT_ID')
    expect(wrangler.env.staging).toEqual({})
    expect(wrangler.env.production).toEqual({})
    expect(new Set(effectiveWorkerNames(wrangler.name)).size).toBe(3)
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(pkg.dependencies['@klnap/payload-storage-sanity']).toBe('0.3.4')
    expect(pkg.scripts.dev).toBe('wrangler dev --var ALLOW_LOCAL_HTTP:true')
    expect(await readFile(join(dir, '.gitignore'), 'utf8')).toContain('.dev.vars*')
    expect(pkg.scripts.deploy).toBe('node scripts/predeploy.mjs')
    expect(pkg.scripts['deploy:staging']).toContain('--env staging')
    const guard = await readFile(join(dir, 'scripts/predeploy.mjs'), 'utf8')
    expect(guard).toContain('["whoami"]')
    expect(guard).toContain('"/workers/scripts"')
    expect(guard).toContain('CLOUDFLARE_API_TOKEN')
    expect(guard).toContain('delete env.CLOUDFLARE_API_TOKEN')
    expect(guard).toContain('redirect: "error"')
    expect(guard).toContain('per_page=1000')
    expect(guard).toContain('The guard will not adopt, overwrite, rename, or deploy it.')
    expect(guard).toContain('bunx')
    expect(await readFile(join(dir, MANIFEST_FILE), 'utf8')).toContain('"effectiveNames"')
  })

  test('generated pre-deploy guard checks the full account script list and refuses an existing name', async () => {
    const fixture = await guardFixture()
    fixture.env.API_PAGES = JSON.stringify([apiPage(['payload-sanity-storage'], 1, 1)])
    const blocked = spawnSync('node', [fixture.guard], {
      cwd: fixture.directory,
      encoding: 'utf8',
      env: fixture.env,
    })
    expect(blocked.status).toBe(2)
    expect(blocked.stderr).toContain('will not adopt, overwrite, rename, or deploy')
    expect(await readFile(fixture.log, 'utf8')).toContain(
      'https://api.cloudflare.com/client/v4/accounts/account-123/workers/scripts?page=1&per_page=1000'
    )
    expect(await readFile(fixture.log, 'utf8')).not.toContain('wrangler deploy')
  })

  test('generated pre-deploy guard checks the configured effective environment name', async () => {
    const fixture = await guardFixture()
    const configPath = join(fixture.directory, 'wrangler.jsonc')
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      env: Record<string, { name?: string }>
    }
    config.env.staging!.name = 'custom-staging-worker'
    await writeFile(configPath, JSON.stringify(config))
    fixture.env.API_PAGES = JSON.stringify([apiPage(['custom-staging-worker'], 1, 1)])
    const result = spawnSync('node', [fixture.guard, '--env', 'staging'], {
      cwd: fixture.directory,
      encoding: 'utf8',
      env: fixture.env,
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('"custom-staging-worker"')
    expect(await readFile(fixture.log, 'utf8')).not.toContain('wrangler deploy')
  })

  test('generated pre-deploy guard paginates and fails closed on unknown names without a TTY', async () => {
    const fixture = await guardFixture()
    fixture.env.API_PAGES = JSON.stringify([
      apiPage(['other-worker'], 1, 2),
      apiPage(['another-worker'], 2, 2),
    ])
    const result = spawnSync('node', [fixture.guard], {
      cwd: fixture.directory,
      encoding: 'utf8',
      env: fixture.env,
    })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('Rerun interactively')
    expect(await readFile(fixture.log, 'utf8')).toContain('page=2&per_page=1000')
    expect(await readFile(fixture.log, 'utf8')).not.toContain('wrangler deploy')
  })

  test('generated pre-deploy guard keeps the read-only API token out of Wrangler auth', async () => {
    const fixture = await guardFixture()
    fixture.env.FORCE_TTY = '1'
    const result = spawnSync('node', [fixture.guard], {
      cwd: fixture.directory,
      encoding: 'utf8',
      input: `${DEFAULT_WORKER_NAME}\n`,
      env: fixture.env,
    })
    expect(result.status).toBe(0)
    const log = await readFile(fixture.log, 'utf8')
    expect(log).toContain('wrangler whoami token=\n')
    expect(log).toContain('wrangler deploy token=\n')
    expect(log).not.toContain('token=set')
  })

  test('generated pre-deploy guard fails closed on API errors and redacts the token', async () => {
    const fixture = await guardFixture()
    fixture.env.API_ERROR = '1'
    const result = spawnSync('node', [fixture.guard], {
      cwd: fixture.directory,
      encoding: 'utf8',
      env: fixture.env,
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Nothing was deployed')
    expect(result.stderr).not.toContain('secret-api-token')
    expect(await readFile(fixture.log, 'utf8')).not.toContain('wrangler deploy')
  })

  test('generated pre-deploy guard rejects incomplete pagination and missing API tokens', async () => {
    const incomplete = await guardFixture()
    incomplete.env.API_PAGES = JSON.stringify([apiPage(['other-worker'], 1, 2)])
    const incompleteResult = spawnSync('node', [incomplete.guard], {
      cwd: incomplete.directory,
      encoding: 'utf8',
      env: incomplete.env,
    })
    expect(incompleteResult.status).toBe(1)
    expect(incompleteResult.stderr).toContain('Could not verify every Worker Script')
    expect(await readFile(incomplete.log, 'utf8')).not.toContain('wrangler deploy')

    const missingToken = await guardFixture()
    delete missingToken.env.CLOUDFLARE_API_TOKEN
    const missingTokenResult = spawnSync('node', [missingToken.guard], {
      cwd: missingToken.directory,
      encoding: 'utf8',
      env: missingToken.env,
    })
    expect(missingTokenResult.status).toBe(1)
    expect(missingTokenResult.stderr).toContain('read-only Workers Scripts permission')
    expect(await readFile(missingToken.log, 'utf8')).not.toContain('API https://')
  })

  test('reuses an existing workers directory and coexists with other projects', async () => {
    await mkdir(join(root, 'workers', 'payload-backups'), { recursive: true })
    await writeFile(
      join(root, 'workers', 'payload-backups', 'README.md'),
      'owned by another project\n'
    )
    await writeFile(
      join(root, 'workers', 'payload-backups', 'payload-backups.manifest.json'),
      JSON.stringify({ name: 'payload-backups', schemaVersion: 1 })
    )
    expect(
      (await failure(run({ name: 'payload-backups', directory: 'workers/duplicate-backup' }))).code
    ).toBe('WORKER_NAME_CONFLICT')
    const result = await run()
    expect(result.directory).toBe(join(root, DEFAULT_DIRECTORY))
    expect(await readFile(join(root, 'workers', 'payload-backups', 'README.md'), 'utf8')).toBe(
      'owned by another project\n'
    )
  })

  test('honors both overrides', async () => {
    const result = await run({ name: 'sanity-edge', directory: 'workers/custom-edge' })
    expect(result.directory).toBe(join(root, 'workers/custom-edge'))
    expect(JSON.parse(await readFile(join(result.directory, 'wrangler.jsonc'), 'utf8')).name).toBe(
      'sanity-edge'
    )
  })

  test('repeat initialization is a no-op and preserves customized generated content', async () => {
    const first = await run()
    const readme = join(first.directory, 'README.md')
    const customized = '# My deployment notes\n'
    await writeFile(readme, customized)
    const repeat = await run()
    expect(repeat.unchanged).toBe(true)
    expect(repeat.written).toEqual([])
    expect(repeat.customized).toContain(readme)
    expect(await readFile(readme, 'utf8')).toBe(customized)
  })

  test('preserves and reports untracked user files inside an initialized project', async () => {
    const { directory } = await run()
    const notes = join(directory, 'notes.txt')
    await writeFile(notes, 'keep this file\n')
    const result = await run()
    expect(result.unchanged).toBe(true)
    expect(result.customized).toContain(notes)
    expect(await readFile(notes, 'utf8')).toBe('keep this file\n')
  })

  test('refuses unrelated non-empty directories and invalid or incomplete manifests', async () => {
    const target = join(root, DEFAULT_DIRECTORY)
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'notes.txt'), 'keep\n')
    expect((await failure(run())).code).toBe('DIRECTORY_CONFLICT')
    expect(await readFile(join(target, 'notes.txt'), 'utf8')).toBe('keep\n')

    await rm(join(target, 'notes.txt'))
    await writeFile(join(target, MANIFEST_FILE), '{bad json')
    expect((await failure(run())).code).toBe('SCAFFOLD_INCOMPLETE')
    expect(await readFile(join(target, MANIFEST_FILE), 'utf8')).toBe('{bad json')
  })

  test('rejects file targets and paths outside the Payload application root', async () => {
    await writeFile(join(root, 'workers'), 'not a directory')
    expect((await failure(run())).code).toBe('INVALID_TARGET_PATH')
    expect((await failure(run({ directory: outside }))).code).toBe('INVALID_TARGET_PATH')
  })

  test('rejects a missing Payload config without creating directories', async () => {
    await rm(join(root, 'payload.config.ts'))
    expect((await failure(run())).code).toBe('MISSING_CONFIGURATION')
    expect(await lstat(join(root, 'workers')).catch(() => null)).toBeNull()
  })

  test('restores a missing generated file only when a valid manifest proves ownership', async () => {
    const result = await run()
    const path = join(result.directory, 'src/index.ts')
    await rm(path)
    const repeat = await run()
    expect(repeat.written).toContain(path)
    expect(await readFile(path, 'utf8')).toContain('@klnap/payload-storage-sanity/cloudflare')
  })

  test('rejects target traversal and symlinks without writing outside the application', async () => {
    expect((await failure(run({ directory: '../outside' }))).code).toBe('INVALID_TARGET_PATH')
    await mkdir(join(root, 'workers'), { recursive: true })
    await symlink(outside, join(root, 'workers', 'payload-sanity-storage'))
    expect((await failure(run())).code).toBe('INVALID_TARGET_PATH')
    expect(await (async () => (await import('node:fs/promises')).readdir(outside))()).toEqual([])
  })

  test('rejects symlinked generated subdirectories after initialization', async () => {
    const result = await run()
    await rm(join(result.directory, 'src'), { recursive: true })
    await symlink(outside, join(result.directory, 'src'))
    expect((await failure(run())).code).toBe('INVALID_TARGET_PATH')
  })

  test('detects local duplicate base or effective environment names', async () => {
    await run()
    expect(
      (
        await failure(
          run({ name: 'payload-sanity-storage-staging', directory: 'custom/nested/other' })
        )
      ).code
    ).toBe('WORKER_NAME_CONFLICT')
    expect(
      (await failure(run({ name: 'payload-sanity-storage', directory: 'workers/another' }))).code
    ).toBe('WORKER_NAME_CONFLICT')
  })

  test.each([
    [
      'wrangler.jsonc',
      `{
        // Wrangler JSONC comments and trailing commas are valid.
        "name": "unrelated-worker",
        "env": { "preview": {}, },
      }`,
      'unrelated-worker-preview',
    ],
    [
      'wrangler.json',
      JSON.stringify({
        name: 'unrelated-worker',
        env: { preview: { name: 'payload-sanity-storage-staging' } },
      }),
      'payload-sanity-storage-staging',
    ],
    [
      'wrangler.toml',
      `name = "unrelated-worker"

[env.preview]
`,
      'unrelated-worker-preview',
    ],
  ])('detects effective name collisions in %s', async (file, content, collision) => {
    const project = join(root, 'nested', 'manual-worker')
    await mkdir(project, { recursive: true })
    await writeFile(join(project, file), content)
    const error = await failure(
      run({
        name:
          collision === 'unrelated-worker-preview'
            ? 'unrelated-worker-preview'
            : 'payload-sanity-storage',
        directory: 'workers/other',
      })
    )
    expect(error.code).toBe('WORKER_NAME_CONFLICT')
  })

  test('fails closed on malformed local Wrangler config', async () => {
    const project = join(root, 'manual-worker')
    await mkdir(project)
    await writeFile(join(project, 'wrangler.toml'), 'name = "manual-worker"\n[env.broken\n')
    expect((await failure(run({ directory: 'workers/other' }))).code).toBe(
      'LOCAL_CONFIG_UNREADABLE'
    )
  })

  test('rejects invalid names and overlong effective environment names', () => {
    for (const name of ['Payload', 'bad_name', '1bad', 'bad-', '']) {
      expect(() => assertWorkerName(name)).toThrow(ScaffoldError)
    }
    try {
      assertWorkerName(`a${'b'.repeat(54)}`)
      throw new Error('expected long effective name to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(ScaffoldError)
      expect((error as ScaffoldError).message).toContain(`"${`a${'b'.repeat(54)}-production`}"`)
    }
  })

  test('reports actionable permission failures', async () => {
    if (process.getuid?.() === 0) return
    await chmod(root, 0o555)
    const error = await failure(run())
    expect(error.code).toBe('PERMISSION_DENIED')
    expect(error.message).toContain('write access')
  })

  test('a concurrent init is blocked by the initialization lock', async () => {
    await writeFile(join(root, '.payload-sanity-storage.payload-sanity-storage-init.lock'), '{}\n')
    expect((await failure(run())).code).toBe('INIT_IN_PROGRESS')
  })

  test('a stale init lock is reported without automatic removal', async () => {
    const lock = join(root, '.payload-sanity-storage.payload-sanity-storage-init.lock')
    const content = JSON.stringify({ startedAt: '2000-01-01T00:00:00.000Z' })
    await writeFile(lock, content)
    const error = await failure(run())
    expect(error.code).toBe('SCAFFOLD_INCOMPLETE')
    expect(await readFile(lock, 'utf8')).toBe(content)
  })
})
