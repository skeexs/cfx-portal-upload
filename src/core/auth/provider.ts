import { AuthMode } from '../../types'
import { classifyError } from '../errors'
import { Logger } from '../logger'
import { AuthInput, AuthProvider, AuthSession } from './types'

function shouldFallbackToBrowser(error: unknown): boolean {
  const classified = classifyError(error, 'auth')

  if (classified.kind === 'timeout' || classified.retriable) {
    return true
  }

  if (
    classified.kind === 'auth' &&
    (classified.statusCode === 401 || classified.statusCode === 403)
  ) {
    return true
  }

  return classified.message.toLowerCase().includes('cloudflare')
}

export class CompositeAuthProvider implements AuthProvider {
  constructor(
    private readonly mode: AuthMode,
    private readonly httpProvider: AuthProvider,
    private readonly browserProvider: AuthProvider,
    private readonly logger: Logger
  ) {}

  async getSession(input: AuthInput): Promise<AuthSession> {
    if (this.mode === 'http') {
      return await this.httpProvider.getSession(input)
    }

    if (this.mode === 'browser') {
      return await this.browserProvider.getSession(input)
    }

    try {
      this.logger.info('Authenticating with HTTP-first strategy ...')
      return await this.httpProvider.getSession(input)
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error
      }

      this.logger.warn(
        'HTTP authentication failed, falling back to browser authentication.'
      )
      return await this.browserProvider.getSession(input)
    }
  }
}
