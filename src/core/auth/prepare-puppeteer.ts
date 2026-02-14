import { Browser, getInstalledBrowsers, install } from '@puppeteer/browsers'
import { homedir } from 'os'
import { join } from 'path'
import { Logger } from '../logger'

function getCacheDirectory(): string {
  return join(homedir(), '.cache', 'puppeteer')
}

export async function preparePuppeteer(logger: Logger): Promise<void> {
  if (process.env.RUNNER_TEMP === undefined) {
    logger.debug('Running locally, skipping Puppeteer setup.')
    return
  }

  const cacheDirectory = getCacheDirectory()
  const installed = await getInstalledBrowsers({
    cacheDir: cacheDirectory
  })

  if (!installed.some(browser => browser.browser === Browser.CHROME)) {
    logger.info('Installing Chrome for Puppeteer...')
    await install({
      cacheDir: cacheDirectory,
      browser: Browser.CHROME,
      buildId: '131.0.6778.108'
    })
  }
}
