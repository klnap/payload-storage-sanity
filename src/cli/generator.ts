import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { ScaffoldError } from './errors.js'
import { assertWorkerName, effectiveEnvironmentName, effectiveWorkerNames } from './naming.js'

export const DEFAULT_WORKER_NAME = 'payload-sanity-storage'
export const DEFAULT_DIRECTORY = 'workers/payload-sanity-storage'
export const MANIFEST_FILE = 'payload-sanity-storage.manifest.json'
const PACKAGE_NAME = '@klnap/payload-storage-sanity'
const LOCK_STALE_MS = 10 * 60 * 1000
const PAYLOAD_CONFIG = /^payload\.config\.(ts|js|mts|mjs|cts|cjs)$/
const PERMISSION_CODES = new Set(['EACCES', 'EPERM', 'EROFS'])

type Manifest = {
  schemaVersion: 1
  name: string
  packageVersion: string
  effectiveNames: string[]
  files: Record<string, string>
}

type Created = { path: string; directory: boolean }

export type GenerateCloudflareProjectOptions = {
  applicationRoot?: string
  name?: string
  directory?: string
}

export type GenerateCloudflareProjectResult = {
  directory: string
  written: string[]
  customized: string[]
  unchanged: boolean
}

const sha256 = (content: string | Buffer): string =>
  createHash('sha256').update(content).digest('hex')
const isCode = (error: unknown, code: string): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === code

const packageVersion = async (): Promise<string> => {
  const packagePath = new URL('../../package.json', import.meta.url)
  const pkg = JSON.parse(await readFile(packagePath, 'utf8')) as { version: string }
  return pkg.version
}

