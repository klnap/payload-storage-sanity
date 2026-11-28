import { ScaffoldError } from './errors.js'

const VALID_WORKER_NAME = /^[a-z][a-z0-9-]{0,62}$/

export const effectiveWorkerNames = (name: string): string[] => [
  name,
  `${name}-staging`,
  `${name}-production`,
]

export const effectiveEnvironmentName = (
  name: string,
  environment: string,
  configuredName?: string
): string => configuredName ?? `${name}-${environment}`

export const assertWorkerName = (name: string): void => {
  for (const effective of effectiveWorkerNames(name)) {
    if (!VALID_WORKER_NAME.test(effective) || effective.endsWith('-')) {
      throw new ScaffoldError(
        'INVALID_WORKER_NAME',
        `Invalid effective Worker name "${effective}". Use lowercase letters, digits and hyphens, start with a letter, and keep each name within 63 characters.`
      )
    }
  }
}
