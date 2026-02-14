import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import { ReUploadResponse, SearchResponse, Urls } from '../types'
import { ActionError } from './errors'
import { Logger } from './logger'

function endpoint(type: keyof typeof Urls, assetId?: string): string {
  const raw = Urls[type]
  return assetId ? raw.replace('{id}', assetId) : raw
}

export class PortalClient {
  private readonly http: AxiosInstance

  constructor(
    private readonly timeoutMs: number,
    private readonly logger: Logger
  ) {
    this.http = axios.create({
      baseURL: Urls.API,
      timeout: timeoutMs
    })
  }

  async verifySession(cookieHeader: string): Promise<void> {
    await this.http.get('me/assets?search=&sort=asset.name&direction=asc', {
      headers: {
        Cookie: cookieHeader
      }
    })
  }

  async resolveAssetId(name: string, cookieHeader: string): Promise<string> {
    this.logger.debug(`Resolving asset id for name "${name}".`)

    const search = await this.http.get<SearchResponse>(
      `me/assets?search=${encodeURIComponent(name)}&sort=asset.name&direction=asc`,
      {
        headers: {
          Cookie: cookieHeader
        }
      }
    )

    if (search.data.items.length === 0) {
      throw new ActionError(
        'portal',
        `Failed to find asset id for "${name}". See debug logs for more information.`,
        false,
        'Ensure the asset exists in portal.cfx.re and that the name is correct.'
      )
    }

    for (const asset of search.data.items) {
      if (asset.name === name) {
        return asset.id.toString()
      }
    }

    throw new ActionError(
      'portal',
      `Failed to find asset id for "${name}" exact match. See debug logs for more information.`,
      false,
      'Use assetId directly or provide the exact portal asset name.'
    )
  }

  async startReupload(
    assetId: string,
    chunkCount: number,
    chunkSize: number,
    totalSize: number,
    originalFileName: string,
    cookieHeader: string
  ): Promise<void> {
    const response = await this.http.post<ReUploadResponse>(
      endpoint('REUPLOAD', assetId),
      {
        chunk_count: chunkCount,
        chunk_size: chunkSize,
        name: originalFileName,
        original_file_name: originalFileName,
        total_size: totalSize
      },
      {
        headers: {
          Cookie: cookieHeader
        }
      }
    )

    if (response.data.errors !== null) {
      throw new ActionError(
        'upload',
        'Failed to start re-upload session.',
        false,
        'Inspect portal response in debug logs and verify asset permissions.'
      )
    }
  }

  async uploadChunk(
    assetId: string,
    chunkIndex: number,
    chunk: Buffer,
    cookieHeader: string
  ): Promise<void> {
    const form = new FormData()
    form.append('chunk_id', chunkIndex)
    form.append('chunk', chunk, {
      filename: 'blob',
      contentType: 'application/octet-stream'
    })

    await this.http.post(endpoint('UPLOAD_CHUNK', assetId), form, {
      headers: {
        ...form.getHeaders(),
        Cookie: cookieHeader
      }
    })
  }

  async completeUpload(assetId: string, cookieHeader: string): Promise<void> {
    await this.http.post(
      endpoint('COMPLETE_UPLOAD', assetId),
      {},
      {
        headers: {
          Cookie: cookieHeader
        }
      }
    )
  }
}
