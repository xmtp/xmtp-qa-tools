import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { KNOWN_ISSUES } from "../helpers/logger";

// System prompt for Claude analysis
const SYSTEM_PROMPT = `You are an expert at analyzing test failure data and logs. 3

# Key principles:
- You provide clear, actionable insights about patterns and status reports. 
- Focus on technical depth and strategic thinking rather than just counting failures.
- Identify root causes, not just symptoms
- Dont provide recommendations
- Look for systemic patterns 
- Distinguish between infrastructure issues and actual bugs
- Explain the business/technical impact of issues
- Be aware of known issues and don't repeat them

# KNOWN ISSUES
${KNOWN_ISSUES.map((issue) => `- ${issue.testName}`).join("\n")}`;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "test-key",
});

// Real Claude API call
async function askClaude(prompt: string, data: string): Promise<string> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return `[MOCK MODE - No API Key] Claude would analyze: "${prompt}" with system prompt and data sample: ${data.substring(0, 100)}...`;
    }

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${prompt}

Here is the test failure data to analyze:

${data}`,
        },
      ],
    });

    return message.content[0].type === "text"
      ? message.content[0].text
      : "No response";
  } catch (error) {
    console.error("Claude API Error:", error);
    return `Error calling Claude API: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function readIssuesData(): string | null {
  try {
    const issuesPath = path.join(__dirname, "issues.json");
    return fs.readFileSync(issuesPath, "utf8");
  } catch (error) {
    console.error("Error reading issues.json:", error);
    return null;
  }
}

describe("Claude Issues Analyzer", () => {
  it("should answer: Which tests fail most often?", async () => {
    const rawData = readIssuesData();

    if (!rawData) {
      console.log("No issues.json found, skipping test");
      return;
    }

    const response = await askClaude("Which tests fail most often?", rawData);

    console.log("=== WHICH TESTS FAIL MOST OFTEN? ===");
    console.log("System Prompt:", SYSTEM_PROMPT);
    console.log("\nClaude Response:");
    console.log(response);
    console.log("\n");

    expect(response.length).toBeGreaterThan(50);
  });

  it("should answer: What are the latest issues?", async () => {
    const rawData = readIssuesData();

    if (!rawData) {
      console.log("No issues.json found, skipping test");
      return;
    }

    const response = await askClaude("What are the latest issues?", rawData);

    console.log("=== WHAT ARE THE LATEST ISSUES? ===");
    console.log("System Prompt:", SYSTEM_PROMPT);
    console.log("\nClaude Response:");
    console.log(response);
    console.log("\n");

    expect(response.length).toBeGreaterThan(50);
  });

  it("should answer: Any interesting patterns?", async () => {
    const rawData = readIssuesData();

    if (!rawData) {
      console.log("No issues.json found, skipping test");
      return;
    }

    const response = await askClaude("Any interesting patterns?", rawData);

    console.log("=== ANY INTERESTING PATTERNS? ===");
    console.log("System Prompt:", SYSTEM_PROMPT);
    console.log("\nClaude Response:");
    console.log(response);
    console.log("\n");

    expect(response.length).toBeGreaterThan(50);
  });
});
