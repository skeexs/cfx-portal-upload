import fs from 'fs'
import path from 'path'
import yazl from 'yazl'
import { Logger } from './logger'

export const DEFAULT_ZIP_EXCLUDES = [
  '.git/**',
  '.github/**',
  '.vscode/**',
  'node_modules/**'
]

export interface CreateZipOptions {
  workspacePath: string
  assetName: string
  extraExcludes?: string[]
  outputZipPath?: string
  logger: Logger
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/')
}

function matchPattern(relativePath: string, pattern: string): boolean {
  const normalizedPath = normalizePath(relativePath)
  const normalizedPattern = normalizePath(pattern).trim()

  if (normalizedPattern.endsWith('/**')) {
    const prefix = normalizedPattern.slice(0, -3)
    return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  }

  return (
    normalizedPath === normalizedPattern ||
    normalizedPath.startsWith(`${normalizedPattern}/`)
  )
}

export function shouldExcludePath(
  relativePath: string,
  excludes: string[]
): boolean {
  return excludes.some(pattern => matchPattern(relativePath, pattern))
}

export async function createZip(options: CreateZipOptions): Promise<string> {
  const excludes = [...DEFAULT_ZIP_EXCLUDES, ...(options.extraExcludes ?? [])]
  const outputZipPath =
    options.outputZipPath ?? path.resolve(`${options.assetName}.zip`)
  const zipfile = new yazl.ZipFile()

  function addDirectory(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      const relativePath = path.relative(options.workspacePath, fullPath)
      const normalizedRelativePath = normalizePath(relativePath)

      if (shouldExcludePath(normalizedRelativePath, excludes)) {
        options.logger.debug(
          `Skipping excluded path: ${normalizedRelativePath}`
        )
        continue
      }

      if (entry.isDirectory()) {
        addDirectory(fullPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const zipPath = path.posix.join(options.assetName, normalizedRelativePath)
      options.logger.debug(`Adding file to zip: ${zipPath}`)
      zipfile.addFile(fullPath, zipPath, { compress: true })
    }
  }

  addDirectory(options.workspacePath)
  zipfile.end()

  return await new Promise((resolve, reject) => {
    const outputStream = fs.createWriteStream(outputZipPath)

    zipfile.outputStream
      .pipe(outputStream)
      .on('close', () => resolve(path.resolve(outputZipPath)))
      .on('error', reject)
  })
}
