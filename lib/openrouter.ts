const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "stealth/ox-alpha";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Abort the request after this many ms. */
  timeoutMs?: number;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Calls OpenRouter's OpenAI-compatible chat completions endpoint and returns
 * the assistant's message content. Throws on non-2xx responses.
 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing in environment.");
  }

  const { model = DEFAULT_MODEL, temperature = 0.4, maxTokens, timeoutMs = 30_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Optional attribution headers recommended by OpenRouter.
        "HTTP-Referer": "https://wppro.au",
        "X-Title": "WP Pro Email Sender",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenRouter request failed (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenRouter returned an empty response.");
    }

    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience helper: single system + user prompt, returns trimmed text. */
export function prompt(system: string, user: string, options?: ChatOptions)
: Promise<string> {
  return chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    options
  );
}
