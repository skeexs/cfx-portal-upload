export interface ReUploadResponse {
  asset_id: number
  errors: Record<string, unknown> | string[] | string | null
}

export interface Asset {
  id: number
  name: string
}

export interface SearchResponse {
  items: Asset[]
}

export interface SSOResponseBody {
  url: string
}

export enum Urls {
  API = 'https://portal-api.cfx.re/v1/',
  SSO = 'auth/discourse?return=',
  REUPLOAD = 'assets/{id}/re-upload',
  UPLOAD_CHUNK = 'assets/{id}/upload-chunk',
  COMPLETE_UPLOAD = 'assets/{id}/complete-upload'
}

export type AuthMode = 'auto' | 'http' | 'browser'

export type AuthSource = 'http' | 'browser'

export interface RetryPolicy {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

export interface RunConfig {
  cookie: string
  makeZip: boolean
  assetName?: string
  assetId?: string
  zipPath?: string
  skipUpload: boolean
  chunkSize: number
  authMode: AuthMode
  requestTimeoutMs: number
  retryPolicy: RetryPolicy
  zipExclude: string[]
  workspacePath: string
}

export interface UploadResult {
  skippedUpload: boolean
  authenticatedWith: AuthSource
  assetId?: string
  assetName?: string
  zipPath?: string
  uploadedChunks: number
}

export type ClassifiedErrorKind =
  | 'config'
  | 'auth'
  | 'portal'
  | 'upload'
  | 'network'
  | 'timeout'
  | 'unknown'
