import { CompositeAuthProvider } from '../src/core/auth'
import { ActionError } from '../src/core/errors'
import { Logger } from '../src/core/logger'
import { AuthProvider } from '../src/core/auth/types'

const logger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

describe('CompositeAuthProvider', () => {
  it('falls back to browser when HTTP auth fails with 403', async () => {
    const httpGetSessionMock = jest
      .fn()
      .mockRejectedValue(
        new ActionError(
          'auth',
          'Authentication failed with status 403.',
          false,
          'x',
          403
        )
      )

    const httpProvider: AuthProvider = {
      getSession: httpGetSessionMock
    }

    const browserGetSessionMock = jest.fn().mockResolvedValue({
      cookieHeader: 'session=abc',
      source: 'browser'
    })

    const browserProvider: AuthProvider = {
      getSession: browserGetSessionMock
    }

    const provider = new CompositeAuthProvider(
      'auto',
      httpProvider,
      browserProvider,
      logger
    )

    const session = await provider.getSession({
      cookie: 'cookie'
    })

    expect(session.source).toBe('browser')
    expect(httpGetSessionMock).toHaveBeenCalledTimes(1)
    expect(browserGetSessionMock).toHaveBeenCalledTimes(1)
  })
})
