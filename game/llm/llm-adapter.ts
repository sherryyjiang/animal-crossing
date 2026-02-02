import debug from "debug";
import { z } from "zod";
import { getResolvedLlmConfig } from "./llm-config";
import type {
  LlmAdapter,
  LlmChatInput,
  LlmChatResult,
  LlmConfig,
  LlmDayKickoffInput,
  LlmDayKickoffResult,
  LlmDaySuggestion,
  LlmFactInput,
  LlmFactResult,
  LlmMessage,
  LlmPlayerInsight,
  LlmPlayerInsightInput,
  LlmPlayerInsightResult,
  LlmSummaryInput,
  LlmSummaryResult,
} from "./llm-types";

const log = debug("ralph:llm-adapter");

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }).optional(),
        text: z.string().min(1).optional(),
      })
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const factsSchema = z.array(z.string().min(1)).max(12);

const playerInsightSchema = z.object({
  text: z.string().min(1),
  category: z.enum([
    "preference",
    "goal",
    "value",
    "habit",
    "interest",
    "style",
  ]),
});

const playerInsightsSchema = z.object({
  insights: z.array(playerInsightSchema).max(6),
});

const daySuggestionSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
});

const daySuggestionsSchema = z.object({
  suggestions: z.array(daySuggestionSchema).max(6),
});

export const llmAdapter: LlmAdapter = {
  async generateReply(input) {
    const { config, apiKey } = await getResolvedLlmConfig();
    return requestReply(config, apiKey, input);
  },
  async extractFacts(input) {
    const { config, apiKey } = await getResolvedLlmConfig();
    return requestFacts(config, apiKey, input);
  },
  async summarizeDay(input) {
    const { config, apiKey } = await getResolvedLlmConfig();
    return requestSummary(config, apiKey, input);
  },
  async analyzePlayer(input) {
    const { config, apiKey } = await getResolvedLlmConfig();
    return requestPlayerInsights(config, apiKey, input);
  },
  async suggestNextDay(input) {
    const { config, apiKey } = await getResolvedLlmConfig();
    return requestDayKickoff(config, apiKey, input);
  },
};

async function requestReply(
  config: LlmConfig,
  apiKey: string,
  input: LlmChatInput
): Promise<LlmChatResult> {
  const messages = buildChatMessages(input.systemPrompt, input.messages);
  return requestChatCompletion(config, apiKey, {
    messages,
    temperature: input.temperature ?? config.temperature,
    maxTokens: input.maxTokens ?? config.maxCompletionTokens,
  });
}

async function requestFacts(
  config: LlmConfig,
  apiKey: string,
  input: LlmFactInput
): Promise<LlmFactResult> {
  const systemPrompt = [
    "You extract memory facts from a conversation with the player.",
    "Return a JSON array of short, specific facts.",
    "Only include information the player said or implied.",
    `Max facts: ${input.maxFacts ?? 4}.`,
    "Do not include any extra text outside JSON.",
  ].join("\n");

  const messages = buildChatMessages(systemPrompt, [
    {
      role: "user",
      content: formatConversation(input.conversation, input.npcName, input.npcRole),
    },
  ]);

  const response = await requestChatCompletion(config, apiKey, {
    messages,
    temperature: 0.2,
    maxTokens: Math.min(config.maxCompletionTokens, 240),
  });

  const parsedFacts = parseJsonArray(response.text);
  const validated = factsSchema.safeParse(parsedFacts);
  if (!validated.success) {
    log("Invalid fact response %o", validated.error.format());
    return { facts: [], raw: response.raw };
  }

  return { facts: validated.data.slice(0, input.maxFacts ?? 4), raw: response.raw };
}

async function requestSummary(
  config: LlmConfig,
  apiKey: string,
  input: LlmSummaryInput
): Promise<LlmSummaryResult> {
  const systemPrompt = [
    "You summarize the day for a cozy village sim.",
    "Write a warm, concise summary of the day's highlights.",
    `Day index: ${input.dayIndex}.`,
    `Max paragraphs: ${input.maxParagraphs ?? 2}.`,
  ].join("\n");

  const messages = buildChatMessages(systemPrompt, [
    { role: "user", content: formatConversation(input.conversation) },
  ]);

  const response = await requestChatCompletion(config, apiKey, {
    messages,
    temperature: 0.4,
    maxTokens: Math.min(config.maxCompletionTokens, 320),
  });

  return { summary: response.text.trim(), raw: response.raw };
}

