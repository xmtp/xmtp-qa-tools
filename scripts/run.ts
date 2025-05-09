import { execSync } from "child_process";
import path from "path";

const type = process.argv[2]; // 'bot' or 'script'
const name = process.argv[3];
const additionalArgs = process.argv.slice(4).join(" ");

// Check for required arguments
if (!type || !name) {
  console.error("Usage: yarn run <type> <name> [args]");
  console.error("Examples:");
  console.error("  yarn run bot gm-bot");
  console.error("  yarn run bot stress 5");
  console.error("  yarn run script generate-keys");
  process.exit(1);
}

// Validate type argument
if (type !== "bot" && type !== "script") {
  console.error('Type must be either "bot" or "script"');
  process.exit(1);
}

try {
  if (type === "bot") {
    // For bots, use --watch flag and support additional arguments
    const filePath = path.join("bots", name, "index.ts");
    console.log(
      `Starting bot: ${name}${additionalArgs ? ` with args: ${additionalArgs}` : ""}`,
    );
    execSync(`tsx --watch ${filePath} ${additionalArgs}`, {
      stdio: "inherit",
    });
  } else {
    // For scripts, run without --watch flag
    const filePath = path.join("scripts", `${name}.ts`);
    console.log(`Running script: ${name}`);
    execSync(`tsx ${filePath} ${additionalArgs}`, {
      stdio: "inherit",
    });
  }
} catch (error) {
  console.error(`Failed to run ${type} "${name}":`, error);
  console.error(
    `Error: ${type === "bot" ? "Bot" : "Script"} "${name}" not found or failed to start`,
  );
  process.exit(1);
}
