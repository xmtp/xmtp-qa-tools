import type { DecodedMessage } from "@xmtp/node-sdk";
import OpenAI from "openai";
import { personalities } from "./tests";

/**
 * OpenAI service class for generating AI responses
 */
export class OpenAIService {
  private openai: OpenAI | null = null;
  private readonly model = "gpt-4.1-mini";

  /**
   * Initialize the OpenAI client
   * @returns Whether initialization was successful
   */
  private initialize(): boolean {
    if (!process.env.OPENAI_API_KEY) {
      return false;
    }

    if (!this.openai) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    return true;
  }

  async analyzeErrorLogs(errorLogs: string): Promise<string> {
    if (!this.initialize()) {
      console.log("OpenAI API key not found. Skipping error analysis.");
      return "";
    }

    try {
      console.log(`Analyzing error logs with ${this.model}...`);

      if (!this.openai) {
        return "";
      }

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a an assistant that analyzes error logs from XMTP tests. Provide a concise, very short summary of what went wrong. Please be specific and technical. Don't propose solutions.
              
              # Example:
              [2025-05-06T22:57:34.207Z] [[32minfo[39m] Failed to find response containing any of [commands]
              [2025-05-06T22:57:34.246Z] [[31merror[39m] [vitest] Test failed in TS_Agents > key-check dev expected false to be true // Object.is equality
              [2025-05-06T22:58:22.929Z] [[32minfo[39m] Failed to find response containing any of [commands]
              [2025-05-06T22:58:22.961Z] [[31merror[39m] [vitest] Test failed in TS_Agents > key-check dev expected false to be true // Object.is equality
              ecause \`key-check\` agent failed to respond in the expected time.

              # Wrong Example:
              The tests failed because the expected true responses for health checks and commands were not received; the respective agents did not respond as expected.
              Why:
              - The \`key-check\` agent failed to respond in the expected time.
              - The \`gm-bot\` agent failed to respond in the expected time.

              # Good Example:
              The test failed because \`key-check\` agent failed to respond in the expected time.
              The test failed because \`gm-bot\` agent failed to respond in the expected time.
              `,
          },
          {
            role: "user",
            content: `Analyze these error logs from an XMTP test:\n\n${errorLogs}`,
          },
        ],
        max_tokens: 500,
      });

      const analysisContent = completion.choices[0]?.message?.content;
      return analysisContent ? `\n\n*AI Analysis:*\n${analysisContent}` : "";
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error analyzing logs with GPT:", errorMessage);
      return "";
    }
  }

  /**
   * Generate a response to a user message
   * @param message The user message
   * @param history Message history
   * @param workerName Name of the worker
   * @returns Generated response
   */
  async generateResponse(
    message: string,
    history: DecodedMessage[],
    workerName: string,
  ): Promise<string> {
    if (!this.initialize()) {
      console.warn(
        "OPENAI_API_KEY is not set in environment variables. GPT workers may not function properly.",
      );
      return `${workerName}: Sorry, I'm not able to generate a response right now.`;
    }

    console.log(`[${workerName}] Generating response for message: ${message}`);

    // Find matching personality or use a default
    const personality =
      personalities.find((p) => p.name === workerName)?.personality ||
      "You are a helpful assistant with a friendly personality.";

    // Prepare recent message history (last 10 messages)
    const recentHistory =
      history
        ?.slice(-10)
        .map((m) => m.content as string)
        .join("\n") || "";

    const systemPrompt = `You are ${workerName}.
                     Keep your responses concise (under 100 words) and friendly. 
                     Never mention other workers in your responses. Never answer more than 1 question per response.

                     Personality: 
                     ${personality}
                     
                     For context, these were the last messages in the conversation: 
                     ${recentHistory}`;

    try {
      if (!this.openai) {
        return `${workerName}: Sorry, I'm not able to generate a response right now.`;
      }

      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: message },
        ],
        model: this.model,
      });

      const responseContent =
        completion.choices[0]?.message?.content ||
        "I'm not sure how to respond to that.";
      return `${workerName}:\n${responseContent}`;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[${workerName}] OpenAI API error:`, errorMessage);
      return `${workerName}: Sorry, I couldn't process that request right now.`;
    }
  }
}

// Create a singleton instance of the OpenAI service
const openAIService = new OpenAIService();

// Backward compatibility functions
export async function analyzeErrorLogsWithGPT(
  errorLogs: string,
): Promise<string> {
  return openAIService.analyzeErrorLogs(errorLogs);
}

export async function generateOpenAIResponse(
  message: string,
  history: DecodedMessage[],
  workerName: string,
): Promise<string> {
  return openAIService.generateResponse(message, history, workerName);
}
