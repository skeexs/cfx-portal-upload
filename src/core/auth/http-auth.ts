import { PortalClient } from '../portal-client'
import { Logger } from '../logger'
import { AuthInput, AuthProvider, AuthSession } from './types'

export class HttpAuthProvider implements AuthProvider {
  constructor(
    private readonly portalClient: PortalClient,
    private readonly logger: Logger
  ) {}

  async getSession(input: AuthInput): Promise<AuthSession> {
    const cookieHeader = `_t=${input.cookie}`
    await this.portalClient.verifySession(cookieHeader)
    this.logger.debug('HTTP session established directly from forum cookie.')

    return {
      cookieHeader,
      source: 'http'
    }
  }
}
