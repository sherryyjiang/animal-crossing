# LLM Adapter Interface and Config

## Goals
- Keep model/provider swappable via config.
- Avoid hard-coding API keys; prefer env-var references.

## Adapter Interface (Draft)
```ts
export interface LlmAdapter {
  generateReply(input: LlmChatInput): Promise<LlmChatResult>;
  extractFacts(input: LlmFactInput): Promise<LlmFactResult>;
  summarizeDay(input: LlmSummaryInput): Promise<LlmSummaryResult>;
}
```

## Config Shape (Draft)
```ts
export interface LlmConfig {
  provider: "cerebras" | "openai-compatible";
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  temperature: number;
  maxCompletionTokens: number;
}
```

## Notes
- `apiKeyEnv` points to an environment variable name so switching models is an env-var flip.
- For browser-only dev, allow a local override stored in IndexedDB (explicitly dev-only).

