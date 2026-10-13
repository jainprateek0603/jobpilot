export type AICompleteInput = {
  system: string
  user: string
  temperature?: number
  maxTokens?: number
}

export interface AIProvider {
  readonly name: string
  complete(input: AICompleteInput): Promise<string>
}