const templates = (name: string, version: string): Record<string, string> => ({
  'src/index.ts': `export { default } from "${PACKAGE_NAME}/cloudflare";\n`,
  'wrangler.jsonc': `${JSON.stringify(
    {
      $schema: './node_modules/wrangler/config-schema.json',
      name,
      account_id: 'YOUR_CLOUDFLARE_ACCOUNT_ID',
      main: 'src/index.ts',
      compatibility_date: '2026-01-01',
      env: {
        staging: {},
        production: {},
      },
    },
    null,
    2
  )}\n`,
  'package.json': `${JSON.stringify(
    {
      name,
      private: true,
      type: 'module',
      scripts: {
        dev: 'wrangler dev --var ALLOW_LOCAL_HTTP:true',
        deploy: 'node scripts/predeploy.mjs',
        'deploy:staging': 'node scripts/predeploy.mjs --env staging',
        'deploy:production': 'node scripts/predeploy.mjs --env production',
      },
      dependencies: { [PACKAGE_NAME]: version },
      devDependencies: { wrangler: '4.168.0' },
    },
    null,
    2
  )}\n`,
  'scripts/predeploy.mjs': [
    'import { spawnSync } from "node:child_process";',
    'import { readFileSync } from "node:fs";',
    'import { createInterface } from "node:readline/promises";',
    'import { fileURLToPath } from "node:url";',
    'import { dirname, resolve } from "node:path";',
    '',
    'const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");',
    'const config = JSON.parse(readFileSync(resolve(root, "wrangler.jsonc"), "utf8"));',
    'const environment = process.argv[2] === "--env" ? process.argv[3] : undefined;',
    'if (process.argv.length > 2 && (!environment || !config.env?.[environment])) {',
    '  console.error("Use no environment, --env staging, or --env production.");',
    '  process.exit(2);',
    '}',
    'const workerName = environment ? (config.env?.[environment]?.name ?? config.name + "-" + environment) : config.name;',
    'const accountId = config.account_id;',
    'if (!accountId || accountId === "YOUR_CLOUDFLARE_ACCOUNT_ID") {',
    '  console.error("Set account_id in wrangler.jsonc to the intended Cloudflare account ID before deploying.");',
    '  process.exit(2);',
    '}',
    '',
    'const run = (args, useWranglerLogin = false) => {',
    '  const env = { ...process.env };',
    '  if (useWranglerLogin) delete env.CLOUDFLARE_API_TOKEN;',
    '  return spawnSync("bunx", ["wrangler", ...args], { cwd: root, encoding: "utf8", env });',
    '};',
    'const identity = run(["whoami"], true);',
    'if (identity.error || identity.status !== 0) {',
    '  console.error("Wrangler authentication failed. Run `bunx wrangler login`, confirm the intended account with `bunx wrangler whoami`, then retry.");',
    '  process.exit(identity.status ?? 1);',
    '}',
    'const token = process.env.CLOUDFLARE_API_TOKEN;',
    'if (!token) {',
    '  console.error("Set CLOUDFLARE_API_TOKEN with read-only Workers Scripts permission for the configured account. Nothing was deployed.");',
    '  process.exit(1);',
    '}',
    'const apiUrl = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(accountId) + "/workers/scripts";',
    'const scripts = [];',
    'let page = 1;',
    'let totalPages;',
    'let totalCount;',
    'let pageSize;',
    'try {',
    '  while (totalPages === undefined || page <= totalPages) {',
    '    const response = await fetch(apiUrl + "?page=" + page + "&per_page=1000", {',
    '      headers: { Authorization: "Bearer " + token },',
    '      redirect: "error",',
    '    });',
    '    if (!response.ok) throw new Error("HTTP error");',
    '    const body = await response.json();',
    '    const info = body?.result_info;',
    '    if (body?.success !== true || !Array.isArray(body.result) || !Number.isInteger(info?.page) || info.page !== page || !Number.isInteger(info?.per_page) || info.per_page < 1 || !Number.isInteger(info?.count) || info.count !== body.result.length || !Number.isInteger(info?.total_count) || info.total_count < 0) throw new Error("Malformed response");',
    '    if (totalPages === undefined) {',
    '      totalPages = Math.max(1, Math.ceil(info.total_count / info.per_page));',
    '      totalCount = info.total_count;',
    '      pageSize = info.per_page;',
    '    } else if (info.total_count !== totalCount || info.per_page !== pageSize) throw new Error("Incomplete pagination");',
    '    for (const item of body.result) {',
    '      if (!item || typeof item.id !== "string" || item.id.length === 0) throw new Error("Malformed script");',
    '      scripts.push(item.id);',
    '    }',
    '    page++;',
    '  }',
    '  if (scripts.length !== totalCount) throw new Error("Incomplete pagination");',
    '} catch {',
    '  console.error("Could not verify every Worker Script in the configured Cloudflare account. Check the account ID, API token permission, network, and API response. Nothing was deployed.");',
    '  process.exit(1);',
    '}',
    'if (scripts.includes(workerName)) {',
    '  console.error("Worker name " + JSON.stringify(workerName) + " already exists in account " + accountId + ". The guard will not adopt, overwrite, rename, or deploy it.");',
    '  console.error("Choose a new Worker name or have the account owner resolve the conflict; then run this guard again.");',
    '  process.exit(2);',
    '}',
    'if (process.stdin.isTTY !== true) {',
    '  console.error("No Worker Script with this name was found. Rerun interactively and confirm the exact name before deploying.");',
    '  process.exit(2);',
    '}',
    'const prompt = createInterface({ input: process.stdin, output: process.stderr });',
    'const confirmation = await prompt.question("Confirm the Worker name is unused in this account by typing " + JSON.stringify(workerName) + ": ");',
    'prompt.close();',
    'if (confirmation !== workerName) {',
    '  console.error("Name confirmation did not match. Nothing was deployed.");',
    '  process.exit(2);',
    '}',
    'const deploy = run(environment ? ["deploy", "--env", environment] : ["deploy"], true);',
    'if (deploy.stdout) process.stdout.write(deploy.stdout);',
    'if (deploy.stderr) process.stderr.write(deploy.stderr);',
    'process.exit(deploy.status ?? 1);',
    '',
  ].join('\n'),
  '.gitignore': 'node_modules/\n.wrangler/\n.dev.vars*\n',
  'README.md': [
    `# ${name}`,
    '',
    'A small Cloudflare Worker entry project for Payload Storage Sanity. Runtime code comes from the published package.',
    '',
    '## Configure and deploy',
    '',
    '1. Install dependencies with `bun install`.',
    '2. Run `bunx wrangler whoami` and choose the intended account.',
    '3. Set its account ID in `wrangler.jsonc` as `account_id`.',
    '4. For local development, put `SANITY_TOKEN` and `UPLOAD_TRANSPORT_SECRET` in `.dev.vars`.',
    '5. Deploy through `bun run deploy`, which checks the configured account before deployment.',
    '',
    '`bun run dev` enables HTTP only for loopback Payload endpoints used by local development. This override is not included in deploy commands.',
    'Set `SANITY_TOKEN` and `UPLOAD_TRANSPORT_SECRET` as Wrangler secrets for every deployed environment.',
    "The pre-deploy guard uses Wrangler's native login to deploy and CLOUDFLARE_API_TOKEN with read-only Workers Scripts permission to check the configured account.",
    'It checks every page of the account-scoped Workers Scripts API and requires interactive exact-name confirmation when no script exists.',
    'A detected script is never adopted, overwritten, renamed, or deployed over. Resolve a conflict with the account owner,',
    'or choose a new `--name` and initialize a separate project. If initialization stopped midway, inspect the manifest and files;',
    'remove only the incomplete generated project after confirming it contains no user data, then rerun init.',
    '',
    'Wrangler environments use distinct names: the base Worker, `-staging`, and `-production`.',
    'Use `bun run deploy:staging` or `bun run deploy:production` for environment deployments; these run the same name guard.',
    'The check and deployment are not atomic. Another actor can create the name after the check and before deployment.',
    '',
  ].join('\n'),
})

