import { AuthMode } from '../../types'
import { Logger } from '../logger'
import { PortalClient } from '../portal-client'
import { HttpAuthProvider } from './http-auth'
import { CompositeAuthProvider } from './provider'
import { PuppeteerAuthProvider } from './puppeteer-auth'
import { AuthProvider } from './types'

export function createAuthProvider(
  mode: AuthMode,
  portalClient: PortalClient,
  logger: Logger,
  maxRetries: number
): AuthProvider {
  const httpProvider = new HttpAuthProvider(portalClient, logger)
  const browserProvider = new PuppeteerAuthProvider(logger, maxRetries)

  return new CompositeAuthProvider(mode, httpProvider, browserProvider, logger)
}

export type { AuthProvider, AuthInput, AuthSession } from './types'
export { CompositeAuthProvider } from './provider'
