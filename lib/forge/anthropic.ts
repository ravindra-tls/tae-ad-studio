/**
 * Anthropic Messages API wrapper for Concept Forge, rebuilt on
 * `@anthropic-ai/sdk` (the SDK's built-in retries honor retry-after).
 *
 * Keeps Concept Forge's original `callClaude` signature so the ported
 * engine modules change minimally:
 *   - `system` accepts a plain string OR an array of text blocks with
 *     `cache_control: { type: 'ephemeral' }` (prompt caching).
 *   - Forced structured output via tools + toolChoice.
 *   - Temperature is STRIPPED centrally for `claude-opus-*` models
 *     (Opus rejects the temperature param).
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolChoice,
} from '@anthropic-ai/sdk/resources/messages';

export type { Message, MessageParam, TextBlockParam, Tool, ToolChoice };

export interface CallClaudeOptions {
  model: string;
  system?: string | TextBlockParam[];
  messages: MessageParam[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  maxTokens?: number;
  temperature?: number;
}

export class ApiKeyMissingError extends Error {
  code = 'NO_API_KEY';
  constructor() {
    super('ANTHROPIC_API_KEY is not set. Add it to the environment before using Concept Forge.');
    this.name = 'ApiKeyMissingError';
  }
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.trim()) throw new ApiKeyMissingError();
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

/** Call the Messages API. Returns the parsed SDK Message. */
export async function callClaude({
  model,
  system,
  messages,
  tools,
  toolChoice,
  maxTokens = 2048,
  temperature,
}: CallClaudeOptions): Promise<Message> {
  const client = getClient();

  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (system) params.system = system;
  if (tools) params.tools = tools;
  if (toolChoice) params.tool_choice = toolChoice;
  // Opus rejects the temperature param — strip it centrally.
  if (temperature !== undefined && !model.startsWith('claude-opus')) {
    params.temperature = temperature;
  }

  return client.messages.create(params);
}

/** Pull the input object from a forced tool_use response. */
export function extractToolInput<T = Record<string, unknown>>(
  response: Message,
  toolName?: string,
): T {
  const blocks = response?.content ?? [];
  const block = blocks.find(
    (b) => b.type === 'tool_use' && (!toolName || b.name === toolName),
  );
  if (!block || block.type !== 'tool_use') {
    const textBlock = blocks.find((b) => b.type === 'text');
    throw new Error(
      `Model did not return the expected tool output${
        textBlock && textBlock.type === 'text' ? `: ${truncate(textBlock.text, 300)}` : '.'
      }`,
    );
  }
  return block.input as T;
}

/** Concatenated plain text from a response (for non-tool calls). */
export function extractText(response: Message): string {
  return (response?.content ?? [])
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
