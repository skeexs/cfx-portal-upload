import { AuthSource } from '../../types'

export interface AuthInput {
  cookie: string
}

export interface AuthSession {
  cookieHeader: string
  source: AuthSource
}

export interface AuthProvider {
  getSession(input: AuthInput): Promise<AuthSession>
}
