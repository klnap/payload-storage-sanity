#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { realpathSync } from 'node:fs'
import { ScaffoldError } from './errors.js'
import { generateCloudflareProject } from './generator.js'

type Parsed = { name?: string; directory?: string }

export const parseInitArgs = (args: string[]): Parsed => {
  if (args[0] !== 'init' || args[1] !== 'cloudflare') {
    throw new ScaffoldError(
      'USAGE',
      'Usage: payload-storage-sanity init cloudflare [--name <worker-name>] [--dir <directory>]'
    )
  }
  const parsed: Parsed = {}
  for (let index = 2; index < args.length; index += 1) {
    const flag = args[index]
    const value = args[index + 1]
    if ((flag !== '--name' && flag !== '--dir') || !value || value.startsWith('--')) {
      throw new ScaffoldError(
        'USAGE',
        `Invalid or incomplete option "${flag}". Usage: payload-storage-sanity init cloudflare [--name <worker-name>] [--dir <directory>]`
      )
    }
    if (flag === '--name') parsed.name = value
    else parsed.directory = value
    index += 1
  }
  return parsed
}

export const runCli = async (args: string[]): Promise<number> => {
  try {
    const result = await generateCloudflareProject(parseInitArgs(args))
    process.stdout.write(
      `${result.unchanged ? 'Worker project already initialized' : 'Initialized Worker project'}: ${result.directory}\n`
    )
    if (result.customized.length) {
      process.stdout.write(`Preserved customized files: ${result.customized.join(', ')}\n`)
    }
    return 0
  } catch (error) {
    if (error instanceof ScaffoldError) {
      process.stderr.write(`${error.message}\n`)
      return error.exitStatus
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

if (process.argv[1]) {
  try {
    if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
      process.exitCode = await runCli(process.argv.slice(2))
    }
  } catch {
    // The module may be imported without an executable path.
  }
}