async function requestPlayerInsights(
  config: LlmConfig,
  apiKey: string,
  input: LlmPlayerInsightInput
): Promise<LlmPlayerInsightResult> {
  const systemPrompt = [
    "You analyze the player's interactions in a cozy village sim.",
    "Extract 2-4 concise insights about the player.",
    "Use only what the player said or implied.",
    "Categories: preference, goal, value, habit, interest, style.",
    "Return JSON only with shape: {\"insights\":[{\"text\":\"...\",\"category\":\"preference\"}]}",
    "If unsure, return an empty insights array.",
  ].join("\n");

  const messages = buildChatMessages(systemPrompt, [
    {
      role: "user",
      content: formatConversation(input.conversation),
    },
  ]);

  const response = await requestChatCompletion(config, apiKey, {
    messages,
    temperature: 0.2,
    maxTokens: Math.min(config.maxCompletionTokens, 280),
  });

  const parsed = parseJsonObject(response.text);
  const validated = parsed ? playerInsightsSchema.safeParse(parsed) : null;
  if (!validated || !validated.success) {
    log("Invalid player insights response %o", validated?.error?.format?.() ?? parsed);
    return { insights: [], raw: response.raw };
  }

  return {
    insights: validated.data.insights.slice(0, input.maxInsights ?? 4),
    raw: response.raw,
  };
}

async function requestDayKickoff(
  config: LlmConfig,
  apiKey: string,
  input: LlmDayKickoffInput
): Promise<LlmDayKickoffResult> {
  const systemPrompt = [
    "You are a cozy village guide.",
    "Suggest 3-5 next-day activities based on yesterday's summary and player insights.",
    "Keep each suggestion warm, concrete, and short.",
    "Return JSON only with shape: {\"suggestions\":[{\"title\":\"...\",\"detail\":\"...\"}]}",
  ].join("\n");

  const insightLines = (input.playerInsights ?? []).map(
    (insight) => `- (${insight.category}) ${insight.text}`
  );

  const userPrompt = [
    `Day index: ${input.dayIndex}.`,
    `Yesterday summary: ${input.previousSummary || "No summary available."}`,
    insightLines.length > 0 ? `Player insights:\n${insightLines.join("\n")}` : "Player insights: none.",
  ].join("\n");

  const messages = buildChatMessages(systemPrompt, [{ role: "user", content: userPrompt }]);

  const response = await requestChatCompletion(config, apiKey, {
    messages,
    temperature: 0.4,
    maxTokens: Math.min(config.maxCompletionTokens, 260),
  });

  const parsed = parseJsonObject(response.text);
  const validated = parsed ? daySuggestionsSchema.safeParse(parsed) : null;
  if (!validated || !validated.success) {
    log("Invalid day kickoff response %o", validated?.error?.format?.() ?? parsed);
    return { suggestions: [], raw: response.raw };
  }

  return {
    suggestions: validated.data.suggestions.slice(0, input.maxSuggestions ?? 5),
    raw: response.raw,
  };
}

async function requestChatCompletion(
  config: LlmConfig,
  apiKey: string,
  input: {
    messages: LlmMessage[];
    temperature: number;
    maxTokens: number;
  }
): Promise<LlmChatResult> {
  const url = buildChatCompletionUrl(config);
  const payload = {
    model: config.model,
    messages: input.messages,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
  };

  let responseText = "";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    responseText = await response.text();
    const parsedJson = parseJson(responseText);

    if (!response.ok) {
      log("LLM request failed %o", {
        status: response.status,
        statusText: response.statusText,
        request: payload,
        response: parsedJson ?? responseText,
      });
      throw new Error(`LLM request failed (${response.status})`);
    }

    if (!parsedJson) {
      log("LLM response not JSON %o", { request: payload, response: responseText });
      throw new Error("LLM response missing JSON");
    }

    const parsed = chatResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      log("LLM response schema mismatch %o", parsed.error.format());
      throw new Error("LLM response invalid");
    }

    const choice = parsed.data.choices[0];
    const text = choice.message?.content?.trim() ?? choice.text?.trim() ?? "";
    if (!text) {
      log("LLM response missing content %o", parsedJson);
      throw new Error("LLM response missing content");
    }

    return {
      text,
      usage: parsed.data.usage
        ? {
            promptTokens: parsed.data.usage.prompt_tokens,
            completionTokens: parsed.data.usage.completion_tokens,
            totalTokens: parsed.data.usage.total_tokens,
          }
        : undefined,
      raw: parsedJson,
    };
  } catch (error) {
    log("LLM request error %o", { error, responseText, model: config.model });
    throw error;
  }
}

function buildChatMessages(systemPrompt: string, messages: LlmMessage[]) {
  return [{ role: "system" as const, content: systemPrompt }, ...messages];
}

function formatConversation(messages: LlmMessage[], npcName?: string, npcRole?: string) {
  const header = npcName ? `${npcName} (${npcRole ?? "npc"}) conversation:` : "Conversation:";
  const lines = messages.map((message) => `${message.role}: ${message.content}`);
  return [header, ...lines].join("\n");
}

function parseJsonArray(text: string) {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  return parseJson(cleaned.slice(start, end + 1)) ?? [];
}

function parseJsonObject(text: string) {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return parseJson(cleaned.slice(start, end + 1));
}

function stripCodeFences(text: string) {
  return text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function buildChatCompletionUrl(config: LlmConfig) {
  const normalized = config.baseUrl.replace(/\/$/, "");
  const base = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  return `${base}/chat/completions`;
}