const lstatOrNull = async (path: string) => {
  try {
    return await lstat(path)
  } catch (error) {
    if (isCode(error, 'ENOENT')) return null
    throw error
  }
}

const resolveTarget = (root: string, directory: string): string => {
  const target = resolve(root, directory)
  const inside = relative(root, target)
  if (!inside || isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) {
    throw new ScaffoldError(
      'INVALID_TARGET_PATH',
      `Target "${directory}" must be a directory inside the Payload application root ${root}.`
    )
  }
  return target
}

const assertRealPath = async (root: string, target: string): Promise<void> => {
  let current = root
  for (const part of relative(root, target).split(sep)) {
    current = join(current, part)
    const info = await lstatOrNull(current)
    if (!info) return
    if (info.isSymbolicLink()) {
      throw new ScaffoldError(
        'INVALID_TARGET_PATH',
        `${current} is a symbolic link; choose a path without symbolic links.`
      )
    }
    if (current !== target && !info.isDirectory()) {
      throw new ScaffoldError('INVALID_TARGET_PATH', `${current} is not a directory.`)
    }
  }
}

const assertApplicationRoot = async (root: string): Promise<void> => {
  const entries = await readdir(root).catch((error: unknown) => {
    if (isCode(error, 'ENOENT') || isCode(error, 'ENOTDIR')) return []
    throw error
  })
  if (!entries.some((entry) => PAYLOAD_CONFIG.test(entry))) {
    throw new ScaffoldError(
      'MISSING_CONFIGURATION',
      `No payload.config file found in ${root}. Run init from the Payload application root.`
    )
  }
}

const ensureDirectory = async (
  root: string,
  directory: string,
  created: Created[]
): Promise<void> => {
  let current = root
  for (const part of relative(root, directory).split(sep).filter(Boolean)) {
    current = join(current, part)
    if (await lstatOrNull(current)) continue
    try {
      await mkdir(current, { mode: 0o755 })
      created.push({ path: current, directory: true })
    } catch (error) {
      if (isCode(error, 'EEXIST')) continue
      throw error
    }
  }
}

const manifestFor = async (path: string): Promise<Manifest | null> => {
  const info = await lstatOrNull(path)
  if (!info) return null
  if (!info.isFile())
    throw new ScaffoldError('DIRECTORY_CONFLICT', `${path} is not a regular manifest file.`)
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<Manifest>
    if (
      value.schemaVersion === 1 &&
      typeof value.name === 'string' &&
      typeof value.packageVersion === 'string' &&
      Array.isArray(value.effectiveNames) &&
      value.effectiveNames.every((item) => typeof item === 'string') &&
      typeof value.files === 'object' &&
      value.files !== null &&
      Object.values(value.files).every(
        (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
      )
    )
      return value as Manifest
  } catch {
    // Invalid manifests are conflicts, not permission to overwrite.
  }
  throw new ScaffoldError(
    'SCAFFOLD_INCOMPLETE',
    `The manifest ${path} is invalid. Inspect the project and recover it manually.`
  )
}

