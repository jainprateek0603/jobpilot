import type { Config } from '../config.js'
import { AppError } from '../lib/errors.js'
import type { AICompleteInput, AIProvider } from './types.js'

type ChatResponse = {
  choices?: { message?: { content?: string | null } }[]
  error?: { message?: string }
}

export function createOpenAIProvider(config: Config, fetchFn: typeof fetch = fetch): AIProvider {
  return {
    name: 'openai',
    async complete(input: AICompleteInput) {
      if (!config.OPENAI_API_KEY) throw new AppError(503, 'AI_UNAVAILABLE', 'Set OPENAI_API_KEY to use this provider')
      const response = await fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.OPENAI_MODEL,
          temperature: input.temperature ?? 0.4,
          max_tokens: input.maxTokens ?? 1800,
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
        }),
      })
      const payload = (await response.json()) as ChatResponse
      if (!response.ok) throw new AppError(502, 'AI_PROVIDER', payload.error?.message || 'The AI provider returned an error')
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new AppError(502, 'AI_PROVIDER', 'The AI provider returned an empty response')
      return content
    },
  }
}
