import type { Config } from '../config.js'
import { createAnthropicProvider } from './anthropic.js'
import { MockProvider } from './mock.js'
import { createOpenAIProvider } from './openai.js'
import type { AIProvider } from './types.js'

export function createProvider(config: Config, fetchFn?: typeof fetch): AIProvider {
  if (config.AI_PROVIDER === 'openai') return createOpenAIProvider(config, fetchFn)
  if (config.AI_PROVIDER === 'anthropic') return createAnthropicProvider(config, fetchFn)
  return new MockProvider()
}
