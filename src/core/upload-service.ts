import { createReadStream, statSync } from 'fs'
import { basename } from 'path'
import { RunConfig, UploadResult } from '../types'
import { ActionError } from './errors'
import { Logger } from './logger'
import { createZip } from './packager'
import { PortalClient } from './portal-client'
import { withRetry } from './retry'
import { AuthProvider } from './auth'

interface UploadZipInput {
  assetId: string
  zipPath: string
  chunkSize: number
  cookieHeader: string
  config: RunConfig
}

export interface UploadServiceDependencies {
  authProvider: AuthProvider
  portalClient: PortalClient
  logger: Logger
}

export class UploadService {
  constructor(private readonly deps: UploadServiceDependencies) {}

  async run(config: RunConfig): Promise<UploadResult> {
    const session = await this.deps.authProvider.getSession({
      cookie: config.cookie
    })

    this.deps.logger.info(
      `Authenticated against CFX portal using ${session.source} mode.`
    )

    if (config.skipUpload) {
      this.deps.logger.info('Skipping upload due to skipUpload=true')
      return {
        skippedUpload: true,
        authenticatedWith: session.source,
        uploadedChunks: 0
      }
    }

    const assetId = await this.resolveAssetId(config, session.cookieHeader)
    const zipPath = await this.resolveZipPath(config)
    const uploadedChunks = await this.uploadZip({
      assetId,
      zipPath,
      chunkSize: config.chunkSize,
      cookieHeader: session.cookieHeader,
      config
    })

    this.deps.logger.info('Upload completed successfully.')

    return {
      skippedUpload: false,
      authenticatedWith: session.source,
      assetId,
      assetName: config.assetName,
      zipPath,
      uploadedChunks
    }
  }

  private async resolveAssetId(
    config: RunConfig,
    cookieHeader: string
  ): Promise<string> {
    if (config.assetId) {
      if (config.assetName) {
        this.deps.logger.debug(
          'Both assetId and assetName were provided. assetId takes precedence.'
        )
      }
      return config.assetId
    }

    if (!config.assetName) {
      throw new ActionError(
        'config',
        'assetName or assetId must be provided when skipUpload is false.',
        false,
        'Provide assetId directly or set assetName to the exact portal asset name.'
      )
    }

    const assetName = config.assetName

    return await withRetry(
      async () =>
        await this.deps.portalClient.resolveAssetId(assetName, cookieHeader),
      {
        policy: config.retryPolicy,
        logger: this.deps.logger,
        context: `Resolve asset id for "${assetName}"`
      }
    )
  }

  private async resolveZipPath(config: RunConfig): Promise<string> {
    if (config.zipPath && config.zipPath.length > 0) {
      this.deps.logger.debug(`Using provided zipPath: ${config.zipPath}`)
      return config.zipPath
    }

    if (!config.makeZip) {
      throw new ActionError(
        'config',
        'Either zipPath or makeZip must be provided to upload a file.',
        false,
        'Set zipPath to an existing zip or enable makeZip=true.'
      )
    }

    if (!config.assetName) {
      throw new ActionError(
        'config',
        'assetName is required to generate a zip path when makeZip is enabled.',
        false,
        'Provide assetName or explicit zipPath.'
      )
    }

    this.deps.logger.info('Creating zip file ...')
    return await createZip({
      workspacePath: config.workspacePath,
      assetName: config.assetName,
      extraExcludes: config.zipExclude,
      logger: this.deps.logger
    })
  }

  private async uploadZip(input: UploadZipInput): Promise<number> {
    const stats = statSync(input.zipPath)
    const totalSize = stats.size

    if (totalSize <= 0) {
      throw new ActionError(
        'upload',
        `Zip file "${input.zipPath}" is empty.`,
        false,
        'Ensure your artifact contains files before upload.'
      )
    }

    const chunkCount = Math.ceil(totalSize / input.chunkSize)
    const originalFileName = basename(input.zipPath)

    await withRetry(
      async () =>
        await this.deps.portalClient.startReupload(
          input.assetId,
          chunkCount,
          input.chunkSize,
          totalSize,
          originalFileName,
          input.cookieHeader
        ),
      {
        policy: input.config.retryPolicy,
        logger: this.deps.logger,
        context: 'Start re-upload session'
      }
    )

    const stream = createReadStream(input.zipPath, {
      highWaterMark: input.chunkSize
    })

    let chunkIndex = 0

    for await (const chunk of stream) {
      const chunkBuffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk as Uint8Array)

      await withRetry(
        async () =>
          await this.deps.portalClient.uploadChunk(
            input.assetId,
            chunkIndex,
            chunkBuffer,
            input.cookieHeader
          ),
        {
          policy: input.config.retryPolicy,
          logger: this.deps.logger,
          context: `Upload chunk ${chunkIndex + 1}/${chunkCount}`
        }
      )

      this.deps.logger.info(`Uploaded chunk ${chunkIndex + 1}/${chunkCount}`)
      chunkIndex++
    }

    await withRetry(
      async () =>
        await this.deps.portalClient.completeUpload(
          input.assetId,
          input.cookieHeader
        ),
      {
        policy: input.config.retryPolicy,
        logger: this.deps.logger,
        context: 'Complete upload'
      }
    )

    return chunkIndex
  }
}
