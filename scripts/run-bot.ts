import { execSync } from "child_process";

const botName = process.argv[2];

if (!botName) {
  console.error("Please provide a bot name");
  console.log("Usage: yarn bot <botname>");
  process.exit(1);
}

try {
  execSync(`tsx --watch bots/${botName}/index.ts`, { stdio: "inherit" });
} catch (error) {
  console.error(`Error: Bot "${botName}" not found or failed to start`);
  process.exit(1);
}
