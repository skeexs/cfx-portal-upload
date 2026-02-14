import fs from 'fs'
import os from 'os'
import path from 'path'
import { RunConfig } from '../src/types'
import { ActionError } from '../src/core/errors'
import { Logger } from '../src/core/logger'
import { PortalClient } from '../src/core/portal-client'
import { UploadService } from '../src/core/upload-service'
import { AuthProvider } from '../src/core/auth'

const logger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

function createZipFile(size: number): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfx-upload-'))
  const zipPath = path.join(tmpDir, 'resource.zip')
  fs.writeFileSync(zipPath, Buffer.alloc(size, 1))
  return zipPath
}

function buildConfig(overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    cookie: 'cookie',
    makeZip: false,
    assetName: 'asset-name',
    assetId: '123',
    zipPath: createZipFile(10),
    skipUpload: false,
    chunkSize: 4,
    authMode: 'auto',
    requestTimeoutMs: 1000,
    retryPolicy: {
      maxRetries: 1,
      baseDelayMs: 1,
      maxDelayMs: 1
    },
    zipExclude: [],
    workspacePath: process.cwd(),
    ...overrides
  }
}

describe('UploadService', () => {
  it('uploads file in chunks successfully', async () => {
    const authProvider: AuthProvider = {
      getSession: jest.fn().mockResolvedValue({
        cookieHeader: 'session=abc',
        source: 'http'
      })
    }

    const portalClient = {
      resolveAssetId: jest.fn(),
      startReupload: jest.fn(),
      uploadChunk: jest.fn(),
      completeUpload: jest.fn()
    } as unknown as PortalClient

    const service = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    const result = await service.run(buildConfig())

    expect(result.uploadedChunks).toBe(3)
    expect((portalClient.startReupload as jest.Mock).mock.calls.length).toBe(1)
    expect((portalClient.uploadChunk as jest.Mock).mock.calls.length).toBe(3)
    expect((portalClient.completeUpload as jest.Mock).mock.calls.length).toBe(1)
  })

  it('retries a failing chunk and recovers', async () => {
    const authProvider: AuthProvider = {
      getSession: jest.fn().mockResolvedValue({
        cookieHeader: 'session=abc',
        source: 'http'
      })
    }

    let failedOnce = false
    const portalClient = {
      resolveAssetId: jest.fn(),
      startReupload: jest.fn(),
      uploadChunk: jest.fn().mockImplementation(() => {
        if (!failedOnce) {
          failedOnce = true
          throw new ActionError('network', 'temporary', true, 'retry')
        }
      }),
      completeUpload: jest.fn()
    } as unknown as PortalClient

    const service = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    const result = await service.run(
      buildConfig({
        zipPath: createZipFile(8),
        chunkSize: 4
      })
    )

    expect(result.uploadedChunks).toBe(2)
    expect((portalClient.uploadChunk as jest.Mock).mock.calls.length).toBe(3)
  })

  it('uses assetId when both assetId and assetName are provided', async () => {
    const authProvider: AuthProvider = {
      getSession: jest.fn().mockResolvedValue({
        cookieHeader: 'session=abc',
        source: 'http'
      })
    }

    const portalClient = {
      resolveAssetId: jest.fn(),
      startReupload: jest.fn(),
      uploadChunk: jest.fn(),
      completeUpload: jest.fn()
    } as unknown as PortalClient

    const service = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    await service.run(
      buildConfig({
        assetId: '999',
        assetName: 'different-name'
      })
    )

    expect((portalClient.resolveAssetId as jest.Mock).mock.calls.length).toBe(0)
  })

  it('returns early when skipUpload=true', async () => {
    const authProvider: AuthProvider = {
      getSession: jest.fn().mockResolvedValue({
        cookieHeader: 'session=abc',
        source: 'browser'
      })
    }

    const portalClient = {
      resolveAssetId: jest.fn(),
      startReupload: jest.fn(),
      uploadChunk: jest.fn(),
      completeUpload: jest.fn()
    } as unknown as PortalClient

    const service = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    const result = await service.run(
      buildConfig({
        skipUpload: true
      })
    )

    expect(result.skippedUpload).toBe(true)
    expect((portalClient.startReupload as jest.Mock).mock.calls.length).toBe(0)
    expect((portalClient.uploadChunk as jest.Mock).mock.calls.length).toBe(0)
  })

  it('returns exact asset lookup error text when no exact match exists', async () => {
    const authProvider: AuthProvider = {
      getSession: jest.fn().mockResolvedValue({
        cookieHeader: 'session=abc',
        source: 'http'
      })
    }

    const portalClient = {
      resolveAssetId: jest
        .fn()
        .mockRejectedValue(
          new ActionError(
            'portal',
            'Failed to find asset id for "missing" exact match. See debug logs for more information.',
            false,
            'Use assetId directly or provide the exact portal asset name.'
          )
        ),
      startReupload: jest.fn(),
      uploadChunk: jest.fn(),
      completeUpload: jest.fn()
    } as unknown as PortalClient

    const service = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    await expect(
      service.run(
        buildConfig({
          assetId: undefined,
          assetName: 'missing'
        })
      )
    ).rejects.toThrow(
      'Failed to find asset id for "missing" exact match. See debug logs for more information.'
    )
  })
})
