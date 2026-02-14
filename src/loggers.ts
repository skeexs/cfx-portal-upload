import * as core from '@actions/core'
import { Logger } from './core/logger'

export function createActionLogger(): Logger {
  return {
    info: message => core.info(message),
    debug: message => core.debug(message),
    warn: message => core.warning(message),
    error: message => core.error(message)
  }
}

export function createConsoleLogger(debugEnabled = false): Logger {
  return {
    info: message => console.log(message),
    debug: message => {
      if (debugEnabled) {
        console.debug(message)
      }
    },
    warn: message => console.warn(message),
    error: message => console.error(message)
  }
}
