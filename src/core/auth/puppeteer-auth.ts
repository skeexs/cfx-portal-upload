import puppeteer, { Browser, Page } from 'puppeteer'
import { Urls, SSOResponseBody } from '../../types'
import { ActionError } from '../errors'
import { Logger } from '../logger'
import { AuthInput, AuthProvider, AuthSession } from './types'
import { preparePuppeteer } from './prepare-puppeteer'

function getSsoUrl(): string {
  return `${Urls.API}${Urls.SSO}`
}

async function getRedirectUrl(
  page: Page,
  maxRetries: number,
  logger: Logger
): Promise<string> {
  let loaded = false
  let attempt = 0
  let redirectUrl: string | null = null

  while (!loaded && attempt < maxRetries) {
    try {
      logger.info('Navigating to SSO URL ...')

      await page.goto(getSsoUrl(), {
        waitUntil: 'networkidle0'
      })

      logger.info('Navigated to SSO URL. Parsing response body ...')

      const responseBody = await page.evaluate(
        () => JSON.parse(document.body.innerText) as SSOResponseBody
      )

      logger.debug('Parsed response body.')
      redirectUrl = responseBody.url

      const forumUrl = new URL(redirectUrl).origin
      logger.info('Redirected to Forum Origin ...')
      await page.goto(forumUrl)

      loaded = true
    } catch {
      logger.warn('Failed to navigate to SSO URL. Retrying in 1 second...')
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempt++
    }
  }

  if (!loaded || redirectUrl === null) {
    throw new ActionError(
      'auth',
      `Failed to navigate to SSO URL after ${maxRetries} attempts.`,
      false,
      'Verify cfx endpoints are reachable and try again later.'
    )
  }

  return redirectUrl
}

async function setForumCookie(
  browser: Browser,
  page: Page,
  cookie: string,
  logger: Logger
): Promise<void> {
  logger.info('Setting forum cookie in browser context ...')

  await browser.setCookie({
    name: '_t',
    value: cookie,
    domain: 'forum.cfx.re',
    path: '/',
    expires: -1,
    size: 1,
    httpOnly: true,
    secure: true,
    session: false
  })

  await page.evaluate(() => document.write('Cookie' + document.cookie))
  logger.info('Cookie set. Following portal redirect ...')
}

export class PuppeteerAuthProvider implements AuthProvider {
  constructor(
    private readonly logger: Logger,
    private readonly maxRetries: number
  ) {}

  async getSession(input: AuthInput): Promise<AuthSession> {
    await preparePuppeteer(this.logger)

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()

    try {
      const redirectUrl = await getRedirectUrl(
        page,
        this.maxRetries,
        this.logger
      )
      await setForumCookie(browser, page, input.cookie, this.logger)

      await page.goto(redirectUrl, {
        waitUntil: 'networkidle0'
      })

      if (!page.url().includes('portal.cfx.re')) {
        throw new ActionError(
          'auth',
          'Redirect failed. Make sure the provided cookie is valid.',
          false,
          'Use a fresh _t cookie from forum.cfx.re.'
        )
      }

      const cookies = await browser.cookies()
      const cookieHeader = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ')

      return {
        cookieHeader,
        source: 'browser'
      }
    } finally {
      await browser.close()
    }
  }
}
