import { ActionError } from '../src/core/errors'
import { Logger } from '../src/core/logger'
import { withRetry } from '../src/core/retry'

const logger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

describe('withRetry', () => {
  it('retries and recovers from transient failures', async () => {
    let attempts = 0

    const result = await withRetry(
      async () => {
        attempts++
        if (attempts < 2) {
          await Promise.resolve()
          throw new ActionError('network', 'temporary', true, 'retry')
        }
        await Promise.resolve()
        return 'ok'
      },
      {
        policy: {
          maxRetries: 2,
          baseDelayMs: 1,
          maxDelayMs: 1
        },
        logger,
        context: 'upload chunk'
      }
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('classifies timeout errors', async () => {
    const timeoutError = new Error('timeout') as Error & {
      isAxiosError: boolean
      code: string
    }
    timeoutError.isAxiosError = true
    timeoutError.code = 'ECONNABORTED'

    await expect(
      withRetry(
        async () => {
          await Promise.resolve()
          throw timeoutError
        },
        {
          policy: {
            maxRetries: 0,
            baseDelayMs: 1,
            maxDelayMs: 1
          },
          logger,
          context: 'start upload'
        }
      )
    ).rejects.toMatchObject({
      kind: 'timeout'
    })
  })

  it('fails after max retries are exhausted', async () => {
    let attempts = 0

    await expect(
      withRetry(
        async () => {
          attempts++
          await Promise.resolve()
          throw new ActionError('upload', 'chunk failed', true, 'retry')
        },
        {
          policy: {
            maxRetries: 2,
            baseDelayMs: 1,
            maxDelayMs: 1
          },
          logger,
          context: 'upload chunk'
        }
      )
    ).rejects.toMatchObject({
      kind: 'upload'
    })

    expect(attempts).toBe(3)
  })
})
