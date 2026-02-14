import { basename } from 'path'
import { AuthMode, RunConfig } from './types'

export interface RawRunInputs {
  cookie?: string
  makeZip?: string | boolean
  assetName?: string
  assetId?: string | number
  zipPath?: string
  skipUpload?: string | boolean
  chunkSize?: string | number
  maxRetries?: string | number
  authMode?: string
  requestTimeoutMs?: string | number
  retryBaseDelayMs?: string | number
  retryMaxDelayMs?: string | number
  zipExclude?: string
  workspacePath?: string
}

function parseBoolean(
  value: string | boolean | undefined,
  defaultValue: boolean
): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === undefined || value.trim().length === 0) {
    return defaultValue
  }

  if (value.toLowerCase() === 'true') {
    return true
  }

  if (value.toLowerCase() === 'false') {
    return false
  }

  throw new Error(`Invalid boolean value "${value}". Use true or false.`)
}

function parsePositiveInteger(
  value: string | number | undefined,
  defaultValue: number,
  errorMessage: string
): number {
  if (value === undefined || value.toString().trim().length === 0) {
    return defaultValue
  }

  const parsed = Number.parseInt(value.toString(), 10)

  if (Number.isNaN(parsed)) {
    throw new Error(errorMessage)
  }

  if (parsed <= 0) {
    throw new Error(`${errorMessage} Value must be greater than zero.`)
  }

  return parsed
}

function parseNonNegativeInteger(
  value: string | number | undefined,
  defaultValue: number,
  errorMessage: string
): number {
  if (value === undefined || value.toString().trim().length === 0) {
    return defaultValue
  }

  const parsed = Number.parseInt(value.toString(), 10)

  if (Number.isNaN(parsed)) {
    throw new Error(errorMessage)
  }

  if (parsed < 0) {
    throw new Error(`${errorMessage} Value must be zero or greater.`)
  }

  return parsed
}

function parseAssetId(value: string | number | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.toString().trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseAuthMode(value: string | undefined): AuthMode {
  if (value === undefined || value.trim().length === 0) {
    return 'auto'
  }

  const mode = value.trim().toLowerCase()
  if (mode === 'auto' || mode === 'http' || mode === 'browser') {
    return mode
  }

  throw new Error(
    `Invalid authMode "${value}". Allowed values are: auto, http, browser.`
  )
}

function parseZipExclude(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return []
  }

  return value
    .split(',')
    .map(pattern => pattern.trim())
    .filter(pattern => pattern.length > 0)
}

function parseName(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveWorkspacePath(value: string | undefined): string {
  if (value && value.trim().length > 0) {
    return value
  }

  if (process.env.GITHUB_WORKSPACE && process.env.GITHUB_WORKSPACE.length > 0) {
    return process.env.GITHUB_WORKSPACE
  }

  return process.cwd()
}

export function parseRunConfig(inputs: RawRunInputs): RunConfig {
  const cookie = parseName(inputs.cookie)
  if (!cookie) {
    throw new Error('Input "cookie" is required.')
  }

  const workspacePath = resolveWorkspacePath(inputs.workspacePath)

  const makeZip = parseBoolean(inputs.makeZip, true)
  const skipUpload = parseBoolean(inputs.skipUpload, false)
  let assetName = parseName(inputs.assetName)
  const assetId = parseAssetId(inputs.assetId)

  if (!assetName && (makeZip || (!assetId && !skipUpload))) {
    assetName = basename(workspacePath)
  }

  const zipPath = parseName(inputs.zipPath)

  const chunkSize = parsePositiveInteger(
    inputs.chunkSize,
    2_097_152,
    'Invalid chunk size. Must be a number.'
  )

  const maxRetries = parseNonNegativeInteger(
    inputs.maxRetries,
    3,
    'Invalid max retries. Must be a number.'
  )

  const requestTimeoutMs = parsePositiveInteger(
    inputs.requestTimeoutMs,
    30_000,
    'Invalid request timeout. Must be a number.'
  )

  const retryBaseDelayMs = parsePositiveInteger(
    inputs.retryBaseDelayMs,
    500,
    'Invalid retry base delay. Must be a number.'
  )

  const retryMaxDelayMs = parsePositiveInteger(
    inputs.retryMaxDelayMs,
    5_000,
    'Invalid retry max delay. Must be a number.'
  )

  if (retryMaxDelayMs < retryBaseDelayMs) {
    throw new Error(
      'retryMaxDelayMs must be greater than or equal to retryBaseDelayMs.'
    )
  }

  return {
    cookie,
    makeZip,
    assetName,
    assetId,
    zipPath,
    skipUpload,
    chunkSize,
    authMode: parseAuthMode(inputs.authMode),
    requestTimeoutMs,
    retryPolicy: {
      maxRetries,
      baseDelayMs: retryBaseDelayMs,
      maxDelayMs: retryMaxDelayMs
    },
    zipExclude: parseZipExclude(inputs.zipExclude),
    workspacePath
  }
}
