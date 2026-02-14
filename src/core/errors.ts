import axios from 'axios'
import { ClassifiedErrorKind } from '../types'

export class ActionError extends Error {
  readonly kind: ClassifiedErrorKind
  readonly retriable: boolean
  readonly suggestion: string
  readonly statusCode?: number

  constructor(
    kind: ClassifiedErrorKind,
    message: string,
    retriable: boolean,
    suggestion: string,
    statusCode?: number
  ) {
    super(message)
    this.name = 'ActionError'
    this.kind = kind
    this.retriable = retriable
    this.suggestion = suggestion
    this.statusCode = statusCode
  }
}

function normalizeMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function hasCloudflareSignature(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('cloudflare') ||
    normalized.includes('challenge') ||
    normalized.includes('attention required')
  )
}

export function classifyError(
  error: unknown,
  fallbackKind: ClassifiedErrorKind = 'unknown'
): ActionError {
  if (error instanceof ActionError) {
    return error
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const message = normalizeMessage(error)

    if (error.code === 'ECONNABORTED') {
      return new ActionError(
        'timeout',
        'Request timed out while communicating with CFX portal.',
        true,
        'Increase requestTimeoutMs or retry later.'
      )
    }

    if (status === 401 || status === 403) {
      return new ActionError(
        'auth',
        `Authentication failed with status ${status}.`,
        false,
        'Verify cookie value. If this persists, run with authMode=browser.',
        status
      )
    }

    if (status === 429 || (status !== undefined && status >= 500)) {
      return new ActionError(
        'network',
        `Transient portal error with status ${status}.`,
        true,
        'Retry the upload. If it keeps failing, increase maxRetries.',
        status
      )
    }

    if (status !== undefined && status >= 400) {
      return new ActionError(
        fallbackKind,
        `Portal request failed with status ${status}.`,
        false,
        'Check inputs and inspect debug logs for request context.',
        status
      )
    }

    if (hasCloudflareSignature(message)) {
      return new ActionError(
        'auth',
        'Cloudflare challenge detected during authentication.',
        true,
        'Retry with authMode=browser.',
        status
      )
    }

    return new ActionError(
      'network',
      message,
      true,
      'Retry the operation and verify network connectivity.',
      status
    )
  }

  const message = normalizeMessage(error)

  if (hasCloudflareSignature(message)) {
    return new ActionError(
      'auth',
      'Cloudflare challenge detected during authentication.',
      true,
      'Retry with authMode=browser.'
    )
  }

  return new ActionError(
    fallbackKind,
    message,
    false,
    'Inspect debug logs for more details.'
  )
}

export function formatErrorForUser(error: unknown): string {
  const classified = classifyError(error)
  return `[${classified.kind}] ${classified.message} Hint: ${classified.suggestion}`
}