const stripJsonc = (source: string): string => {
  let output = ''
  let quote = false
  let escaped = false
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    const next = source[index + 1]
    if (quote) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quote = false
      continue
    }
    if (char === '"') {
      quote = true
      output += char
    } else if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index++
      output += '\n'
    } else if (char === '/' && next === '*') {
      index += 2
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') output += '\n'
        index++
      }
      if (index >= source.length) throw new Error('Unterminated JSONC comment')
      index++
    } else {
      output += char
    }
  }
  if (quote) throw new Error('Unterminated JSONC string')
  let result = ''
  quote = false
  escaped = false
  for (let index = 0; index < output.length; index++) {
    const char = output[index]!
    if (quote) {
      result += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quote = false
    } else if (char === '"') {
      quote = true
      result += char
    } else if (char === ',') {
      let next = index + 1
      while (/\s/.test(output[next] ?? '')) next++
      if (output[next] !== '}' && output[next] !== ']') result += char
    } else {
      result += char
    }
  }
  return result
}

const wranglerNames = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Wrangler config must be an object')
  const config = value as { name?: unknown; env?: unknown }
  if (typeof config.name !== 'string' || config.name.length === 0)
    throw new Error('Wrangler config has no valid top-level name')
  const names = [config.name]
  if (config.env === undefined) return names
  if (!config.env || typeof config.env !== 'object' || Array.isArray(config.env))
    throw new Error('Wrangler env must be an object')
  for (const [environment, raw] of Object.entries(config.env)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error(`Wrangler env.${environment} must be an object`)
    const configuredName = (raw as { name?: unknown }).name
    if (
      configuredName !== undefined &&
      (typeof configuredName !== 'string' || configuredName.length === 0)
    )
      throw new Error(`Wrangler env.${environment}.name must be a non-empty string`)
    names.push(effectiveEnvironmentName(config.name, environment, configuredName))
  }
  return names
}

const tomlNames = (source: string): string[] => {
  let base: string | undefined
  const environments = new Map<string, string | undefined>()
  let environment: string | undefined
  let topLevel = true
  for (const original of source.split(/\r?\n/)) {
    let line = ''
    let quote: string | undefined
    let escaped = false
    for (const char of original) {
      if (quote) {
        line += char
        if (escaped) escaped = false
        else if (char === '\\' && quote === '"') escaped = true
        else if (char === quote) quote = undefined
      } else if (char === '"' || char === "'") {
        quote = char
        line += char
      } else if (char === '#') break
      else line += char
    }
    if (quote) throw new Error('Unterminated TOML string')
    const trimmed = line.trim()
    if (!trimmed) continue
    const section = /^\[env\.(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\]$/.exec(trimmed)
    if (section) {
      environment = section[1] ?? section[2] ?? section[3]
      if (!environment) throw new Error('Empty Wrangler environment name')
      topLevel = false
      if (!environments.has(environment)) environments.set(environment, undefined)
      continue
    }
    if (/^\[/.test(trimmed)) {
      if (!/^\[{1,2}[A-Za-z0-9_.-]+\]{1,2}$/.test(trimmed))
        throw new Error('Malformed TOML section')
      environment = undefined
      topLevel = false
      continue
    }
    if (!trimmed.includes('=')) throw new Error('Malformed TOML assignment')
    const assignment = /^([A-Za-z0-9_-]+)\s*=\s*(.*)$/.exec(trimmed)
    if (!assignment || assignment[2]!.length === 0) throw new Error('Malformed TOML assignment')
    if (assignment[1] !== 'name') continue
    if (!environment && !topLevel) continue
    const raw = assignment[2]!
    let name: string
    if (raw.startsWith('"')) name = JSON.parse(raw) as string
    else if (raw.startsWith("'") && raw.endsWith("'")) name = raw.slice(1, -1)
    else throw new Error('Wrangler name must be a string')
    if (!name) throw new Error('Wrangler name must not be empty')
    if (environment) environments.set(environment, name)
    else base = name
  }
  if (!base) throw new Error('Wrangler config has no valid top-level name')
  return [
    base,
    ...[...environments].map(([key, name]) => effectiveEnvironmentName(base!, key, name)),
  ]
}

const assertNoNameConflict = async (
  root: string,
  directory: string,
  names: string[]
): Promise<void> => {
  const scan = async (current: string): Promise<void> => {
    if (current === directory) return
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') await scan(path)
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.manifest.json')) continue
      let manifest: { name?: unknown; effectiveNames?: unknown }
      try {
        manifest = JSON.parse(await readFile(path, 'utf8')) as typeof manifest
      } catch {
        continue
      }
      const existingNames = [
        ...(typeof manifest.name === 'string' ? [manifest.name] : []),
        ...(Array.isArray(manifest.effectiveNames)
          ? manifest.effectiveNames.filter((name): name is string => typeof name === 'string')
          : []),
      ]
      const collision = existingNames.find((name) => names.includes(name))
      if (collision) {
        throw new ScaffoldError(
          'WORKER_NAME_CONFLICT',
          `Effective Worker name "${collision}" is already initialized in ${dirname(path)}. Choose another --name.`
        )
      }
    }
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (!entry.isFile() || !/^wrangler\.(jsonc|json|toml)$/.test(entry.name)) continue
      const path = join(current, entry.name)
      try {
        const source = await readFile(path, 'utf8')
        const existingNames = entry.name.endsWith('.toml')
          ? tomlNames(source)
          : wranglerNames(JSON.parse(stripJsonc(source)))
        const collision = existingNames.find((name) => names.includes(name))
        if (collision) {
          throw new ScaffoldError(
            'WORKER_NAME_CONFLICT',
            `Effective Worker name "${collision}" is already configured in ${dirname(path)}. Choose another --name.`
          )
        }
      } catch (error) {
        if (error instanceof ScaffoldError) throw error
        throw new ScaffoldError(
          'LOCAL_CONFIG_UNREADABLE',
          `Could not safely read Wrangler config ${path}. Fix or inspect it before initializing.`
        )
      }
    }
  }
  await scan(root)
}

