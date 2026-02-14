import { runCli } from '../src/cli'
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

describe('cli', () => {
  const parseRunConfigMock = parseRunConfig as jest.Mock
  const createAuthProviderMock = createAuthProvider as jest.Mock
  const uploadServiceClassMock = UploadService as unknown as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('runs upload command with shared service core', async () => {
    parseRunConfigMock.mockReturnValue({
      cookie: 'cookie',
      makeZip: false,
      skipUpload: true,
      chunkSize: 1024,
      authMode: 'auto',
      requestTimeoutMs: 1000,
      retryPolicy: { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 },
      zipExclude: [],
      workspacePath: process.cwd(),
      assetId: '123',
      assetName: 'asset'
    })

    createAuthProviderMock.mockReturnValue({
      getSession: jest.fn()
    })

    const runMock = jest.fn().mockResolvedValue({
      skippedUpload: true,
      authenticatedWith: 'http',
      uploadedChunks: 0
    })

    uploadServiceClassMock.mockImplementation(() => ({
      run: runMock
    }))

    const exitCode = await runCli(['upload', '--cookie', 'cookie'])

    expect(exitCode).toBe(0)
    expect(runMock).toHaveBeenCalledTimes(1)
  })
})
