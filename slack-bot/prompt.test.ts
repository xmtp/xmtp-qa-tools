import { describe, expect, it } from "vitest";
import { askClaude, readIssuesData, SYSTEM_PROMPT } from "./helper";

describe("Claude Issues Analyzer", () => {
  it("should answer: Which tests fail most often?", async () => {
    const rawData = readIssuesData();

    if (!rawData) {
      console.log("No issues.json found, skipping test");
      return;
    }

    const response = await askClaude("Which tests fail most often?", rawData);

    console.log("=== WHICH TESTS FAIL MOST OFTEN? ===");
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
    console.log(response);
    console.log("\n");

    expect(response.length).toBeGreaterThan(50);
  });
});
