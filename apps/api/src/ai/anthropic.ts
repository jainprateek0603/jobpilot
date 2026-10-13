import type { Config } from '../config.js'
import { AppError } from '../lib/errors.js'
import type { AICompleteInput, AIProvider } from './types.js'

type AnthropicResponse = {
  content?: { type: string; text?: string }[]
  error?: { message?: string }
}

export function createAnthropicProvider(config: Config, fetchFn: typeof fetch = fetch): AIProvider {
  return {
    name: 'anthropic',
    async complete(input: AICompleteInput) {
      if (!config.ANTHROPIC_API_KEY) {
        throw new AppError(503, 'AI_UNAVAILABLE', 'Set ANTHROPIC_API_KEY to use this provider')
      }
      const response = await fetchFn('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.ANTHROPIC_MODEL,
          max_tokens: input.maxTokens ?? 1800,
          temperature: input.temperature ?? 0.4,
          system: input.system,
          messages: [{ role: 'user', content: input.user }],
        }),
      })
      const payload = (await response.json()) as AnthropicResponse
      if (!response.ok) throw new AppError(502, 'AI_PROVIDER', payload.error?.message || 'The AI provider returned an error')
      const text = payload.content?.filter((block) => block.type === 'text').map((block) => block.text ?? '').join('\n').trim()
      if (!text) throw new AppError(502, 'AI_PROVIDER', 'The AI provider returned an empty response')
      return text
    },
  }
}
