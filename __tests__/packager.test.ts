import fs from 'fs'
import os from 'os'
import path from 'path'
import { createZip, shouldExcludePath } from '../src/core/packager'
import { Logger } from '../src/core/logger'

const logger: Logger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

function createTempWorkspace(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cfx-packager-'))
  fs.mkdirSync(path.join(workspace, '.git'))
  fs.mkdirSync(path.join(workspace, 'src'))
  fs.writeFileSync(path.join(workspace, '.git', 'config'), 'git-config')
  fs.writeFileSync(path.join(workspace, 'src', 'index.ts'), 'console.log("x")')
  return workspace
}

describe('packager', () => {
  it('creates zip without mutating workspace files', async () => {
    const workspace = createTempWorkspace()
    const output = path.join(workspace, 'artifact.zip')

    const zipPath = await createZip({
      workspacePath: workspace,
      assetName: 'my-asset',
      outputZipPath: output,
      logger
    })

    expect(zipPath).toBe(output)
    expect(fs.existsSync(path.join(workspace, '.git', 'config'))).toBe(true)
    expect(fs.existsSync(path.join(workspace, 'src', 'index.ts'))).toBe(true)
    expect(fs.existsSync(output)).toBe(true)
  })

  it('matches default and custom exclude patterns', () => {
    expect(shouldExcludePath('.git/config', ['.git/**'])).toBe(true)
    expect(
      shouldExcludePath('node_modules/pkg/index.js', ['node_modules/**'])
    ).toBe(true)
    expect(shouldExcludePath('src/index.ts', ['.git/**'])).toBe(false)
    expect(shouldExcludePath('secret/file.txt', ['secret/**'])).toBe(true)
  })
})
