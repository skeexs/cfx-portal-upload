import { parseRunConfig, RawRunInputs } from './config'
import { createAuthProvider } from './core/auth'
import { formatErrorForUser } from './core/errors'
import { PortalClient } from './core/portal-client'
import { UploadService } from './core/upload-service'
import { createConsoleLogger } from './loggers'

type ParsedArgv = {
  command?: string
  flags: Record<string, string | boolean>
}

function normalizeFlagName(name: string): string {
  return name.replace(/-([a-z])/g, (_, chr: string) => chr.toUpperCase())
}

function parseArgv(argv: string[]): ParsedArgv {
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }

    const withoutPrefix = token.slice(2)
    const equalIndex = withoutPrefix.indexOf('=')

    if (equalIndex > -1) {
      const key = normalizeFlagName(withoutPrefix.slice(0, equalIndex))
      const value = withoutPrefix.slice(equalIndex + 1)
      flags[key] = value
      continue
    }

    const key = normalizeFlagName(withoutPrefix)
    const next = argv[index + 1]

    if (next && !next.startsWith('--')) {
      flags[key] = next
      index++
      continue
    }

    flags[key] = true
  }

  return {
    command: positional[0],
    flags
  }
}

function printUsage(): void {
  console.log(`Usage:
  node dist/cli.js upload --cookie <forum_cookie> [options]

Options:
  --assetName <value>
  --assetId <value>
  --zipPath <value>
  --makeZip <true|false>
  --skipUpload <true|false>
  --chunkSize <number>
  --maxRetries <number>
  --authMode <auto|http|browser>
  --requestTimeoutMs <number>
  --retryBaseDelayMs <number>
  --retryMaxDelayMs <number>
  --zipExclude ".git/**,node_modules/**"
  --debug
  --help`)
}

function toRawInputs(flags: Record<string, string | boolean>): RawRunInputs {
  return {
    cookie: typeof flags.cookie === 'string' ? flags.cookie : undefined,
    makeZip: flags.makeZip,
    assetName:
      typeof flags.assetName === 'string' ? flags.assetName : undefined,
    assetId:
      typeof flags.assetId === 'string' || typeof flags.assetId === 'number'
        ? flags.assetId
        : undefined,
    zipPath: typeof flags.zipPath === 'string' ? flags.zipPath : undefined,
    skipUpload: flags.skipUpload,
    chunkSize:
      typeof flags.chunkSize === 'string' || typeof flags.chunkSize === 'number'
        ? flags.chunkSize
        : undefined,
    maxRetries:
      typeof flags.maxRetries === 'string' ||
      typeof flags.maxRetries === 'number'
        ? flags.maxRetries
        : undefined,
    authMode: typeof flags.authMode === 'string' ? flags.authMode : undefined,
    requestTimeoutMs:
      typeof flags.requestTimeoutMs === 'string' ||
      typeof flags.requestTimeoutMs === 'number'
        ? flags.requestTimeoutMs
        : undefined,
    retryBaseDelayMs:
      typeof flags.retryBaseDelayMs === 'string' ||
      typeof flags.retryBaseDelayMs === 'number'
        ? flags.retryBaseDelayMs
        : undefined,
    retryMaxDelayMs:
      typeof flags.retryMaxDelayMs === 'string' ||
      typeof flags.retryMaxDelayMs === 'number'
        ? flags.retryMaxDelayMs
        : undefined,
    zipExclude:
      typeof flags.zipExclude === 'string' ? flags.zipExclude : undefined,
    workspacePath: process.cwd()
  }
}

export async function runCli(argv: string[]): Promise<number> {
  const parsed = parseArgv(argv)

  if (parsed.flags.help || parsed.command === undefined) {
    printUsage()
    return 0
  }

  if (parsed.command !== 'upload') {
    console.error(`Unknown command "${parsed.command}".`)
    printUsage()
    return 1
  }

  const debugEnabled = parsed.flags.debug === true
  const logger = createConsoleLogger(debugEnabled)

  try {
    const config = parseRunConfig(toRawInputs(parsed.flags))
    const portalClient = new PortalClient(config.requestTimeoutMs, logger)
    const authProvider = createAuthProvider(
      config.authMode,
      portalClient,
      logger,
      config.retryPolicy.maxRetries
    )

    const service = new UploadService({
      authProvider,
      portalClient,
      logger
    })

    const result = await service.run(config)

    if (result.skippedUpload) {
      logger.info('Session refresh completed. Upload skipped.')
    } else {
      logger.info(
        `Upload completed. assetId=${result.assetId} chunks=${result.uploadedChunks}`
      )
    }

    return 0
  } catch (error) {
    logger.error(formatErrorForUser(error))
    return 1
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2)).then(code => {
    process.exitCode = code
  })
}
