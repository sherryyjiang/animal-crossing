export type LlmProvider = "cerebras" | "openai-compatible";

export interface LlmConfig {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  temperature: number;
  maxCompletionTokens: number;
}

export interface LlmConfigOverrides {
  provider?: LlmProvider;
  baseUrl?: string;
  model?: string;
  apiKeyEnv?: string;
  apiKeyOverride?: string;
  temperature?: number;
  maxCompletionTokens?: number;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmChatInput {
  systemPrompt: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LlmChatResult {
  text: string;
  usage?: LlmUsage;
  raw: unknown;
}

export interface LlmFactInput {
  npcName: string;
  npcRole: string;
  conversation: LlmMessage[];
  maxFacts?: number;
}

export interface LlmFactResult {
  facts: string[];
  raw: unknown;
}

export interface LlmSummaryInput {
  dayIndex: number;
  conversation: LlmMessage[];
  maxParagraphs?: number;
}

export interface LlmSummaryResult {
  summary: string;
  raw: unknown;
}

export type PlayerInsightCategory =
  | "preference"
  | "goal"
  | "value"
  | "habit"
  | "interest"
  | "style";

export interface LlmPlayerInsight {
  text: string;
  category: PlayerInsightCategory;
}

export interface LlmPlayerInsightInput {
  dayIndex: number;
  conversation: LlmMessage[];
  maxInsights?: number;
}

export interface LlmPlayerInsightResult {
  insights: LlmPlayerInsight[];
  raw: unknown;
}

export interface LlmDaySuggestion {
  title: string;
  detail: string;
}

export interface LlmDayKickoffInput {
  dayIndex: number;
  previousSummary: string;
  playerInsights?: LlmPlayerInsight[];
  maxSuggestions?: number;
}

export interface LlmDayKickoffResult {
  suggestions: LlmDaySuggestion[];
  raw: unknown;
}

export interface LlmAdapter {
  generateReply: (input: LlmChatInput) => Promise<LlmChatResult>;
  extractFacts: (input: LlmFactInput) => Promise<LlmFactResult>;
  summarizeDay: (input: LlmSummaryInput) => Promise<LlmSummaryResult>;
  analyzePlayer: (input: LlmPlayerInsightInput) => Promise<LlmPlayerInsightResult>;
  suggestNextDay: (input: LlmDayKickoffInput) => Promise<LlmDayKickoffResult>;
}
