import * as core from '@actions/core'
import { run } from '../src/main'
import { parseRunConfig } from '../src/config'
import { createAuthProvider } from '../src/core/auth'
import { UploadService } from '../src/core/upload-service'

jest.mock('../src/config', () => ({
  parseRunConfig: jest.fn()
}))

jest.mock('../src/core/auth', () => ({
  createAuthProvider: jest.fn()
}))

jest.mock('../src/core/portal-client', () => ({
  PortalClient: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../src/core/upload-service', () => ({
  UploadService: jest.fn().mockImplementation(() => ({
    run: jest.fn()
  }))
}))

describe('main.run', () => {
  const parseRunConfigMock = parseRunConfig as jest.Mock
  const createAuthProviderMock = createAuthProvider as jest.Mock
  const uploadServiceClassMock = UploadService as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(core, 'getInput').mockImplementation(() => '')
    jest.spyOn(core, 'info').mockImplementation()
    jest.spyOn(core, 'debug').mockImplementation()
    jest.spyOn(core, 'warning').mockImplementation()
    jest.spyOn(core, 'error').mockImplementation()
  })

  it('sets failed state when config parsing fails', async () => {
    parseRunConfigMock.mockImplementation(() => {
      throw new Error('Invalid chunk size. Must be a number.')
    })

    const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()

    await run()

    expect(setFailedMock).toHaveBeenCalledWith(
      expect.stringContaining('Invalid chunk size. Must be a number.')
    )
  })

  it('runs upload service and reports summary', async () => {
    parseRunConfigMock.mockReturnValue({
      cookie: 'cookie',
      makeZip: false,
      skipUpload: false,
      chunkSize: 1024,
      authMode: 'auto',
      requestTimeoutMs: 1000,
      retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 },
      zipExclude: [],
      workspacePath: process.cwd(),
      assetId: '123',
      assetName: 'asset',
      zipPath: './asset.zip'
    })

    createAuthProviderMock.mockReturnValue({
      getSession: jest.fn()
    })

    const serviceRunMock = jest.fn().mockResolvedValue({
      skippedUpload: false,
      assetId: '123',
      uploadedChunks: 3
    })

    uploadServiceClassMock.mockImplementation(() => ({
      run: serviceRunMock
    }))

    const infoMock = jest.spyOn(core, 'info').mockImplementation()

    await run()

    expect(serviceRunMock).toHaveBeenCalledTimes(1)
    expect(infoMock).toHaveBeenCalledWith(
      'Upload finished for assetId=123 using 3 chunk(s).'
    )
  })
})