const lockStartedAt = (text: string): number | undefined => {
  try {
    const time = Date.parse((JSON.parse(text) as { startedAt?: string }).startedAt ?? '')
    return Number.isNaN(time) ? undefined : time
  } catch {
    return undefined
  }
}

const lockToken = (text: string): string | undefined => {
  try {
    const token = (JSON.parse(text) as { token?: unknown }).token
    return typeof token === 'string' ? token : undefined
  } catch {
    return undefined
  }
}

const acquireLock = async (path: string, name: string, directory: string): Promise<string> => {
  const token = randomUUID()
  try {
    await writeFile(
      path,
      `${JSON.stringify({ pid: process.pid, token, startedAt: new Date().toISOString() })}\n`,
      { flag: 'wx' }
    )
    return token
  } catch (error) {
    if (!isCode(error, 'EEXIST')) throw error
  }
  const content = await readFile(path, 'utf8').catch(() => undefined)
  if (content === undefined)
    throw new ScaffoldError('INIT_IN_PROGRESS', `Initialization lock ${path} changed; retry.`)
  const time =
    lockStartedAt(content) ??
    (await stat(path).then(
      (info) => info.mtimeMs,
      () => Date.now()
    ))
  if (Date.now() - time > LOCK_STALE_MS) {
    throw new ScaffoldError(
      'SCAFFOLD_INCOMPLETE',
      `Stale init lock ${path}. Confirm no init is running, inspect ${directory}, remove only the stale lock, then retry.`,
      1
    )
  }
  throw new ScaffoldError(
    'INIT_IN_PROGRESS',
    `Another init for "${name}" is running (lock ${path}); retry after it finishes.`
  )
}

const writeNew = async (path: string, content: string, created: Created[]): Promise<void> => {
  await writeFile(path, content, { flag: 'wx' })
  created.push({ path, directory: false })
}

const rollback = async (created: Created[]): Promise<void> => {
  for (const item of [...created].reverse()) {
    if (item.directory) await rmdir(item.path).catch(() => undefined)
    else await unlink(item.path).catch(() => undefined)
  }
}

const normalizeError = (error: unknown): unknown => {
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code && PERMISSION_CODES.has(code)) {
    return new ScaffoldError(
      'PERMISSION_DENIED',
      `Permission denied (${code}). Check ownership and write access for the target directory, then retry.`,
      1
    )
  }
  return error
}

