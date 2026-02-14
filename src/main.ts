import * as core from '@actions/core'
import { parseRunConfig } from './config'
import { createAuthProvider } from './core/auth'
import { formatErrorForUser } from './core/errors'
import { PortalClient } from './core/portal-client'
import { UploadService } from './core/upload-service'
import { createActionLogger } from './loggers'

function readActionInputs(): ReturnType<typeof parseRunConfig> {
  return parseRunConfig({
    cookie: core.getInput('cookie'),
    makeZip: core.getInput('makeZip'),
    assetName: core.getInput('assetName'),
    maxRetries: core.getInput('maxRetries'),
    zipPath: core.getInput('zipPath'),
    assetId: core.getInput('assetId'),
    skipUpload: core.getInput('skipUpload'),
    chunkSize: core.getInput('chunkSize'),
    authMode: core.getInput('authMode'),
    requestTimeoutMs: core.getInput('requestTimeoutMs'),
    retryBaseDelayMs: core.getInput('retryBaseDelayMs'),
    retryMaxDelayMs: core.getInput('retryMaxDelayMs'),
    zipExclude: core.getInput('zipExclude'),
    workspacePath: process.env.GITHUB_WORKSPACE
  })
}

/**
 * The main function for the action.
 */
export async function run(): Promise<void> {
  const logger = createActionLogger()

  try {
    const config = readActionInputs()
    const portalClient = new PortalClient(config.requestTimeoutMs, logger)
    const authProvider = createAuthProvider(
      config.authMode,
      portalClient,
      logger,
      config.retryPolicy.maxRetries
    )

    const uploadService = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    const result = await uploadService.run(config)

    if (result.skippedUpload) {
      core.info('Login/session refresh completed. Upload was skipped.')
      return
    }

    core.info(
      `Upload finished for assetId=${result.assetId} using ${result.uploadedChunks} chunk(s).`
    )
  } catch (error) {
    core.setFailed(formatErrorForUser(error))
  }
}
