import { execSync } from "child_process";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { select } from "@clack/prompts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add a flag to prevent multiple executions
let isRunning = false;

const examplesDir = path.resolve(__dirname, "../examples");
const examples = fs.readdirSync(examplesDir).filter((file) => {
  return (
    fs.statSync(path.join(examplesDir, file)).isDirectory() &&
    file !== "replit" &&
    file !== "railway"
  );
});

async function runSelectedExample() {
  // Prevent multiple executions
  if (isRunning) {
    console.log("Development server is already running.");
    return;
  }

  // Get example from command line argument if provided
  const directExample = process.argv[2];

  let selectedExample;
  if (directExample && examples.includes(directExample)) {
    selectedExample = directExample;
  } else {
    selectedExample = await select({
      message: "Select a example to run:",
      options: examples.map((example) => ({
        value: example,
        label: example,
      })),
    });
  }

  if (typeof selectedExample === "symbol" || !selectedExample) {
    console.log("No example selected. Exiting.");
    return;
  }

  const examplePath = path.resolve(__dirname, `../examples/${selectedExample}`);

  try {
    isRunning = true;
    console.log(`Running example for ${selectedExample}...`);
    execSync(`cd ${examplePath} && yarn dev`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error(`Error running example for ${selectedExample}:`, error);
  } finally {
    isRunning = false;
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${__filename}`) {
  runSelectedExample();
}
