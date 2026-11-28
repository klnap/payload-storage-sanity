export class ScaffoldError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitStatus = 2
  ) {
    super(message)
    this.name = 'ScaffoldError'
  }
}
