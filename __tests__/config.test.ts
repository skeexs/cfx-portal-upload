import { parseRunConfig } from '../src/config'

describe('parseRunConfig', () => {
  it('fails when chunkSize is not a number', () => {
    expect(() =>
      parseRunConfig({
        cookie: 'cookie',
        chunkSize: 'invalid'
      })
    ).toThrow('Invalid chunk size. Must be a number.')
  })

  it('applies defaults for new optional inputs', () => {
    const config = parseRunConfig({
      cookie: 'cookie',
      makeZip: 'false',
      workspacePath: 'C:/repo'
    })

    expect(config.authMode).toBe('auto')
    expect(config.requestTimeoutMs).toBe(30000)
    expect(config.retryPolicy.baseDelayMs).toBe(500)
    expect(config.retryPolicy.maxDelayMs).toBe(5000)
    expect(config.zipExclude).toEqual([])
  })

  it('sets assetName from workspace basename when makeZip is enabled', () => {
    const config = parseRunConfig({
      cookie: 'cookie',
      makeZip: 'true',
      assetId: '123',
      workspacePath: 'C:/repo/my-resource'
    })

    expect(config.assetName).toBe('my-resource')
    expect(config.assetId).toBe('123')
  })
})
