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
try {
  if (!process.env[config.envVar]?.trim()) {
    if (docker(['info'], false).status !== 0) {
      if (config.failIfUnavailableInCI && process.env.CI === 'true') {
        throw new Error(
          `[${config.containerName}] required database unavailable: ${config.envVar} is unset and no container runtime is available`
        )
      }
      console.log(
        `[${config.containerName}] database unreachable: ${config.envVar} is not set and no container runtime is available. Database integration tests are skipped.`
      )
      process.exit(0)
    }
    const password = randomBytes(24).toString('hex')
    const run = docker(
      [
        'run',
        '--name',
        containerName,
        '--label',
        'payload-storage-sanity.ephemeral-postgres=true',
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
        if (docker(['exec', containerName, 'pg_isready', '-U', 'postgres'], false).status === 0) {
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
} finally {
  if (started) {
    if (config.cleanupDelayMs) await Bun.sleep(config.cleanupDelayMs)
    docker(['rm', '-f', containerName], false)
  }
}
