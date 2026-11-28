import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const separator = process.argv.indexOf('--')
if (separator !== 3 || separator === process.argv.length - 1) {
  console.error('usage: bun scripts/with-ephemeral-postgres.mjs <config> -- <command...>')
  process.exit(1)
}

const { default: config } = await import(pathToFileURL(resolve(process.argv[2])).href)
const [command, ...args] = process.argv.slice(separator + 1)
const docker = (argv, inherit = true, env = {}) =>
  spawnSync('docker', argv, {
    env: { ...process.env, ...env },
    stdio: inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
  })
const containerName = `${config.containerName}-${randomBytes(8).toString('hex')}`
let started = false
const removeContainer = () => {
  if (!started) return
  started = false
  docker(['rm', '-f', containerName], false)
}
// While the test child runs, the event loop is blocked, so a signal runs this handler after the child exits.
// Ctrl+C also reaches the child and ends it first, so removal still happens on the normal path.
for (const [signal, code] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    removeContainer()
    process.exit(code)
  })
}

// Refuse production-looking hosts and host overrides before any test process connects.
const assertSafeTestUrl = (value) => {
  const url = new URL(value)
  if (/(^|[.-])prod(?:uction)?([.-]|$)/i.test(url.hostname)) {
    throw new Error('refusing to run integration tests against a production PostgreSQL host')
  }
  if (url.searchParams.has('host') || url.searchParams.has('hostaddr')) {
    throw new Error('test database URLs must not use host or hostaddr query parameters')
  }
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
  if (!loopback && !/(^|[.-])(test|testing|disposable|integration)([.-]|$)/i.test(url.hostname)) {
    throw new Error(
      'PostgreSQL test hosts must be loopback or marked test, disposable, or integration'
    )
  }
}

try {
  if (process.env[config.envVar]?.trim()) assertSafeTestUrl(process.env[config.envVar].trim())
  if (!process.env[config.envVar]?.trim()) {
    if (docker(['info'], false).status !== 0) {
      // Fail instead of skipping: a skipped integration run must never report success.
      console.error(
        `[${config.containerName}] cannot run integration tests: ${config.envVar} is not set and the Docker daemon is not reachable.\n` +
          `Start Docker Desktop (or the Docker engine), or set ${config.envVar} to a disposable PostgreSQL URL. ` +
          'Unit tests run without Docker: bun test.'
      )
      process.exit(1)
    }
    const password = randomBytes(24).toString('hex')
    const run = docker(
      [
        'run',
        '--name',
        containerName,
        '--label',
        'payload-storage-sanity.ephemeral-postgres=true',
        '--rm',
        '-e',
        'POSTGRES_PASSWORD',
        '-p',
        '127.0.0.1::5432',
        '-d',
        config.image,
      ],
      true,
      { POSTGRES_PASSWORD: password }
    )
    started = true
    if (run.status !== 0) process.exitCode = run.status ?? 1
    else {
      let ready = false
      for (let attempt = 0; attempt < 45; attempt++) {
        // TCP, not the unix socket: the image's init phase runs a temporary server on the socket only.
        if (
          docker(['exec', containerName, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], false)
            .status === 0
        ) {
          ready = true
          break
        }
        await Bun.sleep(500)
      }
      if (!ready) throw new Error(`${containerName} did not become ready`)

      const port = docker(['port', containerName, '5432/tcp'], false)
      const hostPort = port.stdout.trim().match(/^127\.0\.0\.1:(\d+)$/m)?.[1]
      if (port.status !== 0 || !hostPort) throw new Error(`cannot resolve ${containerName} port`)
      process.env[config.envVar] = `postgres://postgres:${password}@127.0.0.1:${hostPort}/postgres`
    }
  }

  if (process.exitCode === undefined) {
    const env = {
      ...process.env,
      ...(started ? { PAYLOAD_TEST_POSTGRES_CONTAINER: containerName } : {}),
    }
    const result = spawnSync(command, args, { stdio: 'inherit', env })
    process.exitCode = result.status ?? 1
  }
} catch (error) {
  console.error(`[${config.containerName}] ${error.message}`)
  process.exitCode = 1
} finally {
  if (started) {
    if (config.cleanupDelayMs) await Bun.sleep(config.cleanupDelayMs)
    removeContainer()
  }
}