export const generateCloudflareProject = async (
  options: GenerateCloudflareProjectOptions = {}
): Promise<GenerateCloudflareProjectResult> => {
  const root = resolve(options.applicationRoot ?? process.cwd())
  const name = options.name ?? DEFAULT_WORKER_NAME
  assertWorkerName(name)
  const names = effectiveWorkerNames(name)
  const directory = resolveTarget(root, options.directory ?? DEFAULT_DIRECTORY)
  await assertApplicationRoot(root)
  await assertRealPath(root, directory)
  const lockPaths = names
    .map((effective) => join(root, `.${effective}.payload-sanity-storage-init.lock`))
    .sort()
  const lockedPaths: Array<{ path: string; token: string }> = []
  const created: Created[] = []
  try {
    for (const lockPath of lockPaths) {
      const token = await acquireLock(lockPath, name, directory)
      lockedPaths.push({ path: lockPath, token })
    }
    await assertNoNameConflict(root, directory, names)
    const version = await packageVersion()
    const info = await lstatOrNull(directory)
    if (info && !info.isDirectory())
      throw new ScaffoldError('DIRECTORY_CONFLICT', `${directory} exists and is not a directory.`)
    const manifestPath = join(directory, MANIFEST_FILE)
    const previous = info ? await manifestFor(manifestPath) : null
    const files = templates(name, version)
    if (!info || (await readdir(directory)).length === 0) {
      await ensureDirectory(root, directory, created)
      const hashes: Record<string, string> = {}
      const written: string[] = []
      for (const [path, content] of Object.entries(files)) {
        const file = join(directory, path)
        await ensureDirectory(directory, dirname(file), created)
        await writeNew(file, content, created)
        hashes[path] = sha256(content)
        written.push(file)
      }
      const manifest: Manifest = {
        schemaVersion: 1,
        name,
        packageVersion: version,
        effectiveNames: names,
        files: hashes,
      }
      await writeNew(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, created)
      written.push(manifestPath)
      return { directory, written, customized: [], unchanged: false }
    }
    if (
      !previous ||
      previous.name !== name ||
      JSON.stringify(previous.effectiveNames) !== JSON.stringify(names)
    ) {
      throw new ScaffoldError(
        'DIRECTORY_CONFLICT',
        `${directory} is not an initialized project for "${name}". Existing files were left untouched.`
      )
    }
    const existingPaths = Object.keys(previous.files).sort()
    if (existingPaths.join('\0') !== Object.keys(files).sort().join('\0')) {
      throw new ScaffoldError(
        'SCAFFOLD_INCOMPLETE',
        `Manifest ${manifestPath} does not match this scaffold version. Inspect it before recovery.`
      )
    }
    const customized: string[] = []
    const missing: string[] = []
    for (const [path, content] of Object.entries(files)) {
      const file = join(directory, path)
      await assertRealPath(directory, file)
      const fileInfo = await lstatOrNull(file)
      if (!fileInfo) {
        missing.push(path)
        continue
      }
      if (!fileInfo.isFile())
        throw new ScaffoldError(
          'SCAFFOLD_INCOMPLETE',
          `${file} is not a regular file. Inspect it before recovery.`
        )
      const current = sha256(await readFile(file))
      if (current !== previous.files[path] || current !== sha256(content)) customized.push(file)
    }
    const inspectExtras = async (path: string): Promise<string[]> => {
      const found: string[] = []
      for (const entry of await readdir(path, { withFileTypes: true })) {
        const fullPath = join(path, entry.name)
        if (entry.isSymbolicLink()) {
          throw new ScaffoldError(
            'INVALID_TARGET_PATH',
            `${fullPath} is a symbolic link; remove it only after checking its target.`
          )
        }
        if (entry.isDirectory()) found.push(...(await inspectExtras(fullPath)))
        else if (entry.isFile()) {
          const key = relative(directory, fullPath).split(sep).join('/')
          if (key !== MANIFEST_FILE && !(key in files)) found.push(fullPath)
        }
      }
      return found
    }
    customized.push(...(await inspectExtras(directory)))
    const changed = [...missing]
    for (const path of missing) {
      const file = join(directory, path)
      await ensureDirectory(directory, dirname(file), created)
      await writeNew(file, files[path]!, created)
    }
    if (changed.length) {
      const hashes = { ...previous.files }
      for (const path of changed) hashes[path] = sha256(files[path]!)
      const updated = { ...previous, packageVersion: version, files: hashes }
      await writeFile(manifestPath, `${JSON.stringify(updated, null, 2)}\n`)
    }
    const written = changed.map((path) => join(directory, path))
    if (changed.length) written.push(manifestPath)
    return { directory, written, customized, unchanged: changed.length === 0 }
  } catch (error) {
    await rollback(created)
    throw normalizeError(error)
  } finally {
    await Promise.all(
      lockedPaths.map(async ({ path, token }) => {
        const content = await readFile(path, 'utf8').catch(() => undefined)
        if (content && lockToken(content) === token) await rm(path, { force: true })
      })
    )
  }
}
