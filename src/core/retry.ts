import { RetryPolicy } from '../types'
import { classifyError } from './errors'
import { Logger } from './logger'

export interface RetryOptions {
  policy: RetryPolicy
  logger: Logger
  context: string
  shouldRetry?: (error: ReturnType<typeof classifyError>) => boolean
}

function computeDelay(policy: RetryPolicy, attempt: number): number {
  const exponential = policy.baseDelayMs * 2 ** attempt
  const capped = Math.min(exponential, policy.maxDelayMs)
  const jitter = Math.floor(Math.random() * Math.min(250, policy.baseDelayMs))
  return capped + jitter
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let attempt = 0
  let keepTrying = true

  while (keepTrying) {
    try {
      return await operation()
    } catch (error) {
      const classified = classifyError(error)
      const canRetryByPolicy = attempt < options.policy.maxRetries
      const canRetryByError =
        options.shouldRetry?.(classified) ?? classified.retriable
      keepTrying = canRetryByPolicy && canRetryByError

      if (!keepTrying) {
        throw classified
      }

      const delay = computeDelay(options.policy, attempt)
      options.logger.warn(
        `${options.context} failed (attempt ${attempt + 1}/${options.policy.maxRetries + 1}). Retrying in ${delay}ms.`
      )
      attempt++
      await sleep(delay)
    }
  }

  throw new Error('Retry loop exited unexpectedly.')
}
